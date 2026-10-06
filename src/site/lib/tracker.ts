import type { TrackPayload } from '../../shared/types';

// Mesure d'audience maison : identifiants aléatoires, aucune donnée personnelle, aucun cookie.

function randomId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function stored(storage: () => Storage, key: string): { id: string; created: boolean } {
  try {
    const existing = storage().getItem(key);
    if (existing) return { id: existing, created: false };
    const id = randomId();
    storage().setItem(key, id);
    return { id, created: true };
  } catch {
    return { id: randomId(), created: true };
  }
}

const visitor = stored(() => localStorage, 'nv_vid');
const session = stored(() => sessionStorage, 'nv_sid');

export const visitorId = visitor.id;
export const sessionId = session.id;

const seenSections = new Set<string>();
let currentSection: string | undefined;
let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
let pending = 0;

function send(payload: TrackPayload, beacon = false) {
  const body = JSON.stringify(payload);
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    /* la mesure d'audience ne doit jamais casser le site */
  }
}

function flushTime(beacon: boolean) {
  if (!visibleSince) return;
  const now = performance.now();
  pending += (now - visibleSince) / 1000;
  visibleSince = document.visibilityState === 'visible' ? now : 0;
  const dt = Math.round(pending);
  if (dt < 1) return;
  pending -= dt;
  send({ t: 'ping', sid: sessionId, dt, section: currentSection }, beacon);
}

export function startTracking(lang: string) {
  const params = new URLSearchParams(location.search);
  send({
    t: 'view',
    vid: visitorId,
    sid: sessionId,
    isNew: visitor.created,
    path: location.pathname + location.search,
    ref: document.referrer,
    lang,
    screen: `${window.screen.width}x${window.screen.height}`,
    utm: {
      source: params.get('utm_source') ?? undefined,
      medium: params.get('utm_medium') ?? undefined,
      campaign: params.get('utm_campaign') ?? undefined,
    },
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') flushTime(false);
  }, 30_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushTime(true);
    else visibleSince = performance.now();
  });
  window.addEventListener('pagehide', () => flushTime(true));
}

export function trackSection(name: string) {
  currentSection = name;
  if (seenSections.has(name)) return;
  seenSections.add(name);
  send({ t: 'section', sid: sessionId, name });
}

export function trackEvent(name: string) {
  send({ t: 'event', sid: sessionId, name: name.slice(0, 80) });
}
