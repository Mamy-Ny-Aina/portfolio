import { useMemo, useState } from 'preact/hooks';
import type { Certification, Education, Experience, I18n, LanguageSkill, Project, SectionId, SkillGroup, SocialIcon, SocialLink, Stat, TourStep } from '../../shared/types';
import { LANGS, SECTION_IDS } from '../../shared/types';
import { UI_KEYS, UI_STRINGS, type UIKey } from '../../shared/i18n';
import { emptyI18n, slugify, uid } from '../../shared/utils';
import { draft, edit } from '../store';
import { Icon } from '../components/Icon';
import { Card, I18nField, ListEditor, MediaField, Select, TagsInput, TextInput, Toggle } from '../components/ui';

const EMPHASIS_HINT = 'Astuce : entourez un mot d’astérisques (*mot*) pour le mettre en valeur en italique orange.';

const SECTION_NAMES: Record<SectionId, string> = {
  hero: 'Accueil',
  about: 'À propos',
  experience: 'Expériences',
  projects: 'Projets',
  skills: 'Compétences',
  education: 'Parcours',
  contact: 'Contact',
};

const ICONS: { value: SocialIcon; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'website', label: 'Site web' },
  { value: 'phone', label: 'Téléphone' },
];

function I18nList({ items, onChange, label, addLabel, multiline = true }: { items: I18n[]; onChange: (items: I18n[]) => void; label: string; addLabel: string; multiline?: boolean }) {
  return (
    <div class="f">
      <span class="f__label">{label}</span>
      <ListEditor<I18n>
        compact
        items={items}
        onChange={onChange}
        create={emptyI18n}
        title={(item) => item.fr}
        addLabel={addLabel}
        render={(item, update) => <I18nField label="Texte" value={item} multiline={multiline} rows={2} onChange={(v) => update((d) => Object.assign(d, v))} />}
      />
    </div>
  );
}

function StringList({ items, onChange, label, addLabel }: { items: string[]; onChange: (items: string[]) => void; label: string; addLabel: string }) {
  const move = (i: number, delta: number) => {
    const next = [...items];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div class="f">
      <span class="f__label">{label}</span>
      <div class="list">
        {items.map((url, i) => (
          <div class="item" key={`${i}-${url}`}>
            <div class="item__body" style={{ borderTop: 0 }}>
              <MediaField label={`Élément ${i + 1}`} value={url} onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))} hint="Image, vidéo (mp4/webm) ou lien YouTube." />
              <div class="row">
                <button type="button" class="mini-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Monter">
                  <Icon name="up" />
                </button>
                <button type="button" class="mini-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Descendre">
                  <Icon name="down" />
                </button>
                <button type="button" class="mini-btn danger" onClick={() => onChange(items.filter((_, k) => k !== i))} title="Retirer">
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" class="add-btn" onClick={() => onChange([...items, ''])}>
          <Icon name="plus" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

// --- Profil -------------------------------------------------------------------------------------

export function ProfileEditor() {
  const p = draft.value!.profile;
  const set = (mutate: (profile: typeof p) => void) => edit((d) => mutate(d.profile));
  const cvBase = `m/cv-${slugify(`${p.firstName} ${p.lastName}`) || 'cv'}`;

  return (
    <div class="stack">
      <Card title="Identité" subtitle="Le prénom s’affiche en très grand sur l’accueil, le nom en italique en dessous.">
        <div class="grid grid-3">
          <TextInput label="Prénom d’usage" value={p.firstName} onInput={(v) => set((x) => (x.firstName = v))} />
          <TextInput label="Nom" value={p.lastName} onInput={(v) => set((x) => (x.lastName = v))} />
          <TextInput label="Nom complet" value={p.fullName} onInput={(v) => set((x) => (x.fullName = v))} />
        </div>
        <div class="stack" style={{ marginTop: '1rem' }}>
          <I18nField label="Métier" value={p.role} onChange={(v) => set((x) => (x.role = v))} />
          <I18nField label="Accroche (accueil)" value={p.headline} multiline rows={2} hint={EMPHASIS_HINT} onChange={(v) => set((x) => (x.headline = v))} />
          <I18nField label="Introduction (accueil)" value={p.intro} multiline rows={3} onChange={(v) => set((x) => (x.intro = v))} />
        </div>
      </Card>

      <Card title="À propos">
        <div class="stack">
          <I18nField
            label="Présentation"
            value={p.about}
            multiline
            rows={8}
            hint="Séparez les paragraphes par une ligne vide. Le premier paragraphe est affiché en grand."
            onChange={(v) => set((x) => (x.about = v))}
          />
          <div class="grid grid-2">
            <MediaField label="Photo (portrait)" value={p.photo} onChange={(v) => set((x) => (x.photo = v))} hint="Format portrait conseillé (4:5)." />
            <MediaField label="Avatar (carré)" value={p.avatar} onChange={(v) => set((x) => (x.avatar = v))} hint="Utilisé pour le référencement et les aperçus." />
          </div>
        </div>
      </Card>

      <Card title="Disponibilité & localisation">
        <div class="stack">
          <Toggle label="Afficher le badge de disponibilité" checked={p.available} onChange={(v) => set((x) => (x.available = v))} />
          <I18nField label="Texte du badge" value={p.availability} onChange={(v) => set((x) => (x.availability = v))} />
          <I18nField label="Ville, pays" value={p.location} onChange={(v) => set((x) => (x.location = v))} />
          <div class="grid grid-2">
            <TextInput label="Coordonnées affichées" value={p.coordinates} onInput={(v) => set((x) => (x.coordinates = v))} />
            <TextInput label="Fuseau horaire (horloge de l’accueil)" mono value={p.timezone} onInput={(v) => set((x) => (x.timezone = v))} hint="Ex. Indian/Antananarivo" />
          </div>
        </div>
      </Card>

      <Card title="Coordonnées & CV">
        <div class="stack">
          <div class="grid grid-2">
            <TextInput label="E-mail public" type="email" value={p.email} onInput={(v) => set((x) => (x.email = v))} />
            <TextInput label="WhatsApp (numéro international, chiffres uniquement)" mono value={p.whatsapp} onInput={(v) => set((x) => (x.whatsapp = v))} placeholder="261320710164" />
            <TextInput label="Téléphone" value={p.phone} onInput={(v) => set((x) => (x.phone = v))} />
            <TextInput label="Téléphone secondaire" value={p.phoneAlt} onInput={(v) => set((x) => (x.phoneAlt = v))} />
          </div>
          <Toggle label="Afficher les numéros de téléphone sur le site" checked={p.showPhone} onChange={(v) => set((x) => (x.showPhone = v))} />
          <div class="grid grid-3">
            {LANGS.map((lang) => (
              <MediaField
                key={lang}
                label={`CV (${lang.toUpperCase()})`}
                accept="pdf"
                value={p.cv[lang]}
                uploadKey={`${cvBase}${lang === 'fr' ? '' : `-${lang}`}.pdf`}
                onChange={(v) => set((x) => (x.cv[lang] = v))}
                hint={lang === 'fr' ? 'Version utilisée si une langue n’a pas son propre CV.' : 'Optionnel.'}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card title="Réseaux sociaux" subtitle="Les liens vides ne sont pas affichés.">
        <ListEditor<SocialLink>
          items={p.socials}
          onChange={(items) => set((x) => (x.socials = items))}
          create={() => ({ id: uid(), label: '', url: '', icon: 'website' })}
          title={(s) => s.label || s.url}
          addLabel="Ajouter un réseau"
          render={(s, update) => (
            <div class="grid grid-3">
              <Select label="Icône" value={s.icon} options={ICONS} onChange={(v) => update((d) => (d.icon = v))} />
              <TextInput label="Libellé" value={s.label} onInput={(v) => update((d) => (d.label = v))} />
              <TextInput label="Adresse (URL)" mono value={s.url} onInput={(v) => update((d) => (d.url = v))} placeholder="https://…" />
            </div>
          )}
        />
      </Card>

      <Card title="Chiffres clés" subtitle="Affichés sous la présentation, avec un compteur animé.">
        <ListEditor<Stat>
          items={p.stats}
          onChange={(items) => set((x) => (x.stats = items))}
          create={() => ({ id: uid(), value: '', label: emptyI18n() })}
          title={(s) => `${s.value} ${s.label.fr}`}
          addLabel="Ajouter un chiffre"
          render={(s, update) => (
            <div class="stack">
              <TextInput label="Valeur" value={s.value} onInput={(v) => update((d) => (d.value = v))} placeholder="Ex. 3, 10+, C2" />
              <I18nField label="Libellé" value={s.label} onChange={(v) => update((d) => (d.label = v))} />
            </div>
          )}
        />
      </Card>
    </div>
  );
}

// --- Expériences ---------------------------------------------------------------------------------

export function ExperienceEditor() {
  const items = draft.value!.experience;
  return (
    <Card title="Expériences professionnelles" subtitle="De la plus récente à la plus ancienne. Utilisez les flèches pour réordonner.">
      <ListEditor<Experience>
        items={items}
        onChange={(next) => edit((d) => (d.experience = next))}
        create={() => ({
          id: uid(),
          role: emptyI18n(),
          company: '',
          client: emptyI18n(),
          type: emptyI18n(),
          start: '',
          end: '',
          current: false,
          location: emptyI18n(),
          summary: emptyI18n(),
          highlights: [],
          tech: [],
          link: '',
        })}
        title={(e) => `${e.company || 'Nouvelle expérience'} — ${e.role.fr}`}
        addLabel="Ajouter une expérience"
        render={(e, update) => (
          <>
            <div class="grid grid-2">
              <TextInput label="Entreprise" value={e.company} onInput={(v) => update((d) => (d.company = v))} />
              <TextInput label="Site de l’entreprise (optionnel)" mono value={e.link} onInput={(v) => update((d) => (d.link = v))} placeholder="https://…" />
            </div>
            <I18nField label="Poste" value={e.role} onChange={(v) => update((d) => (d.role = v))} />
            <I18nField label="Projet / client" value={e.client} onChange={(v) => update((d) => (d.client = v))} />
            <div class="grid grid-3">
              <TextInput label="Début" mono value={e.start} onInput={(v) => update((d) => (d.start = v))} placeholder="2025-11 ou 2025" />
              <TextInput label="Fin" mono value={e.end} onInput={(v) => update((d) => (d.end = v))} placeholder="Vide si en cours" />
              <div style={{ alignSelf: 'end', paddingBottom: '0.6rem' }}>
                <Toggle label="Poste actuel" checked={e.current} onChange={(v) => update((d) => (d.current = v))} />
              </div>
            </div>
            <div class="grid grid-2">
              <I18nField label="Type (badge)" value={e.type} onChange={(v) => update((d) => (d.type = v))} placeholder="Ex. CDI, Stage, Freelance" />
              <I18nField label="Lieu" value={e.location} onChange={(v) => update((d) => (d.location = v))} />
            </div>
            <I18nField
              label="Résumé"
              value={e.summary}
              multiline
              rows={2}
              hint="Utilisé par le guide IA, et affiché sur le site si aucun point clé n’est renseigné."
              onChange={(v) => update((d) => (d.summary = v))}
            />
            <I18nList label="Points clés (missions, réalisations)" addLabel="Ajouter un point clé" items={e.highlights} onChange={(v) => update((d) => (d.highlights = v))} />
            <TagsInput label="Technologies" value={e.tech} onChange={(v) => update((d) => (d.tech = v))} />
          </>
        )}
      />
    </Card>
  );
}

// --- Projets ----------------------------------------------------------------------------------------

export function ProjectsEditor() {
  const items = draft.value!.projects;
  return (
    <Card title="Projets" subtitle="Sans image, une couverture graphique est générée automatiquement à partir de la couleur.">
      <ListEditor<Project>
        items={items}
        onChange={(next) => edit((d) => (d.projects = next))}
        create={() => ({
          id: uid(),
          title: emptyI18n(),
          category: emptyI18n(),
          year: '',
          summary: emptyI18n(),
          description: emptyI18n(),
          highlights: [],
          tech: [],
          image: '',
          gallery: [],
          links: [],
          featured: true,
          color: '#ff6a3d',
        })}
        title={(p) => p.title.fr || 'Nouveau projet'}
        addLabel="Ajouter un projet"
        render={(p, update) => (
          <>
            <I18nField label="Titre" value={p.title} onChange={(v) => update((d) => (d.title = v))} />
            <div class="grid grid-2">
              <I18nField label="Catégorie" value={p.category} onChange={(v) => update((d) => (d.category = v))} />
              <div class="stack">
                <TextInput label="Année / période" value={p.year} onInput={(v) => update((d) => (d.year = v))} placeholder="2025 — 2026" />
                <div class="row">
                  <label class="f" style={{ flex: 1 }}>
                    <span class="f__label">Couleur</span>
                    <input type="color" class="input" style={{ height: '42px', padding: '4px' }} value={p.color || '#ff6a3d'} onInput={(e) => update((d) => (d.color = (e.currentTarget as HTMLInputElement).value))} />
                  </label>
                  <TextInput label="Identifiant (lien IA)" mono value={p.id} onInput={(v) => update((d) => (d.id = slugify(v) || d.id))} />
                </div>
              </div>
            </div>
            <I18nField label="Résumé (une phrase)" value={p.summary} multiline rows={2} onChange={(v) => update((d) => (d.summary = v))} />
            <I18nField label="Description détaillée" value={p.description} multiline rows={5} onChange={(v) => update((d) => (d.description = v))} />
            <I18nList label="Points clés" addLabel="Ajouter un point clé" multiline={false} items={p.highlights} onChange={(v) => update((d) => (d.highlights = v))} />
            <TagsInput label="Technologies" value={p.tech} onChange={(v) => update((d) => (d.tech = v))} />
            <MediaField label="Image de couverture (ou vidéo courte)" value={p.image} onChange={(v) => update((d) => (d.image = v))} hint="Format paysage conseillé (16:10)." />
            <StringList label="Galerie" addLabel="Ajouter une image, une vidéo ou un lien YouTube" items={p.gallery} onChange={(v) => update((d) => (d.gallery = v))} />
            <div class="f">
              <span class="f__label">Liens (démo, code source…)</span>
              <ListEditor
                compact
                items={p.links}
                onChange={(v) => update((d) => (d.links = v))}
                create={() => ({ id: uid(), label: '', url: '' })}
                title={(l) => l.label}
                addLabel="Ajouter un lien"
                render={(l, upd) => (
                  <div class="grid grid-2">
                    <TextInput label="Libellé" value={l.label} onInput={(v) => upd((d) => (d.label = v))} placeholder="Voir la démo" />
                    <TextInput label="Adresse" mono value={l.url} onInput={(v) => upd((d) => (d.url = v))} placeholder="https://…" />
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </Card>
  );
}

// --- Compétences ------------------------------------------------------------------------------------

export function SkillsEditor() {
  const c = draft.value!;
  return (
    <div class="stack">
      <Card title="Catégories de compétences">
        <ListEditor<SkillGroup>
          items={c.skills}
          onChange={(next) => edit((d) => (d.skills = next))}
          create={() => ({ id: uid(), name: emptyI18n(), items: [] })}
          title={(g) => `${g.name.fr} (${g.items.length})`}
          addLabel="Ajouter une catégorie"
          render={(g, update) => (
            <>
              <I18nField label="Nom de la catégorie" value={g.name} onChange={(v) => update((d) => (d.name = v))} />
              <TagsInput label="Éléments" value={g.items} onChange={(v) => update((d) => (d.items = v))} hint="Entrée ou virgule pour ajouter. Vous pouvez coller une liste séparée par des virgules." />
            </>
          )}
        />
      </Card>
      <Card title="Bandeau défilant" subtitle="Les mots qui défilent en grand au-dessus des compétences.">
        <TagsInput value={c.marquee} onChange={(v) => edit((d) => (d.marquee = v))} />
      </Card>
    </div>
  );
}

// --- Parcours ----------------------------------------------------------------------------------------

export function EducationEditor() {
  const c = draft.value!;
  return (
    <div class="stack">
      <Card title="Formation">
        <ListEditor<Education>
          items={c.education}
          onChange={(next) => edit((d) => (d.education = next))}
          create={() => ({ id: uid(), title: emptyI18n(), field: emptyI18n(), school: '', location: emptyI18n(), period: '', current: false, detail: emptyI18n() })}
          title={(e) => `${e.title.fr} — ${e.school}`}
          addLabel="Ajouter une formation"
          render={(e, update) => (
            <>
              <I18nField label="Diplôme" value={e.title} onChange={(v) => update((d) => (d.title = v))} />
              <I18nField label="Spécialité" value={e.field} onChange={(v) => update((d) => (d.field = v))} />
              <div class="grid grid-3">
                <TextInput label="Établissement" value={e.school} onInput={(v) => update((d) => (d.school = v))} />
                <TextInput label="Période" value={e.period} onInput={(v) => update((d) => (d.period = v))} placeholder="2022 — 2025" />
                <div style={{ alignSelf: 'end', paddingBottom: '0.6rem' }}>
                  <Toggle label="En cours" checked={e.current} onChange={(v) => update((d) => (d.current = v))} />
                </div>
              </div>
              <I18nField label="Lieu" value={e.location} onChange={(v) => update((d) => (d.location = v))} />
              <I18nField label="Précision (mise en avant)" value={e.detail} onChange={(v) => update((d) => (d.detail = v))} />
            </>
          )}
        />
      </Card>
      <Card title="Certifications">
        <ListEditor<Certification>
          items={c.certifications}
          onChange={(next) => edit((d) => (d.certifications = next))}
          create={() => ({ id: uid(), title: emptyI18n(), issuer: '', date: emptyI18n(), url: '' })}
          title={(x) => x.title.fr}
          addLabel="Ajouter une certification"
          render={(x, update) => (
            <>
              <I18nField label="Intitulé" value={x.title} onChange={(v) => update((d) => (d.title = v))} />
              <div class="grid grid-2">
                <TextInput label="Organisme" value={x.issuer} onInput={(v) => update((d) => (d.issuer = v))} />
                <TextInput label="Lien de vérification (optionnel)" mono value={x.url} onInput={(v) => update((d) => (d.url = v))} />
              </div>
              <I18nField label="Date" value={x.date} onChange={(v) => update((d) => (d.date = v))} placeholder="Août 2025" />
            </>
          )}
        />
      </Card>
      <Card title="Langues parlées">
        <ListEditor<LanguageSkill>
          items={c.languages}
          onChange={(next) => edit((d) => (d.languages = next))}
          create={() => ({ id: uid(), name: emptyI18n(), level: emptyI18n(), score: 70 })}
          title={(l) => `${l.name.fr} — ${l.level.fr}`}
          addLabel="Ajouter une langue"
          render={(l, update) => (
            <>
              <div class="grid grid-2">
                <I18nField label="Langue" value={l.name} onChange={(v) => update((d) => (d.name = v))} />
                <I18nField label="Niveau" value={l.level} onChange={(v) => update((d) => (d.level = v))} />
              </div>
              <label class="f">
                <span class="f__label">Jauge : {l.score} %</span>
                <input type="range" min={0} max={100} step={5} value={l.score} onInput={(e) => update((d) => (d.score = Number((e.currentTarget as HTMLInputElement).value)))} />
              </label>
            </>
          )}
        />
      </Card>
    </div>
  );
}

// --- Guide IA ----------------------------------------------------------------------------------------

export function GuideEditor() {
  const g = draft.value!.guide;
  const set = (mutate: (guide: typeof g) => void) => edit((d) => mutate(d.guide));
  const sectionOptions = SECTION_IDS.map((id) => ({ value: id, label: SECTION_NAMES[id] }));
  return (
    <div class="stack">
      <Card title="Personnalité du guide">
        <div class="stack">
          <Toggle label="Activer le guide IA sur le site" checked={g.enabled} onChange={(v) => set((x) => (x.enabled = v))} />
          <div class="grid grid-2">
            <TextInput label="Nom du guide" value={g.name} onInput={(v) => set((x) => (x.name = v))} />
            <Select
              label="Il parle de vous au…"
              value={g.pronoun}
              options={[
                { value: 'he', label: 'Masculin (il / he)' },
                { value: 'she', label: 'Féminin (elle / she)' },
                { value: 'they', label: 'Neutre (iel / they)' },
              ]}
              onChange={(v) => set((x) => (x.pronoun = v))}
            />
          </div>
          <I18nField label="Sous-titre" value={g.tagline} onChange={(v) => set((x) => (x.tagline = v))} />
          <I18nField label="Message d’accueil" value={g.greeting} multiline rows={3} onChange={(v) => set((x) => (x.greeting = v))} />
        </div>
      </Card>
      <Card title="Ce que l’IA doit savoir" subtitle="Informations privées pour le guide : elles ne sont pas affichées sur le site, mais l’IA s’en sert pour répondre.">
        <I18nField
          label="Informations supplémentaires"
          value={g.knowledge}
          multiline
          rows={8}
          hint="Ex. type de poste recherché, mobilité, télétravail, centres d’intérêt, projets personnels… Évitez les données sensibles (adresse, salaire minimum…)."
          onChange={(v) => set((x) => (x.knowledge = v))}
        />
      </Card>
      <Card title="Suggestions de questions" subtitle="Proposées aux visiteurs à l’ouverture du guide.">
        <I18nList label="Questions" addLabel="Ajouter une suggestion" multiline={false} items={g.suggestions} onChange={(v) => set((x) => (x.suggestions = v))} />
      </Card>
      <Card title="Visite guidée" subtitle="Chaque étape fait défiler la page jusqu’à une section et lit le texte à voix haute.">
        <ListEditor<TourStep>
          items={g.tour}
          onChange={(v) => set((x) => (x.tour = v))}
          create={() => ({ id: uid(), section: 'about', text: emptyI18n() })}
          title={(s, i) => `${i + 1}. ${SECTION_NAMES[s.section]}`}
          addLabel="Ajouter une étape"
          render={(s, update) => (
            <>
              <Select label="Section" value={s.section} options={sectionOptions} onChange={(v) => update((d) => (d.section = v))} />
              <I18nField label="Texte lu par le guide" value={s.text} multiline rows={3} onChange={(v) => update((d) => (d.text = v))} />
            </>
          )}
        />
      </Card>
      <Card title="Comportement">
        <div class="stack">
          <Toggle label="Proposer la lecture à voix haute" checked={g.voice} onChange={(v) => set((x) => (x.voice = v))} />
          <Toggle label="Afficher une bulle d’accueil aux nouveaux visiteurs" checked={g.autoGreet} onChange={(v) => set((x) => (x.autoGreet = v))} />
          <TextInput
            label="Délai avant la bulle (secondes)"
            type="number"
            value={String(g.greetDelay)}
            onInput={(v) => set((x) => (x.greetDelay = Math.max(2, Math.min(120, Number(v) || 8))))}
          />
        </div>
      </Card>
    </div>
  );
}

// --- Sections & référencement ----------------------------------------------------------------------

export function SectionsEditor() {
  const c = draft.value!;
  const move = (index: number, delta: number) =>
    edit((d) => {
      const target = index + delta;
      if (target < 1 || target >= d.sections.length) return;
      [d.sections[index], d.sections[target]] = [d.sections[target], d.sections[index]];
    });
  return (
    <div class="stack">
      <Card title="Sections" subtitle="Ordre, visibilité et titres. L’accueil reste toujours en premier.">
        <div class="list">
          {c.sections.map((s, i) => (
            <div class="item is-open" key={s.id}>
              <div class="item__head">
                <div class="item__title">
                  <span>{SECTION_NAMES[s.id]}</span>
                  {!s.visible && <span class="pill">Masquée</span>}
                </div>
                {s.id !== 'hero' && (
                  <div class="item__tools">
                    <button type="button" class="mini-btn" title="Monter" disabled={i <= 1} onClick={() => move(i, -1)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" class="mini-btn" title="Descendre" disabled={i === c.sections.length - 1} onClick={() => move(i, 1)}>
                      <Icon name="down" />
                    </button>
                  </div>
                )}
              </div>
              <div class="item__body">
                {s.id !== 'hero' && (
                  <Toggle
                    label="Section visible"
                    checked={s.visible}
                    onChange={(v) =>
                      edit((d) => {
                        d.sections[i].visible = v;
                      })
                    }
                  />
                )}
                <I18nField label="Nom (menu)" value={s.label} onChange={(v) => edit((d) => (d.sections[i].label = v))} />
                {s.id !== 'hero' && (
                  <>
                    <I18nField label="Titre" value={s.title} multiline rows={2} hint={EMPHASIS_HINT} onChange={(v) => edit((d) => (d.sections[i].title = v))} />
                    <I18nField label="Sous-titre (optionnel)" value={s.subtitle} multiline rows={2} onChange={(v) => edit((d) => (d.sections[i].subtitle = v))} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Référencement & partage" subtitle="Ce qu’affichent Google, LinkedIn, WhatsApp… quand on partage votre site.">
        <div class="stack">
          <I18nField label="Titre de la page" value={c.seo.title} onChange={(v) => edit((d) => (d.seo.title = v))} />
          <I18nField label="Description" value={c.seo.description} multiline rows={3} onChange={(v) => edit((d) => (d.seo.description = v))} hint="Idéalement 140 à 160 caractères." />
          <MediaField label="Image de partage (1200 × 630)" value={c.seo.image} onChange={(v) => edit((d) => (d.seo.image = v))} />
        </div>
      </Card>
    </div>
  );
}

// --- Textes de l'interface --------------------------------------------------------------------------

const GROUPS: Record<string, string> = {
  nav: 'Navigation',
  loader: 'Écran de chargement',
  hero: 'Accueil',
  about: 'À propos',
  exp: 'Expériences',
  projects: 'Projets',
  skills: 'Compétences',
  edu: 'Parcours',
  contact: 'Contact',
  footer: 'Pied de page',
  guide: 'Guide IA',
  notFound: 'Page introuvable',
  skip: 'Accessibilité',
};

export function UiTextsEditor() {
  const c = draft.value!;
  const [query, setQuery] = useState('');
  const overrides = LANGS.reduce((n, l) => n + Object.keys(c.ui[l] ?? {}).length, 0);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, UIKey[]>();
    for (const key of UI_KEYS) {
      const text = `${key} ${UI_STRINGS.fr[key]} ${UI_STRINGS.en[key]} ${UI_STRINGS.mg[key]}`.toLowerCase();
      if (q && !text.includes(q)) continue;
      const group = key.split('.')[0];
      map.set(group, [...(map.get(group) ?? []), key]);
    }
    return [...map.entries()];
  }, [query]);

  const setValue = (lang: (typeof LANGS)[number], key: UIKey, value: string) =>
    edit((d) => {
      const dict = { ...(d.ui[lang] ?? {}) };
      if (value.trim()) dict[key] = value;
      else delete dict[key];
      d.ui[lang] = dict;
    });

  return (
    <div class="stack">
      <div class="notice">
        <Icon name="info" />
        <div>
          Tous les petits textes du site (boutons, formulaire, guide…) ont une version par défaut dans les trois langues. Remplissez un champ pour la remplacer ; videz-le pour revenir au texte d’origine.
          Les mots entre accolades comme <code>{'{name}'}</code> sont remplacés automatiquement. {overrides > 0 && <strong>{overrides} texte(s) personnalisé(s).</strong>}
        </div>
      </div>
      <input class="input" placeholder="Rechercher un texte…" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      {groups.map(([group, keys]) => (
        <Card key={group} title={GROUPS[group] ?? group}>
          <div class="stack">
            {keys.map((key) => (
              <div class="f" key={key}>
                <span class="f__label">
                  {UI_STRINGS.fr[key]} <span class="muted small">({key})</span>
                </span>
                <div class="i18n">
                  {LANGS.map((lang) => (
                    <div class="i18n__row" key={lang}>
                      <span class="i18n__tag">{lang.toUpperCase()}</span>
                      <input class="input" lang={lang} placeholder={UI_STRINGS[lang][key]} value={c.ui[lang]?.[key] ?? ''} onInput={(e) => setValue(lang, key, (e.currentTarget as HTMLInputElement).value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

