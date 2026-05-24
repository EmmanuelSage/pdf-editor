// Copies PDF.js's font + cMap data out of node_modules into public/ so Vite
// serves them at runtime. These are needed to render standard fonts and to
// draw typed text into form fields on export. They're verbatim copies of a
// dependency, so they're gitignored and regenerated here instead of committed.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));

const assets = ['cmaps', 'standard_fonts'];

mkdirSync(resolve(root, 'public'), { recursive: true });
for (const name of assets) {
  const from = resolve(pdfjsRoot, name);
  const to = resolve(root, 'public', name);
  if (!existsSync(from)) {
    console.warn(`[copy-pdfjs-assets] missing source: ${from}`);
    continue;
  }
  cpSync(from, to, { recursive: true });
  console.log(`[copy-pdfjs-assets] ${name} -> public/${name}`);
}
