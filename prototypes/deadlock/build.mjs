#!/usr/bin/env node
/* Inlines src/ into two self-contained pages (double-click, no server):
 *   index.html   the game        (engine + art + ui)
 *   pieces.html  specimen sheet  (art only)
 *   node build.mjs
 * Engine modules are plain ES modules (so node can test them); here they are
 * flattened into one IIFE by stripping import/export. Same idea as
 * prototypes/hybrid-boardgames/build.mjs: templates with {{SLOT}} markers. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const src = (f) => join(here, 'src', f)
const read = (f) => readFileSync(src(f), 'utf8')
const safe = (s) => s.replace(/<\/script/gi, '<\\/script')
const slot = (s, name, val) => s.replace(name, () => val)

const ENGINE_ORDER = ['rng', 'model', 'sim', 'trace', 'certify', 'grow', 'layout']
export function bundleEngine() {
  const names = []
  const parts = ENGINE_ORDER.filter((m) => existsSync(src(`engine/${m}.mjs`))).map((m) => {
    let code = read(`engine/${m}.mjs`)
    code = code.replace(/^import\s[^;]*;\s*$/gm, '')
    code = code.replace(/^export\s+(async\s+)?(function|const|let|class)\s+([A-Za-z0-9_$]+)/gm, (_, a, kind, name) => { names.push(name); return `${a || ''}${kind} ${name}` })
    return `/* ---- ${m} ---- */\n${code}`
  })
  return `const Engine = (() => {\n${parts.join('\n')}\nreturn { ${names.join(', ')} };\n})();`
}

const css = read('ui/style.css')
const art = ['art/clay.js', 'art/dollop.js'].map(read).join('\n')

let pieces = read('pieces.template.html')
pieces = slot(pieces, '/*{{CSS}}*/', css)
pieces = slot(pieces, '/*{{ART}}*/', safe(art))
pieces = slot(pieces, '/*{{SHEET}}*/', safe(read('ui/sheet.js')))
writeFileSync(join(here, 'pieces.html'), pieces)
console.log('pieces.html', (pieces.length / 1024).toFixed(1) + ' KB')

if (existsSync(src('index.template.html'))) {
  const ui = ['ui/board.js', 'ui/demo.js', 'ui/dev.js', 'ui/app.js'].filter((f) => existsSync(src(f))).map(read).join('\n')
  let html = read('index.template.html')
  html = slot(html, '/*{{CSS}}*/', css)
  const bundle = bundleEngine()
  new Function(bundle) // syntax check: duplicate names across flattened modules fail here, not in the browser
  html = slot(html, '/*{{ENGINE}}*/', safe(bundle))
  html = slot(html, '/*{{ART}}*/', safe(art))
  html = slot(html, '/*{{UI}}*/', safe(ui))
  writeFileSync(join(here, 'index.html'), html)
  console.log('index.html', (html.length / 1024).toFixed(1) + ' KB')
}
