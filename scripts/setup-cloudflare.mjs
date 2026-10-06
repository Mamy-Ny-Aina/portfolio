#!/usr/bin/env node
/**
 * Installation complète sur Cloudflare (gratuit) en une commande, après `npx wrangler login` :
 *   - crée la base D1 et l'espace de stockage KV, et inscrit leurs identifiants dans wrangler.jsonc ;
 *   - applique le schéma de la base ;
 *   - construit le site et le déploie avec les secrets (mot de passe admin, clé de session…) ;
 *   - téléverse le CV (option --cv).
 *
 * Usage :
 *   npm run setup -- [--cv chemin/vers/cv.pdf] [--password motdepasse] [--resend-key re_xxx]
 *                    [--gemini-key xxx] [--anthropic-key xxx] [--location weur]
 *
 * Le script peut être relancé sans risque : il réutilise les ressources existantes et ne change
 * le mot de passe admin que si --password est fourni.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const CONFIG = join(ROOT, 'wrangler.jsonc');
const D1_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';
const KV_PLACEHOLDER = '00000000000000000000000000000000';
const CV_KEY = 'm/cv-ndimby-razafinjatovo.pdf';

const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, ok: (s) => `\x1b[32m${s}\x1b[0m`, warn: (s) => `\x1b[33m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, accent: (s) => `\x1b[38;5;209m${s}\x1b[0m` };

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** Lance wrangler sans passer par un shell (pas de problème de guillemets sous Windows). */
function wrangler(args, { capture = false, input } = {}) {
  const res = spawnSync(process.execPath, [WRANGLER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '' },
  });
  return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function npm(args) {
  const res = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) throw new Error(`npm ${args.join(' ')} a échoué`);
}

function step(title) {
  console.log(`\n${c.accent('●')} ${c.bold(title)}`);
}

function fail(message) {
  console.error(`\n${c.warn('✖')} ${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
let config = readFileSync(CONFIG, 'utf8');

// 1. Connexion ---------------------------------------------------------------------------------
step('Vérification de la connexion Cloudflare');
const who = wrangler(['whoami'], { capture: true });
if (/not authenticated|You are not authenticated/i.test(who.out)) fail('Vous n’êtes pas connecté. Lancez d’abord : npx wrangler login');
const account = /associated with the email ([^\s]+)/i.exec(who.out)?.[1];
console.log(c.ok(`  Connecté${account ? ` (${account})` : ''}.`));

// 2. Base de données D1 -------------------------------------------------------------------------
step('Base de données D1');
if (config.includes(D1_PLACEHOLDER)) {
  const created = wrangler(['d1', 'create', 'portfolio-db', '--location', String(args.location ?? 'weur')], { capture: true });
  let id = /"database_id":\s*"([0-9a-f-]{36})"/i.exec(created.out)?.[1] ?? /database_id\s*=\s*"([0-9a-f-]{36})"/i.exec(created.out)?.[1];
  if (!id) {
    const list = wrangler(['d1', 'list', '--json'], { capture: true });
    try {
      const json = JSON.parse(list.out.slice(list.out.indexOf('[')));
      id = json.find((d) => d.name === 'portfolio-db')?.uuid;
    } catch {
      /* sortie inattendue */
    }
  }
  if (!id) fail(`Impossible de créer ou retrouver la base D1.\n${created.out}`);
  config = config.replace(D1_PLACEHOLDER, id);
  writeFileSync(CONFIG, config);
  console.log(c.ok(`  Base « portfolio-db » prête (${id}).`));
} else {
  console.log(c.dim('  Déjà configurée.'));
}

// 3. Stockage KV -------------------------------------------------------------------------------------
step('Stockage des fichiers (KV)');
if (config.includes(KV_PLACEHOLDER)) {
  const created = wrangler(['kv', 'namespace', 'create', 'FILES'], { capture: true });
  let id = /"id":\s*"([0-9a-f]{32})"/i.exec(created.out)?.[1] ?? /id\s*=\s*"([0-9a-f]{32})"/i.exec(created.out)?.[1];
  if (!id) {
    const list = wrangler(['kv', 'namespace', 'list'], { capture: true });
    try {
      const json = JSON.parse(list.out.slice(list.out.indexOf('[')));
      id = json.find((n) => /FILES/.test(n.title))?.id;
    } catch {
      /* sortie inattendue */
    }
  }
  if (!id) fail(`Impossible de créer ou retrouver l’espace KV.\n${created.out}`);
  config = config.replace(KV_PLACEHOLDER, id);
  writeFileSync(CONFIG, config);
  console.log(c.ok(`  Espace KV prêt (${id}).`));
} else {
  console.log(c.dim('  Déjà configuré.'));
}

// 4. Schéma de la base ---------------------------------------------------------------------------
step('Application du schéma de la base');
if (wrangler(['d1', 'migrations', 'apply', 'DB', '--remote'], { input: 'y\n' }).code !== 0) fail('Les migrations ont échoué.');

// 5. Construction ------------------------------------------------------------------------------------
step('Construction du site');
npm(['run', 'build']);

// 6. Secrets & déploiement -------------------------------------------------------------------------
step('Déploiement');
const existing = wrangler(['secret', 'list', '--format', 'json'], { capture: true });
const hasSecret = (name) => existing.code === 0 && existing.out.includes(`"${name}"`);
const secrets = {};
let generatedPassword = null;
if (args.password && args.password !== true) secrets.ADMIN_PASSWORD = String(args.password);
else if (!hasSecret('ADMIN_PASSWORD')) {
  generatedPassword = `${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`;
  secrets.ADMIN_PASSWORD = generatedPassword;
}
if (!hasSecret('SESSION_SECRET')) secrets.SESSION_SECRET = randomBytes(32).toString('hex');
if (args['resend-key'] && args['resend-key'] !== true) secrets.RESEND_API_KEY = String(args['resend-key']);
if (args['gemini-key'] && args['gemini-key'] !== true) secrets.GEMINI_API_KEY = String(args['gemini-key']);
if (args['anthropic-key'] && args['anthropic-key'] !== true) secrets.ANTHROPIC_API_KEY = String(args['anthropic-key']);

let deployOut = '';
const secretsFile = join(tmpdir(), `portfolio-secrets-${randomBytes(6).toString('hex')}.json`);
try {
  const deployArgs = ['deploy'];
  if (Object.keys(secrets).length) {
    writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
    deployArgs.push('--secrets-file', secretsFile);
  }
  const res = wrangler(deployArgs, { capture: true });
  deployOut = res.out;
  process.stdout.write(c.dim(res.out.split('\n').slice(-12).join('\n')) + '\n');
  if (res.code !== 0) fail('Le déploiement a échoué (voir ci-dessus).');
} finally {
  if (existsSync(secretsFile)) rmSync(secretsFile);
}
const url = /https:\/\/[a-z0-9.-]+\.workers\.dev/i.exec(deployOut)?.[0];

// 7. CV --------------------------------------------------------------------------------------------------
if (args.cv && args.cv !== true) {
  step('Téléversement du CV');
  const path = resolve(String(args.cv));
  if (!existsSync(path)) fail(`CV introuvable : ${path}`);
  const size = statSync(path).size;
  const name = 'CV-Ndimby-Razafinjatovo.pdf';
  const meta = JSON.stringify({ name, type: 'application/pdf', size });
  const put = wrangler(['kv', 'key', 'put', '--binding', 'FILES', CV_KEY, '--path', path, '--metadata', meta, '--remote'], { capture: true });
  if (put.code !== 0) fail(`Échec du téléversement du CV.\n${put.out}`);
  const sql = `INSERT OR REPLACE INTO files (key, name, type, size, scope, created_at) VALUES ('${CV_KEY}', '${name}', 'application/pdf', ${size}, 'media', ${Date.now()})`;
  wrangler(['d1', 'execute', 'DB', '--remote', '--command', sql], { capture: true });
  console.log(c.ok(`  ${basename(path)} → /api/files/${CV_KEY}`));
}

// 8. Résumé ------------------------------------------------------------------------------------------
console.log(`\n${c.ok('✔ Portfolio en ligne !')}`);
if (url) {
  console.log(`  Site            ${c.bold(url)}`);
  console.log(`  Administration  ${c.bold(`${url}/admin/`)}`);
}
if (generatedPassword) {
  console.log(`  Mot de passe    ${c.bold(generatedPassword)}  ${c.warn('← notez-le (modifiable dans Paramètres)')}`);
}
console.log(`\n${c.dim('Étapes facultatives : e-mails (RESEND_API_KEY), IA plus puissante (GEMINI_API_KEY ou ANTHROPIC_API_KEY),')}`);
console.log(c.dim('déploiement automatique depuis GitHub — voir le README.'));
