import type { Context } from 'hono';
import type { AppEnv, Env } from '../env';

const encoder = new TextEncoder();

export function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

export async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await hmacKey(secret);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Comparaison à temps constant de deux chaînes (via HMAC pour égaliser les longueurs). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const key = await hmacKey('compare');
  const [ha, hb] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(a)),
    crypto.subtle.sign('HMAC', key, encoder.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}

/** Empreinte anonymisée de l'adresse IP (jamais stockée en clair). */
export async function ipHash(c: Context<AppEnv>): Promise<string> {
  const secret = c.env.SESSION_SECRET || 'portfolio';
  return (await sha256Hex(`${secret}|${clientIp(c)}`)).slice(0, 20);
}

export function cfInfo(c: Context<AppEnv>): { country: string | null; city: string | null; region: string | null; timezone: string | null } {
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    country: str(cf?.country),
    city: str(cf?.city),
    region: str(cf?.region),
    timezone: str(cf?.timezone),
  };
}

export const now = () => Date.now();

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(-90);
  return cleaned || 'fichier';
}

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

export function secret(env: Env): string {
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || 'portfolio-dev-secret';
}

export function originOk(c: Context<AppEnv>): boolean {
  const origin = c.req.header('origin');
  if (!origin) return true; // requêtes same-origin sans en-tête Origin (anciens navigateurs)
  try {
    return new URL(origin).host === new URL(c.req.url).host;
  } catch {
    return false;
  }
}
