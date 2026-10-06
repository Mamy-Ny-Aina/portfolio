import { useEffect, useState } from 'preact/hooks';
import type { SectionId } from '../shared/types';
import { activeSection, content, introDone, lang, reducedMotion, t, visibleSections } from './state';
import { observeReveals } from './lib/reveal';
import { trackSection } from './lib/tracker';
import { Loader } from './components/Loader';
import { Nav, ProgressBar, SideNav } from './components/Nav';
import { About, Experience, Hero } from './components/Sections';
import { ProjectModal, Projects } from './components/Projects';
import { Education, Skills } from './components/Skills';
import { Contact, Footer } from './components/Contact';
import { BackgroundGL, Cursor } from './components/Ambient';
import { Guide } from './guide/Guide';
import { startTour } from './guide/tour';

const SECTIONS: Record<SectionId, () => preact.JSX.Element> = {
  hero: () => <Hero onTour={() => startTour()} />,
  about: () => <About />,
  experience: () => <Experience />,
  projects: () => <Projects />,
  skills: () => <Skills />,
  education: () => <Education />,
  contact: () => <Contact />,
};

function introAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem('nv_intro') === '1';
  } catch {
    return false;
  }
}

export function App() {
  const [showLoader, setShowLoader] = useState(() => !introAlreadySeen() && !reducedMotion.value);

  const reveal = () => {
    document.documentElement.classList.add('is-ready');
    introDone.value = true;
    try {
      sessionStorage.setItem('nv_intro', '1');
    } catch {
      /* ignore */
    }
  };

  // Visiteur déjà passé (ou mouvements réduits) : pas d'écran d'intro.
  useEffect(() => {
    if (!showLoader) requestAnimationFrame(reveal);
  }, []);

  // Apparitions au défilement, relancées quand le contenu ou la langue changent.
  useEffect(() => {
    observeReveals();
  }, [content.value, lang.value]);

  // Section active (menu, indicateur latéral, statistiques).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id as SectionId;
          activeSection.value = id;
          trackSection(id);
        }
      },
      { rootMargin: '-45% 0px -54% 0px', threshold: 0 },
    );
    document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections.value]);

  return (
    <>
      <a class="skip-link" href="#main">
        {t('skip')}
      </a>
      <BackgroundGL />
      <ProgressBar />
      <Nav onTour={() => startTour()} />
      <SideNav />
      <main id="main">
        {visibleSections.value.map((s) => {
          const Section = SECTIONS[s.id];
          return <Section key={s.id} />;
        })}
      </main>
      <Footer />
      <ProjectModal />
      <Guide />
      <Cursor />
      {showLoader && <Loader onReveal={reveal} onDone={() => setShowLoader(false)} />}
    </>
  );
}
