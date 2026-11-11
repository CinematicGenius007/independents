#!/usr/bin/env node
/* Builds the website into dist/: the landing page (index.html), the game (play.html, one
 * self-contained file apart from the backdrop photo), the handbook, icons and metadata.
 *   node build.mjs                                   # local, open dist/index.html
 *   SITE_URL=https://example.org node build.mjs      # production: absolute canonical, og:image, sitemap
 * Engine modules are plain ES modules so node can run and test them. Here they are
 * flattened into one IIFE by stripping import/export, the same approach as
 * prototypes/deadlock/build.mjs. Top-level names must be unique across modules. */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

/* ---------- the site around the game ---------- */
const OUT = join(here, 'dist');
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
const assets = {};
for (const [name, from] of [['er-floor.webp', 'src/assets/er-floor.webp'], ['board.webp', 'src/brand/board.webp'], ['guide-mode.webp', 'src/brand/guide-mode.webp'], ['phone.webp', 'src/brand/phone.webp'], ['og.jpg', 'src/brand/og.jpg']]) {
  const buf = readFileSync(join(here, from)), hash = createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const file = `assets/${name.replace(/\.(\w+)$/, `.${hash}.$1`)}`;
  writeFileSync(join(OUT, file), buf); assets[name] = file;
}
for (const f of ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) copyFileSync(join(here, 'src/brand', f), join(OUT, f));
const MARK = readFileSync(join(here, 'src/brand/mark.svg'), 'utf8').trim();
writeFileSync(join(OUT, 'favicon.svg'), MARK);
const fillAssets = (t) => t.replace(/\{\{ASSET:([\w.-]+)\}\}/g, (_, n) => { if (!assets[n]) throw new Error(`unknown asset ${n}`); return assets[n]; });

const NAME = 'Night Shift';
const BLURB = 'A browser game where you run an emergency department at night as the charge nurse. Give out beds, call in teams and keep the hospital from jamming.';
const abs = (path) => (SITE ? `${SITE}${path}` : '');
function head({ title, description, path }) {
  const url = abs(path), image = abs(`/${assets['og.jpg']}`);
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    url && `<link rel="canonical" href="${url}">`,
    '<meta name="theme-color" content="#0d1724">',
    '<meta name="color-scheme" content="dark light">',
    '<link rel="icon" href="favicon.ico" sizes="32x32">',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
    '<link rel="manifest" href="site.webmanifest">',
    `<meta property="og:site_name" content="${NAME}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    url && `<meta property="og:url" content="${url}">`,
    image && `<meta property="og:image" content="${image}">`,
    image && '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
    image && `<meta property="og:image:alt" content="${NAME}: twelve hours, twenty-one beds, you decide who gets one.">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image && `<meta name="twitter:image" content="${image}">`,
  ].filter(Boolean).join('\n');
}

/* the game */
const css = read('ui/style.css').replace('__FLOOR__', assets['er-floor.webp']);
const ui = ['ui/backdrop.js', 'ui/monitor.js', 'ui/guide-text.js', 'ui/handbook.js', 'ui/guide.js', 'ui/tutorial.js', 'ui/app.js'].map(read).join('\n');
const html = read('index.template.html')
  .replace('<!--{{HEAD}}-->', () => head({ title: `Play ${NAME}: run an emergency department tonight`, description: BLURB, path: '/play' }))
  .replace('/*{{CSS}}*/', () => css)
  .replace('/*{{DOCS}}*/', () => docs)
  .replace('/*{{ENGINE}}*/', () => safe(bundle))
  .replace('/*{{UI}}*/', () => safe(ui));
writeFileSync(join(OUT, 'play.html'), html);

/* the landing page */
const jsonld = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: NAME, ...(SITE && { url: `${SITE}/` }), description: BLURB, inLanguage: 'en' },
    { '@type': 'VideoGame', name: NAME, description: BLURB, ...(SITE && { url: `${SITE}/play`, image: abs(`/${assets['og.jpg']}`) }), genre: ['Simulation', 'Strategy', 'Management'], gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', playMode: 'SinglePlayer', inLanguage: 'en' },
  ],
}).replace(/</g, '\\u003c');
const landing = fillAssets(readFileSync(join(here, 'src/site/landing.html'), 'utf8'))
  .replace('<!--{{HEAD}}-->', () => head({ title: `${NAME}: an emergency department game`, description: BLURB, path: '/' }))
  .replace('{{JSONLD}}', () => jsonld)
  .replace('{{MARK}}', () => MARK.replace(/<title>.*?<\/title>/, '').replace('<svg ', '<svg aria-hidden="true" '));
writeFileSync(join(OUT, 'index.html'), landing);

/* the same manual as a page of its own, for reading away from the game */
const proseCss = read('ui/style.css').match(/\.prose h1[\s\S]*?(?=\.hb-hit)/)[0];
const page = `<!doctype html><html lang="en"><head>${head({ title: `${NAME} Handbook: how to play, every control and condition`, description: 'The complete manual for Night Shift: the rules, the screen, vital signs and NEWS2, every action, every alert, every condition and a glossary.', path: '/handbook' })}<style>
:root { --blue: #1f4e8c; --blue-d: #173b6b; --line: #d3dae3; --tab: #f6f8fb; --mute: #55647a; --sel: #cfe3fa; }
* { box-sizing: border-box; } html { scroll-behavior: smooth; } body { margin: 0; background: #f4f6f9; color: #1a1a1a; font: 16px/1.6 Tahoma, 'Segoe UI', Verdana, sans-serif; }
header { background: #0d1724; color: #fff; padding: 18px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 24px; } header h1 { margin: 0; font-size: 22px; flex: 1 1 auto; } header a { color: #fff; } header .play { background: #ffb454; color: #1b1306; padding: 8px 16px; border-radius: 5px; font-weight: 700; text-decoration: none; }
nav { background: #fff; border-bottom: 1px solid var(--line); padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; } nav a { color: var(--blue); }
.prose { padding: 0 20px; } main { padding: 16px 0 60px; } section { margin-bottom: 26px; }
table { border-collapse: collapse; width: 100%; }
${proseCss}</style></head><body><header><h1>Night Shift Handbook</h1><a href="./">Home</a><a class="play" href="play.html">Play</a></header><nav aria-label="Sections">${sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav><main class="prose">${sections.map((s) => `<section id="${s.id}">${s.html}</section>`).join('')}</main></body></html>`;
writeFileSync(join(OUT, 'handbook.html'), page);

/* everything else a website is expected to have */
writeFileSync(join(OUT, '404.html'), `<!doctype html><html lang="en"><head>${head({ title: `Not found · ${NAME}`, description: BLURB, path: '/404' }).replace(/<link rel="canonical"[^>]*>/, '')}<meta name="robots" content="noindex"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1724;color:#eef2f7;font:17px/1.6 Tahoma,'Segoe UI',Verdana,sans-serif;text-align:center;padding:24px}a{color:#ffb454}svg{width:56px;height:56px}</style></head><body><div>${MARK}<h1>No patient by that name.</h1><p>This page is not on the board.</p><p><a href="./">Back to the front desk</a> &middot; <a href="play.html">Start a shift</a></p></div></body></html>`);
writeFileSync(join(OUT, 'site.webmanifest'), JSON.stringify({
  name: NAME, short_name: NAME, description: BLURB, start_url: 'play.html', scope: './', display: 'standalone', orientation: 'any', background_color: '#0d1724', theme_color: '#0d1724',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 2));
const PAGES = [['/', 'weekly', '1.0'], ['/play', 'weekly', '0.9'], ['/handbook', 'weekly', '0.8']];
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n${SITE ? `\nSitemap: ${SITE}/sitemap.xml\n` : ''}`);
if (SITE) writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(([p, f, pr]) => `  <url><loc>${SITE}${p}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
const link = (p) => (SITE ? `${SITE}${p}` : p);
/* llms.txt: a plain summary for AI search and assistants (llmstxt.org), with the whole manual beside it */
writeFileSync(join(OUT, 'llms.txt'), `# ${NAME}\n\n> ${BLURB}\n\nThe player is the charge nurse of Harbourside General's emergency department (a fictional hospital), from 19:00 to 07:00. They never treat patients. They decide who gets which bed, who goes first, what is held back, who is called in from home, and when two patients swap places. Two rules drive the simulation: a care step starts only when everything it needs is free at the same moment, and a patient keeps the place they are in until the next place is theirs. It runs in any modern browser, on desktop and on phones, with no account. Medical content is plausible game content and has not been reviewed by a clinician.\n\n## Play\n\n- [Play Night Shift](${link('/play')}): the game. A new night: add ?seed=ANYTHING.\n\n## Docs\n\n- [Handbook](${link('/handbook')}): how to play, every control, every condition, glossary.\n- [Full handbook as text](${link('/llms-full.txt')}): the same manual in Markdown.\n`);
writeFileSync(join(OUT, 'llms-full.txt'), `# ${NAME} Handbook\n\n> ${BLURB}\n\n${whole.replace(/^# (.*) \{#.*\}$/gm, '# $1')}`);
/* response headers (Cloudflare and Netlify read _headers; vercel.json mirrors it) */
writeFileSync(join(OUT, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

const kb = (f) => `${(readFileSync(join(OUT, f)).length / 1024).toFixed(1)} KB`;
console.log(`dist/ ${SITE ? `for ${SITE}` : '(no SITE_URL: canonical, og:image and sitemap left out)'}`);
for (const f of ['index.html', 'play.html', 'handbook.html', assets['er-floor.webp']]) console.log(`  ${f.padEnd(34)} ${kb(f)}`);
