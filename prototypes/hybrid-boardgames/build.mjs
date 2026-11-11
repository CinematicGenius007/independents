#!/usr/bin/env node
/* Inlines src/{engine.js,words.txt,*.css,ui.js} into one self-contained index.html.
 *   node build.mjs
 * No bundler, no dependencies: the output is just the template with five slots filled. */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(here, 'src', f), 'utf8')
const words = read('words.txt').trim().split(/\s+/).join(' ')
if (/["\\<]/.test(words)) throw new Error('word list must be plain a–z')
const css = ['base.css', 'cartel.css', 'bidding.css', 'lexicon.css'].map(read).join('\n')
const slot = (s, name, val) => s.replace(name, () => val)
let html = read('template.html')
html = slot(html, '/*{{CSS}}*/', css)
html = slot(html, '/*{{ENGINE}}*/', read('engine.js').replace(/<\/script/gi, '<\\/script'))
html = slot(html, '{{WORDS}}', words)
html = slot(html, '/*{{UI}}*/', read('ui.js').replace(/<\/script/gi, '<\\/script'))
writeFileSync(join(here, 'index.html'), html)
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB')
