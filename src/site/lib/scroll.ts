import Lenis from 'lenis';

let lenis: Lenis | null = null;
let reduced = false;
const NAV_OFFSET = 0;

/** Défilement fluide (inertie) sur ordinateur ; défilement natif sur mobile et si mouvements réduits. */
export function initSmoothScroll(prefersReducedMotion: boolean) {
  reduced = prefersReducedMotion;
  if (reduced || lenis) return;
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.3,
  });
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

export function scrollToSection(id: string, options: { immediate?: boolean; duration?: number } = {}) {
  const target = id === 'top' ? 0 : document.getElementById(id);
  if (target === null) return;
  if (lenis) {
    lenis.scrollTo(target as HTMLElement | number, {
      offset: NAV_OFFSET,
      duration: options.duration ?? 1.5,
      immediate: options.immediate,
      force: true,
    });
    return;
  }
  const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET;
  window.scrollTo({ top, behavior: reduced || options.immediate ? 'auto' : 'smooth' });
}

export function lockScroll(lock: boolean) {
  if (lenis) {
    if (lock) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle('is-locked', lock);
}

export function scrollVelocity(): number {
  return lenis ? lenis.velocity : 0;
}
