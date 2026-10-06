// `wrangler dev` refuse de démarrer si le dossier des assets n'existe pas encore.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', '<!doctype html><title>Lancez `npm run build`</title>');
}
