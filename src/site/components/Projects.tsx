import { useEffect, useRef, useState } from 'preact/hooks';
import type { Project } from '../../shared/types';
import { content, finePointer, L, openProjectId, t } from '../state';
import { lockScroll } from '../lib/scroll';
import { isVideo, youtubeEmbed } from '../lib/format';
import { trackEvent } from '../lib/tracker';
import { Icon } from './Icon';
import { SectionHead } from './Sections';

const RINGS = [
  [92, 70, 48, 26],
  [90, 60, 30],
  [94, 78, 62, 46, 30],
  [88, 52],
  [92, 74, 56],
];

/** Couverture du projet : l'image fournie, ou une composition graphique générée. */
export function ProjectCover({ project, index }: { project: Project; index: number }) {
  const style = { '--c': project.color || 'var(--accent)' };
  if (project.image) {
    return (
      <div class="cover" style={style}>
        {isVideo(project.image) ? (
          <video src={project.image} muted loop playsInline autoPlay preload="metadata" />
        ) : (
          <img src={project.image} alt="" loading="lazy" decoding="async" />
        )}
      </div>
    );
  }
  const rings = RINGS[index % RINGS.length];
  return (
    <div class="cover" style={style} aria-hidden="true">
      <div class="cover__grid" />
      <div class="cover__glow" />
      <svg class="cover__rings" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        {rings.map((r) => (
          <circle key={r} cx="100" cy="100" r={r} stroke-width="0.7" />
        ))}
        <path d={`M100 ${100 - rings[0]}V${100 + rings[0]}M${100 - rings[0]} 100H${100 + rings[0]}`} stroke-width="0.5" opacity="0.6" />
        <circle cx={100 + rings[1] * Math.cos(index)} cy={100 + rings[1] * Math.sin(index)} r="4" fill="currentColor" stroke="none" />
      </svg>
      <span class="cover__tag mono">{L(project.category)}</span>
      <span class="cover__mono">{String(index + 1).padStart(2, '0')}</span>
    </div>
  );
}

function openProject(project: Project) {
  openProjectId.value = project.id;
  trackEvent(`project_open:${project.id}`);
}

export function Projects() {
  const projects = content.value.projects;
  const [hovered, setHovered] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, vx: 0 });

  // L'aperçu suit la souris avec un peu d'inertie et s'incline selon la vitesse.
  useEffect(() => {
    if (!finePointer.value) return;
    const state = pos.current;
    const onMove = (e: MouseEvent) => {
      state.tx = e.clientX + 28;
      state.ty = e.clientY - 120;
    };
    const tick = () => {
      const dx = state.tx - state.x;
      state.x += dx * 0.14;
      state.y += (state.ty - state.y) * 0.14;
      state.vx += (dx * 0.04 - state.vx) * 0.2;
      const el = previewRef.current;
      if (el) {
        const maxX = window.innerWidth - el.offsetWidth - 16;
        el.style.transform = `translate3d(${Math.min(state.x, maxX)}px, ${Math.max(16, state.y)}px, 0)`;
        el.style.setProperty('--rot', `${Math.max(-8, Math.min(8, state.vx))}deg`);
      }
      state.raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    state.raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(state.raf);
    };
  }, []);

  const active = hovered !== null ? projects[hovered] : null;

  return (
    <section id="projects" class="sec" data-section="projects">
      <div class="wrap">
        <SectionHead id="projects" />
        <ul class="pj" onMouseLeave={() => setHovered(null)}>
          {projects.map((project, i) => (
            <li key={project.id} data-reveal style={{ '--d': `${Math.min(i, 4) * 60}ms` }}>
              <button
                type="button"
                class="pj__row"
                data-cursor-label={t('projects.open')}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                onClick={() => openProject(project)}
              >
                <span class="pj__thumb">
                  <ProjectCover project={project} index={i} />
                </span>
                <span class="pj__num mono">{String(i + 1).padStart(2, '0')}</span>
                <span class="pj__title">{L(project.title)}</span>
                <span class="pj__cat">{L(project.category)}</span>
                <span class="pj__year mono">{project.year || '—'}</span>
                <span class="pj__arrow" aria-hidden="true">
                  <Icon name="arrowUpRight" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {finePointer.value && (
        <div class={`pj-preview ${active ? 'is-on' : ''}`} ref={previewRef} aria-hidden="true">
          {active && (
            <div class="pj-preview__card">
              <ProjectCover project={active} index={hovered ?? 0} />
              <p class="pj-preview__text">{L(active.summary)}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function ProjectModal() {
  const projects = content.value.projects;
  const id = openProjectId.value;
  const index = projects.findIndex((p) => p.id === id);
  const project = index >= 0 ? projects[index] : null;
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const [shown, setShown] = useState<{ project: Project; index: number } | null>(null);

  // On garde le dernier projet affiché pendant l'animation de fermeture.
  useEffect(() => {
    if (project) setShown({ project, index });
  }, [project, index]);

  const open = Boolean(project);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    lockScroll(true);
    window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openProjectId.value = null;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lockScroll(false);
      (lastFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [id]);

  const step = (delta: number) => {
    const list = content.value.projects;
    const current = list.findIndex((p) => p.id === openProjectId.value);
    if (current < 0 || !list.length) return;
    const next = list[(current + delta + list.length) % list.length];
    openProjectId.value = next.id;
    trackEvent(`project_open:${next.id}`);
  };

  const view = project ? { project, index } : shown;
  const prev = view ? projects[(view.index - 1 + projects.length) % projects.length] : null;
  const next = view ? projects[(view.index + 1) % projects.length] : null;

  return (
    <div class={`modal ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div class="modal__backdrop" onClick={() => (openProjectId.value = null)} />
      <article class="modal__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={view ? L(view.project.title) : ''} data-lenis-prevent>
        {view && (
          <>
            <div class="modal__top">
              <span class="mono">
                {String(view.index + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
              </span>
              <button type="button" class="icon-btn" ref={closeRef} aria-label={t('projects.close')} onClick={() => (openProjectId.value = null)}>
                <Icon name="close" />
              </button>
            </div>
            <div class="modal__body">
              <div class="modal__cover">
                <ProjectCover project={view.project} index={view.index} />
              </div>
              <span class="label">
                {L(view.project.category)}
                {view.project.year ? ` · ${view.project.year}` : ''}
              </span>
              <h3 class="modal__title">{L(view.project.title)}</h3>
              <p class="modal__lead">{L(view.project.summary)}</p>
              {L(view.project.description) && <p class="modal__desc">{L(view.project.description)}</p>}

              <div class="modal__cols">
                {view.project.highlights.length > 0 && (
                  <div>
                    <h4 class="label">{t('projects.highlights')}</h4>
                    <ul class="modal__list">
                      {view.project.highlights.map((h, i) => (
                        <li key={i}>
                          <span class="mono">{String(i + 1).padStart(2, '0')}</span>
                          {L(h)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {view.project.tech.length > 0 && (
                  <div>
                    <h4 class="label">{t('projects.stack')}</h4>
                    <ul class="chips">
                      {view.project.tech.map((tech) => (
                        <li class="chip" key={tech}>
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {view.project.links.some((l) => l.url) && (
                <div class="modal__links">
                  {view.project.links
                    .filter((l) => l.url)
                    .map((l) => (
                      <a key={l.id} class="btn btn--ghost btn--small" href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.label || l.url}
                        <Icon name="arrowUpRight" />
                      </a>
                    ))}
                </div>
              )}

              {view.project.gallery.length > 0 && (
                <div class="modal__gallery">
                  <h4 class="label">{t('projects.gallery')}</h4>
                  {view.project.gallery.map((src) => {
                    const yt = youtubeEmbed(src);
                    if (yt) return <iframe key={src} src={yt} title={L(view.project.title)} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />;
                    if (isVideo(src)) return <video key={src} src={src} controls playsInline preload="metadata" />;
                    return <img key={src} src={src} alt={L(view.project.title)} loading="lazy" decoding="async" />;
                  })}
                </div>
              )}
            </div>
            {projects.length > 1 && prev && next && (
              <div class="modal__nav">
                <button type="button" onClick={() => step(-1)}>
                  <span class="label">← {t('projects.prev')}</span>
                  <strong>{L(prev.title)}</strong>
                </button>
                <button type="button" onClick={() => step(1)}>
                  <span class="label">{t('projects.next')} →</span>
                  <strong>{L(next.title)}</strong>
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}
