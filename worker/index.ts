import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import { renderHome, renderSitemap } from './lib/seo';

const app = new Hono<AppEnv>();

app.get('/', (c) => renderHome(c));
app.get('/sitemap.xml', (c) => renderSitemap(c));
app.get('/robots.txt', (c) =>
  c.text(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${new URL(c.req.url).origin}/sitemap.xml
`),
);

app.route('/api/admin', adminRoutes);
app.route('/api', publicRoutes);

app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

// Toute autre requête arrivée jusqu'ici est servie par les fichiers statiques.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  console.error('[worker] erreur non gérée', err);
  return c.json({ error: 'internal_error' }, 500);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
