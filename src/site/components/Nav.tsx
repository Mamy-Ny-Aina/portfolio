import { useEffect, useRef, useState } from 'preact/hooks';
import { LANGS, LANG_LABELS, type Lang, type SectionId } from '../../shared/types';
import { activeSection, content, L, lang, menuOpen, sectionIndex, t, theme, visibleSections } from '../state';
import { lockScroll, scrollToSection } from '../lib/scroll';
import { trackEvent } from '../lib/tracker';
import { stopSpeaking } from '../guide/voice';
import { Icon } from './Icon';
import { Orb } from '../guide/Orb';

/** Change de langue avec un court fondu pour éviter un saut de texte brutal. */
export function setLanguage(next: Lang) {
  if (next === lang.value) return;
  stopSpeaking();
  const root = document.documentElement;
  root.classList.add('lang-switching');
  window.setTimeout(() => {
    lang.value = next;
    trackEvent(`lang:${next}`);
    window.setTimeout(() => root.classList.remove('lang-switching'), 60);
  }, 180);
}

export function LangSwitch() {
  return (
    <div class="lang-switch" role="group" aria-label={t('nav.language')}>
      {LANGS.map((code) => (
        <button type="button" key={code} lang={code} title={LANG_LABELS[code].name} aria-pressed={lang.value === code} onClick={() => setLanguage(code)}>
          {LANG_LABELS[code].short}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      class="icon-btn theme-btn"
      aria-label={t('nav.theme')}
      title={t('nav.theme')}
      onClick={() => {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        trackEvent(`theme:${theme.value}`);
      }}
    >
      <Icon name={theme.value === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function go(id: SectionId | 'top') {
  return (event: Event) => {
    event.preventDefault();
    if (menuOpen.value) {
      menuOpen.value = false;
      lockScroll(false);
    }
    scrollToSection(id === 'top' ? 'top' : id);
  };
}

export function Nav({ onTour }: { onTour: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const p = content.value.profile;
  const sections = visibleSections.value.filter((s) => s.id !== 'hero');
  const open = menuOpen.value;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      if (y > lastY.current + 6 && y > 480) setHidden(true);
      else if (y < lastY.current - 6 || y < 480) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        menuOpen.value = false;
        lockScroll(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggleMenu = () => {
    menuOpen.value = !open;
    lockScroll(!open);
  };

  return (
    <>
      <header class="nav" data-scrolled={scrolled || open} data-hidden={hidden && !open}>
        <div class="wrap nav__inner">
          <a class="nav__brand" href="#hero" onClick={go('top')} aria-label={t('nav.home')}>
            {p.firstName.toLowerCase()}
            <b>.</b>
          </a>
          <nav class="nav__links" aria-label="Sections">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} class={`nav__link ${activeSection.value === s.id ? 'is-active' : ''}`} onClick={go(s.id)}>
                {L(s.label)}
              </a>
            ))}
          </nav>
          <div class="nav__tools">
            <LangSwitch />
            <ThemeToggle />
            {content.value.guide.enabled && (
              <button type="button" class="nav__tour" onClick={onTour} aria-label={t('nav.tour')}>
                <Orb size={30} />
                <span class="nav__tour-label">{t('nav.tour')}</span>
              </button>
            )}
            <button type="button" class="icon-btn nav__burger" aria-expanded={open} aria-controls="menu" aria-label={open ? t('nav.close') : t('nav.menu')} onClick={toggleMenu}>
              <Icon name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>

      <div id="menu" class={`menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <ul class="menu__links">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} style={{ '--i': i }} class={activeSection.value === s.id ? 'is-active' : ''} onClick={go(s.id)} tabIndex={open ? 0 : -1}>
                <span class="mono">{sectionIndex.value.get(s.id)}</span>
                {L(s.label)}
              </a>
            </li>
          ))}
        </ul>
        <div class="menu__bottom">
          <LangSwitch />
          <ThemeToggle />
          <a class="link mono" href={`mailto:${p.email}`} tabIndex={open ? 0 : -1}>
            {p.email}
          </a>
        </div>
      </div>
    </>
  );
}

export function SideNav() {
  const sections = visibleSections.value;
  return (
    <nav class="sidenav" aria-hidden="true">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} tabIndex={-1} class={activeSection.value === s.id ? 'is-active' : ''} onClick={go(s.id)}>
          <span>{L(s.label)}</span>
          <i />
        </a>
      ))}
    </nav>
  );
}

export function ProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current?.style.setProperty('--p', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return <div class="progress" ref={ref} aria-hidden="true" />;
}
