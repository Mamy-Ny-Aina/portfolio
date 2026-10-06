import { signal } from '@preact/signals';
import type { Lang } from '../../shared/types';

// Voix du guide : synthèse vocale du navigateur (gratuite, hors ligne) et dictée.

export const speaking = signal(false);
/** Intensité de la voix (0 à 1) pour animer l'orbe. */
export const voiceLevel = signal(0);

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  if (ttsSupported) voices = window.speechSynthesis.getVoices();
}
if (ttsSupported) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

const PREFERRED = /natural|neural|online|google|premium|enhanced|siri|denise|henri|vivienne|remy|amelie|thomas|sonia|libby|ryan|aria|jenny|guy|daniel|samantha/i;

function findVoice(prefix: string): SpeechSynthesisVoice | undefined {
  const matching = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
  return matching.find((v) => PREFERRED.test(v.name)) ?? matching.find((v) => v.localService) ?? matching[0];
}

function voiceFor(lang: Lang): { voice?: SpeechSynthesisVoice; code: string; phonetic: boolean } {
  if (!voices.length) refreshVoices();
  if (lang === 'mg') {
    const native = findVoice('mg');
    if (native) return { voice: native, code: native.lang, phonetic: false };
    const fr = findVoice('fr-fr') ?? findVoice('fr');
    return { voice: fr, code: fr?.lang ?? 'fr-FR', phonetic: true };
  }
  if (lang === 'en') {
    const en = findVoice('en-gb') ?? findVoice('en-us') ?? findVoice('en');
    return { voice: en, code: en?.lang ?? 'en-GB', phonetic: false };
  }
  const fr = findVoice('fr-fr') ?? findVoice('fr');
  return { voice: fr, code: fr?.lang ?? 'fr-FR', phonetic: false };
}

/**
 * Aucune voix malgache n'existe dans les navigateurs : on adapte l'orthographe pour qu'une voix
 * française prononce le malgache de façon proche (o → ou, ao → ô, j → dz, e → é…).
 * Les mots contenant c, q, u, w ou x — lettres absentes du malgache — sont laissés tels quels.
 */
export function malagasyForFrenchVoice(text: string): string {
  return text.replace(/[A-Za-zÀ-ÿ]+/g, (word) => {
    if (/[cquwx]/i.test(word)) return word;
    let w = word;
    w = w.replace(/ao/g, 'ô').replace(/Ao/g, 'Ô');
    w = w.replace(/o/g, 'ou').replace(/O/g, 'Ou');
    w = w.replace(/j/g, 'dz').replace(/J/g, 'Dz');
    w = w.replace(/a[iy]/g, 'aï');
    w = w.replace(/e/g, 'é').replace(/E/g, 'É');
    w = w.replace(/([aeiouéyô])s(?=[aeiouéyô])/g, '$1ss');
    w = w.replace(/g(?=[éiy])/g, 'gu');
    w = w.replace(/y$/, 'i');
    return w;
  });
}

/** Découpe un texte en phrases courtes (Chrome coupe parfois les longues lectures). */
export function sentences(text: string): string[] {
  const parts = text.match(/[^.!?…\n]+[.!?…]*["»”)]*\s*|\n+/g) ?? [text];
  const out: string[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (part.length > 220) {
      out.push(...part.split(/(?<=[,;:])\s+/).filter(Boolean));
    } else if (out.length && out[out.length - 1].length < 24) {
      out[out.length - 1] += ` ${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Pending {
  utterance: SpeechSynthesisUtterance;
  resolve: () => void;
}

const queue: Pending[] = [];
let current: Pending | null = null;
let levelRaf = 0;

function animateLevel() {
  cancelAnimationFrame(levelRaf);
  const tick = () => {
    const base = speaking.value ? 0.18 + Math.abs(Math.sin(performance.now() / 130)) * 0.22 : 0;
    voiceLevel.value = Math.max(base, voiceLevel.value * 0.9);
    if (speaking.value || voiceLevel.value > 0.01) levelRaf = requestAnimationFrame(tick);
    else voiceLevel.value = 0;
  };
  levelRaf = requestAnimationFrame(tick);
}

function next() {
  if (current || !queue.length) {
    if (!current && !queue.length) speaking.value = false;
    return;
  }
  current = queue.shift()!;
  speaking.value = true;
  animateLevel();
  const done = current;
  const finish = () => {
    if (current !== done) return;
    current = null;
    done.resolve();
    next();
  };
  done.utterance.onend = finish;
  done.utterance.onerror = finish;
  window.speechSynthesis.speak(done.utterance);
}

export interface SpeakOptions {
  /** Appelé à chaque mot prononcé, avec la position (en caractères) dans le texte d'origine. */
  onProgress?: (charIndex: number) => void;
}

/** Lit un texte à voix haute ; la promesse se résout à la fin de la lecture (ou si elle est interrompue). */
export function speak(text: string, lang: Lang, options: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported) return Promise.resolve();
  const clean = cleanForSpeech(text);
  if (!clean) return Promise.resolve();
  const { voice, code, phonetic } = voiceFor(lang);
  const parts = sentences(clean);
  let offset = 0;
  const promises = parts.map((part) => {
    const start = clean.indexOf(part, offset);
    const base = start >= 0 ? start : offset;
    offset = base + part.length;
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(phonetic ? malagasyForFrenchVoice(part) : part);
      utterance.lang = code;
      if (voice) utterance.voice = voice;
      utterance.rate = lang === 'mg' ? 0.95 : 1.02;
      utterance.pitch = 1;
      utterance.onboundary = (event) => {
        voiceLevel.value = 1;
        if (!phonetic) options.onProgress?.(base + event.charIndex);
      };
      utterance.onstart = () => options.onProgress?.(base);
      const wrappedResolve = () => {
        options.onProgress?.(base + part.length);
        resolve();
      };
      queue.push({ utterance, resolve: wrappedResolve });
    });
  });
  next();
  return Promise.all(promises).then(() => undefined);
}

export function stopSpeaking() {
  if (!ttsSupported) return;
  const pending = [...queue];
  queue.length = 0;
  const active = current;
  current = null;
  window.speechSynthesis.cancel();
  active?.resolve();
  for (const p of pending) p.resolve();
  speaking.value = false;
}

/** Lecture progressive d'un texte qui arrive en flux : chaque phrase complète est lue dès qu'elle est prête. */
export function createStreamSpeaker(lang: Lang) {
  let spoken = 0;
  return {
    push(fullText: string) {
      const clean = fullText;
      const lastBoundary = Math.max(clean.lastIndexOf('. '), clean.lastIndexOf('! '), clean.lastIndexOf('? '), clean.lastIndexOf('\n'));
      if (lastBoundary + 1 <= spoken) return;
      const chunk = clean.slice(spoken, lastBoundary + 1);
      spoken = lastBoundary + 1;
      if (chunk.trim()) void speak(chunk, lang);
    },
    flush(fullText: string) {
      const rest = fullText.slice(spoken);
      spoken = fullText.length;
      if (rest.trim()) void speak(rest, lang);
    },
  };
}

// --- Dictée --------------------------------------------------------------------------------

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const sttSupported = recognitionCtor() !== null;

export function startDictation(
  lang: Lang,
  handlers: { onText: (text: string, final: boolean) => void; onEnd: () => void },
): { stop: () => void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const codes = lang === 'en' ? ['en-US'] : lang === 'mg' ? ['mg-MG', 'fr-FR'] : ['fr-FR'];
  let attempt = 0;
  let recognition: RecognitionLike;
  let finalText = '';

  const run = () => {
    recognition = new Ctor();
    recognition.lang = codes[attempt];
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      handlers.onText((finalText + interim).trim(), false);
    };
    recognition.onerror = (event) => {
      if ((event.error === 'language-not-supported' || event.error === 'no-speech') && attempt < codes.length - 1 && !finalText) {
        attempt += 1;
        recognition.onend = null;
        run();
      }
    };
    recognition.onend = () => {
      if (finalText.trim()) handlers.onText(finalText.trim(), true);
      handlers.onEnd();
    };
    recognition.start();
  };

  try {
    run();
  } catch {
    return null;
  }
  return { stop: () => recognition.stop() };
}
