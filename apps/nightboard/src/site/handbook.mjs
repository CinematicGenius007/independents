/* Build-time only (Node): compiles the handbook from docs/HANDBOOK.md, the Guide Mode text and
 * the case book, so the in-game handbook, handbook.html and llms-full.txt say the same thing.
 *
 * HANDBOOK.md uses a small Markdown subset, which md2html() renders:
 *   # Title {#id}      a top-level section; every one needs an id (the in-game nav uses it)
 *   ## / ###           subheadings
 *   | a | b |          tables (second line is the separator row)
 *   > text             a callout
 *   - item / 1. item   lists
 *   ![caption](x.svg)  a diagram from diagrams/, inlined as SVG
 *   `code` **bold** *italic*
 * Two sections are generated rather than written: "Every control" from src/ui/guide-text.js
 * and "Case book" from src/engine/casebook.mjs. They go just before "The Engineer Lens". */

export const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
const BLOCK_START = /^(#{2,3} |\||> |- |\d+\. |!\[)/;

/** Renders the Markdown subset above. `diagram(name)` returns the SVG text of diagrams/<name>. */
export function md2html(src, diagram = () => '') {
  const out = [], lines = src.split('\n');
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    let m;
    if (!l.trim()) { i += 1; continue; }
    if ((m = l.match(/^(#{2,3}) (.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i += 1; continue; }
    if ((m = l.match(/^!\[(.*)\]\((.*)\)$/))) { out.push(`<figure>${diagram(m[2])}<figcaption>${inline(m[1])}</figcaption></figure>`); i += 1; continue; }
    if (l.startsWith('|')) {
      const head = cells(l), rows = [];
      i += 2;   // the header row and the |---| separator
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(cells(lines[i])); i += 1; }
      out.push(`<div class="tw"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (l.startsWith('> ')) {
      const b = [];
      while (i < lines.length && lines[i].startsWith('> ')) { b.push(lines[i].slice(2)); i += 1; }
      out.push(`<blockquote><p>${inline(b.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const tag = l.startsWith('- ') ? 'ul' : 'ol', items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) { items.push(lines[i].replace(/^(- |\d+\. )/, '')); i += 1; }
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) { p.push(lines[i]); i += 1; }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

/** "Every control": the Guide Mode entries grouped by where they live on screen. */
export function controlsMd(guide) {
  const groups = new Map();
  for (const [where, title, what, todo] of Object.values(guide)) {
    if (!groups.has(where)) groups.set(where, []);
    groups.get(where).push([title, what, todo]);
  }
  const cell = (t) => t.replace(/\|/g, '/');
  let md = 'Everything on the screen, in the same words Guide Mode uses. Press **G** in the game to see these on the real thing.\n\n';
  for (const [where, items] of groups) {
    md += `## ${where}\n\n| Control | What it is | What to do |\n| --- | --- | --- |\n${items.map(([t, w, d]) => `| **${cell(t)}** | ${cell(w)} | ${cell(d)} |`).join('\n')}\n\n`;
  }
  return md;
}

/** "Case book": every condition, its steps, beds and time targets, from the simulation's own data. */
export function casesMd(cases, kinds) {
  const need = (n) => n.split('|').map((k) => kinds[k].label).join(' or ');
  const arrives = (via) => (via === 'ems' ? 'by ambulance' : via === 'house' ? 'already in the hospital' : 'walking in');
  let md = 'Every condition in the game. Generated from the same data the simulation runs on.\n\n> Spoilers. These are the answers.\n\n';
  const list = Object.values(cases).sort((a, b) => a.esi - b.esi || a.title.localeCompare(b.title));
  for (const c of list) {
    md += `## ${c.title}\n\n**Arrives as:** "${c.cc}" ${arrives(c.via)}. **ESI ${c.esi}.** **Safe beds:** ${(c.bed || []).map((k) => kinds[k].label).join(', ') || 'not applicable'}.\n\n`;
    md += `| Step | Needs | Minutes |\n| --- | --- | --- |\n${c.steps.map((s) => `| ${s.label.replace(/\|/g, '/')} | ${s.needs.map(need).join(', ') || 'bed only'}${s.blood ? `, ${s.blood} units of blood` : ''} | ${s.dur || 'until a bed is free'} |`).join('\n')}\n\n`;
    if (c.clocks && c.clocks.length) md += `**Time targets:** ${c.clocks.map((k) => `${k.label}, ${k.limit} min`).join('. ')}.\n\n`;
    if (c.tip) md += `**Charge tip:** ${c.tip}\n\n`;
  }
  return md;
}

/**
 * Compiles the whole handbook.
 * @param {object} o
 * @param {string} o.markdown   docs/HANDBOOK.md
 * @param {object} o.guide      GUIDE from src/ui/guide-text.js
 * @param {object} o.cases      CASES from src/engine/casebook.mjs
 * @param {object} o.kinds      KINDS from src/engine/hospital.mjs
 * @param {(name: string) => string} o.diagram  SVG text of diagrams/<name>
 * @returns {{ sections: {id, title, html, text}[], markdown: string }}
 *   sections feed the in-game handbook and handbook.html; markdown is the full text for llms-full.txt.
 */
export function compileHandbook({ markdown, guide, cases, kinds, diagram }) {
  const at = markdown.indexOf('# The Engineer Lens');
  if (at < 0) throw new Error('HANDBOOK.md needs a "# The Engineer Lens" section: the generated sections go before it');
  const generated = `# Every control {#controls}\n\n${controlsMd(guide)}# Case book {#cases}\n\n${casesMd(cases, kinds)}`;
  const whole = `${markdown.slice(0, at)}${generated}${markdown.slice(at)}`;

  const sections = whole.split(/^# /m).slice(1).map((chunk) => {
    const nl = chunk.indexOf('\n'), m = chunk.slice(0, nl).match(/^(.*) \{#(.*)\}$/);
    if (!m) throw new Error(`handbook section heading needs an {#id}: "${chunk.slice(0, nl)}"`);
    const body = chunk.slice(nl + 1);
    return { id: m[2], title: m[1], html: `<h1>${inline(m[1])}</h1>\n${md2html(body, diagram)}`, text: body.replace(/[#*|`>!-]/g, ' ').replace(/\s+/g, ' ').trim() };
  });

  const ids = new Set();
  for (const s of sections) { if (ids.has(s.id)) throw new Error(`duplicate handbook section id "${s.id}"`); ids.add(s.id); }
  for (const [where, title, , , topic] of Object.values(guide)) {
    if (topic && !ids.has(topic)) throw new Error(`Guide Mode entry "${title}" (${where}) links to missing handbook section "${topic}"`);
  }
  return { sections, markdown: whole.replace(/^# (.*) \{#.*\}$/gm, '# $1') };
}
