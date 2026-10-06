import type { SectionId, SiteContent } from '../../shared/types';
import { SECTION_IDS } from '../../shared/types';

export type GuideAction =
  | { type: 'goto'; target: SectionId }
  | { type: 'project'; id: string }
  | { type: 'tour' }
  | { type: 'cv' }
  | { type: 'contact' };

const TAG_RE = /\[\[\s*(goto|project|tour|cv|contact)\s*(?::\s*([\w-]+))?\s*\]\]/gi;

/** Texte affichable pendant la diffusion : balises complètes retirées, balise en cours d'écriture masquée. */
export function visibleText(raw: string): string {
  return tidy(raw.replace(TAG_RE, '').replace(/\[\[[^\]]*\]?$/, '').replace(/\[$/, ''));
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]+([.,;:!?])(?=\s|$)/g, (_, p: string) => (p === '!' || p === '?' || p === ':' || p === ';' ? ` ${p}` : p))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** Extrait les actions demandées par l'IA et renvoie le texte nettoyé. */
export function extractActions(raw: string, content: SiteContent): { text: string; actions: GuideAction[] } {
  const actions: GuideAction[] = [];
  const visible = new Set(content.sections.filter((s) => s.visible).map((s) => s.id));
  const seen = new Set<string>();
  for (const match of raw.matchAll(TAG_RE)) {
    const type = match[1].toLowerCase();
    const arg = (match[2] ?? '').toLowerCase();
    const key = `${type}:${arg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (type === 'goto' && (SECTION_IDS as readonly string[]).includes(arg) && visible.has(arg as SectionId)) {
      actions.push({ type: 'goto', target: arg as SectionId });
    } else if (type === 'project') {
      const project = content.projects.find((p) => p.id.toLowerCase() === arg);
      if (project) actions.push({ type: 'project', id: project.id });
    } else if (type === 'tour' || type === 'cv' || type === 'contact') {
      actions.push({ type });
    }
  }
  return { text: tidy(raw.replace(TAG_RE, '')).trim(), actions: actions.slice(0, 3) };
}

export function actionTag(action: GuideAction): string {
  if (action.type === 'goto') return `[[goto:${action.target}]]`;
  if (action.type === 'project') return `[[project:${action.id}]]`;
  return `[[${action.type}]]`;
}
