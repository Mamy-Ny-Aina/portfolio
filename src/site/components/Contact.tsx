import { useRef, useState } from 'preact/hooks';
import type { UIKey } from '../../shared/i18n';
import { content, L, lang, t } from '../state';
import { sendContact } from '../lib/api';
import { scrollToSection } from '../lib/scroll';
import { sessionId, trackEvent } from '../lib/tracker';
import { Icon, SOCIAL_ICON } from './Icon';
import { SectionHead } from './Sections';

const MAX_FILE = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.xls,.xlsx,.zip';
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

type Errors = Partial<Record<'name' | 'email' | 'message' | 'file', UIKey>>;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function ContactForm() {
  const [values, setValues] = useState({ name: '', email: '', subject: '', message: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [alert, setAlert] = useState<UIKey | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sentName, setSentName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mountedAt = useRef(Date.now());
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof values) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key as keyof Errors]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const pickFile = (candidate: File | null | undefined) => {
    if (!candidate) return;
    const ext = candidate.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT.split(',').includes(`.${ext}`)) {
      setErrors((er) => ({ ...er, file: 'contact.errFileType' }));
      return;
    }
    if (candidate.size > MAX_FILE) {
      setErrors((er) => ({ ...er, file: 'contact.errFileSize' }));
      return;
    }
    setErrors((er) => ({ ...er, file: undefined }));
    setFile(candidate);
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!values.name.trim()) next.name = 'contact.errName';
    if (!EMAIL_RE.test(values.email.trim())) next.email = 'contact.errEmail';
    if (values.message.trim().length < 10) next.message = 'contact.errMessage';
    return next;
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (status === 'sending') return;
    const found = validate();
    setErrors(found);
    setAlert(null);
    if (Object.keys(found).length) return;

    const form = new FormData();
    form.set('name', values.name.trim());
    form.set('email', values.email.trim());
    form.set('subject', values.subject.trim());
    form.set('message', values.message.trim());
    form.set('lang', lang.value);
    form.set('sid', sessionId);
    form.set('elapsed', String(Date.now() - mountedAt.current));
    form.set('website', honeypot.current?.value ?? '');
    if (file) form.set('file', file, file.name);

    setStatus('sending');
    const result = await sendContact(form);
    if (result.ok) {
      setSentName(values.name.trim().split(/\s+/)[0] ?? '');
      setStatus('success');
      setValues({ name: '', email: '', subject: '', message: '' });
      setFile(null);
      trackEvent('contact_sent');
      return;
    }
    setStatus('idle');
    if (result.error === 'rate_limited') setAlert('contact.rateLimited');
    else if (result.error === 'name') setErrors({ name: 'contact.errName' });
    else if (result.error === 'email') setErrors({ email: 'contact.errEmail' });
    else if (result.error === 'message') setErrors({ message: 'contact.errMessage' });
    else if (result.error === 'file_size' || result.error === 'too_large') setErrors({ file: 'contact.errFileSize' });
    else if (result.error === 'file_type') setErrors({ file: 'contact.errFileType' });
    else setAlert('contact.error');
  };

  if (status === 'success') {
    return (
      <div class="form" data-reveal>
        <div class="form__success" role="status">
          <span class="check">
            <Icon name="check" />
          </span>
          <h3>{t('contact.successTitle')}</h3>
          <p>{t('contact.successText', { name: sentName })}</p>
          <button
            type="button"
            class="btn btn--ghost btn--small"
            onClick={() => {
              mountedAt.current = Date.now();
              setStatus('idle');
            }}
          >
            {t('contact.again')}
          </button>
        </div>
      </div>
    );
  }

  const field = (key: 'name' | 'email' | 'subject', type: string, label: UIKey, autoComplete: string) => (
    <div class={`field ${errors[key as keyof Errors] ? 'has-error' : ''}`}>
      <input
        id={`c-${key}`}
        name={key}
        type={type}
        placeholder=" "
        autoComplete={autoComplete}
        value={values[key]}
        onInput={set(key)}
        maxLength={key === 'name' ? 100 : 200}
        aria-invalid={Boolean(errors[key as keyof Errors])}
        aria-describedby={errors[key as keyof Errors] ? `c-${key}-err` : undefined}
      />
      <label for={`c-${key}`}>{t(label)}</label>
      {errors[key as keyof Errors] && (
        <span class="field__error" id={`c-${key}-err`}>
          {t(errors[key as keyof Errors]!)}
        </span>
      )}
    </div>
  );

  return (
    <form class="form" noValidate onSubmit={submit} data-reveal style={{ '--d': '150ms' }}>
      <div class="form__row">
        {field('name', 'text', 'contact.name', 'name')}
        {field('email', 'email', 'contact.email', 'email')}
      </div>
      {field('subject', 'text', 'contact.subject', 'off')}
      <div class={`field ${errors.message ? 'has-error' : ''}`}>
        <textarea
          id="c-message"
          name="message"
          placeholder={t('contact.messagePlaceholder')}
          value={values.message}
          onInput={set('message')}
          maxLength={5000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'c-message-err' : undefined}
        />
        <label for="c-message">{t('contact.message')}</label>
        {errors.message && (
          <span class="field__error" id="c-message-err">
            {t(errors.message)}
          </span>
        )}
      </div>

      <div class="hp" aria-hidden="true">
        <label>
          Website
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div class={`field ${errors.file ? 'has-error' : ''}`}>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            pickFile((e.currentTarget as HTMLInputElement).files?.[0]);
            (e.currentTarget as HTMLInputElement).value = '';
          }}
        />
        <div
          class={`drop ${dragging ? 'is-over' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={t('contact.file')}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer?.files?.[0]);
          }}
        >
          <Icon name={file ? 'file' : 'paperclip'} />
          {file ? (
            <span class="drop__file">
              <strong>{file.name}</strong>
              <small>{formatSize(file.size)}</small>
            </span>
          ) : (
            <span class="drop__file">
              {t('contact.drop')}
              <small>{t('contact.fileHint')}</small>
            </span>
          )}
          {file && (
            <button
              type="button"
              class="icon-btn icon-btn--plain"
              aria-label={t('contact.remove')}
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        {errors.file && <span class="field__error">{t(errors.file)}</span>}
      </div>

      {alert && (
        <p class="form__alert" role="alert">
          {t(alert)}
        </p>
      )}

      <div class="form__foot">
        <p class="form__privacy">{t('contact.privacy')}</p>
        <button type="submit" class="btn btn--primary" disabled={status === 'sending'} data-magnetic>
          {status === 'sending' ? t('contact.sending') : t('contact.send')}
          <Icon name="send" />
        </button>
      </div>
    </form>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class="btn btn--ghost btn--small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          trackEvent('email_copy');
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          window.location.href = `mailto:${value}`;
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} />
      {copied ? t('contact.copied') : t('contact.copy')}
    </button>
  );
}

export function Contact() {
  const p = content.value.profile;
  const socials = p.socials.filter((s) => s.url);
  const phones = [p.phone, p.phoneAlt].filter(Boolean);
  const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

  return (
    <section id="contact" class="sec" data-section="contact">
      <div class="wrap contact">
        <div>
          <SectionHead id="contact" />
          <ul class="contact__direct" data-reveal style={{ '--d': '120ms' }}>
            <li>
              <span class="label">{t('contact.emailLabel')}</span>
              <div class="contact__value">
                <a class="link" href={`mailto:${p.email}`} onClick={() => trackEvent('email_click')}>
                  {p.email}
                </a>
              </div>
              <CopyButton value={p.email} />
            </li>
            {p.showPhone && phones.length > 0 && (
              <li>
                <span class="label">{t('contact.phone')}</span>
                <div class="contact__value">
                  {phones.map((n) => (
                    <a key={n} class="link" href={tel(n)} onClick={() => trackEvent('phone_click')}>
                      {n}
                    </a>
                  ))}
                </div>
                {p.whatsapp ? (
                  <a class="btn btn--ghost btn--small" href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <Icon name="whatsapp" />
                    WhatsApp
                  </a>
                ) : (
                  <span />
                )}
              </li>
            )}
            <li>
              <span class="label">{t('contact.location')}</span>
              <div class="contact__value">
                <span>{L(p.location)}</span>
                <small>{p.coordinates}</small>
              </div>
              <button type="button" class="icon-btn" aria-label={L(p.location)} onClick={() => scrollToSection('about')}>
                <Icon name="pin" />
              </button>
            </li>
          </ul>
          {socials.length > 0 && (
            <div class="socials" data-reveal style={{ '--d': '200ms' }}>
              {socials.map((s) => (
                <a key={s.id} class="social" href={s.url} target="_blank" rel="noopener noreferrer me" onClick={() => trackEvent(`social:${s.id}`)}>
                  <Icon name={SOCIAL_ICON[s.icon] ?? 'globe'} />
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <ContactForm />
      </div>
    </section>
  );
}

export function Footer() {
  const p = content.value.profile;
  return (
    <footer class="footer">
      <div class="wrap">
        <div class="footer__big" aria-hidden="true">
          <span>{p.firstName}</span>
          <em>{p.lastName}</em>
        </div>
        <div class="footer__row">
          <span>
            © {new Date().getFullYear()} {p.firstName} {p.lastName}. {t('footer.rights')}
          </span>
          <span>{t('footer.made')}</span>
          <button type="button" onClick={() => scrollToSection('top')}>
            {t('footer.top')}
            <Icon name="arrowUp" />
          </button>
        </div>
        <p class="footer__note">{t('footer.analytics')}</p>
      </div>
    </footer>
  );
}
