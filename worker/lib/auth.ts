import type { Context, Next } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, Env } from '../env';
import { base64url, hmacSign, originOk, randomToken, safeEqual, secret, sha256Hex } from './util';

const COOKIE = 'nv_admin';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const PBKDF2_ITERATIONS = 20000;
const PASSWORD_KEY = 'admin_password';

interface StoredCredential {
  salt: string;
  hash: string;
  iterations: number;
}

async function storedCredential(env: Env): Promise<StoredCredential | null> {
  const row = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(PASSWORD_KEY).first<{ value: string }>();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as StoredCredential;
    return parsed.hash && parsed.salt ? parsed : null;
  } catch {
    return null;
  }
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
  return base64url(bits);
}

export async function passwordSource(env: Env): Promise<'database' | 'env' | 'none'> {
  if (await storedCredential(env)) return 'database';
  return env.ADMIN_PASSWORD ? 'env' : 'none';
}

/** Empreinte de l'identifiant courant : changer le mot de passe invalide toutes les sessions. */
async function credentialFingerprint(env: Env): Promise<string | null> {
  const stored = await storedCredential(env);
  if (stored) return `db:${stored.hash}`;
  if (env.ADMIN_PASSWORD) return `env:${await sha256Hex(env.ADMIN_PASSWORD)}`;
  return null;
}

export async function isConfigured(env: Env): Promise<boolean> {
  return (await credentialFingerprint(env)) !== null;
}

export async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const stored = await storedCredential(env);
  if (stored) return safeEqual(await pbkdf2(password, stored.salt, stored.iterations), stored.hash);
  if (env.ADMIN_PASSWORD) return safeEqual(password, env.ADMIN_PASSWORD);
  return false;
}

export async function setPassword(env: Env, password: string): Promise<void> {
  const salt = randomToken(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  const value = JSON.stringify({ salt, hash, iterations: PBKDF2_ITERATIONS } satisfies StoredCredential);
  await env.DB.prepare(
    'INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  )
    .bind(PASSWORD_KEY, value, Date.now())
    .run();
}

async function createSessionToken(env: Env): Promise<string> {
  const fingerprint = await credentialFingerprint(env);
  const payload = `${Date.now() + SESSION_TTL_MS}.${randomToken(12)}`;
  const signature = await hmacSign(`${secret(env)}|${fingerprint}`, payload);
  return `${payload}.${signature}`;
}

async function verifySessionToken(env: Env, token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const expires = Number(parts[0]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const fingerprint = await credentialFingerprint(env);
  if (!fingerprint) return false;
  const expected = await hmacSign(`${secret(env)}|${fingerprint}`, `${parts[0]}.${parts[1]}`);
  return safeEqual(expected, parts[2]);
}

export async function isAdmin(c: Context<AppEnv>): Promise<boolean> {
  const token = getCookie(c, COOKIE);
  if (!token) return false;
  try {
    return await verifySessionToken(c.env, token);
  } catch {
    return false;
  }
}

export async function startSession(c: Context<AppEnv>): Promise<void> {
  const token = await createSessionToken(c.env);
  setCookie(c, COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  if (!(await isAdmin(c))) return c.json({ error: 'unauthorized' }, 401);
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !originOk(c)) return c.json({ error: 'bad_origin' }, 403);
  await next();
}

// --- Limitation des tentatives de connexion -------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export async function loginAllowed(env: Env, ip: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash = ? AND ok = 0 AND ts > ?')
    .bind(ip, Date.now() - WINDOW_MS)
    .first<{ n: number }>();
  return (row?.n ?? 0) < MAX_FAILURES;
}

export async function recordLogin(env: Env, ip: string, ok: boolean): Promise<void> {
  const ts = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_attempts (ip_hash, ok, ts) VALUES (?, ?, ?)').bind(ip, ok ? 1 : 0, ts),
    env.DB.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(ts - 2 * 24 * 3600 * 1000),
  ]);
}
