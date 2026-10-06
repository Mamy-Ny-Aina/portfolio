import { useEffect, useRef, useState } from 'preact/hooks';
import { content, contentReady, L, t } from '../state';

/**
 * Écran d'introduction : le nom apparaît lettre à lettre pendant que le contenu et les polices
 * se chargent, puis le rideau se lève sur l'accueil (jamais plus de 4 secondes).
 */
export function Loader({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const fontsReady = useRef(false);
  const p = content.value.profile;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let value = 0;
    let finished = false;
    document.fonts?.ready.then(() => (fontsReady.current = true)).catch(() => (fontsReady.current = true));

    const tick = () => {
      const elapsed = performance.now() - start;
      const ready = (contentReady.value && fontsReady.current && elapsed > 1300) || elapsed > 4000;
      const target = ready ? 100 : Math.min(88, elapsed / 15);
      value += (target - value) * (ready ? 0.14 : 0.06);
      if (ready && value > 99.4) value = 100;
      setProgress(value);
      if (value >= 100 && !finished) {
        finished = true;
        setLeaving(true);
        onReveal();
        window.setTimeout(onDone, 1200);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  let i = 0;
  const word = (text: string, serif = false) => (
    <span class={`loader__word ${serif ? 'loader__word--serif' : ''}`}>
      {Array.from(text).map((ch) => (
        <span style={{ '--i': i++ }}>{ch}</span>
      ))}
    </span>
  );

  return (
    <div class={`loader ${leaving ? 'is-leaving' : ''}`} role="progressbar" aria-label={t('loader.label')} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
      <div class="loader__name">
        {word(p.firstName)}
        {word(p.lastName, true)}
      </div>
      <div class="loader__bottom">
        <div class="loader__meta mono">
          <span>{L(p.role)}</span>
          <span>{L(p.location)}</span>
        </div>
        <div class="loader__bar" style={{ '--p': (progress / 100).toFixed(3) }}>
          <i />
        </div>
        <div class="loader__count">{String(Math.round(progress)).padStart(3, '0')}</div>
      </div>
    </div>
  );
}
