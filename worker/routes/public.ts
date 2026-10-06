import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../env';
import type { ChatMessage, ChatRequest, TrackPayload } from '../../src/shared/types';
import { CONTENT_VERSION } from '../../src/shared/defaultContent';
import { isLang } from '../../src/shared/utils';
import { loadContent, publicContent } from '../lib/content';
import { isAdmin } from '../lib/auth';
import { isBot, parseUA, referrerHost } from '../lib/ua';
import { sendContactEmail } from '../lib/email';
import { buildSystemPrompt } from '../lib/ai/prompt';
import { runChat } from '../lib/ai/providers';
import {
  EMAIL_RE,
  ID_RE,
  cfInfo,
  cleanText,
  extensionOf,
  hmacSign,
  ipHash,
  randomToken,
  safeEqual,
  sanitizeFilename,
  secret,
} from '../lib/util';

const pub = new Hono<AppEnv>();

const MAX_ATTACHMENT = 5 * 1024 * 1024;
const ATTACHMENT_EXT = new Set(['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ppt', 'pptx', 'xls', 'xlsx', 'zip']);
const SECTION_RE = /^[a-z0-9-]{2,32}$/;
const EVENT_RE = /^[a-z0-9_:.-]{2,80}$/i;

pub.get('/health', (c) => c.json({ ok: true, time: Date.now() }));

// --- Contenu --------------------------------------------------------------------------------

pub.get('/content', async (c) => {
  const { content, updatedAt } = await loadContent(c.env);
  const etag = `"c${CONTENT_VERSION}-${updatedAt ?? 0}"`;
  if (c.req.header('if-none-match') === etag) {
    return c.body(null, 304, { ETag: etag, 'Cache-Control': 'no-cache' });
  }
  return c.json({ content: publicContent(content) }, 200, { ETag: etag, 'Cache-Control': 'no-cache' });
});

// --- Mesure d'audience ----------------------------------------------------------------------

// Limite simple par adresse (par instance) : protège le quota d'écritures gratuit de la base.
const trackHits = new Map<string, { minute: number; count: number }>();

function trackAllowed(ip: string): boolean {
  const minute = Math.floor(Date.now() / 60_000);
  const entry = trackHits.get(ip);
  if (!entry || entry.minute !== minute) {
    if (trackHits.size > 5000) trackHits.clear();
    trackHits.set(ip, { minute, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 40;
}

pub.post('/track', async (c) => {
  const ua = c.req.header('user-agent') ?? '';
  if (isBot(ua) || (await isAdmin(c))) return c.body(null, 204);
  if (!trackAllowed(await ipHash(c))) return c.body(null, 429);

  let body: TrackPayload;
  try {
    body = (await c.req.json()) as TrackPayload;
  } catch {
    return c.body(null, 400);
  }
  if (!body || typeof body !== 'object' || !ID_RE.test(String(body.sid ?? ''))) return c.body(null, 400);

  const db = c.env.DB;
  const ts = Date.now();

  switch (body.t) {
    case 'view': {
      if (!ID_RE.test(String(body.vid ?? ''))) return c.body(null, 400);
      const { device, browser, os } = parseUA(ua);
      const geo = cfInfo(c);
      const ref = cleanText(body.ref, 500);
      const host = new URL(c.req.url).hostname;
      await db
        .prepare(
          `INSERT INTO sessions (id, visitor_id, started_at, last_seen, country, city, region, timezone, device, browser, os,
             referrer, referrer_host, utm_source, utm_medium, utm_campaign, lang, screen, landing, is_new, ip_hash)
           VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
           ON CONFLICT(id) DO UPDATE SET pageviews = pageviews + 1, last_seen = excluded.last_seen`,
        )
        .bind(
          body.sid,
          body.vid,
          ts,
          geo.country,
          geo.city,
          geo.region,
          geo.timezone,
          device,
          browser,
          os,
          ref || null,
          referrerHost(ref, host),
          cleanText(body.utm?.source, 80) || null,
          cleanText(body.utm?.medium, 80) || null,
          cleanText(body.utm?.campaign, 80) || null,
          cleanText(body.lang, 8) || null,
          cleanText(body.screen, 20) || null,
          cleanText(body.path, 200) || '/',
          body.isNew ? 1 : 0,
          await ipHash(c),
        )
        .run();
      // Nettoyage occasionnel des données très anciennes.
      if (Math.random() < 0.01) {
        const old = ts - 400 * 24 * 3600 * 1000;
        c.executionCtx.waitUntil(
          db.batch([db.prepare('DELETE FROM events WHERE ts < ?').bind(old), db.prepare('DELETE FROM sessions WHERE last_seen < ?').bind(old)]),
        );
      }
      break;
    }
    case 'section': {
      const name = String(body.name ?? '');
      if (!SECTION_RE.test(name)) return c.body(null, 400);
      await db
        .prepare(
          `UPDATE sessions SET current_section = ?1, last_seen = ?2,
             sections = CASE WHEN EXISTS (SELECT 1 FROM json_each(sessions.sections) WHERE value = ?1)
                             THEN sections ELSE json_insert(sections, '$[#]', ?1) END
           WHERE id = ?3`,
        )
        .bind(name, ts, body.sid)
        .run();
      break;
    }
    case 'ping': {
      const dt = Math.max(0, Math.min(120, Math.round(Number(body.dt) || 0)));
      const section = typeof body.section === 'string' && SECTION_RE.test(body.section) ? body.section : null;
      await db
        .prepare('UPDATE sessions SET last_seen = ?1, duration = duration + ?2, current_section = COALESCE(?3, current_section) WHERE id = ?4')
        .bind(ts, dt, section, body.sid)
        .run();
      break;
    }
    case 'event': {
      const name = String(body.name ?? '');
      if (!EVENT_RE.test(name)) return c.body(null, 400);
      const statements = [db.prepare("INSERT INTO events (session_id, type, name, ts) VALUES (?, 'event', ?, ?)").bind(body.sid, name, ts)];
      if (name === 'tour_start') statements.push(db.prepare('UPDATE sessions SET tour = 1 WHERE id = ?').bind(body.sid));
      await db.batch(statements);
      break;
    }
    default:
      return c.body(null, 400);
  }
  return c.body(null, 204);
});

// --- Formulaire de contact ------------------------------------------------------------------

export async function signFileUrl(c: Context<AppEnv>, key: string, days = 30): Promise<string> {
  const exp = Date.now() + days * 24 * 3600 * 1000;
  const sig = await hmacSign(secret(c.env), `${key}|${exp}`);
  const origin = new URL(c.req.url).origin;
  return `${origin}/api/files/${key}?exp=${exp}&sig=${sig}`;
}

async function verifyFileSignature(c: Context<AppEnv>, key: string): Promise<boolean> {
  const exp = Number(c.req.query('exp'));
  const sig = c.req.query('sig');
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(await hmacSign(secret(c.env), `${key}|${exp}`), sig);
}

pub.post('/contact', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  const length = Number(c.req.header('content-length') ?? 0);
  if (length > MAX_ATTACHMENT + 512 * 1024) return c.json({ error: 'too_large' }, 413);

  const fields: Record<string, string> = {};
  let file: File | null = null;
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await c.req.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') fields[key] = value;
        else if (key === 'file' && value.size > 0) file = value;
      }
    } else {
      Object.assign(fields, await c.req.json());
    }
  } catch {
    return c.json({ error: 'bad_request' }, 400);
  }

  // Pièges à robots : champ caché rempli ou formulaire envoyé trop vite → on fait semblant d'accepter.
  if (fields.website || Number(fields.elapsed ?? 99999) < 2500) return c.json({ ok: true });

  const name = cleanText(fields.name, 100);
  const email = cleanText(fields.email, 200);
  const subject = cleanText(fields.subject, 200);
  const body = cleanText(fields.message, 5000);
  const lang = isLang(fields.lang) ? fields.lang : 'fr';
  const sid = ID_RE.test(fields.sid ?? '') ? fields.sid : null;

  if (!name) return c.json({ error: 'name' }, 400);
  if (!EMAIL_RE.test(email)) return c.json({ error: 'email' }, 400);
  if (body.length < 10) return c.json({ error: 'message' }, 400);

  const db = c.env.DB;
  const ip = await ipHash(c);
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM messages WHERE ip_hash = ? AND created_at > ?')
    .bind(ip, Date.now() - 3600 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return c.json({ error: 'rate_limited' }, 429);

  let attachment: { key: string; name: string; size: number; type: string } | null = null;
  if (file) {
    const fileName = sanitizeFilename(file.name);
    if (file.size > MAX_ATTACHMENT) return c.json({ error: 'file_size' }, 413);
    if (!ATTACHMENT_EXT.has(extensionOf(fileName))) return c.json({ error: 'file_type' }, 400);
    const key = `att/${Date.now().toString(36)}-${randomToken(6)}-${fileName}`;
    const type = file.type || 'application/octet-stream';
    await c.env.FILES.put(key, await file.arrayBuffer(), { metadata: { name: fileName, type, size: file.size } });
    attachment = { key, name: fileName, size: file.size, type };
  }

  const geo = cfInfo(c);
  const ts = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO messages (name, email, subject, body, lang, file_key, file_name, file_size, file_type, session_id, country, ip_hash, email_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(name, email, subject || null, body, lang, attachment?.key ?? null, attachment?.name ?? null, attachment?.size ?? null, attachment?.type ?? null, sid, geo.country, ip, ts),
  ];
  if (attachment) {
    statements.push(
      db.prepare("INSERT INTO files (key, name, type, size, scope, created_at) VALUES (?, ?, ?, ?, 'attachment', ?)").bind(attachment.key, attachment.name, attachment.type, attachment.size, ts),
    );
  }
  if (sid) statements.push(db.prepare('UPDATE sessions SET contacted = 1 WHERE id = ?').bind(sid));
  const results = await db.batch(statements);
  const messageId = results[0].meta.last_row_id;

  const origin = new URL(c.req.url).origin;
  const status = await sendContactEmail(c.env, {
    name,
    email,
    subject,
    body,
    lang,
    country: geo.country,
    city: geo.city,
    attachment: attachment ? { name: attachment.name, size: attachment.size, url: await signFileUrl(c, attachment.key) } : null,
    adminUrl: `${origin}/admin/#/messages`,
  });
  await db.prepare('UPDATE messages SET email_status = ? WHERE id = ?').bind(status, messageId).run();

  return c.json({ ok: true });
});

// --- Guide IA -------------------------------------------------------------------------------

const encoder = new TextEncoder();
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

pub.post('/chat', async (c) => {
  let payload: ChatRequest;
  try {
    payload = (await c.req.json()) as ChatRequest;
  } catch {
    return c.json({ error: 'bad_request' }, 400);
  }
  const lang = isLang(payload?.lang) ? payload.lang : 'fr';
  const history: ChatMessage[] = (Array.isArray(payload?.messages) ? payload.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  // L'historique doit commencer par un message du visiteur et finir par sa question.
  while (history.length && history[0].role !== 'user') history.shift();
  const question = history.at(-1);
  if (!question || question.role !== 'user' || !question.content.trim()) return c.json({ error: 'empty' }, 400);

  const sid = ID_RE.test(payload.sid ?? '') ? payload.sid! : null;
  const vid = ID_RE.test(payload.vid ?? '') ? payload.vid! : null;
  const ip = await ipHash(c);
  const db = c.env.DB;

  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE ip_hash = ? AND role = 'user' AND created_at > ?")
    .bind(ip, Date.now() - 3600 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 40) return c.json({ error: 'rate_limited', fallback: true }, 429);

  const { content } = await loadContent(c.env);
  if (!content.guide.enabled) return c.json({ error: 'disabled', fallback: true }, 503);
  const system = buildSystemPrompt(content, lang);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let answer = '';
  let resolveFirst!: (ok: boolean) => void;
  const firstChunk = new Promise<boolean>((resolve) => (resolveFirst = resolve));
  const timeout = setTimeout(() => resolveFirst(false), 25_000);

  const pump = (async () => {
    let provider = '';
    try {
      provider = await runChat(c.env, system, history, async (text) => {
        if (!answer) resolveFirst(true);
        answer += text;
        await writer.write(sse({ t: text }));
      });
      await writer.write(sse({ done: true, provider }));
    } catch (err) {
      console.error('[chat] échec', err instanceof Error ? err.message : err);
      if (answer) await writer.write(sse({ error: 'interrupted' })).catch(() => {});
    } finally {
      clearTimeout(timeout);
      resolveFirst(false);
      await writer.close().catch(() => {});
    }
    if (answer) {
      const ts = Date.now();
      const statements = [
        db.prepare('INSERT INTO chat_messages (session_id, visitor_id, role, content, lang, provider, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(sid, vid, 'user', question.content, lang, null, ip, ts),
        db.prepare('INSERT INTO chat_messages (session_id, visitor_id, role, content, lang, provider, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(sid, vid, 'assistant', answer.slice(0, 8000), lang, provider, ip, ts + 1),
      ];
      if (sid) statements.push(db.prepare('UPDATE sessions SET chat_count = chat_count + 1 WHERE id = ?').bind(sid));
      await db.batch(statements).catch((err) => console.error('[chat] journalisation impossible', err));
    }
  })();
  c.executionCtx.waitUntil(pump);

  if (!(await firstChunk)) {
    // Aucun fournisseur n'a répondu : le navigateur bascule sur son guide hors ligne.
    await writer.abort('timeout').catch(() => {});
    return c.json({ error: 'unavailable', fallback: true }, 503);
  }
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
});

// --- Fichiers -------------------------------------------------------------------------------

interface FileMeta {
  name?: string;
  type?: string;
  size?: number;
}

const INLINE_TYPES = /^(image\/(png|jpe?g|webp|gif|avif|svg\+xml)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav)|application\/pdf|text\/plain)$/;

pub.get('/files/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/files\//, ''));
  if (!/^(m|att)\/[A-Za-z0-9._ -]+$/.test(key)) return c.json({ error: 'not_found' }, 404);
  const isAttachment = key.startsWith('att/');
  if (isAttachment && !(await isAdmin(c)) && !(await verifyFileSignature(c, key))) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const range = c.req.header('range');
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': isAttachment ? 'private, no-store' : 'public, max-age=31536000, immutable',
  });

  const setMeta = (meta: FileMeta | null) => {
    const type = meta?.type || 'application/octet-stream';
    const name = meta?.name || key.split('/').pop() || 'fichier';
    headers.set('Content-Type', type);
    const disposition = INLINE_TYPES.test(type) && !c.req.query('download') ? 'inline' : 'attachment';
    headers.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
    if (type === 'image/svg+xml') headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  };

  if (range) {
    const { value, metadata } = await c.env.FILES.getWithMetadata<FileMeta>(key, { type: 'arrayBuffer' });
    if (!value) return c.json({ error: 'not_found' }, 404);
    setMeta(metadata);
    const total = value.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = 0;
    let end = total - 1;
    if (m) {
      if (m[1] === '' && m[2] !== '') {
        start = Math.max(0, total - Number(m[2]));
      } else {
        start = Number(m[1] || 0);
        if (m[2] !== '') end = Math.min(total - 1, Number(m[2]));
      }
    }
    if (!m || start > end || start >= total) {
      headers.set('Content-Range', `bytes */${total}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(value.slice(start, end + 1), { status: 206, headers });
  }

  const { value, metadata } = await c.env.FILES.getWithMetadata<FileMeta>(key, { type: 'stream' });
  if (!value) return c.json({ error: 'not_found' }, 404);
  setMeta(metadata);
  if (metadata?.size) headers.set('Content-Length', String(metadata.size));
  return new Response(value, { headers });
});

export default pub;
