import type { ChatRequest, ChatStreamEvent, SiteContent } from '../../shared/types';

export async function fetchContent(timeoutMs = 4000): Promise<SiteContent | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/content', { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: SiteContent };
    return data.content ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function sendContact(form: FormData): Promise<ContactResult> {
  try {
    const res = await fetch('/api/contact', { method: 'POST', body: form });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? `http_${res.status}` };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export type ChatResult = { provider: string } | { fallback: true };

/** Interroge le guide IA ; le texte arrive au fil de l'eau via `onDelta`. */
export async function streamChat(request: ChatRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<ChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/event-stream') || !res.body) return { fallback: true };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let provider = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let index: number;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5)) as ChatStreamEvent;
        if ('t' in event) onDelta(event.t);
        else if ('done' in event) provider = event.provider;
        else if ('error' in event) throw new Error(event.error);
      }
    }
  }
  return { provider: provider || 'unknown' };
}
