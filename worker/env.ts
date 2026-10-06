export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: KVNamespace;
  AI?: Ai;

  // Secrets (wrangler secret put …)
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;

  // Variables (wrangler.jsonc → vars)
  CONTACT_TO_EMAIL?: string;
  RESEND_FROM?: string;
  /** auto | claude | gemini | workers-ai | local */
  AI_PROVIDER?: string;
  CLAUDE_MODEL?: string;
  GEMINI_MODEL?: string;
  WORKERS_AI_MODEL?: string;
}

export type AppEnv = { Bindings: Env };
