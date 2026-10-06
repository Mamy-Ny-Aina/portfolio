import { effect, signal } from '@preact/signals';
import type { ChatMessage } from '../../shared/types';
import { tr, uid } from '../../shared/utils';
import { content, L, lang, openProjectId, t } from '../state';
import { streamChat } from '../lib/api';
import { scrollToSection } from '../lib/scroll';
import { sessionId, trackEvent, visitorId } from '../lib/tracker';
import { actionTag, extractActions, visibleText, type GuideAction } from './actions';
import { localAnswer } from './localBrain';
import { createStreamSpeaker, startDictation, stopSpeaking, ttsSupported } from './voice';
import { startTour } from './tour';

export interface GuideMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions: GuideAction[];
  pending?: boolean;
  offline?: boolean;
  error?: boolean;
  greeting?: boolean;
}

const STORE_KEY = 'nv_chat';

function restore(): GuideMessage[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return (JSON.parse(raw) as GuideMessage[]).filter((m) => !m.pending);
  } catch {
    /* rien à restaurer */
  }
  return [];
}

function readVoicePreference(): boolean {
  try {
    const value = localStorage.getItem('nv_voice');
    if (value === '0') return false;
    if (value === '1') return true;
  } catch {
    /* préférence par défaut */
  }
  return true;
}

export const guideOpen = signal(false);
export const messages = signal<GuideMessage[]>(restore());
export const busy = signal(false);
export const listening = signal(false);
export const bubbleVisible = signal(false);
export const draft = signal('');
export const voiceEnabled = signal(readVoicePreference());

effect(() => {
  const list = messages.value.filter((m) => !m.pending).slice(-30);
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* stockage plein ou indisponible */
  }
});

function greetingMessage(): GuideMessage {
  return { id: uid(), role: 'assistant', text: L(content.value.guide.greeting), actions: [], greeting: true };
}

// Si seule la salutation est affichée, elle suit la langue choisie.
effect(() => {
  void lang.value;
  const current = messages.peek();
  if (current.length === 1 && current[0].greeting) messages.value = [greetingMessage()];
});

export function setVoice(on: boolean) {
  voiceEnabled.value = on;
  try {
    localStorage.setItem('nv_voice', on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!on) stopSpeaking();
}

export function openGuide() {
  guideOpen.value = true;
  bubbleVisible.value = false;
  if (!messages.value.length) messages.value = [greetingMessage()];
  trackEvent('guide_open');
}

export function closeGuide() {
  guideOpen.value = false;
}

export function pushAssistant(text: string, actions: GuideAction[] = []) {
  messages.value = [...messages.value, { id: uid(), role: 'assistant', text, actions }];
}

function update(id: string, patch: Partial<GuideMessage>) {
  messages.value = messages.value.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

let controller: AbortController | null = null;

/** Affiche une réponse locale mot à mot, comme si elle était écrite en direct. */
async function typeOut(id: string, text: string) {
  const words = text.split(/(\s+)/);
  let shown = '';
  for (let i = 0; i < words.length; i += 3) {
    shown += words.slice(i, i + 3).join('');
    update(id, { text: shown });
    await new Promise((r) => setTimeout(r, 28));
  }
}

export async function ask(input: string) {
  const question = input.trim().slice(0, 1500);
  if (!question || busy.value) return;
  stopSpeaking();
  draft.value = '';
  const currentLang = lang.value;
  const botId = uid();
  messages.value = [
    ...messages.value.filter((m) => !m.pending),
    { id: uid(), role: 'user', text: question, actions: [] },
    { id: botId, role: 'assistant', text: '', actions: [], pending: true },
  ];
  busy.value = true;
  trackEvent('guide_question');

  const history: ChatMessage[] = messages.value
    .filter((m) => !m.pending && !m.error && m.text)
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.text }));
  const speaker = voiceEnabled.value && ttsSupported ? createStreamSpeaker(currentLang) : null;

  let raw = '';
  let offline = false;
  controller = new AbortController();
  try {
    const result = await streamChat(
      { messages: history, lang: currentLang, sid: sessionId, vid: visitorId },
      (delta) => {
        raw += delta;
        const shown = visibleText(raw);
        update(botId, { text: shown });
        speaker?.push(shown);
      },
      controller.signal,
    );
    if ('fallback' in result) offline = true;
  } catch {
    if (!raw) offline = true;
  }

  if (offline) {
    const local = localAnswer(question, content.value, currentLang);
    raw = `${local.text} ${local.actions.map(actionTag).join(' ')}`;
    await typeOut(botId, local.text);
  }

  const { text, actions } = extractActions(raw, content.value);
  const finalText = text || t('guide.error');
  update(botId, { text: finalText, actions, pending: false, offline, error: !text });
  speaker?.flush(finalText);
  busy.value = false;
  controller = null;
  runActions(actions);
}

export function resetConversation() {
  controller?.abort();
  controller = null;
  stopSpeaking();
  busy.value = false;
  messages.value = [greetingMessage()];
}

const compact = () => matchMedia('(max-width: 640px)').matches;

export function cvUrl(): string {
  const cv = content.value.profile.cv;
  return tr(cv, lang.value);
}

/** Exécute une action du guide (navigation, ouverture d'un projet, visite…). */
export function performAction(action: GuideAction, fromUser = false) {
  if (fromUser && compact() && action.type !== 'cv') guideOpen.value = false;
  switch (action.type) {
    case 'goto':
      scrollToSection(action.target);
      break;
    case 'contact':
      scrollToSection('contact');
      break;
    case 'project':
      openProjectId.value = action.id;
      trackEvent(`project_open:${action.id}`);
      break;
    case 'tour':
      startTour();
      break;
    case 'cv':
      trackEvent('cv_download');
      break;
  }
}

/** Sur ordinateur, les actions sont exécutées automatiquement ; sur mobile, le visiteur touche les boutons. */
function runActions(actions: GuideAction[]) {
  const tour = actions.find((a) => a.type === 'tour');
  if (tour) {
    performAction(tour);
    return;
  }
  if (compact()) return;
  for (const action of actions) if (action.type !== 'cv') performAction(action);
}

// --- Dictée ---------------------------------------------------------------------------------

let dictation: { stop: () => void } | null = null;

export function toggleDictation() {
  if (listening.value) {
    dictation?.stop();
    return;
  }
  stopSpeaking();
  dictation = startDictation(lang.value, {
    onText: (text, final) => {
      draft.value = text;
      if (final) void ask(text);
    },
    onEnd: () => {
      listening.value = false;
      dictation = null;
    },
  });
  listening.value = dictation !== null;
}
