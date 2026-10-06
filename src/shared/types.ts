// Modèle de contenu du portfolio, partagé par le site, l'admin et le Worker.
// Tout le texte visible est traduit dans les trois langues (I18n).

export const LANGS = ['fr', 'en', 'mg'] as const;
export type Lang = (typeof LANGS)[number];
export type I18n = Record<Lang, string>;

export const LANG_LABELS: Record<Lang, { short: string; name: string; locale: string }> = {
  fr: { short: 'FR', name: 'Français', locale: 'fr-FR' },
  en: { short: 'EN', name: 'English', locale: 'en-GB' },
  mg: { short: 'MG', name: 'Malagasy', locale: 'mg-MG' },
};

export const SECTION_IDS = ['hero', 'about', 'experience', 'projects', 'skills', 'education', 'contact'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type SocialIcon = 'github' | 'linkedin' | 'email' | 'whatsapp' | 'facebook' | 'x' | 'instagram' | 'website' | 'phone';

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  icon: SocialIcon;
}

export interface Stat {
  id: string;
  value: string;
  label: I18n;
}

export interface Profile {
  firstName: string;
  lastName: string;
  fullName: string;
  role: I18n;
  headline: I18n;
  intro: I18n;
  about: I18n;
  location: I18n;
  coordinates: string;
  timezone: string;
  available: boolean;
  availability: I18n;
  photo: string;
  avatar: string;
  /** URL du CV par langue (le français sert de repli). */
  cv: I18n;
  email: string;
  phone: string;
  phoneAlt: string;
  whatsapp: string;
  showPhone: boolean;
  socials: SocialLink[];
  stats: Stat[];
}

export interface Experience {
  id: string;
  role: I18n;
  company: string;
  client: I18n;
  type: I18n;
  /** "AAAA" ou "AAAA-MM" */
  start: string;
  /** "AAAA" ou "AAAA-MM" ; vide si en cours ou inconnu */
  end: string;
  current: boolean;
  location: I18n;
  summary: I18n;
  highlights: I18n[];
  tech: string[];
  link: string;
}

export interface ProjectLink {
  id: string;
  label: string;
  url: string;
}

export interface Project {
  id: string;
  title: I18n;
  category: I18n;
  year: string;
  summary: I18n;
  description: I18n;
  highlights: I18n[];
  tech: string[];
  image: string;
  gallery: string[];
  links: ProjectLink[];
  featured: boolean;
  color: string;
}

export interface SkillGroup {
  id: string;
  name: I18n;
  items: string[];
}

export interface Education {
  id: string;
  title: I18n;
  field: I18n;
  school: string;
  location: I18n;
  period: string;
  current: boolean;
  detail: I18n;
}

export interface Certification {
  id: string;
  title: I18n;
  issuer: string;
  date: I18n;
  url: string;
}

export interface LanguageSkill {
  id: string;
  name: I18n;
  level: I18n;
  /** 0 à 100 */
  score: number;
}

export interface SectionConfig {
  id: SectionId;
  visible: boolean;
  label: I18n;
  title: I18n;
  subtitle: I18n;
}

export interface TourStep {
  id: string;
  section: SectionId;
  text: I18n;
}

export interface GuideConfig {
  enabled: boolean;
  name: string;
  pronoun: 'he' | 'she' | 'they';
  tagline: I18n;
  greeting: I18n;
  /** Informations supplémentaires connues du guide IA (non affichées sur le site). */
  knowledge: I18n;
  suggestions: I18n[];
  tour: TourStep[];
  voice: boolean;
  autoGreet: boolean;
  /** Délai (secondes) avant la bulle d'accueil. */
  greetDelay: number;
}

export interface SeoConfig {
  title: I18n;
  description: I18n;
  image: string;
}

export interface SiteContent {
  version: number;
  updatedAt: string;
  profile: Profile;
  experience: Experience[];
  projects: Project[];
  skills: SkillGroup[];
  education: Education[];
  certifications: Certification[];
  languages: LanguageSkill[];
  sections: SectionConfig[];
  guide: GuideConfig;
  seo: SeoConfig;
  marquee: string[];
  /** Surcharges des textes de l'interface, par langue puis par clé. */
  ui: Partial<Record<Lang, Record<string, string>>>;
}

// ---------------------------------------------------------------------------
// Contrats de l'API
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  lang: Lang;
  sid?: string;
  vid?: string;
  section?: string;
}

/** Événement SSE renvoyé par /api/chat */
export type ChatStreamEvent = { t: string } | { done: true; provider: string } | { error: string };

export type TrackPayload =
  | {
      t: 'view';
      vid: string;
      sid: string;
      isNew: boolean;
      path: string;
      ref: string;
      lang: string;
      screen: string;
      utm?: { source?: string; medium?: string; campaign?: string };
    }
  | { t: 'section'; sid: string; name: string }
  | { t: 'ping'; sid: string; dt: number; section?: string }
  | { t: 'event'; sid: string; name: string };

export interface CountItem {
  k: string;
  n: number;
  c?: string;
}

export interface StatsTotals {
  sessions: number;
  visitors: number;
  pageviews: number;
  avgDuration: number;
  bounceRate: number;
  newSessions: number;
  chatSessions: number;
  contacted: number;
  tours: number;
  chatMessages: number;
  messages: number;
}

export interface StatsResponse {
  range: { from: number; to: number; days: number };
  totals: StatsTotals;
  previous: StatsTotals;
  daily: { d: string; sessions: number; visitors: number }[];
  countries: CountItem[];
  cities: CountItem[];
  devices: CountItem[];
  browsers: CountItem[];
  os: CountItem[];
  referrers: CountItem[];
  langs: CountItem[];
  sections: CountItem[];
  events: CountItem[];
  hours: number[];
  live: LiveVisitor[];
  unreadMessages: number;
}

export interface LiveVisitor {
  id: string;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  section: string | null;
  lastSeen: number;
  startedAt: number;
}

export interface VisitorSession {
  id: string;
  visitorId: string;
  startedAt: number;
  lastSeen: number;
  duration: number;
  pageviews: number;
  country: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  lang: string | null;
  screen: string | null;
  sections: string[];
  currentSection: string | null;
  chatCount: number;
  contacted: boolean;
  tour: boolean;
  isNew: boolean;
}

export interface SessionDetail {
  session: VisitorSession;
  events: { type: string; name: string | null; ts: number }[];
  chat: { role: string; content: string; createdAt: number; provider: string | null }[];
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  lang: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  sessionId: string | null;
  country: string | null;
  emailStatus: string | null;
  isRead: boolean;
  createdAt: number;
}

export interface ChatSessionSummary {
  sessionId: string;
  startedAt: number;
  lastAt: number;
  count: number;
  lang: string | null;
  country: string | null;
  city: string | null;
  firstQuestion: string;
}

export interface MediaFile {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
  scope: string;
  createdAt: number;
}

export interface SystemStatus {
  ai: { provider: string; chain: string[]; workersAi: boolean; claude: boolean; gemini: boolean };
  email: { configured: boolean; to: string | null; from: string };
  admin: { passwordSource: 'database' | 'env' | 'none' };
  storage: { files: number; bytes: number };
  content: { updatedAt: string | null; versions: number };
}

export interface ContentVersion {
  id: number;
  createdAt: number;
  note: string | null;
  size: number;
}
