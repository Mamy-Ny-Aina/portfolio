import type { Env } from '../env';
import { escapeHtml } from './util';

export interface OutgoingContact {
  name: string;
  email: string;
  subject: string;
  body: string;
  lang: string;
  country: string | null;
  city: string | null;
  attachment?: { name: string; size: number; url: string } | null;
  adminUrl: string;
}

export type EmailStatus = 'sent' | 'failed' | 'disabled';

export function emailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.CONTACT_TO_EMAIL);
}

export function emailFrom(env: Env): string {
  return env.RESEND_FROM || 'Portfolio <onboarding@resend.dev>';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** Envoie le message du formulaire de contact au propriétaire du portfolio via Resend. */
export async function sendContactEmail(env: Env, msg: OutgoingContact): Promise<EmailStatus> {
  if (!emailConfigured(env)) return 'disabled';

  const subjectLine = `Portfolio · ${msg.subject || 'Nouveau message'} — ${msg.name}`.slice(0, 180);
  const where = [msg.city, msg.country].filter(Boolean).join(', ');
  const paragraphs = escapeHtml(msg.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  const attachment = msg.attachment
    ? `<p style="margin:18px 0 0;padding:12px 14px;border:1px solid #e7e2da;border-radius:10px;background:#faf8f5">
         📎 <a href="${escapeHtml(msg.attachment.url)}" style="color:#e5491d;font-weight:600">${escapeHtml(msg.attachment.name)}</a>
         <span style="color:#8a857d">(${formatSize(msg.attachment.size)} · lien valable 30 jours)</span></p>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f3f0ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#151412">
  <div style="max-width:620px;margin:0 auto;padding:32px 20px">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e5491d;font-weight:700;margin-bottom:10px">Nouveau message · Portfolio</div>
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e7e2da">
      <h1 style="margin:0 0 6px;font-size:22px">${escapeHtml(msg.subject || 'Nouveau message')}</h1>
      <p style="margin:0 0 22px;color:#5c5852">De <strong>${escapeHtml(msg.name)}</strong> · <a href="mailto:${escapeHtml(msg.email)}" style="color:#e5491d">${escapeHtml(msg.email)}</a></p>
      ${paragraphs}
      ${attachment}
      <p style="margin:26px 0 0">
        <a href="mailto:${escapeHtml(msg.email)}?subject=${encodeURIComponent('Re: ' + (msg.subject || 'votre message'))}" style="display:inline-block;background:#151412;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600">Répondre</a>
        <a href="${escapeHtml(msg.adminUrl)}" style="display:inline-block;margin-left:8px;color:#151412;padding:12px 6px;font-weight:600">Ouvrir l’admin →</a>
      </p>
    </div>
    <p style="font-size:12px;color:#8a857d;margin:14px 4px 0">Langue du site : ${escapeHtml(msg.lang.toUpperCase())}${where ? ` · Localisation approximative : ${escapeHtml(where)}` : ''}</p>
  </div></body></html>`;

  const lines = ['Nouveau message depuis le portfolio', `De : ${msg.name} <${msg.email}>`];
  if (msg.subject) lines.push(`Sujet : ${msg.subject}`);
  lines.push('', msg.body, '');
  if (msg.attachment) lines.push(`Pièce jointe : ${msg.attachment.name} — ${msg.attachment.url}`);
  if (where) lines.push(`Localisation approximative : ${where}`);
  const text = lines.join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom(env),
        to: [env.CONTACT_TO_EMAIL],
        reply_to: msg.email,
        subject: subjectLine,
        html,
        text,
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend a refusé le message', res.status, await res.text());
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[email] échec réseau', err);
    return 'failed';
  }
}
