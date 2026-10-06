import { signal } from '@preact/signals';
import type { MediaFile } from '../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** null = vérification en cours, false = non connecté, true = connecté */
export const authenticated = signal<boolean | null>(null);
export const configured = signal(true);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && path !== '/login') {
    authenticated.value = false;
    throw new ApiError(401, 'unauthorized');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `http_${res.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export async function checkSession() {
  try {
    const me = await api.get<{ authenticated: boolean; configured: boolean }>('/me');
    configured.value = me.configured;
    authenticated.value = me.authenticated;
  } catch {
    authenticated.value = false;
  }
}

/** Réduit les grandes photos (2000 px max, WebP) avant envoi : pages plus légères, stockage préservé. */
export async function optimizeImage(file: File, maxSize = 2000, quality = 0.86): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 450_000) {
      bitmap.close();
      return file;
    }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  }
}

/** Téléversement avec progression (le fichier brut est envoyé tel quel). */
export function uploadFile(file: File, options: { onProgress?: (ratio: number) => void; key?: string } = {}): Promise<MediaFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({ name: file.name });
    if (options.key) query.set('key', options.key);
    xhr.open('PUT', `/api/admin/upload?${query}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: { file?: MediaFile; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* réponse inattendue */
      }
      if (xhr.status === 401) authenticated.value = false;
      if (xhr.status >= 200 && xhr.status < 300 && data.file) resolve(data.file);
      else reject(new ApiError(xhr.status, data.error ?? 'upload_failed'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network'));
    xhr.send(file);
  });
}

export const ERROR_TEXT: Record<string, string> = {
  invalid_password: 'Mot de passe incorrect.',
  too_many_attempts: 'Trop de tentatives. Réessayez dans 15 minutes.',
  not_configured: 'Aucun mot de passe n’est configuré (variable ADMIN_PASSWORD).',
  weak_password: 'Le nouveau mot de passe doit contenir au moins 10 caractères.',
  file_type: 'Type de fichier non accepté.',
  file_size: 'Fichier trop volumineux (20 Mo maximum).',
  too_large: 'Contenu trop volumineux.',
  unavailable: 'Service d’IA indisponible pour le moment.',
  network: 'Connexion impossible. Vérifiez votre réseau.',
  bad_origin: 'Requête refusée (origine inconnue).',
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return ERROR_TEXT[err.code] ?? `Erreur (${err.code}).`;
  return 'Une erreur inattendue est survenue.';
}
