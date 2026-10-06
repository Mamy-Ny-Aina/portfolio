import type { Env } from '../env';
import type { SiteContent } from '../../src/shared/types';
import { defaultContent } from '../../src/shared/defaultContent';
import { mergeContent } from '../../src/shared/utils';

const CONTENT_KEY = 'content';
const HISTORY_LIMIT = 30;
const CACHE_MS = 4000;

let cache: { at: number; value: { content: SiteContent; updatedAt: number | null } } | null = null;

export async function loadContent(env: Env): Promise<{ content: SiteContent; updatedAt: number | null }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: { content: SiteContent; updatedAt: number | null } = { content: defaultContent, updatedAt: null };
  try {
    const row = await env.DB.prepare('SELECT value, updated_at FROM kv_store WHERE key = ?')
      .bind(CONTENT_KEY)
      .first<{ value: string; updated_at: number }>();
    if (row) value = { content: mergeContent(defaultContent, JSON.parse(row.value)), updatedAt: row.updated_at };
  } catch (err) {
    console.error('[content] lecture impossible, contenu par défaut utilisé', err);
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Contenu exposé publiquement : les notes privées destinées à l'IA sont retirées. */
export function publicContent(content: SiteContent): SiteContent {
  return { ...content, guide: { ...content.guide, knowledge: { fr: '', en: '', mg: '' } } };
}

export async function saveContent(env: Env, input: unknown, note: string | null): Promise<SiteContent> {
  const content = mergeContent(defaultContent, input);
  const ts = Date.now();
  content.updatedAt = new Date(ts).toISOString();
  const json = JSON.stringify(content);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    ).bind(CONTENT_KEY, json, ts),
    env.DB.prepare('INSERT INTO content_history (content, note, created_at) VALUES (?, ?, ?)').bind(json, note, ts),
    env.DB.prepare(`DELETE FROM content_history WHERE id NOT IN (SELECT id FROM content_history ORDER BY id DESC LIMIT ${HISTORY_LIMIT})`),
  ]);
  cache = null;
  return content;
}

export function invalidateContentCache() {
  cache = null;
}
