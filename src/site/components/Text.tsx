import { splitEmphasis } from '../../shared/utils';

/** Affiche un texte où *les mots entre astérisques* sont mis en valeur (italique, couleur d'accent). */
export function Emph({ text }: { text: string }) {
  return (
    <>
      {splitEmphasis(text).map((part, i) => (part.em ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>))}
    </>
  );
}

/** Titre révélé mot à mot (les mots mis en valeur restent en italique). */
export function SplitWords({ text, delay = 0 }: { text: string; delay?: number }) {
  let index = 0;
  return (
    <span class="split" style={{ '--d': `${delay}ms` }}>
      {splitEmphasis(text).map((part, p) =>
        part.text.split(/(\s+)/).map((word, w) => {
          if (!word) return null;
          if (/^\s+$/.test(word)) return ' ';
          const i = index++;
          return (
            <span class="w" key={`${p}-${w}`}>
              {part.em ? <em style={{ '--i': i }}>{word}</em> : <span style={{ '--i': i }}>{word}</span>}
            </span>
          );
        }),
      )}
    </span>
  );
}

/** Lettres révélées une à une (nom de l'accueil). */
export function SplitChars({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span class="chars">
      <span class="sr-only">{text}</span>
      {Array.from(text).map((char, i) => (
        <span class="c" aria-hidden="true" key={i}>
          <span style={{ '--i': i, '--d': `${delay}ms` }}>{char === ' ' ? ' ' : char}</span>
        </span>
      ))}
    </span>
  );
}
