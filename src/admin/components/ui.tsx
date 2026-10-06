import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { CountItem, I18n, Lang, MediaFile } from '../../shared/types';
import { LANGS } from '../../shared/types';
import { uid } from '../../shared/utils';
import { api, errorText, optimizeImage, uploadFile } from '../api';
import { confirmAction, confirmState, editLang, toast, toasts } from '../store';
import { Icon } from './Icon';

// --- Champs simples ------------------------------------------------------------------------

export function Field({ label, hint, children }: { label?: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <label class="f">
      {label && <span class="f__label">{label}</span>}
      {children}
      {hint && <span class="f__hint">{hint}</span>}
    </label>
  );
}

export function TextInput({
  label,
  value,
  onInput,
  placeholder,
  hint,
  type = 'text',
  mono,
}: {
  label?: ComponentChildren;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  hint?: ComponentChildren;
  type?: string;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        class={`input ${mono ? 'input--mono' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onInput,
  rows = 4,
  hint,
  placeholder,
}: {
  label?: ComponentChildren;
  value: string;
  onInput: (value: string) => void;
  rows?: number;
  hint?: ComponentChildren;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea class="textarea" rows={rows} value={value} placeholder={placeholder} onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)} />
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ComponentChildren; checked: boolean; onChange: (value: boolean) => void; hint?: ComponentChildren }) {
  return (
    <div class="f">
      <label class="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
        <span class="toggle__track" />
        {label}
      </label>
      {hint && <span class="f__hint">{hint}</span>}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label?: ComponentChildren;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ComponentChildren;
}) {
  return (
    <Field label={label} hint={hint}>
      <select class="select" value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Spinner() {
  return <span class="spinner" role="status" aria-label="Chargement" />;
}

export function EmptyState({ icon = 'inbox', children }: { icon?: Parameters<typeof Icon>[0]['name']; children: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Card({ title, subtitle, actions, children }: { title?: ComponentChildren; subtitle?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="card">
      {(title || actions) && (
        <div class="card__head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div class="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// --- Champ traduit (FR / EN / MG) avec traduction automatique ---------------------------------

const LANG_TAG: Record<Lang, string> = { fr: 'FR', en: 'EN', mg: 'MG' };

export function I18nField({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  hint,
  placeholder,
}: {
  label: ComponentChildren;
  value: I18n;
  onChange: (value: I18n) => void;
  multiline?: boolean;
  rows?: number;
  hint?: ComponentChildren;
  placeholder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const shown: Lang[] = editLang.value === 'all' ? [...LANGS] : [editLang.value];

  const translate = async () => {
    const source = value.fr.trim();
    if (!source) {
      toast('Écrivez d’abord le texte en français.', 'info');
      return;
    }
    let targets: Lang[] = (['en', 'mg'] as const).filter((l) => !value[l].trim());
    if (!targets.length) {
      if (!(await confirmAction('Les traductions anglaise et malgache existent déjà. Les remplacer par une nouvelle traduction automatique ?', false))) return;
      targets = ['en', 'mg'];
    }
    setBusy(true);
    try {
      const next = { ...value };
      for (const target of targets) {
        const { text } = await api.post<{ text: string }>('/translate', { text: source, from: 'fr', to: target });
        next[target] = text;
      }
      onChange(next);
      toast('Traduction ajoutée. Relisez-la avant d’enregistrer.');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="f">
      <span class="f__label">
        {label}
        <button type="button" class="mini-btn" title="Traduire automatiquement depuis le français" onClick={translate} disabled={busy} style={{ width: '26px', height: '26px' }}>
          {busy ? <Spinner /> : <Icon name="wand" />}
        </button>
      </span>
      <div class="i18n">
        {shown.map((lang) => (
          <div class="i18n__row" key={lang}>
            <span class={`i18n__tag ${value[lang]?.trim() ? '' : 'is-empty'}`} title={value[lang]?.trim() ? '' : 'Non traduit'}>
              {LANG_TAG[lang]}
            </span>
            {multiline ? (
              <textarea
                class="textarea"
                rows={rows}
                lang={lang}
                value={value[lang] ?? ''}
                placeholder={lang === 'fr' ? placeholder : value.fr || placeholder}
                onInput={(e) => onChange({ ...value, [lang]: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            ) : (
              <input
                class="input"
                lang={lang}
                value={value[lang] ?? ''}
                placeholder={lang === 'fr' ? placeholder : value.fr || placeholder}
                onInput={(e) => onChange({ ...value, [lang]: (e.currentTarget as HTMLInputElement).value })}
              />
            )}
          </div>
        ))}
      </div>
      {hint && <span class="f__hint">{hint}</span>}
    </div>
  );
}

// --- Étiquettes (technologies…) --------------------------------------------------------------

export function TagsInput({ label, value, onChange, placeholder = 'Ajouter puis Entrée', hint }: { label?: ComponentChildren; value: string[]; onChange: (value: string[]) => void; placeholder?: string; hint?: ComponentChildren }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !value.includes(p));
    if (parts.length) onChange([...value, ...parts]);
    setText('');
  };
  return (
    <div class="f">
      {label && <span class="f__label">{label}</span>}
      <div class="tags">
        {value.map((tag, i) => (
          <span class="tag" key={`${tag}-${i}`}>
            {tag}
            <button type="button" aria-label={`Retirer ${tag}`} onClick={() => onChange(value.filter((_, k) => k !== i))}>
              <Icon name="close" />
            </button>
          </span>
        ))}
        <input
          value={text}
          placeholder={placeholder}
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          onPaste={(e) => {
            const pasted = e.clipboardData?.getData('text') ?? '';
            if (/[,;\n]/.test(pasted)) {
              e.preventDefault();
              add(pasted);
            }
          }}
        />
      </div>
      {hint && <span class="f__hint">{hint}</span>}
    </div>
  );
}

// --- Listes éditables -------------------------------------------------------------------------

export function ListEditor<T>({
  items,
  onChange,
  render,
  create,
  title,
  addLabel = 'Ajouter',
  emptyText = 'Aucun élément pour le moment.',
  compact,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (mutate: (draft: T) => void) => void, index: number) => ComponentChildren;
  create: () => T;
  title: (item: T, index: number) => string;
  addLabel?: string;
  emptyText?: string;
  compact?: boolean;
}) {
  const keyOf = (item: T, index: number) => {
    const id = (item as { id?: unknown }).id;
    return typeof id === 'string' && id ? id : `i${index}`;
  };
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  };
  const update = (index: number, mutate: (draft: T) => void) => {
    const next = structuredClone(items);
    mutate(next[index]);
    onChange(next);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const duplicate = (index: number) => {
    const copy = structuredClone(items[index]);
    if (typeof (copy as { id?: unknown }).id === 'string') (copy as { id: string }).id = uid();
    const next = [...items];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };
  const remove = async (index: number) => {
    if (!(await confirmAction(`Supprimer « ${title(items[index], index) || 'cet élément'} » ?`))) return;
    onChange(items.filter((_, i) => i !== index));
  };
  const add = () => {
    const item = create();
    onChange([...items, item]);
    setOpen(new Set([...open, keyOf(item, items.length)]));
  };

  return (
    <div class="list">
      {!items.length && <p class="muted small">{emptyText}</p>}
      {items.map((item, index) => {
        const key = keyOf(item, index);
        const isOpen = compact || open.has(key);
        return (
          <div class={`item ${isOpen ? 'is-open' : ''}`} key={key}>
            <div class="item__head">
              {compact ? (
                <div class="item__title">
                  <span class="muted small">{String(index + 1).padStart(2, '0')}</span>
                </div>
              ) : (
                <button type="button" class="item__title" onClick={() => toggle(key)}>
                  <Icon name="chevron" />
                  <span>{title(item, index) || <em class="muted">Sans titre</em>}</span>
                </button>
              )}
              <div class="item__tools">
                <button type="button" class="mini-btn" title="Monter" disabled={index === 0} onClick={() => move(index, -1)}>
                  <Icon name="up" />
                </button>
                <button type="button" class="mini-btn" title="Descendre" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                  <Icon name="down" />
                </button>
                <button type="button" class="mini-btn" title="Dupliquer" onClick={() => duplicate(index)}>
                  <Icon name="copy" />
                </button>
                <button type="button" class="mini-btn danger" title="Supprimer" onClick={() => remove(index)}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            {isOpen && <div class="item__body">{render(item, (mutate) => update(index, mutate), index)}</div>}
          </div>
        );
      })}
      <button type="button" class="add-btn" onClick={add}>
        <Icon name="plus" />
        {addLabel}
      </button>
    </div>
  );
}

// --- Médias -------------------------------------------------------------------------------------

export type MediaAccept = 'image' | 'pdf' | 'any';

const ACCEPT_ATTR: Record<MediaAccept, string> = {
  image: 'image/*,video/mp4,video/webm',
  pdf: 'application/pdf',
  any: '*/*',
};

export const isImageUrl = (url: string) => /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url) || url.startsWith('data:image');
export const isVideoUrl = (url: string) => /\.(mp4|webm)(\?|$)/i.test(url);

function matches(file: MediaFile, accept: MediaAccept) {
  if (accept === 'image') return file.type.startsWith('image/') || file.type.startsWith('video/');
  if (accept === 'pdf') return file.type === 'application/pdf';
  return true;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** Téléverse un fichier (en optimisant les images) et renvoie sa fiche. */
export async function uploadWithOptimization(file: File, onProgress?: (ratio: number) => void, key?: string): Promise<MediaFile | null> {
  try {
    const prepared = file.type.startsWith('image/') ? await optimizeImage(file) : file;
    const media = await uploadFile(prepared, { onProgress, key });
    toast(`« ${media.name} » téléversé.`);
    return media;
  } catch (err) {
    toast(errorText(err), 'error');
    return null;
  }
}

const pickerState = signal<{ accept: MediaAccept; resolve: (file: MediaFile | null) => void } | null>(null);

export function pickMedia(accept: MediaAccept): Promise<MediaFile | null> {
  return new Promise((resolve) => {
    pickerState.value = {
      accept,
      resolve: (file) => {
        pickerState.value = null;
        resolve(file);
      },
    };
  });
}

export function MediaThumb({ url, type }: { url: string; type?: string }) {
  if ((type?.startsWith('image/') ?? false) || isImageUrl(url)) return <img src={url} alt="" loading="lazy" />;
  if ((type?.startsWith('video/') ?? false) || isVideoUrl(url)) return <video src={url} muted preload="metadata" />;
  return <Icon name="file" />;
}

export function MediaPickerHost() {
  const state = pickerState.value;
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) return;
    setFiles(null);
    api
      .get<{ files: MediaFile[] }>('/files')
      .then((r) => setFiles(r.files))
      .catch((err) => {
        toast(errorText(err), 'error');
        setFiles([]);
      });
  }, [state]);

  if (!state) return null;
  const list = (files ?? []).filter((f) => matches(f, state.accept));

  const onUpload = async (file?: File) => {
    if (!file) return;
    setProgress(0);
    const media = await uploadWithOptimization(file, setProgress);
    setProgress(null);
    if (media) state.resolve(media);
  };

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && state.resolve(null)}>
      <div class="dialog dialog--wide" role="dialog" aria-label="Médiathèque">
        <div class="card__head">
          <div>
            <h3>Médiathèque</h3>
            <p class="muted small">Choisissez un fichier ou téléversez-en un nouveau.</p>
          </div>
          <button type="button" class="mini-btn" aria-label="Fermer" onClick={() => state.resolve(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div
          class="dropzone"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onUpload(e.dataTransfer?.files?.[0]);
          }}
        >
          <Icon name="upload" />
          <strong>Téléverser un fichier</strong>
          <span class="muted small">Glissez-déposez ou cliquez · les grandes images sont optimisées automatiquement</span>
          {progress !== null && (
            <div class="progress-line" style={{ width: '220px' }}>
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
        <input ref={input} type="file" hidden accept={ACCEPT_ATTR[state.accept]} onChange={(e) => void onUpload((e.currentTarget as HTMLInputElement).files?.[0])} />
        <div style={{ marginTop: '1rem' }}>
          {files === null ? (
            <div class="empty">
              <Spinner />
            </div>
          ) : list.length ? (
            <div class="media-grid">
              {list.map((f) => (
                <button type="button" class="media is-selectable" key={f.key} onClick={() => state.resolve(f)}>
                  <div class="media__thumb">
                    <MediaThumb url={f.url} type={f.type} />
                  </div>
                  <div class="media__info">
                    <strong>{f.name}</strong>
                    <span class="muted">{formatBytes(f.size)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon="image">Aucun fichier compatible pour le moment.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaField({
  label,
  value,
  onChange,
  accept = 'image',
  hint,
  uploadKey,
}: {
  label: ComponentChildren;
  value: string;
  onChange: (value: string) => void;
  accept?: MediaAccept;
  hint?: ComponentChildren;
  /** Clé de stockage fixe (ex. le CV), pour garder la même adresse après remplacement. */
  uploadKey?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onUpload = async (file?: File) => {
    if (!file) return;
    setProgress(0);
    const media = await uploadWithOptimization(file, setProgress, uploadKey);
    setProgress(null);
    if (media) onChange(uploadKey ? `${media.url}?v=${Date.now().toString(36)}` : media.url);
  };

  return (
    <div class="f">
      <span class="f__label">{label}</span>
      <div class="img-field">
        <div class="img-field__preview">{value ? <MediaThumb url={value.split('?')[0]} /> : <Icon name={accept === 'pdf' ? 'file' : 'image'} />}</div>
        <div class="img-field__side">
          <input class="input input--mono" value={value} placeholder="Adresse du fichier (ou choisissez ci-dessous)" onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)} />
          <div class="row">
            <button
              type="button"
              class="btn btn--ghost btn--small"
              onClick={async () => {
                const media = await pickMedia(accept);
                if (media) onChange(media.url);
              }}
            >
              <Icon name="image" />
              Médiathèque
            </button>
            <button type="button" class="btn btn--ghost btn--small" onClick={() => input.current?.click()}>
              <Icon name="upload" />
              Téléverser
            </button>
            {value && (
              <a class="mini-btn" href={value} target="_blank" rel="noopener" title="Ouvrir">
                <Icon name="external" />
              </a>
            )}
            {value && (
              <button type="button" class="mini-btn danger" title="Retirer" onClick={() => onChange('')}>
                <Icon name="close" />
              </button>
            )}
          </div>
          {progress !== null && (
            <div class="progress-line">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
      {hint && <span class="f__hint">{hint}</span>}
      <input ref={input} type="file" hidden accept={ACCEPT_ATTR[accept]} onChange={(e) => void onUpload((e.currentTarget as HTMLInputElement).files?.[0])} />
    </div>
  );
}

// --- Fenêtres globales ----------------------------------------------------------------------

export function ConfirmHost() {
  const state = confirmState.value;
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!state) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') state.resolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);
  if (!state) return null;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && state.resolve(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h3>Confirmation</h3>
        <p class="muted">{state.message}</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--ghost btn--small" onClick={() => state.resolve(false)}>
            Annuler
          </button>
          <button type="button" ref={okRef} class={`btn btn--small ${state.danger ? 'btn--danger' : 'btn--primary'}`} onClick={() => state.resolve(true)}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastHost() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast--${t.kind}`}>
          <Icon name={t.kind === 'error' ? 'info' : t.kind === 'info' ? 'info' : 'check'} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, wide, children }: { title: ComponentChildren; onClose: () => void; wide?: boolean; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`dialog ${wide ? 'dialog--wide' : ''}`} role="dialog" aria-modal="true">
        <div class="card__head">
          <h3>{title}</h3>
          <button type="button" class="mini-btn" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div class="drawer__backdrop" onClick={onClose} />
      <aside class="drawer" role="dialog" aria-modal="true">
        {children}
      </aside>
    </>
  );
}

// --- Graphiques -----------------------------------------------------------------------------

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryName(code: string | null | undefined): string {
  if (!code || code === '—' || code.length !== 2) return code === 'T1' ? 'Tor' : 'Inconnu';
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function Country({ code }: { code: string | null | undefined }) {
  return (
    <span>
      <span class="cc">{code && code.length === 2 ? code.toUpperCase() : '··'}</span>
      {countryName(code)}
    </span>
  );
}

export function BarList({ items, render, empty = 'Pas encore de données.' }: { items: CountItem[]; render?: (item: CountItem) => ComponentChildren; empty?: string }) {
  if (!items.length) return <p class="muted small">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div class="bars">
      {items.map((item) => (
        <div class="bar" key={`${item.k}-${item.c ?? ''}`} style={{ '--w': `${(item.n / max) * 100}%` }}>
          <span>{render ? render(item) : item.k}</span>
          <b>{item.n}</b>
        </div>
      ))}
    </div>
  );
}

/** Maximum « rond » divisible en 4 graduations entières (4, 8, 20, 40, 100…). */
function niceMax(value: number) {
  const raw = Math.max(1, value) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  return Math.max(4, Math.ceil(step) * 4);
}

export function AreaChart({ points }: { points: { label: string; a: number; b: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 240;
  const pad = { t: 14, r: 10, b: 26, l: 34 };
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.a, p.b))));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => pad.t + innerH * (1 - v / max);

  const path = (key: 'a' | 'b') => {
    if (!points.length) return '';
    let d = `M${x(0)},${y(points[0][key])}`;
    for (let i = 1; i < points.length; i++) {
      const x0 = x(i - 1);
      const x1 = x(i);
      const mid = (x0 + x1) / 2;
      d += ` C${mid},${y(points[i - 1][key])} ${mid},${y(points[i][key])} ${x1},${y(points[i][key])}`;
    }
    return d;
  };
  const area = points.length ? `${path('a')} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70))));
  const gradId = useMemo(() => `g${uid(5)}`, []);

  const onMove = (e: MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div class="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ height: `${height}px` }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(tick) + 4} text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">
              {tick}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path('b')} fill="none" stroke="var(--text-3)" stroke-width="1.4" stroke-dasharray="4 4" />
        <path d={path('a')} fill="none" stroke="var(--accent)" stroke-width="2.2" />
        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={p.label} x={x(i)} y={height - 6} text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">
              {p.label}
            </text>
          ) : null,
        )}
        {hover !== null && points[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="var(--line-strong)" />
            <circle cx={x(hover)} cy={y(points[hover].a)} r="4.5" fill="var(--accent)" />
          </g>
        )}
      </svg>
      {hover !== null && points[hover] && (
        <div class="chart__tip" style={{ left: `${(x(hover) / width) * 100}%` }}>
          <strong>{points[hover].label}</strong> · {points[hover].a} visiteur{points[hover].a > 1 ? 's' : ''} · {points[hover].b} visite{points[hover].b > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div class="hours">
        {hours.map((n, h) => (
          <div key={h} title={`${String(h).padStart(2, '0')} h : ${n} visite${n > 1 ? 's' : ''}`} style={{ height: `${Math.max(3, (n / max) * 100)}%`, '--o': (0.2 + (n / max) * 0.8).toFixed(2) }} />
        ))}
      </div>
      <div class="hours-axis">
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </div>
    </div>
  );
}

export function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return <span class="kpi__delta">—</span>;
  if (!before) return <span class="kpi__delta up">nouveau</span>;
  const change = ((now - before) / before) * 100;
  const good = invert ? change < 0 : change > 0;
  return (
    <span class={`kpi__delta ${Math.abs(change) < 1 ? '' : good ? 'up' : 'down'}`}>
      {change > 0 ? '▲' : change < 0 ? '▼' : '•'} {Math.abs(change).toFixed(0)} % vs période précédente
    </span>
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0 s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (!m) return `${s} s`;
  if (m < 60) return `${m} min ${String(s).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function formatDate(ts: number, withTime = true): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: withTime ? undefined : 'numeric',
    hour: withTime ? '2-digit' : undefined,
    minute: withTime ? '2-digit' : undefined,
  }).format(new Date(ts));
}

export function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return formatDate(ts, false);
}
