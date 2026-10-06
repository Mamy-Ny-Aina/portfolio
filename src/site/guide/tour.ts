import { signal } from '@preact/signals';
import type { TourStep } from '../../shared/types';
import { content, L, lang, t, visibleSections } from '../state';
import { scrollToSection } from '../lib/scroll';
import { trackEvent } from '../lib/tracker';
import { speak, stopSpeaking, ttsSupported } from './voice';
import { guideOpen, pushAssistant, voiceEnabled } from './store';

export interface TourState {
  steps: TourStep[];
  index: number;
  playing: boolean;
  /** Nombre de caractères déjà prononcés (surlignage mot à mot). */
  spoken: number;
  /** Durée estimée de l'étape (barre de progression). */
  duration: number;
  /** Incrémenté à chaque (re)lancement d'étape, pour redémarrer les animations. */
  run: number;
}

export const tour = signal<TourState | null>(null);

let token = 0;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function availableSteps(): TourStep[] {
  const visible = new Set(visibleSections.value.map((s) => s.id));
  return content.value.guide.tour.filter((step) => visible.has(step.section) && L(step.text).trim());
}

function focusSection(id: string | null) {
  document.querySelectorAll('[data-section]').forEach((el) => el.classList.toggle('is-tour-focus', el.id === id));
}

function patch(values: Partial<TourState>) {
  if (tour.value) tour.value = { ...tour.value, ...values };
}

function estimateMs(text: string) {
  return Math.max(4500, text.split(/\s+/).length * 340 + 1200);
}

async function revealByTime(my: number, length: number, ms: number) {
  const start = performance.now();
  while (my === token && tour.value?.playing) {
    const progress = Math.min(1, (performance.now() - start) / ms);
    patch({ spoken: Math.floor(length * progress) });
    if (progress >= 1) return;
    await wait(110);
  }
}

async function runStep() {
  const my = ++token;
  const state = tour.value;
  if (!state) return;
  const step = state.steps[state.index];
  const text = L(step.text);
  stopSpeaking();
  focusSection(step.section);
  scrollToSection(step.section, { duration: 1.7 });
  tour.value = { ...state, spoken: 0, duration: estimateMs(text), run: state.run + 1 };

  await wait(1150);
  if (my !== token || !tour.value?.playing) return;

  if (voiceEnabled.value && ttsSupported) {
    await speak(text, lang.value, {
      onProgress: (index) => {
        if (my === token) patch({ spoken: index });
      },
    });
  } else {
    await revealByTime(my, text.length, estimateMs(text));
  }
  if (my !== token || !tour.value?.playing) return;
  patch({ spoken: text.length });
  await wait(1000);
  if (my !== token || !tour.value?.playing) return;
  nextStep();
}

function onWheel() {
  if (tour.value?.playing) pauseTour();
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'Escape') endTour();
  else if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(event.key) && tour.value?.playing) pauseTour();
}

export function startTour(from = 0) {
  const steps = availableSteps();
  if (!steps.length) return;
  guideOpen.value = false;
  document.documentElement.classList.add('is-touring');
  tour.value = { steps, index: Math.min(from, steps.length - 1), playing: true, spoken: 0, duration: 0, run: 0 };
  trackEvent('tour_start');
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchmove', onWheel, { passive: true });
  window.addEventListener('keydown', onKey);
  void runStep();
}

export function nextStep() {
  const state = tour.value;
  if (!state) return;
  if (state.index >= state.steps.length - 1) {
    endTour(true);
    return;
  }
  tour.value = { ...state, index: state.index + 1, playing: true };
  void runStep();
}

export function prevStep() {
  const state = tour.value;
  if (!state) return;
  tour.value = { ...state, index: Math.max(0, state.index - 1), playing: true };
  void runStep();
}

export function pauseTour() {
  if (!tour.value) return;
  token++;
  stopSpeaking();
  patch({ playing: false });
}

export function resumeTour() {
  if (!tour.value) return;
  patch({ playing: true });
  void runStep();
}

export function endTour(completed = false) {
  token++;
  stopSpeaking();
  tour.value = null;
  document.documentElement.classList.remove('is-touring');
  focusSection(null);
  window.removeEventListener('wheel', onWheel);
  window.removeEventListener('touchmove', onWheel);
  window.removeEventListener('keydown', onKey);
  if (completed) {
    trackEvent('tour_end');
    pushAssistant(t('guide.tourEnd', { name: content.value.profile.firstName }), [{ type: 'contact' }]);
    guideOpen.value = true;
  }
}
