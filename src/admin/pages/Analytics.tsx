import { useCallback, useEffect, useState } from 'preact/hooks';
import type { ChatSessionSummary, ContactMessage, CountItem, SessionDetail, StatsResponse, VisitorSession } from '../../shared/types';
import { api, errorText } from '../api';
import { confirmAction, draft, toast, unread } from '../store';
import { Icon } from '../components/Icon';
import {
  AreaChart,
  BarList,
  Card,
  Country,
  Delta,
  Drawer,
  EmptyState,
  HourBars,
  Spinner,
  countryName,
  formatBytes,
  formatDate,
  formatDuration,
  timeAgo,
} from '../components/ui';

const tzMinutes = () => -new Date().getTimezoneOffset();

const LANG_NAMES: Record<string, string> = { fr: 'Français', en: 'English', mg: 'Malagasy' };

function sectionName(id: string): string {
  const s = draft.value?.sections.find((x) => x.id === id);
  return s?.label.fr || id;
}

function eventLabel(name: string): string {
  const fixed: Record<string, string> = {
    cv_download: 'CV téléchargé',
    tour_start: 'Visite guidée lancée',
    tour_end: 'Visite guidée terminée',
    guide_open: 'Guide IA ouvert',
    guide_question: 'Question posée au guide',
    guide_bubble: 'Bulle d’accueil affichée',
    contact_sent: 'Message envoyé',
    email_copy: 'E-mail copié',
    email_click: 'Clic sur l’e-mail',
    phone_click: 'Clic sur le téléphone',
  };
  if (fixed[name]) return fixed[name];
  const [kind, arg] = name.split(':');
  if (kind === 'project_open') {
    const p = draft.value?.projects.find((x) => x.id === arg);
    return `Projet ouvert : ${p?.title.fr ?? arg}`;
  }
  if (kind === 'lang') return `Langue choisie : ${LANG_NAMES[arg] ?? arg}`;
  if (kind === 'theme') return `Thème ${arg === 'light' ? 'clair' : 'sombre'}`;
  if (kind === 'social') return `Lien ${arg}`;
  return name;
}

function referrerLabel(host: string) {
  return host === 'direct' ? 'Accès direct' : host;
}

function fillDays(daily: StatsResponse['daily'], days: number) {
  const map = new Map(daily.map((d) => [d.d, d]));
  const out: { label: string; a: number; b: number }[] = [];
  const shift = tzMinutes() * 60_000;
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() + shift - i * 86_400_000).toISOString().slice(0, 10);
    const row = map.get(key);
    out.push({ label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, a: row?.visitors ?? 0, b: row?.sessions ?? 0 });
  }
  return out;
}

// --- Tableau de bord ---------------------------------------------------------------------------

export function Dashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<StatsResponse>(`/stats?days=${days}&tz=${tzMinutes()}`);
      setStats(data);
      unread.value = data.unreadMessages;
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }, [days]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!stats) return <div class="empty">{error ? <p>{error}</p> : <Spinner />}</div>;
  const { totals: t, previous: p } = stats;
  const cv = stats.events.find((e) => e.k === 'cv_download')?.n ?? 0;
  const sectionOrder = (draft.value?.sections ?? []).map((s) => s.id);
  const funnel = sectionOrder.map((id) => ({ id, n: stats.sections.find((s) => s.k === id)?.n ?? 0 }));
  const sessionsTotal = Math.max(1, t.sessions);

  const kpis: { label: string; icon: Parameters<typeof Icon>[0]['name']; value: string; now: number; before: number; invert?: boolean }[] = [
    { label: 'Visiteurs uniques', icon: 'users', value: String(t.visitors), now: t.visitors, before: p.visitors },
    { label: 'Visites', icon: 'activity', value: String(t.sessions), now: t.sessions, before: p.sessions },
    { label: 'Durée moyenne', icon: 'clock', value: formatDuration(t.avgDuration), now: t.avgDuration, before: p.avgDuration },
    { label: 'Taux de rebond', icon: 'logout', value: `${Math.round(t.bounceRate * 100)} %`, now: t.bounceRate, before: p.bounceRate, invert: true },
    { label: 'Messages reçus', icon: 'inbox', value: String(t.messages), now: t.messages, before: p.messages },
    { label: 'Questions au guide IA', icon: 'chat', value: String(t.chatMessages), now: t.chatMessages, before: p.chatMessages },
    { label: 'Visites guidées', icon: 'play', value: String(t.tours), now: t.tours, before: p.tours },
    { label: 'CV téléchargés', icon: 'download', value: String(cv), now: cv, before: 0 },
  ];

  return (
    <div class="stack">
      <div class="row">
        <div class="seg" role="group" aria-label="Période">
          {[7, 30, 90, 365].map((d) => (
            <button type="button" key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d === 365 ? '1 an' : `${d} jours`}
            </button>
          ))}
        </div>
        <span class="live right">
          <span class="pulse-dot" />
          {stats.live.length} visiteur{stats.live.length > 1 ? 's' : ''} en ligne
        </span>
      </div>

      <div class="grid grid-4">
        {kpis.map((k) => (
          <div class="kpi" key={k.label}>
            <span class="kpi__label">
              <Icon name={k.icon} />
              {k.label}
            </span>
            <span class="kpi__value">{k.value}</span>
            <Delta now={k.now} before={k.before} invert={k.invert} />
          </div>
        ))}
      </div>

      <Card
        title="Fréquentation"
        subtitle={`Sur les ${days === 365 ? '12 derniers mois' : `${days} derniers jours`} (heure locale)`}
        actions={
          <div class="legend">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              Visiteurs
            </span>
            <span>
              <i style={{ background: 'var(--text-3)' }} />
              Visites
            </span>
          </div>
        }
      >
        <AreaChart points={fillDays(stats.daily, days)} />
      </Card>

      {stats.live.length > 0 && (
        <Card title="En ce moment sur le site">
          <div class="bars">
            {stats.live.map((v) => (
              <div class="bar" key={v.id} style={{ '--w': '100%' }}>
                <span>
                  <Country code={v.country} /> {v.city ? `· ${v.city}` : ''} · {v.device} {v.browser}
                </span>
                <span class="muted small">{v.section ? `regarde « ${sectionName(v.section)} »` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div class="grid grid-2">
        <Card title="Pays">
          <BarList items={stats.countries} render={(i) => <Country code={i.k} />} />
        </Card>
        <Card title="Villes">
          <BarList items={stats.cities} render={(i) => `${i.k}${i.c ? ` · ${countryName(i.c)}` : ''}`} />
        </Card>
        <Card title="Provenance" subtitle="Site d’où arrivent les visiteurs">
          <BarList items={stats.referrers} render={(i) => referrerLabel(i.k)} />
        </Card>
        <Card title="Parcours dans le site" subtitle="Part des visites ayant atteint chaque section">
          <div class="funnel">
            {funnel.map((f) => (
              <div class="funnel__row" key={f.id}>
                <span>{sectionName(f.id)}</span>
                <div class="funnel__bar">
                  <i style={{ width: `${Math.min(100, (f.n / sessionsTotal) * 100)}%` }} />
                </div>
                <span class="muted small">{Math.round((f.n / sessionsTotal) * 100)} %</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Appareils & navigateurs">
          <div class="grid grid-2">
            <BarList items={stats.devices} />
            <BarList items={stats.browsers} />
          </div>
        </Card>
        <Card title="Systèmes & langues">
          <div class="grid grid-2">
            <BarList items={stats.os} />
            <BarList items={stats.langs} render={(i) => LANG_NAMES[i.k] ?? i.k} />
          </div>
        </Card>
        <Card title="Heures de visite" subtitle="Selon votre fuseau horaire">
          <HourBars hours={stats.hours} />
        </Card>
        <Card title="Actions des visiteurs">
          <BarList items={stats.events.map((e: CountItem) => ({ ...e, k: eventLabel(e.k) }))} empty="Aucune action enregistrée pour le moment." />
        </Card>
      </div>
    </div>
  );
}

// --- Fiche d'une visite -----------------------------------------------------------------------

export function SessionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get<SessionDetail>(`/visitors/${encodeURIComponent(id)}`)
      .then(setDetail)
      .catch((err) => setError(errorText(err)));
  }, [id]);

  return (
    <Drawer onClose={onClose}>
      <div class="card__head">
        <h3>Détail de la visite</h3>
        <button type="button" class="mini-btn" aria-label="Fermer" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {!detail ? (
        <div class="empty">{error || <Spinner />}</div>
      ) : (
        <div class="stack">
          <dl class="kv">
            <dt>Début</dt>
            <dd>{formatDate(detail.session.startedAt)}</dd>
            <dt>Durée active</dt>
            <dd>{formatDuration(detail.session.duration)}</dd>
            <dt>Lieu</dt>
            <dd>
              <Country code={detail.session.country} />
              {detail.session.city ? ` · ${detail.session.city}` : ''}
              {detail.session.region ? ` (${detail.session.region})` : ''}
            </dd>
            <dt>Appareil</dt>
            <dd>
              {detail.session.device} · {detail.session.os} · {detail.session.browser}
              {detail.session.screen ? ` · ${detail.session.screen}` : ''}
            </dd>
            <dt>Provenance</dt>
            <dd>{detail.session.referrer || 'Accès direct'}</dd>
            {detail.session.utmSource && (
              <>
                <dt>Campagne</dt>
                <dd>{detail.session.utmSource}</dd>
              </>
            )}
            <dt>Langue du site</dt>
            <dd>{LANG_NAMES[detail.session.lang ?? ''] ?? detail.session.lang ?? '—'}</dd>
            <dt>Visiteur</dt>
            <dd>{detail.session.isNew ? 'Première visite' : 'Visiteur récurrent'}</dd>
          </dl>
          <div>
            <p class="f__label" style={{ marginBottom: '0.5rem' }}>
              Sections vues
            </p>
            <div class="row">
              {detail.session.sections.length ? detail.session.sections.map((s) => <span class="pill" key={s}>{sectionName(s)}</span>) : <span class="muted small">—</span>}
            </div>
          </div>
          {detail.events.length > 0 && (
            <div>
              <p class="f__label" style={{ marginBottom: '0.5rem' }}>
                Actions
              </p>
              <ul class="timeline">
                {detail.events.map((e, i) => (
                  <li key={i}>
                    <time>{new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time>
                    {eventLabel(e.name ?? e.type)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.chat.length > 0 && (
            <div>
              <p class="f__label" style={{ marginBottom: '0.5rem' }}>
                Conversation avec le guide IA
              </p>
              <Transcript messages={detail.chat} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Transcript({ messages }: { messages: { role: string; content: string; createdAt: number; provider: string | null }[] }) {
  return (
    <div class="transcript">
      {messages.map((m, i) => (
        <div key={i} class={`bubble bubble--${m.role === 'user' ? 'user' : 'assistant'}`}>
          {m.content}
          <small>
            {new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            {m.provider ? ` · ${m.provider}` : ''}
          </small>
        </div>
      ))}
    </div>
  );
}

// --- Visiteurs -----------------------------------------------------------------------------------

type Filter = 'all' | 'chat' | 'contact' | 'tour';

export function Visitors() {
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<VisitorSession[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ limit: '50', filter });
        if (before) query.set('before', String(before));
        const data = await api.get<{ sessions: VisitorSession[]; total: number; hasMore: boolean }>(`/visitors?${query}`);
        setRows((prev) => (before && prev ? [...prev, ...data.sessions] : data.sessions));
        setHasMore(data.hasMore);
        setTotal(data.total);
      } catch (err) {
        toast(errorText(err), 'error');
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  return (
    <div class="stack">
      <div class="row">
        <div class="seg" role="group" aria-label="Filtre">
          {(
            [
              ['all', 'Toutes les visites'],
              ['chat', 'Ont discuté avec l’IA'],
              ['contact', 'Ont envoyé un message'],
              ['tour', 'Visite guidée'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <span class="muted small right">{total} visite(s) enregistrée(s) au total</span>
      </div>

      {rows === null ? (
        <div class="empty">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="users">Aucune visite pour ce filtre. Les visites apparaissent ici en temps réel.</EmptyState>
      ) : (
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lieu</th>
                <th>Appareil</th>
                <th>Durée</th>
                <th>Parcours</th>
                <th>Provenance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s.id)}>
                  <td>
                    <div>{formatDate(s.startedAt)}</div>
                    <div class="muted small">{timeAgo(s.lastSeen)}</div>
                  </td>
                  <td>
                    <Country code={s.country} />
                    {s.city && <div class="muted small">{s.city}</div>}
                  </td>
                  <td>
                    <div>{s.device}</div>
                    <div class="muted small">
                      {s.os} · {s.browser}
                    </div>
                  </td>
                  <td>{formatDuration(s.duration)}</td>
                  <td>
                    <span class="muted small">
                      {s.sections.length} section{s.sections.length > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td class="small">{s.referrerHost ?? 'Direct'}</td>
                  <td>
                    <div class="row" style={{ gap: '0.3rem' }}>
                      {s.isNew ? <span class="pill">Nouveau</span> : <span class="pill">Revenu</span>}
                      {s.chatCount > 0 && <span class="pill pill--accent">IA ×{s.chatCount}</span>}
                      {s.contacted && <span class="pill pill--ok">Message</span>}
                      {s.tour && <span class="pill pill--warn">Visite</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && rows && (
        <button type="button" class="btn btn--ghost btn--small" disabled={loading} onClick={() => load(rows[rows.length - 1].startedAt)}>
          {loading ? 'Chargement…' : 'Charger plus'}
        </button>
      )}
      {selected && <SessionDrawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// --- Messages ----------------------------------------------------------------------------------

const EMAIL_STATUS: Record<string, [string, string]> = {
  sent: ['E-mail envoyé', 'pill--ok'],
  failed: ['Échec de l’e-mail', 'pill--warn'],
  disabled: ['E-mail non configuré', ''],
  pending: ['En cours', ''],
};

export function Messages() {
  const [list, setList] = useState<ContactMessage[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [session, setSession] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ messages: ContactMessage[] }>('/messages');
      setList(data.messages);
      unread.value = data.messages.filter((m) => !m.isRead).length;
    } catch (err) {
      toast(errorText(err), 'error');
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = list?.find((m) => m.id === activeId) ?? null;

  const markRead = async (message: ContactMessage, read: boolean) => {
    setList((prev) => prev?.map((m) => (m.id === message.id ? { ...m, isRead: read } : m)) ?? prev);
    unread.value = Math.max(0, unread.value + (read ? -1 : 1));
    try {
      await api.patch(`/messages/${message.id}`, { read });
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const open = (message: ContactMessage) => {
    setActiveId(message.id);
    if (!message.isRead) void markRead(message, true);
  };

  const remove = async (message: ContactMessage) => {
    if (!(await confirmAction(`Supprimer définitivement le message de ${message.name} ?`))) return;
    try {
      await api.del(`/messages/${message.id}`);
      setList((prev) => prev?.filter((m) => m.id !== message.id) ?? prev);
      setActiveId(null);
      toast('Message supprimé.');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  if (list === null) {
    return (
      <div class="empty">
        <Spinner />
      </div>
    );
  }
  if (!list.length) return <EmptyState icon="inbox">Aucun message pour le moment. Ils arriveront ici (et par e-mail si Resend est configuré).</EmptyState>;

  const replyHref = (m: ContactMessage) => {
    const quoted = m.body
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n');
    return `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'votre message'}`)}&body=${encodeURIComponent(`Bonjour ${m.name},\n\n\n\n${quoted}`)}`;
  };

  return (
    <div class="inbox">
      <div class="inbox__list">
        {list.map((m) => (
          <button type="button" key={m.id} class={`inbox__item ${m.id === activeId ? 'is-active' : ''} ${m.isRead ? '' : 'is-unread'}`} onClick={() => open(m)}>
            <strong>
              {m.name}
              {m.fileName && <Icon name="paperclip" width={14} height={14} />}
            </strong>
            <span class="small">{m.subject || 'Sans sujet'}</span>
            <p>{m.body}</p>
            <span class="muted small">{timeAgo(m.createdAt)}</span>
          </button>
        ))}
      </div>
      <div class="inbox__view">
        {!active ? (
          <EmptyState icon="mail">Sélectionnez un message pour le lire.</EmptyState>
        ) : (
          <div class="stack">
            <div class="row">
              <span class={`pill ${EMAIL_STATUS[active.emailStatus ?? '']?.[1] ?? ''}`}>{EMAIL_STATUS[active.emailStatus ?? '']?.[0] ?? active.emailStatus}</span>
              {active.country && (
                <span class="pill">
                  <Country code={active.country} />
                </span>
              )}
              {active.lang && <span class="pill">{LANG_NAMES[active.lang] ?? active.lang}</span>}
              <span class="muted small right">{formatDate(active.createdAt)}</span>
            </div>
            <div>
              <h2>{active.subject || 'Sans sujet'}</h2>
              <p class="muted">
                {active.name} ·{' '}
                <a class="link" href={`mailto:${active.email}`}>
                  {active.email}
                </a>
              </p>
            </div>
            <div class="inbox__body">{active.body}</div>
            {active.fileKey && (
              <a class="btn btn--ghost btn--small" href={`/api/files/${active.fileKey}?download=1`} target="_blank" rel="noopener">
                <Icon name="paperclip" />
                {active.fileName} {active.fileSize ? `(${formatBytes(active.fileSize)})` : ''}
              </a>
            )}
            <div class="row">
              <a class="btn btn--primary btn--small" href={replyHref(active)}>
                <Icon name="mail" />
                Répondre
              </a>
              <button type="button" class="btn btn--ghost btn--small" onClick={() => markRead(active, !active.isRead)}>
                {active.isRead ? 'Marquer comme non lu' : 'Marquer comme lu'}
              </button>
              {active.sessionId && (
                <button type="button" class="btn btn--ghost btn--small" onClick={() => setSession(active.sessionId)}>
                  <Icon name="eye" />
                  Voir la visite
                </button>
              )}
              <button type="button" class="btn btn--danger btn--small right" onClick={() => remove(active)}>
                <Icon name="trash" />
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
      {session && <SessionDrawer id={session} onClose={() => setSession(null)} />}
    </div>
  );
}

// --- Conversations avec le guide IA -----------------------------------------------------------

export function Chats() {
  const [list, setList] = useState<ChatSessionSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; createdAt: number; provider: string | null }[] | null>(null);
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ chats: ChatSessionSummary[]; totalQuestions: number }>('/chats?limit=100')
      .then((data) => {
        setList(data.chats);
        setTotal(data.totalQuestions);
      })
      .catch((err) => {
        toast(errorText(err), 'error');
        setList([]);
      });
  }, []);

  const open = async (sid: string) => {
    setActive(sid);
    setMessages(null);
    try {
      const data = await api.get<{ messages: { role: string; content: string; createdAt: number; provider: string | null }[] }>(`/chats/${encodeURIComponent(sid)}`);
      setMessages(data.messages);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const remove = async (sid: string) => {
    if (!(await confirmAction('Supprimer cette conversation ?'))) return;
    await api.del(`/chats/${encodeURIComponent(sid)}`);
    setList((prev) => prev?.filter((c) => c.sessionId !== sid) ?? prev);
    setActive(null);
    toast('Conversation supprimée.');
  };

  if (list === null) {
    return (
      <div class="empty">
        <Spinner />
      </div>
    );
  }
  if (!list.length) return <EmptyState icon="chat">Aucune conversation pour le moment. Les questions posées au guide IA apparaîtront ici.</EmptyState>;

  return (
    <div class="stack">
      <p class="muted small">
        {total} question{total > 1 ? 's' : ''} posée{total > 1 ? 's' : ''} au guide au total. Ces échanges vous montrent ce que les visiteurs veulent savoir : complétez au besoin
        les « informations pour l’IA » dans Contenu → Guide IA.
      </p>
      <div class="inbox">
        <div class="inbox__list">
          {list.map((c) => (
            <button type="button" key={c.sessionId} class={`inbox__item ${c.sessionId === active ? 'is-active' : ''}`} onClick={() => open(c.sessionId)}>
              <strong>{c.firstQuestion}</strong>
              <span class="small">
                {c.count} question{c.count > 1 ? 's' : ''} · {LANG_NAMES[c.lang ?? ''] ?? c.lang} · {c.country ? countryName(c.country) : 'Lieu inconnu'}
              </span>
              <span class="muted small">{timeAgo(c.lastAt)}</span>
            </button>
          ))}
        </div>
        <div class="inbox__view">
          {!active ? (
            <EmptyState icon="chat">Sélectionnez une conversation.</EmptyState>
          ) : !messages ? (
            <div class="empty">
              <Spinner />
            </div>
          ) : (
            <div class="stack">
              <div class="row">
                <button type="button" class="btn btn--ghost btn--small" onClick={() => setSession(active)}>
                  <Icon name="eye" />
                  Voir la visite
                </button>
                <button type="button" class="btn btn--danger btn--small right" onClick={() => remove(active)}>
                  <Icon name="trash" />
                  Supprimer
                </button>
              </div>
              <Transcript messages={messages} />
            </div>
          )}
        </div>
      </div>
      {session && <SessionDrawer id={session} onClose={() => setSession(null)} />}
    </div>
  );
}
