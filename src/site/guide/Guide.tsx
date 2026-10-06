import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { content, introDone, L, sectionLabel, t } from '../state';
import { Icon } from '../components/Icon';
import { Orb, type OrbState } from './Orb';
import { renderMarkdown } from './markdown';
import { speaking, sttSupported, ttsSupported } from './voice';
import type { GuideAction } from './actions';
import {
  ask,
  bubbleVisible,
  busy,
  closeGuide,
  cvUrl,
  draft,
  guideOpen,
  listening,
  messages,
  openGuide,
  performAction,
  resetConversation,
  setVoice,
  toggleDictation,
  voiceEnabled,
  type GuideMessage,
} from './store';
import { endTour, nextStep, pauseTour, prevStep, resumeTour, startTour, tour } from './tour';
import { trackEvent } from '../lib/tracker';

function guideState(): OrbState {
  if (listening.value) return 'listening';
  if (speaking.value) return 'speaking';
  if (busy.value) return 'thinking';
  return 'idle';
}

function ActionChip({ action }: { action: GuideAction }) {
  const name = content.value.profile.firstName;
  if (action.type === 'cv') {
    const url = cvUrl();
    if (!url) return null;
    return (
      <a class="msg-action" href={url} target="_blank" rel="noopener" download onClick={() => performAction(action, true)}>
        <Icon name="download" />
        {t('guide.downloadCv')}
      </a>
    );
  }
  let label = '';
  let icon: 'arrowDown' | 'arrowUpRight' | 'play' | 'mail' = 'arrowDown';
  if (action.type === 'goto') label = t('guide.go', { section: sectionLabel(action.target) });
  else if (action.type === 'project') {
    const project = content.value.projects.find((p) => p.id === action.id);
    label = t('guide.openProject', { project: project ? L(project.title) : action.id });
    icon = 'arrowUpRight';
  } else if (action.type === 'tour') {
    label = t('guide.startTour');
    icon = 'play';
  } else if (action.type === 'contact') {
    label = t('guide.contactCta', { name });
    icon = 'mail';
  }
  return (
    <button type="button" class="msg-action" onClick={() => performAction(action, true)}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function Message({ message }: { message: GuideMessage }) {
  const html = useMemo(() => renderMarkdown(message.text), [message.text]);
  if (message.role === 'user') return <div class="msg msg--user">{message.text}</div>;
  return (
    <div class="msg msg--assistant">
      {message.pending && !message.text ? (
        <span class="typing" aria-label={t('guide.thinking', { name: content.value.guide.name })}>
          <i />
          <i />
          <i />
        </span>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {message.pending && message.text && <span class="caret" aria-hidden="true" />}
      {!message.pending && message.actions.length > 0 && (
        <div class="msg__actions">
          {message.actions.map((action, i) => (
            <ActionChip key={i} action={action} />
          ))}
        </div>
      )}
      {message.offline && (
        <div class="msg__meta">
          <Icon name="sparkle" width={12} height={12} />
          {t('guide.offline')}
        </div>
      )}
    </div>
  );
}

function Panel() {
  const g = content.value.guide;
  const open = guideOpen.value;
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const list = messages.value;
  const asked = list.some((m) => m.role === 'user');

  useEffect(() => {
    if (!open) return;
    if (matchMedia('(min-width: 641px)').matches) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  }, [list, open]);

  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(130, el.scrollHeight)}px`;
  };

  useEffect(autosize, [draft.value]);

  const submit = (event?: Event) => {
    event?.preventDefault();
    void ask(draft.value);
  };

  return (
    <section class={`guide-panel ${open ? 'is-open' : ''}`} role="dialog" aria-label={`${g.name} — ${L(g.tagline)}`} aria-hidden={!open}>
      <header class="guide-panel__head">
        <Orb size={40} state={guideState()} />
        <div class="guide-panel__title">
          <strong>{g.name}</strong>
          <span>
            <span class="pulse-dot" />
            {busy.value ? t('guide.thinking', { name: g.name }) : `${L(g.tagline)} · ${t('guide.status')}`}
          </span>
        </div>
        <div class="guide-panel__actions">
          {ttsSupported && g.voice && (
            <button
              type="button"
              class="icon-btn"
              aria-pressed={voiceEnabled.value}
              title={voiceEnabled.value ? t('guide.voiceOn') : t('guide.voiceOff')}
              aria-label={voiceEnabled.value ? t('guide.voiceOn') : t('guide.voiceOff')}
              onClick={() => setVoice(!voiceEnabled.value)}
            >
              <Icon name={voiceEnabled.value ? 'volume' : 'volumeOff'} />
            </button>
          )}
          <button type="button" class="icon-btn" title={t('guide.reset')} aria-label={t('guide.reset')} onClick={resetConversation}>
            <Icon name="refresh" />
          </button>
          <button type="button" class="icon-btn" aria-label={t('guide.close')} onClick={closeGuide}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      <div class="guide-panel__body" ref={bodyRef} aria-live="polite" data-lenis-prevent>
        {list.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {!asked && g.tour.length > 0 && (
          <button type="button" class="guide-panel__tourcta" onClick={() => startTour()}>
            <Orb size={30} />
            <span>
              {t('guide.startTour')}
              <small>
                {g.tour
                  .slice(0, 4)
                  .map((step) => sectionLabel(step.section))
                  .join(' · ')}
                {g.tour.length > 4 ? ' …' : ''}
              </small>
            </span>
          </button>
        )}
      </div>

      {!asked && !busy.value && g.suggestions.length > 0 && (
        <div class="guide-panel__suggest" aria-label={t('guide.suggestions')}>
          {g.suggestions.map((s, i) => (
            <button type="button" key={i} class="suggest" onClick={() => void ask(L(s))}>
              {L(s)}
            </button>
          ))}
        </div>
      )}

      <form class="guide-panel__form" onSubmit={submit}>
        {sttSupported && (
          <button
            type="button"
            class={`round-btn ${listening.value ? 'is-on' : ''}`}
            aria-label={t('guide.mic')}
            title={t('guide.mic')}
            aria-pressed={listening.value}
            onClick={toggleDictation}
          >
            <Icon name="mic" />
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          maxLength={1500}
          value={draft.value}
          placeholder={listening.value ? t('guide.listening') : t('guide.placeholder')}
          aria-label={t('guide.placeholder')}
          onInput={(e) => (draft.value = (e.currentTarget as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) submit(e);
          }}
        />
        <button type="submit" class="round-btn round-btn--accent" aria-label={t('guide.send')} disabled={!draft.value.trim() || busy.value}>
          <Icon name="send" />
        </button>
      </form>
      <p class="guide-panel__foot">{t('guide.privacy')}</p>
    </section>
  );
}

function Bubble() {
  const g = content.value.guide;
  const dismiss = () => {
    bubbleVisible.value = false;
    try {
      sessionStorage.setItem('nv_bubble', '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div class="guide-bubble" role="dialog" aria-label={g.name}>
      <button type="button" class="icon-btn icon-btn--plain guide-bubble__close" aria-label={t('guide.later')} onClick={dismiss}>
        <Icon name="close" />
      </button>
      <div class="guide-bubble__head">
        <Orb size={34} />
        <div>
          <strong>{g.name}</strong>
          <span>{L(g.tagline)}</span>
        </div>
      </div>
      <p>{L(g.greeting)}</p>
      <div class="guide-bubble__actions">
        {g.tour.length > 0 && (
          <button
            type="button"
            class="btn btn--primary btn--small"
            onClick={() => {
              dismiss();
              startTour();
            }}
          >
            <Icon name="play" />
            {t('guide.tour')}
          </button>
        )}
        <button
          type="button"
          class="btn btn--ghost btn--small"
          onClick={() => {
            dismiss();
            openGuide();
          }}
        >
          {t('guide.ask')}
        </button>
      </div>
    </div>
  );
}

function splitWords(text: string) {
  const words: { text: string; end: number }[] = [];
  const re = /\S+\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) words.push({ text: m[0], end: m.index + m[0].trimEnd().length });
  return words;
}

function TourCaption() {
  const state = tour.value;
  if (!state) return null;
  const step = state.steps[state.index];
  const text = L(step.text);
  const words = splitWords(text);
  return (
    <div class={`tour ${state.playing ? '' : 'is-paused'}`} role="region" aria-label={t('guide.tour')}>
      <div class="tour__progress" aria-hidden="true">
        {state.steps.map((_, i) => (
          <i
            key={`${i}-${state.run}`}
            class={i < state.index ? 'is-done' : i === state.index ? 'is-current' : ''}
            style={i === state.index ? { '--dur': `${state.duration}ms` } : undefined}
          />
        ))}
      </div>
      <div class="tour__body">
        <Orb size={46} state={speaking.value ? 'speaking' : 'idle'} />
        <div>
          <div class="tour__meta mono">
            {t('guide.step', { n: state.index + 1, total: state.steps.length })} · {sectionLabel(step.section)}
          </div>
          <p class="tour__text" aria-live="polite">
            {words.map((w, i) => (
              <span key={`${state.run}-${i}`} class={`word ${w.end <= state.spoken ? 'is-said' : ''}`}>
                {w.text}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div class="tour__controls">
        <div>
          <button type="button" class="round-btn" onClick={prevStep} disabled={state.index === 0} aria-label={t('guide.prev')}>
            <Icon name="prev" />
          </button>
          <button
            type="button"
            class="round-btn round-btn--accent"
            onClick={state.playing ? pauseTour : resumeTour}
            aria-label={state.playing ? t('guide.pause') : t('guide.play')}
          >
            <Icon name={state.playing ? 'pause' : 'play'} />
          </button>
          <button type="button" class="round-btn" onClick={nextStep} aria-label={t('guide.next')}>
            <Icon name="next" />
          </button>
        </div>
        <div>
          <button
            type="button"
            class="btn btn--ghost btn--small"
            onClick={() => {
              pauseTour();
              openGuide();
            }}
          >
            <Icon name="message" />
            {t('guide.ask')}
          </button>
          <button type="button" class="round-btn" onClick={() => endTour(false)} aria-label={t('guide.stop')} title={t('guide.stop')}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Guide() {
  const g = content.value.guide;

  // Bulle d'accueil proactive, une fois par session.
  useEffect(() => {
    if (!introDone.value || !g.enabled || !g.autoGreet) return;
    try {
      if (sessionStorage.getItem('nv_bubble')) return;
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => {
      if (!guideOpen.value && !tour.value) {
        bubbleVisible.value = true;
        trackEvent('guide_bubble');
      }
    }, Math.max(2, g.greetDelay) * 1000);
    return () => window.clearTimeout(timer);
  }, [introDone.value, g.enabled, g.autoGreet, g.greetDelay]);

  // Sur l'accueil, les boutons « Visite guidée » suffisent : le lanceur apparaît dès qu'on défile.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.45);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!g.enabled) return null;
  const launcherVisible = introDone.value && !guideOpen.value && !tour.value && (scrolled || bubbleVisible.value);

  return (
    <>
      <button
        type="button"
        class={`guide-launcher ${launcherVisible ? 'is-visible' : ''}`}
        onClick={openGuide}
        aria-label={t('guide.open')}
        tabIndex={launcherVisible ? 0 : -1}
      >
        <span class="guide-launcher__text">
          <strong>{g.name}</strong>
          <span>{L(g.tagline)}</span>
        </span>
        <Orb size={46} state={guideState()} />
      </button>
      {bubbleVisible.value && !guideOpen.value && !tour.value && <Bubble />}
      <Panel />
      <TourCaption />
    </>
  );
}
