import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { LANGS, type Lang } from '../../src/shared/types';
import { isLang, stripEmphasis, tr } from '../../src/shared/utils';
import { loadContent } from './content';
import { escapeHtml } from './util';

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

/** Sert la page d'accueil avec des balises SEO à jour (titre, description, Open Graph, JSON-LD). */
export async function renderHome(c: Context<AppEnv>): Promise<Response> {
  const url = new URL(c.req.url);
  const asset = await c.env.ASSETS.fetch(new Request(new URL('/', url).toString(), { method: 'GET' }));
  if (!asset.ok || !(asset.headers.get('content-type') ?? '').includes('text/html')) return asset;

  const { content } = await loadContent(c.env);
  const queryLang = url.searchParams.get('lang');
  const lang: Lang = isLang(queryLang) ? queryLang : 'fr';
  const p = content.profile;
  const title = stripEmphasis(tr(content.seo.title, lang));
  const description = stripEmphasis(tr(content.seo.description, lang));
  const absolute = (path: string) => (path ? new URL(path, url.origin).toString() : '');
  const image = absolute(content.seo.image || p.photo);
  const canonical = `${url.origin}/${lang === 'fr' ? '' : `?lang=${lang}`}`;

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${p.firstName} ${p.lastName}`,
    alternateName: p.fullName,
    jobTitle: tr(p.role, lang),
    description,
    url: `${url.origin}/`,
    image: absolute(p.photo),
    email: `mailto:${p.email}`,
    address: { '@type': 'PostalAddress', addressLocality: tr(p.location, lang).split(',')[0]?.trim(), addressCountry: 'MG' },
    sameAs: p.socials.map((s) => s.url).filter((u) => /^https?:\/\//.test(u)),
    knowsLanguage: content.languages.map((l) => tr(l.name, 'en')),
    alumniOf: content.education.map((e) => ({ '@type': 'EducationalOrganization', name: e.school })),
    knowsAbout: content.skills.flatMap((s) => s.items).slice(0, 30),
  };
  const jsonLd = JSON.stringify(person).replace(/</g, '\\u003c');
  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${url.origin}/${l === 'fr' ? '' : `?lang=${l}`}">`,
  ).join('');

  const setContent = (selector: string, value: string, rewriter: HTMLRewriter) =>
    rewriter.on(selector, {
      element(el) {
        el.setAttribute('content', value);
      },
    });

  let rewriter = new HTMLRewriter()
    .on('html', {
      element(el) {
        el.setAttribute('lang', lang);
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('head', {
      element(el) {
        el.append(
          `<link rel="canonical" href="${escapeHtml(canonical)}">${alternates}<script type="application/ld+json">${jsonLd}</script>`,
          { html: true },
        );
      },
    });
  rewriter = setContent('meta[name="description"]', description, rewriter);
  rewriter = setContent('meta[property="og:title"]', title, rewriter);
  rewriter = setContent('meta[property="og:description"]', description, rewriter);
  rewriter = setContent('meta[property="og:image"]', image, rewriter);
  rewriter = setContent('meta[property="og:url"]', canonical, rewriter);
  rewriter = setContent('meta[property="og:locale"]', lang === 'fr' ? 'fr_FR' : lang === 'en' ? 'en_GB' : 'mg_MG', rewriter);
  rewriter = setContent('meta[name="twitter:title"]', title, rewriter);
  rewriter = setContent('meta[name="twitter:description"]', description, rewriter);
  rewriter = setContent('meta[name="twitter:image"]', image, rewriter);

  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'no-cache');
  headers.delete('ETag');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return rewriter.transform(new Response(asset.body, { status: 200, headers }));
}

export async function renderSitemap(c: Context<AppEnv>): Promise<Response> {
  const origin = new URL(c.req.url).origin;
  const { content } = await loadContent(c.env);
  const lastmod = (content.updatedAt || new Date().toISOString()).slice(0, 10);
  const links = LANGS.map(
    (l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${origin}/${l === 'fr' ? '' : `?lang=${l}`}"/>`,
  ).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${origin}/</loc><lastmod>${lastmod}</lastmod>${links}</url>
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
