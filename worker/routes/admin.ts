import { Hono } from 'hono';
import type { AppEnv } from '../env';
import type {
  ChatSessionSummary,
  ContactMessage,
  ContentVersion,
  CountItem,
  LiveVisitor,
  MediaFile,
  SessionDetail,
  StatsResponse,
  StatsTotals,
  SystemStatus,
  VisitorSession,
} from '../../src/shared/types';
import { defaultContent } from '../../src/shared/defaultContent';
import { isLang } from '../../src/shared/utils';
import {
  endSession,
  isAdmin,
  isConfigured,
  loginAllowed,
  passwordSource,
  recordLogin,
  requireAdmin,
  setPassword,
  startSession,
  verifyPassword,
} from '../lib/auth';
import { loadContent, saveContent } from '../lib/content';
import { emailConfigured, emailFrom } from '../lib/email';
import { buildTranslatePrompt } from '../lib/ai/prompt';
import { completeText, providerAvailability, providerChain } from '../lib/ai/providers';
import { extensionOf, ipHash, originOk, randomToken, sanitizeFilename } from '../lib/util';

const admin = new Hono<AppEnv>();

const MAX_UPLOAD = 20 * 1024 * 1024;
const UPLOAD_EXT = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg', 'ico',
  'pdf', 'doc', 'docx', 'odt', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'zip',
  'mp4', 'webm', 'mp3', 'ogg', 'wav',
]);
const DAY = 24 * 3600 * 1000;

// --- Session ------------------------------------------------------------------------------

admin.get('/me', async (c) => c.json({ authenticated: await isAdmin(c), configured: await isConfigured(c.env) }));

admin.post('/login', async (c) => {
  if (!originOk(c)) return c.json({ error: 'bad_origin' }, 403);
  if (!(await isConfigured(c.env))) return c.json({ error: 'not_configured' }, 503);
  const ip = await ipHash(c);
  if (!(await loginAllowed(c.env, ip))) return c.json({ error: 'too_many_attempts' }, 429);
  const body = (await c.req.json().catch(() => ({}))) as { password?: unknown };
  const ok = typeof body.password === 'string' && body.password.length <= 200 && (await verifyPassword(c.env, body.password));
  await recordLogin(c.env, ip, ok);
  if (!ok) return c.json({ error: 'invalid_password' }, 401);
  await startSession(c);
  return c.json({ ok: true });
});

admin.post('/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

// Toutes les routes suivantes exigent une session admin valide.
admin.use('*', requireAdmin);

// --- Contenu ------------------------------------------------------------------------------

admin.get('/content', async (c) => {
  const { content, updatedAt } = await loadContent(c.env);
  return c.json({ content, updatedAt });
});

admin.put('/content', async (c) => {
  const raw = await c.req.text();
  if (raw.length > 1_500_000) return c.json({ error: 'too_large' }, 413);
  let body: { content?: unknown; note?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  if (!body.content || typeof body.content !== 'object' || !('profile' in body.content)) {
    return c.json({ error: 'invalid_content' }, 400);
  }
  const note = typeof body.note === 'string' ? body.note.slice(0, 120) : null;
  const saved = await saveContent(c.env, body.content, note);
  return c.json({ ok: true, content: saved, updatedAt: Date.parse(saved.updatedAt) });
});

admin.get('/content/history', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, note, created_at, length(content) AS size FROM content_history ORDER BY id DESC LIMIT 30',
  ).all<{ id: number; note: string | null; created_at: number; size: number }>();
  const versions: ContentVersion[] = results.map((r) => ({ id: r.id, note: r.note, createdAt: r.created_at, size: r.size }));
  return c.json({ versions });
});

admin.post('/content/restore/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT content FROM content_history WHERE id = ?').bind(Number(c.req.param('id'))).first<{ content: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  const saved = await saveContent(c.env, JSON.parse(row.content), `Restauration de la version #${c.req.param('id')}`);
  return c.json({ ok: true, content: saved });
});

admin.post('/content/reset', async (c) => {
  const saved = await saveContent(c.env, structuredClone(defaultContent), 'Réinitialisation au contenu du CV');
  return c.json({ ok: true, content: saved });
});

// --- Statistiques -------------------------------------------------------------------------

function rangeParams(c: { req: { query(name: string): string | undefined } }) {
  const days = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30));
  const tzMinutes = Math.max(-840, Math.min(840, Number(c.req.query('tz')) || 180));
  const to = Date.now();
  const from = to - days * DAY;
  return { days, from, to, prevFrom: from - days * DAY, tzSeconds: tzMinutes * 60 };
}

const totalsSql = `SELECT COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors, COALESCE(SUM(pageviews), 0) AS pageviews,
  COALESCE(AVG(duration), 0) AS avgDuration,
  COALESCE(SUM(CASE WHEN duration < 10 AND json_array_length(sections) <= 1 THEN 1 ELSE 0 END), 0) AS bounces,
  COALESCE(SUM(is_new), 0) AS newSessions, COALESCE(SUM(CASE WHEN chat_count > 0 THEN 1 ELSE 0 END), 0) AS chatSessions,
  COALESCE(SUM(contacted), 0) AS contacted, COALESCE(SUM(tour), 0) AS tours
  FROM sessions WHERE started_at >= ?1 AND started_at < ?2`;

type TotalsRow = Omit<StatsTotals, 'bounceRate' | 'chatMessages' | 'messages'> & { bounces: number };

function toTotals(row: TotalsRow | undefined, chatMessages: number, messages: number): StatsTotals {
  const r = row ?? { sessions: 0, visitors: 0, pageviews: 0, avgDuration: 0, bounces: 0, newSessions: 0, chatSessions: 0, contacted: 0, tours: 0 };
  return {
    sessions: r.sessions,
    visitors: r.visitors,
    pageviews: r.pageviews,
    avgDuration: Math.round(r.avgDuration),
    bounceRate: r.sessions ? r.bounces / r.sessions : 0,
    newSessions: r.newSessions,
    chatSessions: r.chatSessions,
    contacted: r.contacted,
    tours: r.tours,
    chatMessages,
    messages,
  };
}

function groupSql(column: string, limit = 10) {
  return `SELECT COALESCE(${column}, '—') AS k, COUNT(DISTINCT visitor_id) AS n FROM sessions
    WHERE started_at >= ?1 AND started_at < ?2 GROUP BY k ORDER BY n DESC LIMIT ${limit}`;
}

admin.get('/stats', async (c) => {
  const { days, from, to, prevFrom, tzSeconds } = rangeParams(c);
  const db = c.env.DB;
  const liveSince = Date.now() - 60 * 1000;

  const [totals, previous, daily, countries, cities, devices, browsers, os, referrers, langs, sections, events, hours, live, chatNow, chatPrev, msgNow, msgPrev, unread] =
    await db.batch([
      db.prepare(totalsSql).bind(from, to),
      db.prepare(totalsSql).bind(prevFrom, from),
      db
        .prepare(
          `SELECT strftime('%Y-%m-%d', started_at / 1000 + ?3, 'unixepoch') AS d, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors
           FROM sessions WHERE started_at >= ?1 AND started_at < ?2 GROUP BY d ORDER BY d`,
        )
        .bind(from, to, tzSeconds),
      db.prepare(groupSql('country', 12)).bind(from, to),
      db
        .prepare(
          `SELECT city AS k, country AS c, COUNT(DISTINCT visitor_id) AS n FROM sessions
           WHERE started_at >= ?1 AND started_at < ?2 AND city IS NOT NULL GROUP BY city, country ORDER BY n DESC LIMIT 10`,
        )
        .bind(from, to),
      db.prepare(groupSql('device')).bind(from, to),
      db.prepare(groupSql('browser')).bind(from, to),
      db.prepare(groupSql('os')).bind(from, to),
      db.prepare(groupSql("COALESCE(referrer_host, 'direct')", 12)).bind(from, to),
      db.prepare(groupSql('lang')).bind(from, to),
      db
        .prepare(
          `SELECT j.value AS k, COUNT(*) AS n FROM sessions s, json_each(s.sections) j
           WHERE s.started_at >= ?1 AND s.started_at < ?2 GROUP BY j.value`,
        )
        .bind(from, to),
      db.prepare('SELECT name AS k, COUNT(*) AS n FROM events WHERE ts >= ?1 AND ts < ?2 GROUP BY name ORDER BY n DESC LIMIT 25').bind(from, to),
      db
        .prepare(
          `SELECT CAST(strftime('%H', started_at / 1000 + ?3, 'unixepoch') AS INTEGER) AS h, COUNT(*) AS n
           FROM sessions WHERE started_at >= ?1 AND started_at < ?2 GROUP BY h`,
        )
        .bind(from, to, tzSeconds),
      db
        .prepare(
          `SELECT id, country, city, device, browser, current_section AS section, last_seen AS lastSeen, started_at AS startedAt
           FROM sessions WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 20`,
        )
        .bind(liveSince),
      db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'user' AND created_at >= ?1 AND created_at < ?2").bind(from, to),
      db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'user' AND created_at >= ?1 AND created_at < ?2").bind(prevFrom, from),
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?1 AND created_at < ?2').bind(from, to),
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?1 AND created_at < ?2').bind(prevFrom, from),
      db.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0'),
    ]);

  const n = (r: D1Result) => (r.results[0] as { n: number } | undefined)?.n ?? 0;
  const hourly = new Array<number>(24).fill(0);
  for (const row of hours.results as { h: number; n: number }[]) hourly[row.h] = row.n;

  const response: StatsResponse = {
    range: { from, to, days },
    totals: toTotals(totals.results[0] as TotalsRow, n(chatNow), n(msgNow)),
    previous: toTotals(previous.results[0] as TotalsRow, n(chatPrev), n(msgPrev)),
    daily: daily.results as StatsResponse['daily'],
    countries: countries.results as CountItem[],
    cities: cities.results as CountItem[],
    devices: devices.results as CountItem[],
    browsers: browsers.results as CountItem[],
    os: os.results as CountItem[],
    referrers: referrers.results as CountItem[],
    langs: langs.results as CountItem[],
    sections: sections.results as CountItem[],
    events: events.results as CountItem[],
    hours: hourly,
    live: live.results as unknown as LiveVisitor[],
    unreadMessages: n(unread),
  };
  return c.json(response);
});

admin.get('/live', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, country, city, device, browser, current_section AS section, last_seen AS lastSeen, started_at AS startedAt
     FROM sessions WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 20`,
  )
    .bind(Date.now() - 60 * 1000)
    .all<LiveVisitor>();
  return c.json({ live: results });
});

// --- Visiteurs ----------------------------------------------------------------------------

interface SessionRow {
  id: string;
  visitor_id: string;
  started_at: number;
  last_seen: number;
  duration: number;
  pageviews: number;
  country: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  lang: string | null;
  screen: string | null;
  sections: string;
  current_section: string | null;
  chat_count: number;
  contacted: number;
  tour: number;
  is_new: number;
}

function mapSession(r: SessionRow): VisitorSession {
  let sections: string[] = [];
  try {
    sections = JSON.parse(r.sections || '[]');
  } catch {
    /* ignore */
  }
  return {
    id: r.id,
    visitorId: r.visitor_id,
    startedAt: r.started_at,
    lastSeen: r.last_seen,
    duration: r.duration,
    pageviews: r.pageviews,
    country: r.country,
    city: r.city,
    region: r.region,
    device: r.device,
    browser: r.browser,
    os: r.os,
    referrer: r.referrer,
    referrerHost: r.referrer_host,
    utmSource: r.utm_source,
    lang: r.lang,
    screen: r.screen,
    sections,
    currentSection: r.current_section,
    chatCount: r.chat_count,
    contacted: r.contacted === 1,
    tour: r.tour === 1,
    isNew: r.is_new === 1,
  };
}

admin.get('/visitors', async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
  const before = Number(c.req.query('before')) || Date.now() + 1;
  const filter = c.req.query('filter');
  const extra = filter === 'chat' ? 'AND chat_count > 0' : filter === 'contact' ? 'AND contacted = 1' : filter === 'tour' ? 'AND tour = 1' : '';
  const { results } = await c.env.DB.prepare(`SELECT * FROM sessions WHERE started_at < ? ${extra} ORDER BY started_at DESC LIMIT ?`)
    .bind(before, limit)
    .all<SessionRow>();
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>();
  return c.json({ sessions: results.map(mapSession), total: total?.n ?? 0, hasMore: results.length === limit });
});

admin.get('/visitors/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const [session, events, chat] = await db.batch([
    db.prepare('SELECT * FROM sessions WHERE id = ?').bind(id),
    db.prepare('SELECT type, name, ts FROM events WHERE session_id = ? ORDER BY ts').bind(id),
    db.prepare('SELECT role, content, created_at AS createdAt, provider FROM chat_messages WHERE session_id = ? ORDER BY id').bind(id),
  ]);
  const row = session.results[0] as SessionRow | undefined;
  if (!row) return c.json({ error: 'not_found' }, 404);
  const detail: SessionDetail = {
    session: mapSession(row),
    events: events.results as SessionDetail['events'],
    chat: chat.results as SessionDetail['chat'],
  };
  return c.json(detail);
});

admin.delete('/visitors', async (c) => {
  const olderThanDays = Number(c.req.query('olderThanDays'));
  const db = c.env.DB;
  if (olderThanDays > 0) {
    const cutoff = Date.now() - olderThanDays * DAY;
    await db.batch([db.prepare('DELETE FROM sessions WHERE started_at < ?').bind(cutoff), db.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff)]);
  } else {
    await db.batch([db.prepare('DELETE FROM sessions'), db.prepare('DELETE FROM events')]);
  }
  return c.json({ ok: true });
});

// --- Messages -----------------------------------------------------------------------------

interface MessageRow {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  lang: string | null;
  file_key: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  session_id: string | null;
  country: string | null;
  email_status: string | null;
  is_read: number;
  created_at: number;
}

const mapMessage = (r: MessageRow): ContactMessage => ({
  id: r.id,
  name: r.name,
  email: r.email,
  subject: r.subject,
  body: r.body,
  lang: r.lang,
  fileKey: r.file_key,
  fileName: r.file_name,
  fileSize: r.file_size,
  fileType: r.file_type,
  sessionId: r.session_id,
  country: r.country,
  emailStatus: r.email_status,
  isRead: r.is_read === 1,
  createdAt: r.created_at,
});

admin.get('/messages', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200').all<MessageRow>();
  return c.json({ messages: results.map(mapMessage) });
});

admin.patch('/messages/:id', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { read?: boolean };
  await c.env.DB.prepare('UPDATE messages SET is_read = ? WHERE id = ?').bind(body.read === false ? 0 : 1, Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

admin.delete('/messages/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT file_key FROM messages WHERE id = ?').bind(id).first<{ file_key: string | null }>();
  if (row?.file_key) {
    await c.env.FILES.delete(row.file_key);
    await c.env.DB.prepare('DELETE FROM files WHERE key = ?').bind(row.file_key).run();
  }
  await c.env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// --- Conversations avec le guide IA -------------------------------------------------------

admin.get('/chats', async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 40));
  const { results } = await c.env.DB.prepare(
    `SELECT m.session_id AS sessionId, MIN(m.created_at) AS startedAt, MAX(m.created_at) AS lastAt,
            SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS count, MAX(m.lang) AS lang,
            (SELECT content FROM chat_messages f WHERE f.session_id = m.session_id AND f.role = 'user' ORDER BY f.id LIMIT 1) AS firstQuestion,
            s.country AS country, s.city AS city
     FROM chat_messages m LEFT JOIN sessions s ON s.id = m.session_id
     WHERE m.session_id IS NOT NULL
     GROUP BY m.session_id ORDER BY lastAt DESC LIMIT ?`,
  )
    .bind(limit)
    .all<ChatSessionSummary>();
  const total = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'user'").first<{ n: number }>();
  return c.json({ chats: results, totalQuestions: total?.n ?? 0 });
});

admin.get('/chats/:sid', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT role, content, created_at AS createdAt, provider FROM chat_messages WHERE session_id = ? ORDER BY id',
  )
    .bind(c.req.param('sid'))
    .all();
  return c.json({ messages: results });
});

admin.delete('/chats/:sid', async (c) => {
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE session_id = ?').bind(c.req.param('sid')).run();
  return c.json({ ok: true });
});

// --- Médias -------------------------------------------------------------------------------

admin.get('/files', async (c) => {
  const scope = c.req.query('scope') === 'attachment' ? 'attachment' : 'media';
  const { results } = await c.env.DB.prepare('SELECT key, name, type, size, scope, created_at FROM files WHERE scope = ? ORDER BY created_at DESC')
    .bind(scope)
    .all<{ key: string; name: string; type: string; size: number; scope: string; created_at: number }>();
  const files: MediaFile[] = results.map((r) => ({
    key: r.key,
    url: `/api/files/${r.key}`,
    name: r.name,
    type: r.type,
    size: r.size,
    scope: r.scope,
    createdAt: r.created_at,
  }));
  return c.json({ files });
});

/** Téléversement brut (le fichier est le corps de la requête) : rapide et sans analyse multipart. */
admin.put('/upload', async (c) => {
  const name = sanitizeFilename(c.req.query('name') || 'fichier');
  const ext = extensionOf(name);
  if (!UPLOAD_EXT.has(ext)) return c.json({ error: 'file_type' }, 400);
  const declared = Number(c.req.header('content-length') || 0);
  if (declared > MAX_UPLOAD) return c.json({ error: 'file_size' }, 413);
  const data = await c.req.arrayBuffer();
  if (!data.byteLength) return c.json({ error: 'empty' }, 400);
  if (data.byteLength > MAX_UPLOAD) return c.json({ error: 'file_size' }, 413);

  const type = (c.req.header('content-type') || 'application/octet-stream').split(';')[0].trim().slice(0, 100);
  const fixedKey = c.req.query('key');
  const key = fixedKey && /^m\/[A-Za-z0-9._-]{3,120}$/.test(fixedKey) ? fixedKey : `m/${Date.now().toString(36)}-${randomToken(5)}-${name}`;
  await c.env.FILES.put(key, data, { metadata: { name, type, size: data.byteLength } });
  const ts = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO files (key, name, type, size, scope, created_at) VALUES (?, ?, ?, ?, 'media', ?)
     ON CONFLICT(key) DO UPDATE SET name = excluded.name, type = excluded.type, size = excluded.size, created_at = excluded.created_at`,
  )
    .bind(key, name, type, data.byteLength, ts)
    .run();
  const file: MediaFile = { key, url: `/api/files/${key}`, name, type, size: data.byteLength, scope: 'media', createdAt: ts };
  return c.json({ file });
});

admin.delete('/files/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/admin\/files\//, ''));
  if (!/^(m|att)\//.test(key)) return c.json({ error: 'invalid_key' }, 400);
  await c.env.FILES.delete(key);
  await c.env.DB.prepare('DELETE FROM files WHERE key = ?').bind(key).run();
  return c.json({ ok: true });
});

// --- Traduction automatique (FR → EN / MG) --------------------------------------------------

admin.post('/translate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: unknown; from?: unknown; to?: unknown };
  const text = typeof body.text === 'string' ? body.text.slice(0, 6000) : '';
  if (!text.trim() || !isLang(body.from) || !isLang(body.to)) return c.json({ error: 'bad_request' }, 400);
  try {
    const { text: translated, provider } = await completeText(
      c.env,
      buildTranslatePrompt(body.from, body.to),
      [{ role: 'user', content: text }],
      Math.min(3000, Math.ceil(text.length / 2) + 200),
    );
    return c.json({ text: translated.trim().replace(/^["«]\s*|\s*["»]$/g, ''), provider });
  } catch (err) {
    console.error('[translate]', err);
    return c.json({ error: 'unavailable' }, 503);
  }
});

// --- Sécurité & état du système -----------------------------------------------------------

admin.post('/password', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
  if (typeof body.current !== 'string' || typeof body.next !== 'string') return c.json({ error: 'bad_request' }, 400);
  if (body.next.length < 10 || body.next.length > 200) return c.json({ error: 'weak_password' }, 400);
  if (!(await verifyPassword(c.env, body.current))) return c.json({ error: 'invalid_password' }, 401);
  await setPassword(c.env, body.next);
  await startSession(c); // l'ancienne session devient invalide : on en ouvre une nouvelle
  return c.json({ ok: true });
});

admin.get('/status', async (c) => {
  const db = c.env.DB;
  const [files, versions, content] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM files'),
    db.prepare('SELECT COUNT(*) AS n FROM content_history'),
    db.prepare("SELECT updated_at FROM kv_store WHERE key = 'content'"),
  ]);
  const f = files.results[0] as { n: number; bytes: number };
  const availability = providerAvailability(c.env);
  const chain = providerChain(c.env);
  const status: SystemStatus = {
    ai: {
      provider: chain[0] ?? 'local',
      chain,
      workersAi: availability['workers-ai'],
      claude: availability.claude,
      gemini: availability.gemini,
    },
    email: { configured: emailConfigured(c.env), to: c.env.CONTACT_TO_EMAIL ?? null, from: emailFrom(c.env) },
    admin: { passwordSource: await passwordSource(c.env) },
    storage: { files: f.n, bytes: f.bytes },
    content: {
      updatedAt: (content.results[0] as { updated_at: number } | undefined)?.updated_at
        ? new Date((content.results[0] as { updated_at: number }).updated_at).toISOString()
        : null,
      versions: (versions.results[0] as { n: number }).n,
    },
  };
  return c.json(status);
});

export default admin;
