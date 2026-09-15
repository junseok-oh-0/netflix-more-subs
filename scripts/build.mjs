import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');
const dev = process.env.DEV === '1';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

await build({
  entryPoints: ['content.js', 'background.js', 'popup.js'].map((f) => resolve(src, f)),
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  sourcemap: dev ? 'inline' : false,
  logLevel: 'info',
});

for (const f of ['popup.html', 'settings_box.html', 'tutorial.html', 'update.html']) {
  cpSync(resolve(src, f), resolve(dist, f));
}
cpSync(resolve(src, 'icons'), resolve(dist, 'icons'), { recursive: true });

const manifest = JSON.parse(readFileSync(resolve(src, 'manifest.json'), 'utf8'));
if (dev) {
  // Lets the fixture page (npm run fixture) receive the content script.
  manifest.content_scripts[0].matches.push('http://localhost/*', 'http://127.0.0.1/*');
  manifest.name += ' (dev)';
}
writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`built ${dev ? 'dev' : 'prod'} extension to dist/`);
