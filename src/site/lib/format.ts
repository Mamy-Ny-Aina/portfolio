import type { Lang } from '../../shared/types';
import { LANG_LABELS } from '../../shared/types';

export function timeIn(timeZone: string, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(LANG_LABELS.fr.locale, { hour: '2-digit', minute: '2-digit' }).format(new Date());
  }
}

export function utcOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value.replace('GMT', 'UTC') ?? '';
  } catch {
    return '';
  }
}

export function initials(text: string): string {
  const words = text.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '·';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const isVideo = (url: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url);

export function youtubeEmbed(url: string): string | null {
  const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
