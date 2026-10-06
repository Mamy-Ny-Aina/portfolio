import { render } from 'preact';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/guide.css';

import { defaultContent } from '../shared/defaultContent';
import { mergeContent } from '../shared/utils';
import { content, contentReady, lang, reducedMotion } from './state';
import { fetchContent } from './lib/api';
import { initSmoothScroll } from './lib/scroll';
import { startTracking } from './lib/tracker';
import { App } from './App';

// Le contenu par défaut (CV) s'affiche tout de suite ; la version de l'admin le remplace dès réception.
fetchContent().then((remote) => {
  if (remote) content.value = mergeContent(defaultContent, remote);
  contentReady.value = true;
});

initSmoothScroll(reducedMotion.value);
startTracking(lang.value);

render(<App />, document.getElementById('app')!);

// Les ancres (#contact…) ouvertes directement défilent jusqu'à la section une fois la page prête.
if (location.hash.length > 1) {
  const id = decodeURIComponent(location.hash.slice(1));
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 400);
}
