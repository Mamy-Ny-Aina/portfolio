// Apparitions au défilement : un seul IntersectionObserver pour toute la page.
// L'état est porté par l'attribut data-in, que Preact ne réécrit jamais.

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-in', '');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  );
  return observer;
}

export function observeReveals(root: ParentNode = document) {
  const io = getObserver();
  const elements = root.querySelectorAll('[data-reveal]:not([data-in]), .split:not([data-in])');
  if (!io) {
    elements.forEach((el) => el.setAttribute('data-in', ''));
    return;
  }
  elements.forEach((el) => io.observe(el));
}
