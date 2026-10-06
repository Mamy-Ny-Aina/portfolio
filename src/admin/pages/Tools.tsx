import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ContentVersion, MediaFile, SiteContent, SystemStatus } from '../../shared/types';
import { defaultContent } from '../../shared/defaultContent';
import { mergeContent } from '../../shared/utils';
import { api, authenticated, errorText } from '../api';
import { confirmAction, dirty, draft, replaceDraft, saved, toast } from '../store';
import { Icon } from '../components/Icon';
import { Card, EmptyState, MediaThumb, Spinner, TextInput, formatBytes, formatDate, uploadWithOptimization } from '../components/ui';

// --- Médiathèque ------------------------------------------------------------------------------

export function Media() {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ files: MediaFile[] }>('/files');
      setFiles(data.files);
    } catch (err) {
      toast(errorText(err), 'error');
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAll = async (list: FileList | File[] | null | undefined) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      setUploading({ name: file.name, progress: 0 });
      await uploadWithOptimization(file, (progress) => setUploading({ name: file.name, progress }));
    }
    setUploading(null);
    void load();
  };

  const remove = async (file: MediaFile) => {
    const used = JSON.stringify(draft.value ?? {}).includes(file.url);
    const message = used
      ? `« ${file.name} » est utilisé dans le contenu du site. Le supprimer quand même ? (l’image disparaîtra du site)`
      : `Supprimer « ${file.name} » ?`;
    if (!(await confirmAction(message))) return;
    try {
      await api.del(`/files/${file.key}`);
      setFiles((prev) => prev?.filter((f) => f.key !== file.key) ?? prev);
      toast('Fichier supprimé.');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const copy = async (file: MediaFile) => {
    try {
      await navigator.clipboard.writeText(new URL(file.url, location.origin).toString());
      toast('Adresse copiée.');
    } catch {
      toast(file.url, 'info');
    }
  };

  return (
    <div class="stack">
      <div
        class={`dropzone ${over ? 'is-over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void uploadAll(e.dataTransfer?.files);
        }}
      >
        <Icon name="upload" />
        <strong>Déposez vos fichiers ici ou cliquez pour parcourir</strong>
        <span class="muted small">Images, vidéos (mp4/webm), PDF, documents · 20 Mo max par fichier · les grandes photos sont optimisées en WebP automatiquement</span>
        {uploading && (
          <div style={{ width: 'min(320px, 100%)' }}>
            <span class="small">{uploading.name}</span>
            <div class="progress-line">
              <i style={{ width: `${Math.round(uploading.progress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      <input ref={input} type="file" multiple hidden onChange={(e) => void uploadAll((e.currentTarget as HTMLInputElement).files)} />

      {files === null ? (
        <div class="empty">
          <Spinner />
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon="image">Votre médiathèque est vide. Ajoutez des captures de vos projets, votre CV, des vidéos de démonstration…</EmptyState>
      ) : (
        <div class="media-grid">
          {files.map((f) => (
            <div class="media" key={f.key}>
              <a class="media__thumb" href={f.url} target="_blank" rel="noopener">
                <MediaThumb url={f.url} type={f.type} />
              </a>
              <div class="media__info">
                <strong title={f.name}>{f.name}</strong>
                <span class="muted">
                  {formatBytes(f.size)} · {formatDate(f.createdAt, false)}
                </span>
              </div>
              <div class="media__tools">
                <button type="button" class="mini-btn" title="Copier l’adresse" onClick={() => copy(f)}>
                  <Icon name="link" />
                </button>
                <button type="button" class="mini-btn danger" title="Supprimer" onClick={() => remove(f)}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Paramètres ------------------------------------------------------------------------------------

const PROVIDER_NAMES: Record<string, string> = {
  'workers-ai': 'Cloudflare Workers AI (gratuit)',
  claude: 'Claude (Anthropic)',
  gemini: 'Google Gemini',
  local: 'Guide hors ligne (sans IA)',
};

export function Settings() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api.get<SystemStatus>('/status'), api.get<{ versions: ContentVersion[] }>('/content/history')]);
      setStatus(s);
      setVersions(h.versions);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const changePassword = async (e: Event) => {
    e.preventDefault();
    if (pwd.next.length < 10) return toast('Le nouveau mot de passe doit contenir au moins 10 caractères.', 'error');
    if (pwd.next !== pwd.confirm) return toast('Les deux mots de passe ne correspondent pas.', 'error');
    setPwdBusy(true);
    try {
      await api.post('/password', { current: pwd.current, next: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      toast('Mot de passe modifié. Notez-le bien !');
      void loadAll();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setPwdBusy(false);
    }
  };

  const exportContent = () => {
    const blob = new Blob([JSON.stringify(saved.value ?? draft.value, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio-contenu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importContent = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<SiteContent>;
      if (!parsed || typeof parsed !== 'object' || !parsed.profile) throw new Error('format');
      replaceDraft(mergeContent(defaultContent, parsed));
      toast('Contenu importé dans le brouillon. Vérifiez puis cliquez sur « Enregistrer ».', 'info');
    } catch {
      toast('Fichier invalide : il doit s’agir d’une sauvegarde JSON du portfolio.', 'error');
    }
  };

  const restore = async (version: ContentVersion) => {
    if (dirty.value && !(await confirmAction('Vous avez des modifications non enregistrées : elles seront perdues. Continuer ?'))) return;
    if (!(await confirmAction(`Restaurer la version du ${formatDate(version.createdAt)} ? Le site sera mis à jour immédiatement.`, false))) return;
    try {
      const { content } = await api.post<{ content: SiteContent }>(`/content/restore/${version.id}`);
      saved.value = content;
      replaceDraft(content);
      toast('Version restaurée.');
      void loadAll();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const resetToCv = async () => {
    if (!(await confirmAction('Remplacer tout le contenu par la version initiale tirée du CV ? (une sauvegarde reste dans l’historique)'))) return;
    try {
      const { content } = await api.post<{ content: SiteContent }>('/content/reset');
      saved.value = content;
      replaceDraft(content);
      toast('Contenu réinitialisé.');
      void loadAll();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const purge = async (olderThanDays?: number) => {
    const label = olderThanDays ? `les visites de plus de ${olderThanDays} jours` : 'TOUTES les statistiques de visite';
    if (!(await confirmAction(`Supprimer ${label} ? Cette action est définitive.`))) return;
    try {
      await api.del(`/visitors${olderThanDays ? `?olderThanDays=${olderThanDays}` : ''}`);
      toast('Statistiques supprimées.');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const logout = async () => {
    await api.post('/logout').catch(() => {});
    authenticated.value = false;
  };

  return (
    <div class="stack">
      <div class="grid grid-2">
        <Card title="Guide IA">
          {!status ? (
            <Spinner />
          ) : (
            <div class="stack">
              <p>
                Fournisseur actif : <strong>{PROVIDER_NAMES[status.ai.provider] ?? status.ai.provider}</strong>
              </p>
              <p class="muted small">
                Ordre de secours : {status.ai.chain.length ? status.ai.chain.map((p) => PROVIDER_NAMES[p] ?? p).join(' → ') : 'aucun'} → guide hors ligne.
              </p>
              <div class="notice">
                <Icon name="info" />
                <div>
                  Pour des réponses encore meilleures (notamment en malagasy), ajoutez une clé gratuite Google Gemini (<code>GEMINI_API_KEY</code>) ou une clé Claude
                  (<code>ANTHROPIC_API_KEY</code>) avec <code>npx wrangler secret put …</code>. Voir le README.
                </div>
              </div>
            </div>
          )}
        </Card>
        <Card title="Envoi des e-mails">
          {!status ? (
            <Spinner />
          ) : status.email.configured ? (
            <div class="stack">
              <p>
                <span class="pill pill--ok">Actif</span> Les messages sont envoyés à <strong>{status.email.to}</strong>.
              </p>
              <p class="muted small">Expéditeur : {status.email.from}</p>
            </div>
          ) : (
            <div class="notice">
              <Icon name="info" />
              <div>
                Les messages sont bien enregistrés ici, mais pas encore envoyés par e-mail. Créez une clé gratuite sur <strong>resend.com</strong> (avec l’adresse{' '}
                {status.email.to ?? 'de destination'}) puis : <code>npx wrangler secret put RESEND_API_KEY</code>.
              </div>
            </div>
          )}
        </Card>
        <Card title="Stockage">
          {!status ? (
            <Spinner />
          ) : (
            <dl class="kv">
              <dt>Fichiers</dt>
              <dd>
                {status.storage.files} · {formatBytes(status.storage.bytes)}
              </dd>
              <dt>Contenu publié</dt>
              <dd>{status.content.updatedAt ? formatDate(Date.parse(status.content.updatedAt)) : 'Version d’origine (CV)'}</dd>
              <dt>Versions</dt>
              <dd>{status.content.versions} sauvegarde(s) dans l’historique</dd>
            </dl>
          )}
        </Card>
        <Card title="Sécurité" subtitle={status?.admin.passwordSource === 'database' ? 'Mot de passe personnalisé actif.' : 'Mot de passe initial (variable ADMIN_PASSWORD).'}>
          <form class="stack" onSubmit={changePassword}>
            <TextInput label="Mot de passe actuel" type="password" value={pwd.current} onInput={(v) => setPwd({ ...pwd, current: v })} />
            <div class="grid grid-2">
              <TextInput label="Nouveau mot de passe" type="password" value={pwd.next} onInput={(v) => setPwd({ ...pwd, next: v })} hint="10 caractères minimum." />
              <TextInput label="Confirmation" type="password" value={pwd.confirm} onInput={(v) => setPwd({ ...pwd, confirm: v })} />
            </div>
            <div class="row">
              <button type="submit" class="btn btn--primary btn--small" disabled={pwdBusy || !pwd.current || !pwd.next}>
                <Icon name="shield" />
                Changer le mot de passe
              </button>
              <button type="button" class="btn btn--ghost btn--small right" onClick={logout}>
                <Icon name="logout" />
                Se déconnecter
              </button>
            </div>
          </form>
        </Card>
      </div>

      <Card title="Sauvegardes & historique" subtitle="Chaque enregistrement crée une version (les 30 dernières sont conservées).">
        <div class="row" style={{ marginBottom: '1rem' }}>
          <button type="button" class="btn btn--ghost btn--small" onClick={exportContent}>
            <Icon name="download" />
            Exporter le contenu (JSON)
          </button>
          <button type="button" class="btn btn--ghost btn--small" onClick={() => importInput.current?.click()}>
            <Icon name="upload" />
            Importer une sauvegarde
          </button>
          <button type="button" class="btn btn--danger btn--small right" onClick={resetToCv}>
            <Icon name="refresh" />
            Revenir au contenu du CV
          </button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(e) => void importContent((e.currentTarget as HTMLInputElement).files?.[0])} />
        </div>
        {versions === null ? (
          <Spinner />
        ) : versions.length === 0 ? (
          <p class="muted small">Aucune version enregistrée : le site affiche encore le contenu d’origine.</p>
        ) : (
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Note</th>
                  <th>Taille</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v, i) => (
                  <tr key={v.id} style={{ cursor: 'default' }}>
                    <td>
                      {formatDate(v.createdAt)} {i === 0 && <span class="pill pill--ok">En ligne</span>}
                    </td>
                    <td class="muted">{v.note ?? '—'}</td>
                    <td class="muted">{formatBytes(v.size)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {i > 0 && (
                        <button type="button" class="btn btn--ghost btn--small" onClick={() => restore(v)}>
                          <Icon name="history" />
                          Restaurer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Données de visite" subtitle="Les statistiques ne contiennent ni nom ni adresse IP en clair.">
        <div class="row">
          <button type="button" class="btn btn--ghost btn--small" onClick={() => purge(180)}>
            Supprimer les visites de plus de 6 mois
          </button>
          <button type="button" class="btn btn--danger btn--small" onClick={() => purge()}>
            <Icon name="trash" />
            Tout effacer
          </button>
        </div>
      </Card>
    </div>
  );
}
