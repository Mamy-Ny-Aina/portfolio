import { computed, signal } from '@preact/signals';
import type { Lang, SiteContent } from '../shared/types';
import { api, errorText } from './api';

// --- Notifications ----------------------------------------------------------------------------

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error' | 'info';
}

export const toasts = signal<Toast[]>([]);
let toastId = 0;

export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, text, kind }];
  window.setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
}

// --- Confirmation -----------------------------------------------------------------------------

export const confirmState = signal<{ message: string; danger: boolean; resolve: (ok: boolean) => void } | null>(null);

export function confirmAction(message: string, danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState.value = {
      message,
      danger,
      resolve: (ok) => {
        confirmState.value = null;
        resolve(ok);
      },
    };
  });
}

// --- Contenu en cours d'édition -----------------------------------------------------------------

export const saved = signal<SiteContent | null>(null);
export const draft = signal<SiteContent | null>(null);
export const saving = signal(false);
export const dirty = computed(() => {
  if (!draft.value || !saved.value) return false;
  return JSON.stringify(draft.value) !== JSON.stringify(saved.value);
});

function readEditLang(): Lang | 'all' {
  try {
    const value = localStorage.getItem('nv_admin_lang');
    if (value === 'fr' || value === 'en' || value === 'mg' || value === 'all') return value;
  } catch {
    /* ignore */
  }
  return 'all';
}

/** Langue(s) affichée(s) dans les champs traduisibles. */
export const editLang = signal<Lang | 'all'>(readEditLang());

export function setEditLang(value: Lang | 'all') {
  editLang.value = value;
  try {
    localStorage.setItem('nv_admin_lang', value);
  } catch {
    /* ignore */
  }
}

/** Modifie le brouillon : la fonction reçoit une copie qu'elle peut muter librement. */
export function edit(mutate: (content: SiteContent) => void) {
  if (!draft.value) return;
  const next = structuredClone(draft.value);
  mutate(next);
  draft.value = next;
}

export async function loadContent() {
  const { content } = await api.get<{ content: SiteContent }>('/content');
  saved.value = content;
  draft.value = structuredClone(content);
}

export async function saveContent(note?: string): Promise<boolean> {
  if (!draft.value || saving.value) return false;
  saving.value = true;
  try {
    const { content } = await api.put<{ content: SiteContent }>('/content', { content: draft.value, note: note ?? null });
    saved.value = content;
    draft.value = structuredClone(content);
    toast('Modifications publiées sur le site.');
    return true;
  } catch (err) {
    toast(errorText(err), 'error');
    return false;
  } finally {
    saving.value = false;
  }
}

export function discardChanges() {
  if (saved.value) draft.value = structuredClone(saved.value);
}

export function replaceDraft(content: SiteContent) {
  draft.value = structuredClone(content);
}

/** Messages non lus (pastille du menu). */
export const unread = signal(0);
