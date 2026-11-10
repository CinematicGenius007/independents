#!/usr/bin/env node
/* Inlines src/ into one self-contained index.html (double-click, no server).
 *   node build.mjs
 * Engine modules are plain ES modules so node can run and test them. Here they are
 * flattened into one IIFE by stripping import/export, the same approach as
 * prototypes/deadlock/build.mjs. Top-level names must be unique across modules. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'src', f), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const ENGINE = ['rng', 'news2', 'hospital', 'casebook', 'patient', 'scenario', 'sim'];
const names = new Set();
const parts = ENGINE.map((m) => {
  let code = read(`engine/${m}.mjs`);
  code = code.replace(/^import\s[^;]*;\s*$/gm, '');
  code = code.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  code = code.replace(/^export\s+(async\s+)?(function|const|let|class)\s+([A-Za-z0-9_$]+)/gm, (_, a, kind, name) => { names.add(name); return `${a || ''}${kind} ${name}`; });
  return `/* ---- ${m} ---- */\n${code}`;
});
const bundle = `const Engine = (() => {\n${parts.join('\n')}\nreturn { ${[...names].join(', ')} };\n})();`;
new Function(bundle);   // syntax check: a duplicate name across modules fails here, not in the browser

const ui = ['ui/backdrop.js', 'ui/monitor.js', 'ui/app.js'].map(read).join('\n');
const html = read('index.template.html')
  .replace('/*{{CSS}}*/', () => read('ui/style.css'))
  .replace('/*{{ENGINE}}*/', () => safe(bundle))
  .replace('/*{{UI}}*/', () => safe(ui));
writeFileSync(join(here, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
