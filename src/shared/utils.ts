import type { I18n, Lang, SiteContent } from './types';
import { LANGS } from './types';

export const i18n = (fr: string, en: string, mg: string): I18n => ({ fr, en, mg });
export const emptyI18n = (): I18n => ({ fr: '', en: '', mg: '' });

/** Texte dans la langue demandée, avec repli sur le français puis l'anglais. */
export function tr(value: Partial<I18n> | undefined | null, lang: Lang): string {
  if (!value) return '';
  return value[lang] || value.fr || value.en || value.mg || '';
}

export function uid(size = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fusionne un contenu enregistré avec le contenu par défaut : les objets sont fusionnés
 * récursivement (pour récupérer les nouveaux champs après une mise à jour du code),
 * les tableaux enregistrés remplacent ceux par défaut, et les types incohérents sont ignorés.
 */
export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return base;
    // Complète chaque élément d'objet avec la forme du premier élément par défaut.
    const template = base.find(isPlainObject);
    if (!template) return override as T;
    return override.map((item) => (isPlainObject(item) ? deepMerge(blankLike(template), item) : item)) as T;
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      out[key] = key in base ? deepMerge((base as Record<string, unknown>)[key], value) : value;
    }
    return out as T;
  }
  if (typeof base !== typeof override) return base;
  return override as T;
}

/** Copie « vide » d'un objet modèle : chaînes vides, tableaux vides, booléens faux. */
function blankLike<T>(template: T): T {
  if (Array.isArray(template)) return [] as T;
  if (isPlainObject(template)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) out[k] = blankLike(v);
    return out as T;
  }
  if (typeof template === 'string') return '' as T;
  if (typeof template === 'number') return 0 as T;
  if (typeof template === 'boolean') return false as T;
  return template;
}

export function mergeContent(defaults: SiteContent, stored: unknown): SiteContent {
  const merged = deepMerge(defaults, stored);
  // Sections : on garde l'ordre enregistré mais on ajoute celles qui manqueraient.
  const ids = new Set(merged.sections.map((s) => s.id));
  for (const s of defaults.sections) if (!ids.has(s.id)) merged.sections.push(s);
  merged.sections = merged.sections.filter((s) => defaults.sections.some((d) => d.id === s.id));
  return merged;
}

const MONTHS: Record<Lang, string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  mg: ['Janoary', 'Febroary', 'Martsa', 'Aprily', 'Mey', 'Jona', 'Jolay', 'Aogositra', 'Septambra', 'Oktobra', 'Novambra', 'Desambra'],
};

const PRESENT: I18n = { fr: 'Aujourd’hui', en: 'Present', mg: 'Ankehitriny' };

export function formatMonth(value: string, lang: Lang): string {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(value.trim());
  if (!m) return value;
  const year = m[1];
  if (!m[2]) return year;
  const name = MONTHS[lang][Number(m[2]) - 1] ?? '';
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return `${cap} ${year}`;
}

export function formatPeriod(start: string, end: string, current: boolean, lang: Lang): string {
  const from = start ? formatMonth(start, lang) : '';
  if (current) return from ? `${from} — ${PRESENT[lang]}` : PRESENT[lang];
  if (!end || end === start) return from;
  return `${from} — ${formatMonth(end, lang)}`;
}

/** Découpe « texte *mis en valeur* texte » en segments. */
export function splitEmphasis(text: string): { text: string; em: boolean }[] {
  const out: { text: string; em: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), em: false });
    out.push({ text: m[1], em: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), em: false });
  return out;
}

export const stripEmphasis = (text: string) => text.replace(/\*([^*]+)\*/g, '$1');

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Normalise un texte pour la recherche de mots-clés (minuscules, sans accents). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase();
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
