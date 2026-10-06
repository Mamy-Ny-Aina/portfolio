import type { Env } from '../../env';
import type { ChatMessage } from '../../../src/shared/types';

export type ProviderId = 'claude' | 'gemini' | 'workers-ai';

type ProviderStream = (env: Env, system: string, messages: ChatMessage[], maxTokens: number) => AsyncGenerator<string>;

/** Modèles Workers AI essayés dans l'ordre (gratuits dans la limite de 10 000 neurones/jour). */
const WORKERS_AI_MODELS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
];

export function providerAvailability(env: Env): Record<ProviderId, boolean> {
  return { claude: Boolean(env.ANTHROPIC_API_KEY), gemini: Boolean(env.GEMINI_API_KEY), 'workers-ai': Boolean(env.AI) };
}

/** Ordre d'essai des fournisseurs : celui choisi dans AI_PROVIDER d'abord, puis les autres disponibles. */
export function providerChain(env: Env): ProviderId[] {
  const preference = (env.AI_PROVIDER || 'auto').toLowerCase();
  if (preference === 'local' || preference === 'none') return [];
  const base: ProviderId[] = ['claude', 'gemini', 'workers-ai'];
  const order = base.includes(preference as ProviderId)
    ? [preference as ProviderId, ...base.filter((p) => p !== preference)]
    : base;
  const available = providerAvailability(env);
  return order.filter((p) => available[p]);
}

/** Lit un flux Server-Sent Events et renvoie le contenu de chaque ligne « data: ». */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
    }
    if (buffer.startsWith('data:')) yield buffer.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

// --- Claude (Anthropic) ----------------------------------------------------------------------

const claudeStream: ProviderStream = async function* (env, system, messages, maxTokens) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  const model = env.CLAUDE_MODEL || 'claude-opus-5-5';
  const isHaiku = model.includes('haiku');
  const supportsDefaultFallback = /opus-5|fable-5|sonnet-5-5/.test(model);

  const stream = client.beta.messages.stream({
    model,
    // La réflexion (thinking) compte dans max_tokens : on laisse de la marge au-delà de la réponse visible.
    max_tokens: maxTokens + 3000,
    ...(isHaiku ? {} : { output_config: { effort: 'low' as const } }),
    // Si une demande est refusée par les filtres de sécurité, l'API la relance sur le modèle de repli recommandé.
    ...(supportsDefaultFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  let produced = false;
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
      produced = true;
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (!produced) throw new Error(`claude: aucune réponse (stop_reason=${final.stop_reason})`);
};

// --- Gemini (Google AI Studio, offre gratuite) -----------------------------------------------

const geminiStream: ProviderStream = async function* (env, system, messages, maxTokens) {
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens + 2000, temperature: 0.6 },
      }),
    },
  );
  if (!res.ok || !res.body) throw new Error(`gemini: HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  for await (const data of sseData(res.body)) {
    if (!data || data === '[DONE]') continue;
    const json = JSON.parse(data) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    for (const part of json.candidates?.[0]?.content?.parts ?? []) {
      if (part.text && !part.thought) yield part.text;
    }
  }
};

// --- Workers AI (Cloudflare, gratuit, sans clé) -----------------------------------------------

type AiRunner = { run(model: string, inputs: Record<string, unknown>): Promise<unknown> };

const workersAiStream: ProviderStream = async function* (env, system, messages, maxTokens) {
  if (!env.AI) throw new Error('workers-ai: binding AI absent');
  const ai = env.AI as unknown as AiRunner;
  const models = [...new Set([env.WORKERS_AI_MODEL, ...WORKERS_AI_MODELS].filter((m): m is string => Boolean(m)))];
  let lastError: unknown = null;

  for (const model of models) {
    let produced = false;
    try {
      const inputs: Record<string, unknown> = {
        messages: [{ role: 'system', content: system }, ...messages],
        stream: true,
        temperature: 0.6,
      };
      if (/gemma-4|gpt-oss|qwen3/.test(model)) inputs.max_completion_tokens = maxTokens;
      else inputs.max_tokens = maxTokens;

      const result = await ai.run(model, inputs);
      if (!(result instanceof ReadableStream)) throw new Error('réponse non diffusée');
      for await (const data of sseData(result as ReadableStream<Uint8Array>)) {
        if (!data || data === '[DONE]') continue;
        const json = JSON.parse(data) as { response?: string; choices?: { delta?: { content?: string | null } }[] };
        const text = json.response ?? json.choices?.[0]?.delta?.content ?? '';
        if (text) {
          produced = true;
          yield text;
        }
      }
      if (produced) return;
      lastError = new Error(`${model}: réponse vide`);
    } catch (err) {
      if (produced) throw err;
      lastError = err;
      console.warn(`[ai] workers-ai ${model} indisponible`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError ?? new Error('workers-ai: aucun modèle disponible');
};

const PROVIDERS: Record<ProviderId, ProviderStream> = {
  claude: claudeStream,
  gemini: geminiStream,
  'workers-ai': workersAiStream,
};

/**
 * Fait répondre le premier fournisseur disponible et transmet le texte au fil de l'eau.
 * Si un fournisseur échoue avant d'avoir produit du texte, on passe au suivant.
 */
export async function runChat(
  env: Env,
  system: string,
  messages: ChatMessage[],
  onText: (text: string) => void | Promise<void>,
  maxTokens = 900,
): Promise<ProviderId> {
  const chain = providerChain(env);
  let lastError: unknown = new Error('Aucun fournisseur d’IA configuré');
  for (const id of chain) {
    let started = false;
    try {
      for await (const chunk of PROVIDERS[id](env, system, messages, maxTokens)) {
        if (!chunk) continue;
        started = true;
        await onText(chunk);
      }
      if (started) return id;
      lastError = new Error(`${id}: réponse vide`);
    } catch (err) {
      if (started) throw err;
      lastError = err;
      console.warn(`[ai] ${id} a échoué`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError;
}

/** Version non diffusée (traductions de l'admin). */
export async function completeText(env: Env, system: string, messages: ChatMessage[], maxTokens = 1500) {
  let text = '';
  const provider = await runChat(env, system, messages, (t) => {
    text += t;
  }, maxTokens);
  return { text, provider };
}
