import { useEffect, useRef, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import type { SectionId } from '../../shared/types';
import { finePointer, introDone, reducedMotion, theme, visibleSections } from '../state';
import type { ShapeName } from '../gl/shapes';

const SHAPE_FOR: Record<SectionId, ShapeName> = {
  hero: 'planet',
  about: 'madagascar',
  experience: 'helix',
  projects: 'wave',
  skills: 'network',
  education: 'atom',
  contact: 'portal',
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Fond 3D : le champ de particules suit le défilement d'une section à l'autre. */
export function BackgroundGL() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { ParticleField, supportsWebGL2 } = await import('../gl/scene');
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;
      if (!supportsWebGL2()) {
        setFallback(true);
        return;
      }
      let field: InstanceType<typeof ParticleField>;
      try {
        field = new ParticleField(canvas, {
          reducedMotion: reducedMotion.value,
          mobile: !finePointer.value || window.innerWidth < 760,
        });
      } catch (err) {
        console.warn('Fond 3D désactivé :', err);
        setFallback(true);
        return;
      }

      let ids: SectionId[] = [];
      let tops: number[] = [];
      let heights: number[] = [];

      const measure = () => {
        ids = visibleSections.value.map((s) => s.id);
        tops = [];
        heights = [];
        for (const id of ids) {
          const el = document.getElementById(id);
          const rect = el?.getBoundingClientRect();
          tops.push(rect ? rect.top + window.scrollY : 0);
          heights.push(rect ? rect.height : 1);
        }
        field.setSequence(ids.map((id) => SHAPE_FOR[id]));
      };

      /** Position dans la séquence de formes + atténuation pendant la lecture d'une section. */
      const compute = () => {
        const center = window.scrollY + window.innerHeight * 0.5;
        let i = 0;
        for (let k = 0; k < tops.length; k++) if (center >= tops[k]) i = k;
        const local = heights[i] ? (center - tops[i]) / heights[i] : 0;
        const position = Math.min(tops.length - 1, i + smoothstep(0.68, 1, local));
        const reading = i === 0 ? 0 : smoothstep(0.1, 0.3, local) * (1 - smoothstep(0.66, 0.92, local));
        return { position, reading };
      };

      const onScroll = () => {
        const { position, reading } = compute();
        field.setScroll(window.scrollY);
        field.setProgress(position);
        field.setFocus(reading);
      };
      const onResize = () => {
        field.resize();
        measure();
        onScroll();
      };
      const onPointer = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        field.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1), true);
      };
      const onLeave = () => field.setPointer(0, 0, false);

      measure();
      field.setProgress(compute().position, true);
      field.setScroll(window.scrollY);
      field.start();
      requestAnimationFrame(() => canvas.classList.add('is-ready'));

      const resizeObserver = new ResizeObserver(() => {
        measure();
        onScroll();
      });
      resizeObserver.observe(document.body);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      window.addEventListener('pointermove', onPointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);

      const stopTheme = effect(() => field.setTheme(theme.value));
      const stopIntro = effect(() => {
        if (introDone.value) field.playIntro();
      });
      const stopSections = effect(() => {
        void visibleSections.value;
        requestAnimationFrame(() => {
          measure();
          onScroll();
        });
      });

      cleanup = () => {
        stopTheme();
        stopIntro();
        stopSections();
        resizeObserver.disconnect();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointer);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        field.destroy();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <canvas id="gl" ref={canvasRef} aria-hidden="true" />
      {fallback && <div class="gl-fallback" aria-hidden="true" />}
      <div class="grain" aria-hidden="true" />
    </>
  );
}

/** Anneau qui suit la souris (ordinateur) et effet magnétique sur les boutons principaux. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!finePointer.value || reducedMotion.value) return;
    const el = ref.current;
    if (!el) return;
    const pos = { x: -100, y: -100, tx: -100, ty: -100 };
    let raf = 0;
    let magnet: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      pos.tx = e.clientX;
      pos.ty = e.clientY;
      el.classList.add('is-visible');
      const target = e.target as HTMLElement | null;
      const labelled = target?.closest<HTMLElement>('[data-cursor-label]');
      const interactive = target?.closest('a, button, [role="button"], input, textarea, label');
      el.classList.toggle('is-label', Boolean(labelled));
      el.classList.toggle('is-hover', !labelled && Boolean(interactive));
      if (labelRef.current) labelRef.current.textContent = labelled?.dataset.cursorLabel ?? '';

      const nextMagnet = target?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (magnet && magnet !== nextMagnet) magnet.style.transform = '';
      magnet = nextMagnet;
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
        magnet.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
    };
    const onLeave = () => {
      el.classList.remove('is-visible');
      if (magnet) magnet.style.transform = '';
      magnet = null;
    };
    const tick = () => {
      pos.x += (pos.tx - pos.x) * 0.2;
      pos.y += (pos.ty - pos.y) * 0.2;
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!finePointer.value) return null;
  return (
    <div class="cursor" ref={ref} aria-hidden="true">
      <span class="cursor__label" ref={labelRef} />
    </div>
  );
}
