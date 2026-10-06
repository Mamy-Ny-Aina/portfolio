import { computed, effect, signal } from '@preact/signals';
import type { I18n, Lang, SectionConfig, SectionId, SiteContent } from '../shared/types';
import { defaultContent } from '../shared/defaultContent';
import { UI_STRINGS, format, type UIKey } from '../shared/i18n';
import { isLang, tr } from '../shared/utils';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  const stored = readStorage('nv_lang');
  return isLang(stored) ? stored : 'fr';
}

function initialTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export const content = signal<SiteContent>(defaultContent);
export const lang = signal<Lang>(initialLang());
export const theme = signal<'dark' | 'light'>(initialTheme());
export const activeSection = signal<SectionId>('hero');
export const openProjectId = signal<string | null>(null);
export const menuOpen = signal(false);
export const introDone = signal(false);
export const contentReady = signal(false);

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = signal(motionQuery.matches);
motionQuery.addEventListener?.('change', (e) => (reducedMotion.value = e.matches));

const finePointerQuery = matchMedia('(hover: hover) and (pointer: fine)');
export const finePointer = signal(finePointerQuery.matches);
finePointerQuery.addEventListener?.('change', (e) => (finePointer.value = e.matches));

export const visibleSections = computed<SectionConfig[]>(() => content.value.sections.filter((s) => s.visible));

/** Numéro affiché de chaque section (01, 02…), l'accueil n'étant pas numéroté. */
export const sectionIndex = computed(() => {
  const map = new Map<SectionId, string>();
  let n = 0;
  for (const s of visibleSections.value) {
    if (s.id === 'hero') continue;
    n += 1;
    map.set(s.id, String(n).padStart(2, '0'));
  }
  return map;
});

/** Texte traduit d'un champ de contenu. */
export const L = (value: I18n | undefined): string => tr(value, lang.value);

/** Texte de l'interface (avec surcharges éventuelles définies dans l'admin). */
export function t(key: UIKey, vars?: Record<string, string | number>): string {
  const current = lang.value;
  const override = content.value.ui?.[current]?.[key];
  return format(override || UI_STRINGS[current][key] || UI_STRINGS.fr[key] || key, vars);
}

export function sectionLabel(id: SectionId): string {
  const s = content.value.sections.find((x) => x.id === id);
  return s ? L(s.label) : id;
}

effect(() => {
  const value = lang.value;
  document.documentElement.setAttribute('lang', value);
  writeStorage('nv_lang', value);
});

effect(() => {
  const value = theme.value;
  document.documentElement.setAttribute('data-theme', value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#0b0b0d' : '#f3f0ea');
  writeStorage('nv_theme', value);
});

effect(() => {
  const seo = content.value.seo;
  const title = L(seo.title).replace(/\*/g, '');
  if (title) document.title = title;
});
