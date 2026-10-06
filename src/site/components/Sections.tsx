import { useEffect, useRef, useState } from 'preact/hooks';
import type { SectionId } from '../../shared/types';
import { formatPeriod } from '../../shared/utils';
import { content, L, lang, reducedMotion, sectionIndex, t, visibleSections } from '../state';
import { scrollToSection } from '../lib/scroll';
import { timeIn, utcOffset } from '../lib/format';
import { trackEvent } from '../lib/tracker';
import { Icon } from './Icon';
import { Emph, SplitChars, SplitWords } from './Text';
import { Orb } from '../guide/Orb';
import { go } from './Nav';

// --- Accueil ---------------------------------------------------------------------------------

function Clock() {
  const p = content.value.profile;
  const [now, setNow] = useState(() => timeIn(p.timezone, lang.value));
  useEffect(() => {
    const update = () => setNow(timeIn(p.timezone, lang.value));
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, [p.timezone, lang.value]);
  const city = L(p.location).split(',')[0]?.trim() ?? '';
  return (
    <span class="hero__clock">
      <Icon name="pin" width={14} height={14} />
      <span>
        {city} — <b>{now}</b> {utcOffset(p.timezone)}
      </span>
    </span>
  );
}

export function Hero({ onTour }: { onTour: () => void }) {
  const p = content.value.profile;
  const current = content.value.education.find((e) => e.current);
  const cv = L(p.cv);
  const next = visibleSections.value.find((s) => s.id !== 'hero')?.id;

  return (
    <section id="hero" class="hero" data-section="hero" aria-label={`${p.firstName} ${p.lastName}`}>
      <div class="wrap hero__inner">
        {p.available && (
          <div class="hero__status" data-hero style={{ '--d': '250ms' }}>
            <span class="pulse-dot" />
            {L(p.availability)}
          </div>
        )}
        <h1 class="hero__name">
          <span class="hero__first">
            <SplitChars text={p.firstName} delay={120} />
          </span>
          <span class="hero__last">
            <SplitChars text={p.lastName} delay={360} />
          </span>
        </h1>
        <div class="hero__lede">
          <p class="hero__role mono" data-hero style={{ '--d': '700ms' }}>
            {L(p.role)}
          </p>
          <p class="hero__headline" data-hero style={{ '--d': '800ms' }}>
            <Emph text={L(p.headline)} />
          </p>
          {L(p.intro) && (
            <p class="hero__intro" data-hero style={{ '--d': '900ms' }}>
              {L(p.intro)}
            </p>
          )}
          <div class="hero__ctas" data-hero style={{ '--d': '1000ms' }}>
            {content.value.guide.enabled && (
              <button type="button" class="btn btn--primary" data-magnetic onClick={onTour}>
                <Orb size={30} />
                {t('hero.cta.tour')}
              </button>
            )}
            <a class="btn btn--ghost" href="#contact" data-magnetic onClick={go('contact')}>
              {t('hero.cta.contact')}
              <Icon name="arrowRight" class="arrow" />
            </a>
            {cv && (
              <a class="link hero__cv" href={cv} target="_blank" rel="noopener" download onClick={() => trackEvent('cv_download')}>
                <Icon name="download" />
                {t('hero.cta.cv')}
              </a>
            )}
          </div>
        </div>
      </div>
      <div class="wrap">
        <div class="hero__bottom mono" data-hero style={{ '--d': '1150ms' }}>
          <Clock />
          <span>{current ? `${L(current.title)} · ${current.school}` : ''}</span>
          {next && (
            <button type="button" class="scroll-cue mono" onClick={() => scrollToSection(next)}>
              {t('hero.scroll')}
              <i />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// --- En-tête de section ------------------------------------------------------------------------

export function SectionHead({ id }: { id: SectionId }) {
  const section = content.value.sections.find((s) => s.id === id);
  if (!section) return null;
  return (
    <header class="sec-head">
      <div class="sec-head__meta label" data-reveal>
        <span class="sec-head__index">{sectionIndex.value.get(id)}</span>
        <span>{L(section.label)}</span>
      </div>
      {L(section.title) && (
        <h2 class="sec-head__title">
          <SplitWords text={L(section.title)} />
        </h2>
      )}
      {L(section.subtitle) && (
        <p class="sec-head__sub" data-reveal style={{ '--d': '180ms' }}>
          {L(section.subtitle)}
        </p>
      )}
    </header>
  );
}

// --- À propos --------------------------------------------------------------------------------

function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^(\D*)(\d+)(.*)$/.exec(value.trim());
  const [shown, setShown] = useState(match && !reducedMotion.value ? `${match[1]}0${match[3]}` : value);

  useEffect(() => {
    if (!match || reducedMotion.value) {
      setShown(value);
      return;
    }
    const [, prefix, digits, suffix] = match;
    const target = Number(digits);
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / 1600);
          const eased = 1 - Math.pow(1 - k, 4);
          setShown(`${prefix}${Math.round(target * eased)}${suffix}`);
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span ref={ref}>{shown}</span>;
}

export function About() {
  const p = content.value.profile;
  const frameRef = useRef<HTMLDivElement>(null);
  const paragraphs = L(p.about)
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);

  // Léger effet de parallaxe sur la photo.
  useEffect(() => {
    if (reducedMotion.value) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.setProperty('--py', `${Math.max(-8, Math.min(8, progress * -10)) - 4}%`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section id="about" class="sec about" data-section="about">
      <div class="wrap">
        <SectionHead id="about" />
        <div class="about__grid">
          <figure class="about__photo" data-reveal="scale">
            <div class="about__frame" ref={frameRef}>
              {p.photo && (
                <img
                  src={p.photo}
                  alt={t('about.photoAlt', { name: `${p.firstName} ${p.lastName}` })}
                  width={960}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span class="about__tag">
                <Icon name="pin" width={14} height={14} />
                {L(p.location)}
              </span>
            </div>
            <figcaption class="about__caption mono">
              <span>{p.fullName}</span>
              <span>{p.coordinates}</span>
            </figcaption>
          </figure>
          <div class="about__text">
            {paragraphs.map((para, i) => (
              <p key={i} class={i === 0 ? 'about__lead' : undefined} data-reveal style={{ '--d': `${i * 90}ms` }}>
                {para}
              </p>
            ))}
            {p.stats.length > 0 && (
              <dl class="stats" data-reveal style={{ '--d': '200ms' }}>
                {p.stats.map((s) => (
                  <div class="stat" key={s.id}>
                    <dt>
                      <CountUp value={s.value} />
                    </dt>
                    <dd>{L(s.label)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Expériences -----------------------------------------------------------------------------

export function Experience() {
  const items = content.value.experience;
  return (
    <section id="experience" class="sec" data-section="experience">
      <div class="wrap">
        <SectionHead id="experience" />
        <ol class="xp">
          {items.map((e, i) => {
            const highlights = e.highlights.map(L).filter(Boolean);
            return (
              <li class="xp__item" key={e.id} data-reveal style={{ '--d': `${Math.min(i, 3) * 70}ms` }}>
                <div class="xp__when">
                  <span class="mono">{formatPeriod(e.start, e.end, e.current, lang.value)}</span>
                  {L(e.type) && (
                    <span class={`badge ${e.current ? 'badge--live' : ''}`}>
                      {e.current && <span class="pulse-dot pulse-dot--accent" />}
                      {L(e.type)}
                    </span>
                  )}
                  {L(e.location) && <span class="mono xp__place">{L(e.location)}</span>}
                </div>
                <div class="xp__main">
                  <h3 class="xp__company">
                    {e.link ? (
                      <a class="link" href={e.link} target="_blank" rel="noopener noreferrer">
                        {e.company}
                      </a>
                    ) : (
                      e.company
                    )}
                  </h3>
                  <p class="xp__role">{L(e.role)}</p>
                  {L(e.client) && <p class="xp__client">{L(e.client)}</p>}
                  {!highlights.length && L(e.summary) && <p class="xp__summary">{L(e.summary)}</p>}
                  {highlights.length > 0 && (
                    <ul class="xp__list">
                      {highlights.map((h, k) => (
                        <li key={k}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {e.tech.length > 0 && (
                    <ul class="chips" aria-label={t('exp.tech')}>
                      {e.tech.map((tech) => (
                        <li class="chip" key={tech}>
                          {tech}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
