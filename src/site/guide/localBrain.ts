import type { I18n, Lang, SiteContent } from '../../shared/types';
import { formatPeriod, normalizeText, stripEmphasis, tr } from '../../shared/utils';
import type { GuideAction } from './actions';

// Guide « hors ligne » : quand aucune IA n'est joignable, il répond aux questions courantes
// à partir du contenu du portfolio (mots-clés en français, anglais et malgache).

type Intent =
  | 'tour'
  | 'cv'
  | 'contact'
  | 'availability'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'languages'
  | 'location'
  | 'ai'
  | 'about'
  | 'greeting'
  | 'thanks';

const INTENTS: [Intent, RegExp][] = [
  ['tour', /\b(visite|visiter|tour|guide moi|guidez|montre[sz]?|faire le tour|show me around|show me|fitsidihana|tsidiho|tariho|asehoy)\b/],
  ['cv', /\b(cv|resume|curriculum)\b/],
  ['contact', /\b(contact\w*|joindre|e-?mail|mail|telephone|phone|numero|number|whatsapp|linkedin|github|ecrire|reach|call|mifandray|laharana|mailaka|antso|finday)\b/],
  ['availability', /\b(disponib\w*|available|availability|recrut\w*|hire|hiring|embauch\w*|cdi|cdd|freelance|mission|open to|salaire|salary|malalaka|vonona)\b/],
  ['experience', /\b(experience\w*|travail\w*|work\w*|job|emploi|poste|entreprise|company|southsaico|orange|smmec|stage|internship|carriere|career|traikefa|niasa|miasa|asa)\b/],
  ['projects', /\b(projets?|projects?|realisation\w*|portfolio|banking|crm|workflow|crypto|tetikasa)\b/],
  [
    'skills',
    /\b(competence\w*|skills?|technolog\w*|stack|langages?|frameworks?|java|spring|react|angular|quarkus|python|php|docker|sql|maitrise\w*|outils?|tools?|fahaiza\w*|teknolojia|fehezany|mahay)\b/,
  ],
  ['education', /\b(formation|etudes?|diplome\w*|ecole|universit\w*|master|licence|bachelor|degree|school|stud\w*|mbds|itu|bac\w*|certif\w*|delf|fianarana|mpianatra|diplaoma)\b/],
  ['languages', /\b(langues?|languages? (?:does|do)|parle\w*|speaks?|anglais|english|francais|french|malgache|malagasy|fiteny|miteny)\b/],
  ['location', /\b(ou (?:est|habite|vit)|where|based|located|location|localisation|ville|city|pays|country|madagasca?r|antananarivo|tana|aiza|monina)\b/],
  ['ai', /\b(ia|ai|intelligence artificielle|artificial intelligence|machine learning|big data|faharanitan\w*)\b/],
  ['about', /\b(qui est|who is|presente\w*|introduce|about him|a propos|profil\w*|parcours|background|iza moa|momba|diany)\b/],
  ['greeting', /\b(bonjour|salut|hello|hi|hey|coucou|bonsoir|good (?:morning|afternoon|evening)|manao ahoana|salama|akory)\b/],
  ['thanks', /\b(merci|thanks|thank you|misaotra)\b/],
];

function detect(question: string): Intent | null {
  const q = normalizeText(question);
  const scores = new Map<Intent, number>();
  INTENTS.forEach(([intent, re], order) => {
    const matches = q.match(new RegExp(re.source, 'g'));
    if (matches) scores.set(intent, matches.length * 10 - order * 0.01);
  });
  let best: Intent | null = null;
  let bestScore = 0;
  for (const [intent, score] of scores) {
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

const PHRASES: Record<string, I18n> = {
  tour: {
    fr: 'Avec plaisir ! Je vous emmène faire le tour du portfolio.',
    en: 'With pleasure! Let me take you around the portfolio.',
    mg: 'Faly aho! Andeha hotarihiko hitsidika ny portfolio ianao.',
  },
  cv: {
    fr: 'Voici le CV de {name}, prêt à télécharger.',
    en: 'Here is {name}’s CV, ready to download.',
    mg: 'Ity ny CV an’i {name}, azo ampidinina.',
  },
  noCv: {
    fr: 'Le CV n’est pas encore en ligne, mais vous pouvez le demander directement à {name} via le formulaire de contact.',
    en: 'The CV isn’t online yet, but you can ask {name} for it through the contact form.',
    mg: 'Mbola tsy misy an-tserasera ny CV, fa azonao angatahina mivantana amin’i {name} amin’ny alalan’ny fifandraisana.',
  },
  contact: {
    fr: 'Vous pouvez joindre {name} :',
    en: 'You can reach {name}:',
    mg: 'Azonao ifandraisana i {name}:',
  },
  contactForm: {
    fr: 'Le plus simple : le formulaire de contact, juste ici.',
    en: 'The easiest way is the contact form, right here.',
    mg: 'Ny tsotra indrindra: ny taratasy fifandraisana eto.',
  },
  available: {
    fr: '{name} est actuellement **{status}**. Postes, missions freelance ou collaborations : écrivez-lui, il répond rapidement.',
    en: '{name} is currently **{status}**. Roles, freelance missions or collaborations: write to him, he replies quickly.',
    mg: '{name} dia **{status}** amin’izao fotoana izao. Asa, iraka tsy miankina na fiaraha-miasa: manorata aminy, mamaly haingana izy.',
  },
  notAvailable: {
    fr: '{name} n’est pas en recherche active pour le moment, mais vous pouvez tout de même lui écrire.',
    en: '{name} isn’t actively looking right now, but you are welcome to write to him.',
    mg: 'Tsy mitady asa mafy i {name} amin’izao, fa azonao atao ihany ny manoratra aminy.',
  },
  experience: {
    fr: 'Son parcours professionnel :',
    en: 'His professional experience:',
    mg: 'Ny traikefany ara-asa:',
  },
  projects: {
    fr: 'Quelques réalisations de {name} :',
    en: 'A few of {name}’s projects:',
    mg: 'Ireto ny sasany amin’ny tetikasan’i {name}:',
  },
  projectsMore: {
    fr: 'Ouvrez un projet pour voir les détails.',
    en: 'Open a project to see the details.',
    mg: 'Sokafy ny tetikasa iray hahitana ny antsipiriany.',
  },
  skills: {
    fr: 'Sa boîte à outils :',
    en: 'His toolbox:',
    mg: 'Ny fitaovany:',
  },
  education: {
    fr: 'Sa formation :',
    en: 'His education:',
    mg: 'Ny fianarany:',
  },
  certifications: {
    fr: 'Certifications :',
    en: 'Certifications:',
    mg: 'Fanamarinana:',
  },
  languages: {
    fr: '{name} parle :',
    en: '{name} speaks:',
    mg: 'Miteny ireto i {name}:',
  },
  location: {
    fr: '{name} est basé à **{location}**.',
    en: '{name} is based in **{location}**.',
    mg: 'Monina any **{location}** i {name}.',
  },
  ai: {
    fr: '{name} se spécialise en intelligence artificielle dans le cadre de son {master}.',
    en: '{name} is specialising in artificial intelligence through his {master}.',
    mg: 'Manokana amin’ny faharanitan-tsaina artifisialy i {name} ao amin’ny {master}.',
  },
  thanks: {
    fr: 'Avec plaisir ! Une autre question sur {name} ?',
    en: 'You’re welcome! Any other question about {name}?',
    mg: 'Tsy misy fisaorana! Mbola manana fanontaniana hafa momba an’i {name} ve ianao?',
  },
  unknown: {
    fr: 'Je n’ai pas cette information pour le moment. Le plus simple est de poser la question directement à {name} via le formulaire de contact — il répond rapidement.',
    en: 'I don’t have that information right now. The easiest way is to ask {name} directly through the contact form — he replies quickly.',
    mg: 'Tsy manana io fampahalalana io aho amin’izao. Ny tsotra indrindra dia ny manontany mivantana an’i {name} amin’ny alalan’ny fifandraisana — mamaly haingana izy.',
  },
  offline: {
    fr: 'Je peux vous parler de son parcours, de ses compétences, de ses projets ou de comment le contacter.',
    en: 'I can tell you about his background, skills, projects or how to contact him.',
    mg: 'Afaka miresaka aminao momba ny diany, ny fahaiza-manaony, ny tetikasany na ny fomba hifandraisana aminy aho.',
  },
};

function fill(template: I18n, lang: Lang, vars: Record<string, string>): string {
  return tr(template, lang).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

export function localAnswer(question: string, content: SiteContent, lang: Lang): { text: string; actions: GuideAction[] } {
  const L = (v: I18n) => stripEmphasis(tr(v, lang));
  const p = content.profile;
  const name = p.firstName;
  const vars = { name, location: L(p.location), status: L(p.availability) };
  const intent = detect(question);

  switch (intent) {
    case 'tour':
      return { text: fill(PHRASES.tour, lang, vars), actions: [{ type: 'tour' }] };
    case 'cv': {
      const cv = tr(p.cv, lang);
      return cv ? { text: fill(PHRASES.cv, lang, vars), actions: [{ type: 'cv' }] } : { text: fill(PHRASES.noCv, lang, vars), actions: [{ type: 'contact' }] };
    }
    case 'contact': {
      const lines = [`- ${p.email}`];
      if (p.showPhone && p.phone) lines.push(`- ${[p.phone, p.phoneAlt].filter(Boolean).join(' / ')}`);
      for (const s of p.socials) if (s.url) lines.push(`- ${s.label} : ${s.url}`);
      return { text: `${fill(PHRASES.contact, lang, vars)}\n${lines.join('\n')}\n\n${fill(PHRASES.contactForm, lang, vars)}`, actions: [{ type: 'contact' }] };
    }
    case 'availability':
      return {
        text: fill(p.available ? PHRASES.available : PHRASES.notAvailable, lang, vars),
        actions: [{ type: 'contact' }],
      };
    case 'experience': {
      const lines = content.experience.map(
        (e) => `- **${L(e.role)} — ${e.company}** (${formatPeriod(e.start, e.end, e.current, lang)})${L(e.client) ? ` : ${L(e.client)}` : ''}`,
      );
      return { text: `${fill(PHRASES.experience, lang, vars)}\n${lines.join('\n')}`, actions: [{ type: 'goto', target: 'experience' }] };
    }
    case 'projects': {
      const q = normalizeText(question);
      const specific = content.projects.find((pr) =>
        normalizeText(`${L(pr.title)} ${pr.id.replace(/-/g, ' ')}`)
          .split(/\s+/)
          .some((word) => word.length > 3 && q.includes(word)),
      );
      if (specific) {
        const highlights = specific.highlights.map(L).filter(Boolean);
        const text = `**${L(specific.title)}** — ${L(specific.category)}\n\n${L(specific.description) || L(specific.summary)}${
          highlights.length ? `\n\n${highlights.map((h) => `- ${h}`).join('\n')}` : ''
        }\n\n${specific.tech.join(' · ')}`;
        return { text, actions: [{ type: 'project', id: specific.id }] };
      }
      const lines = content.projects.map((pr) => `- **${L(pr.title)}** — ${L(pr.summary)}`);
      return {
        text: `${fill(PHRASES.projects, lang, vars)}\n${lines.join('\n')}\n\n${fill(PHRASES.projectsMore, lang, vars)}`,
        actions: [{ type: 'goto', target: 'projects' }],
      };
    }
    case 'skills': {
      const lines = content.skills.map((g) => `- **${L(g.name)}** : ${g.items.join(', ')}`);
      return { text: `${fill(PHRASES.skills, lang, vars)}\n${lines.join('\n')}`, actions: [{ type: 'goto', target: 'skills' }] };
    }
    case 'education': {
      const edu = content.education.map((e) => `- **${L(e.title)}** — ${e.school} (${e.period})`);
      const certs = content.certifications.map((c) => `- ${L(c.title)} — ${c.issuer} (${L(c.date)})`);
      return {
        text: `${fill(PHRASES.education, lang, vars)}\n${edu.join('\n')}${certs.length ? `\n\n${fill(PHRASES.certifications, lang, vars)}\n${certs.join('\n')}` : ''}`,
        actions: [{ type: 'goto', target: 'education' }],
      };
    }
    case 'languages': {
      const lines = content.languages.map((l) => `- **${L(l.name)}** — ${L(l.level)}`);
      return { text: `${fill(PHRASES.languages, lang, vars)}\n${lines.join('\n')}`, actions: [{ type: 'goto', target: 'education' }] };
    }
    case 'location':
      return { text: fill(PHRASES.location, lang, vars), actions: [{ type: 'goto', target: 'about' }] };
    case 'ai': {
      const master = content.education.find((e) => e.current);
      if (master) return { text: fill(PHRASES.ai, lang, { ...vars, master: `${L(master.title)} (${master.school})` }), actions: [{ type: 'goto', target: 'education' }] };
      return { text: fill(PHRASES.unknown, lang, vars), actions: [{ type: 'contact' }] };
    }
    case 'about': {
      const first = L(p.about).split(/\n{2,}/)[0] ?? '';
      return { text: `**${p.firstName} ${p.lastName}** — ${L(p.role)}, ${L(p.location)}.\n\n${first}`, actions: [{ type: 'goto', target: 'about' }] };
    }
    case 'greeting':
      return { text: `${L(content.guide.greeting)}`, actions: [] };
    case 'thanks':
      return { text: fill(PHRASES.thanks, lang, vars), actions: [] };
    default:
      return { text: `${fill(PHRASES.unknown, lang, vars)}\n\n${fill(PHRASES.offline, lang, vars)}`, actions: [{ type: 'contact' }] };
  }
}
