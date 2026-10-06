import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ContactMessage } from '../shared/types';
import { api, authenticated, checkSession, configured, errorText } from './api';
import { discardChanges, dirty, draft, editLang, loadContent, saveContent, saving, setEditLang, toast, unread } from './store';
import { Icon, type AdminIconName } from './components/Icon';
import { ConfirmHost, MediaPickerHost, Spinner, ToastHost } from './components/ui';
import { Chats, Dashboard, Messages, Visitors } from './pages/Analytics';
import { EducationEditor, ExperienceEditor, GuideEditor, ProfileEditor, ProjectsEditor, SectionsEditor, SkillsEditor, UiTextsEditor } from './pages/Content';
import { Media, Settings } from './pages/Tools';

interface Route {
  path: string;
  label: string;
  description: string;
  icon: AdminIconName;
  component: ComponentType;
  content?: boolean;
}

const ROUTES: (Route | { group: string })[] = [
  { path: 'dashboard', label: 'Tableau de bord', description: 'Fréquentation, provenance et engagement des visiteurs', icon: 'dashboard', component: Dashboard },
  { path: 'visitors', label: 'Visiteurs', description: 'Chaque visite, son parcours et ses actions', icon: 'users', component: Visitors },
  { path: 'messages', label: 'Messages', description: 'Messages reçus via le formulaire de contact', icon: 'inbox', component: Messages },
  { path: 'chats', label: 'Conversations IA', description: 'Questions posées au guide IA', icon: 'chat', component: Chats },
  { group: 'Contenu du site' },
  { path: 'content/profile', label: 'Profil & contact', description: 'Identité, présentation, photo, CV et coordonnées', icon: 'user', component: ProfileEditor, content: true },
  { path: 'content/experience', label: 'Expériences', description: 'Parcours professionnel', icon: 'briefcase', component: ExperienceEditor, content: true },
  { path: 'content/projects', label: 'Projets', description: 'Réalisations, visuels, galeries et liens', icon: 'folder', component: ProjectsEditor, content: true },
  { path: 'content/skills', label: 'Compétences', description: 'Technologies et bandeau défilant', icon: 'code', component: SkillsEditor, content: true },
  { path: 'content/education', label: 'Parcours', description: 'Formation, certifications et langues', icon: 'cap', component: EducationEditor, content: true },
  { path: 'content/guide', label: 'Guide IA', description: 'Personnalité, connaissances et visite guidée', icon: 'sparkles', component: GuideEditor, content: true },
  { path: 'content/sections', label: 'Sections & SEO', description: 'Ordre, titres et référencement', icon: 'layout', component: SectionsEditor, content: true },
  { path: 'content/ui', label: 'Textes du site', description: 'Boutons, formulaires et messages de l’interface', icon: 'type', component: UiTextsEditor, content: true },
  { group: 'Outils' },
  { path: 'media', label: 'Médiathèque', description: 'Images, vidéos, CV et documents', icon: 'image', component: Media },
  { path: 'settings', label: 'Paramètres', description: 'IA, e-mails, sécurité et sauvegardes', icon: 'sliders', component: Settings },
];

const routes = ROUTES.filter((r): r is Route => 'path' in r);
const currentPath = () => location.hash.replace(/^#\/?/, '') || 'dashboard';
const route = signal(currentPath());
window.addEventListener('hashchange', () => (route.value = currentPath()));

function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/login', { password });
      authenticated.value = true;
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="login">
      <form class="login__card" onSubmit={submit}>
        <span class="orb" style={{ '--size': '46px' }} aria-hidden="true">
          <span class="orb__core" />
        </span>
        <div>
          <h1>Administration</h1>
          <p class="muted small">Gérez le contenu de votre portfolio et suivez vos visiteurs.</p>
        </div>
        {!configured.value && (
          <div class="notice">
            <Icon name="info" />
            <div>
              Aucun mot de passe n’est défini. Lancez <code>npx wrangler secret put ADMIN_PASSWORD</code> puis rechargez la page.
            </div>
          </div>
        )}
        <label class="f">
          <span class="f__label">Mot de passe</span>
          <input class="input" type="password" autoComplete="current-password" value={password} onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} autoFocus />
        </label>
        {error && <p class="small" style={{ color: '#ff7b6b' }}>{error}</p>}
        <button type="submit" class="btn btn--primary" disabled={busy || !password}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <a class="link small muted" href="/">
          ← Retour au site
        </a>
      </form>
    </div>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const active = routes.find((r) => r.path === route.value) ?? routes[0];
  const Page = active.component;

  useEffect(() => {
    loadContent().catch((err) => setLoadError(errorText(err)));
    api
      .get<{ messages: ContactMessage[] }>('/messages')
      .then((data) => (unread.value = data.messages.filter((m) => !m.isRead).length))
      .catch(() => {});
  }, []);

  // Ctrl+S pour enregistrer, et avertissement avant de quitter avec des modifications.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty.value) void saveContent();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.value) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [route.value]);

  return (
    <div class="adm">
      <aside class={`adm-side ${menuOpen ? 'is-open' : ''}`}>
        <div class="adm-brand">
          <span class="orb" style={{ '--size': '34px' }} aria-hidden="true">
            <span class="orb__core" />
          </span>
          <div>
            <strong>
              {draft.value?.profile.firstName.toLowerCase() ?? 'portfolio'}
              <b>.</b>
            </strong>
            <span>Administration</span>
          </div>
        </div>
        <nav class="adm-nav">
          {ROUTES.map((r) =>
            'group' in r ? (
              <span class="adm-nav__title label" key={r.group}>
                {r.group}
              </span>
            ) : (
              <a key={r.path} href={`#/${r.path}`} class={route.value === r.path ? 'is-active' : ''}>
                <Icon name={r.icon} />
                {r.label}
                {r.path === 'messages' && unread.value > 0 && <span class="count">{unread.value}</span>}
              </a>
            ),
          )}
        </nav>
        <div class="adm-side__foot adm-nav">
          <a href="/" target="_blank" rel="noopener">
            <Icon name="external" />
            Voir le site
          </a>
          <a
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              await api.post('/logout').catch(() => {});
              authenticated.value = false;
            }}
          >
            <Icon name="logout" />
            Déconnexion
          </a>
        </div>
      </aside>

      <div class="adm-main">
        <header class="adm-top">
          <button type="button" class="icon-btn adm-burger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name="menu" />
          </button>
          <div>
            <h1>{active.label}</h1>
            <p>{active.description}</p>
          </div>
          <div class="adm-top__actions">
            {active.content && (
              <div class="seg" role="group" aria-label="Langues affichées">
                {(
                  [
                    ['all', 'FR · EN · MG'],
                    ['fr', 'FR'],
                    ['en', 'EN'],
                    ['mg', 'MG'],
                  ] as const
                ).map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={editLang.value === value} onClick={() => setEditLang(value)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {active.content && (
              <button type="button" class="btn btn--primary btn--small" disabled={!dirty.value || saving.value} onClick={() => saveContent()}>
                {saving.value ? <Spinner /> : <Icon name="check" />}
                Enregistrer
              </button>
            )}
          </div>
        </header>
        <main class="adm-content">
          {active.content && !draft.value ? (
            <div class="empty">{loadError || <Spinner />}</div>
          ) : (
            <Page />
          )}
        </main>
      </div>

      {menuOpen && <div class="drawer__backdrop" style={{ zIndex: 94 }} onClick={() => setMenuOpen(false)} />}
      {dirty.value && (
        <div class="savebar" role="status">
          <span class="pulse-dot" />
          Modifications non enregistrées
          <button type="button" class="btn btn--ghost btn--small" onClick={discardChanges}>
            Annuler
          </button>
          <button type="button" class="btn btn--primary btn--small" disabled={saving.value} onClick={() => saveContent()}>
            {saving.value ? 'Publication…' : 'Enregistrer et publier'}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminApp() {
  useEffect(() => {
    void checkSession();
  }, []);

  useEffect(() => {
    if (authenticated.value === false && draft.value) toast('Session expirée : reconnectez-vous.', 'info');
  }, [authenticated.value]);

  return (
    <>
      {authenticated.value === null ? (
        <div class="login">
          <Spinner />
        </div>
      ) : authenticated.value ? (
        <Shell />
      ) : (
        <Login />
      )}
      <ConfirmHost />
      <MediaPickerHost />
      <ToastHost />
    </>
  );
}
