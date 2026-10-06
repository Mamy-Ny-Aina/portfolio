import { useEffect, useRef } from 'preact/hooks';
import { content, L, reducedMotion, t } from '../state';
import { scrollVelocity } from '../lib/scroll';
import { Icon } from './Icon';
import { SectionHead } from './Sections';

/** Bandeau défilant : accélère et change de sens avec la vitesse de défilement de la page. */
export function Marquee({ items }: { items: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || reducedMotion.value) return;
    const group = track.firstElementChild as HTMLElement | null;
    let x = 0;
    let last = performance.now();
    let raf = 0;
    let visible = false;
    let direction = -1;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = scrollVelocity();
      if (Math.abs(v) > 0.4) direction = v > 0 ? -1 : 1;
      const speed = 55 + Math.min(700, Math.abs(v) * 28);
      x += direction * speed * dt;
      const width = group?.offsetWidth ?? 0;
      if (width) {
        if (x <= -width) x += width;
        if (x > 0) x -= width;
      }
      track.style.transform = `translate3d(${x}px, 0, 0)`;
      if (visible) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(track);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [items.join('|')]);

  if (!items.length) return null;
  const group = (
    <div class="marquee__group">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} class={`marquee__item ${i % 2 ? 'is-outline' : ''}`}>
          {item}
          <Icon name="sparkle" />
        </span>
      ))}
    </div>
  );

  return (
    <div class="marquee" aria-hidden="true">
      <div class="marquee__track" ref={trackRef}>
        {group}
        {group}
      </div>
    </div>
  );
}

export function Skills() {
  const groups = content.value.skills;
  return (
    <section id="skills" class="sec skills-sec" data-section="skills">
      <Marquee items={content.value.marquee} />
      <div class="wrap skills-sec__inner">
        <SectionHead id="skills" />
        <div class="skills" aria-label={t('skills.intro')}>
          {groups.map((g, i) => (
            <div class="skills__row" key={g.id} data-reveal style={{ '--d': `${Math.min(i, 4) * 60}ms` }}>
              <div class="skills__cat">
                <span class="mono">{String(i + 1).padStart(2, '0')}</span>
                {L(g.name)}
              </div>
              <ul class="skills__items">
                {g.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Education() {
  const { education, certifications, languages } = content.value;
  return (
    <section id="education" class="sec" data-section="education">
      <div class="wrap">
        <SectionHead id="education" />
        <div class="edu">
          <div class="edu__col">
            <span class="label">{t('edu.education')}</span>
            <ol class="edu__list">
              {education.map((e, i) => (
                <li class="edu__item" key={e.id} data-reveal style={{ '--d': `${i * 70}ms` }}>
                  <div class="edu__period mono">
                    {e.period}
                    {e.current && <span>{t('edu.inProgress')}</span>}
                  </div>
                  <div>
                    <h4>{L(e.title)}</h4>
                    {L(e.field) && <p class="edu__field">{L(e.field)}</p>}
                    <p class="edu__school">{e.school}</p>
                    {L(e.location) && <p class="edu__loc">{L(e.location)}</p>}
                    {L(e.detail) && <p class="edu__detail">{L(e.detail)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div class="edu__col">
            {certifications.length > 0 && (
              <>
                <span class="label">{t('edu.certifications')}</span>
                <ul class="certs">
                  {certifications.map((c, i) => (
                    <li class="cert" key={c.id} data-reveal style={{ '--d': `${i * 70}ms` }}>
                      <span class="mono" style={{ color: 'var(--accent)' }}>
                        {L(c.date)}
                      </span>
                      <h4>
                        {c.url ? (
                          <a class="link" href={c.url} target="_blank" rel="noopener noreferrer">
                            {L(c.title)}
                          </a>
                        ) : (
                          L(c.title)
                        )}
                      </h4>
                      <p>{c.issuer}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {languages.length > 0 && (
              <>
                <span class="label">{t('edu.languages')}</span>
                <ul class="langs">
                  {languages.map((l, i) => (
                    <li key={l.id} data-reveal style={{ '--d': `${i * 80}ms` }}>
                      <div class="lang__row">
                        <strong>{L(l.name)}</strong>
                        <span>{L(l.level)}</span>
                      </div>
                      <div class="lang__bar">
                        <i style={{ '--v': String(Math.max(0, Math.min(100, l.score)) / 100) }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
