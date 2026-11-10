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

/* ---------- the handbook: docs/HANDBOOK.md + Guide Mode text + the case book ---------- */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
const diagram = (name) => readFileSync(join(here, 'diagrams', name), 'utf8');

function md2html(src) {
  const out = [], lines = src.split('\n');
  let i = 0;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i += 1; continue; }
    let m;
    if ((m = l.match(/^(#{2,3}) (.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i += 1; continue; }
    if ((m = l.match(/^!\[(.*)\]\((.*)\)$/))) { out.push(`<figure>${diagram(m[2])}<figcaption>${inline(m[1])}</figcaption></figure>`); i += 1; continue; }
    if (l.startsWith('|')) {
      const head = cells(l); i += 2;
      const rows = []; while (i < lines.length && lines[i].startsWith('|')) { rows.push(cells(lines[i])); i += 1; }
      out.push(`<div class="tw"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (l.startsWith('> ')) { const b = []; while (i < lines.length && lines[i].startsWith('> ')) { b.push(lines[i].slice(2)); i += 1; } out.push(`<blockquote><p>${inline(b.join(' '))}</p></blockquote>`); continue; }
    if (/^(- |\d+\. )/.test(l)) {
      const tag = l.startsWith('- ') ? 'ul' : 'ol', items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) { items.push(lines[i].replace(/^(- |\d+\. )/, '')); i += 1; }
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3} |\||> |- |\d+\. |!\[)/.test(lines[i])) { p.push(lines[i]); i += 1; }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

const GUIDE = new Function(`${read('ui/guide-text.js')}\nreturn GUIDE;`)();
function controlsMd() {
  const groups = new Map();
  for (const [where, title, what, todo] of Object.values(GUIDE)) { if (!groups.has(where)) groups.set(where, []); groups.get(where).push([title, what, todo]); }
  const cell = (t) => t.replace(/\|/g, '/');
  let md = 'Everything on the screen, in the same words Guide Mode uses. Press **G** in the game to see these on the real thing.\n\n';
  for (const [where, items] of groups) md += `## ${where}\n\n| Control | What it is | What to do |\n| --- | --- | --- |\n${items.map(([t, w, d]) => `| **${cell(t)}** | ${cell(w)} | ${cell(d)} |`).join('\n')}\n\n`;
  return md;
}
const { CASES } = await import('./src/engine/casebook.mjs');
const { KINDS } = await import('./src/engine/hospital.mjs');
function casesMd() {
  const need = (n) => n.split('|').map((k) => KINDS[k].label).join(' or ');
  const bedName = (k) => KINDS[k].label;
  let md = 'Every condition in the game. Generated from the same data the simulation runs on.\n\n> Spoilers. These are the answers.\n\n';
  const list = Object.values(CASES).sort((a, b) => a.esi - b.esi || a.title.localeCompare(b.title));
  for (const c of list) {
    md += `## ${c.title}\n\n**Arrives as:** "${c.cc}" ${c.via === 'ems' ? 'by ambulance' : c.via === 'house' ? 'already in the hospital' : 'walking in'}. **ESI ${c.esi}.** **Safe beds:** ${(c.bed || []).map(bedName).join(', ') || 'not applicable'}.\n\n`;
    md += `| Step | Needs | Minutes |\n| --- | --- | --- |\n${c.steps.map((s) => `| ${s.label.replace(/\|/g, '/')} | ${s.needs.map(need).join(', ') || 'bed only'}${s.blood ? `, ${s.blood} units of blood` : ''} | ${s.dur || 'until a bed is free'} |`).join('\n')}\n\n`;
    if (c.clocks && c.clocks.length) md += `**Time targets:** ${c.clocks.map((k) => `${k.label}, ${k.limit} min`).join('. ')}.\n\n`;
    if (c.tip) md += `**Charge tip:** ${c.tip}\n\n`;
  }
  return md;
}

const hb = readFileSync(join(here, 'docs/HANDBOOK.md'), 'utf8');
const casebookMd = casesMd();
writeFileSync(join(here, 'docs/CASEBOOK.md'), `# Night Shift case book\n\n<!-- generated by build.mjs from src/engine/casebook.mjs. Do not edit. -->\n\n${casebookMd}`);
const generated = `# Every control {#controls}\n\n${controlsMd()}# Case book {#cases}\n\n${casebookMd}`;
const splitAt = hb.indexOf('# The Engineer Lens');     // generated reference sections go before the two closing notes
const whole = `${hb.slice(0, splitAt)}${generated}${hb.slice(splitAt)}`;
const sections = whole.split(/^# /m).slice(1).map((chunk) => {
  const nl = chunk.indexOf('\n'), m = chunk.slice(0, nl).match(/^(.*) \{#(.*)\}$/);
  if (!m) throw new Error(`section heading needs an {#id}: ${chunk.slice(0, nl)}`);
  const body = chunk.slice(nl + 1), html = `<h1>${inline(m[1])}</h1>\n${md2html(body)}`;
  return { id: m[2], title: m[1], html, text: body.replace(/[#*|`>!-]/g, ' ').replace(/\s+/g, ' ').trim() };
});
for (const [where, , , , topic] of Object.values(GUIDE)) if (topic && !sections.some((s) => s.id === topic)) throw new Error(`guide entry in "${where}" links to missing handbook section "${topic}"`);
const docs = JSON.stringify({ sections, diagrams: { jam: diagram('jam.svg') } }).replace(/<\/script/gi, '<\\/script');

const floor = `data:image/jpeg;base64,${readFileSync(join(here, 'src/assets/er-floor.jpg')).toString('base64')}`;
const css = read('ui/style.css').replace('__FLOOR__', floor);

const ui = ['ui/backdrop.js', 'ui/monitor.js', 'ui/guide-text.js', 'ui/handbook.js', 'ui/guide.js', 'ui/tutorial.js', 'ui/app.js'].map(read).join('\n');
const html = read('index.template.html')
  .replace('/*{{CSS}}*/', () => css)
  .replace('/*{{DOCS}}*/', () => docs)
  .replace('/*{{ENGINE}}*/', () => safe(bundle))
  .replace('/*{{UI}}*/', () => safe(ui));
writeFileSync(join(here, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');

/* the same manual as a page of its own, for reading away from the game */
const proseCss = read('ui/style.css').match(/\.prose h1[\s\S]*?(?=\.hb-hit)/)[0];
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Night Shift Handbook</title><style>
:root { --blue: #1f4e8c; --blue-d: #173b6b; --line: #d3dae3; --tab: #f6f8fb; --mute: #55647a; --sel: #cfe3fa; }
* { box-sizing: border-box; } html { scroll-behavior: smooth; } body { margin: 0; background: #f4f6f9; color: #1a1a1a; font: 16px/1.6 Tahoma, 'Segoe UI', Verdana, sans-serif; }
header { background: var(--blue); color: #fff; padding: 18px 20px; } header h1 { margin: 0; font-size: 22px; } header a { color: #fff; }
nav { background: #fff; border-bottom: 1px solid var(--line); padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; } nav a { color: var(--blue); }
.prose { padding: 0 20px; } main { padding: 16px 0 60px; } section { margin-bottom: 26px; }
table { border-collapse: collapse; width: 100%; }
${proseCss}</style></head><body><header><h1>Night Shift Handbook</h1><a href="index.html">Open the game</a></header><nav>${sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav><main class="prose">${sections.map((s) => `<section id="${s.id}">${s.html}</section>`).join('\n')}</main></body></html>`;
writeFileSync(join(here, 'handbook.html'), page);
console.log('handbook.html', (page.length / 1024).toFixed(1) + ' KB');
