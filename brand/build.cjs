#!/usr/bin/env node
/* =====================================================================
   INDEPENDENTS — brand build.   node prototypes/root-explorer-minimal/brand/build.cjs

   One source of truth for every mark on the page. It writes, beside this file:
     logo-mark.svg    the Rising Spiral crest (64 grid)            logo-lockup.svg   mark + drawn wordmark
     favicon.svg      the 3-turn crest on a charcoal tile (32 grid) brand-poster.svg  1200 x 630 social image
     icons.svg        <symbol> sprite: mark + 19 projects + 6 UI   icon-sheet.svg    labelled contact sheet
   and rewrites the inline sprite in ../index.html between the sprite markers.

   Everything is drawn, not typed: the wordmark and the labels are monoline paths built from one
   12 x 16 cell (rounded-rectangle corners, because every plate on the spiral is one), so nothing depends
   on a font being installed. Colours are the page's three: charcoal, chalk, ember.
   ===================================================================== */
"use strict";
const fs = require("fs"), path = require("path");
const OUT = __dirname, PAGE = path.join(OUT, "..", "index.html");
const C = { card: "#151516", chalk: "#EAE8E3", mute: "#9C9B97", ember: "#EE6A3C" };
const n = x => +x.toFixed(2);

/* ---------- 1. the wordmark alphabet: monoline caps on a 12 x 16 cell ---------- */
const G = {
  A: "M1 15L6 1L11 15M3 10H9", B: "M1 15V1H7.5A3.5 3.5 0 0 1 7.5 8H1M7.5 8H8A3.5 3.5 0 0 1 8 15H1",
  C: "M11 1H4A3 3 0 0 0 1 4V12A3 3 0 0 0 4 15H11", D: "M1 1H7A4 4 0 0 1 11 5V11A4 4 0 0 1 7 15H1Z",
  E: "M11 1H1V15H11M1 8H9", F: "M11 1H1V15M1 8H9", G: "M11 1H4A3 3 0 0 0 1 4V12A3 3 0 0 0 4 15H8A3 3 0 0 0 11 12V8H6.5",
  H: "M1 1V15M11 1V15M1 8H11", I: "M2.5 1H9.5M6 1V15M2.5 15H9.5", J: "M10 1V11A4 4 0 0 1 6 15H5A4 4 0 0 1 1 11",
  K: "M1 1V15M11 1L1 9M4.5 6.5L11 15", L: "M1 1V15H11", M: "M1 15V1L6 9L11 1V15", N: "M1 15V1L11 15V1",
  O: "M4 1H8A3 3 0 0 1 11 4V12A3 3 0 0 1 8 15H4A3 3 0 0 1 1 12V4A3 3 0 0 1 4 1Z", P: "M1 15V1H8A3.5 3.5 0 0 1 8 8H1",
  Q: "M4 1H8A3 3 0 0 1 11 4V12A3 3 0 0 1 8 15H4A3 3 0 0 1 1 12V4A3 3 0 0 1 4 1ZM7 11L11.5 15.5", R: "M1 15V1H8A3.5 3.5 0 0 1 8 8H1M6.5 8L11 15",
  S: "M11 1H4A3 3 0 0 0 1 4V5A3 3 0 0 0 4 8H8A3 3 0 0 1 11 11V12A3 3 0 0 1 8 15H1", T: "M0.5 1H11.5M6 1V15",
  U: "M1 1V11A4 4 0 0 0 5 15H7A4 4 0 0 0 11 11V1", V: "M1 1L6 15L11 1", W: "M1 1L3.5 15L6 6L8.5 15L11 1",
  X: "M1 1L11 15M11 1L1 15", Y: "M1 1L6 8L11 1M6 8V15", Z: "M1 1H11L1 15H11", "-": "M3 8H9",
  "/": "M9 1L3 15", "·": "M5.2 7.2H6.8V8.8H5.2Z", ".": "M5.2 13.4H6.8V15H5.2Z",
};
/* word(): returns a <g> of stroked paths. s = scale, track = extra gap between cells (cell units). Returns [svg, width]. */
function word(str, { x = 0, y = 0, s = 1, track = 8, sw = 2, color = C.chalk, accent = null } = {}) {
  let cx = 0, out = "";
  for (const ch of str) {
    if (ch === " ") { cx += 12 + track; continue; }
    const d = G[ch.toUpperCase()]; if (!d) continue;
    const col = accent && accent.chars.includes(ch) ? accent.color : null;
    out += `<path d="${d}" transform="translate(${n(cx)} 0)"${col ? ` stroke="${col}"` : ""}/>`; cx += 12 + track;
  }
  const w = cx - track;
  return [`<g transform="translate(${n(x)} ${n(y)}) scale(${s})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="1.6">${out}</g>`, w * s];
}

/* ---------- 2. the crest: a Rising Spiral ----------
   Semicircles of radius d, 2d, 3d… on two centres d apart make a spiral that needs nothing but arcs.
   It winds clockwise out of an ember seed, and its last arc hands the thread up and off the top, solid while it is LIVE and dashed once it is ROADMAP.
   spiral() works in its own space (seed at 0,0, centres at -d and 0), reports its box, and mark() fits it. */
function spiral({ d, arcs, tail }) {
  const ctr = [-d, 0]; let from = 0, p = "M0 0", minX = 0, maxX = 0, minY = -tail, maxY = 0;
  for (let k = 1; k <= arcs; k++) {
    const c = ctr[(k - 1) % 2], to = 2 * c - from;
    p += `A${n(k * d)} ${n(k * d)} 0 0 1 ${n(to)} 0`; from = to; minX = Math.min(minX, to); maxX = Math.max(maxX, to, from);
    if (k % 2) maxY = Math.max(maxY, k * d); else minY = Math.min(minY, -k * d);
  }
  return { d: p, tailD: `M${n(from)} 0V${n(-tail)}`, minX, maxX, minY, maxY };
}
/* fit: [x, y] puts the middle of the drawing there; at: [x, y] puts the ember seed there. */
function mark({ s = 1, sw = 3.2, tail = 28, chalk = C.chalk, ember = C.ember, seedR = 2.6, arcs = 5, d = 4, fit = [32, 32], at = null, ox = 0, oy = 0 } = {}) {
  const sp = spiral({ d, arcs, tail });
  const [sx, sy] = at || [fit[0] - (sp.minX + sp.maxX) / 2, fit[1] - (sp.minY + sp.maxY) / 2];
  return `<g transform="translate(${n(ox)} ${n(oy)}) scale(${s})"><g transform="translate(${n(sx)} ${n(sy)})"><path d="${sp.d}" fill="none" stroke="${chalk}" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="round"/><path d="${sp.tailD}" fill="none" stroke="${chalk}" stroke-width="${sw}" stroke-dasharray="${n(sw)} ${n(sw)}"/><circle r="${seedR}" fill="${ember}"/></g></g>`;
}

const svg = (vb, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${body}</svg>\n`;
const files = {};

/* ---------- 3. logo-mark (64 grid, transparent) ---------- */
files["logo-mark.svg"] = svg("0 0 64 64", `<title>Independents — the Rising Spiral</title>${mark()}`, ` width="512" height="512" role="img" aria-label="Independents"`);

/* ---------- 4. favicon (32 grid, charcoal tile, three turns, heavier line so 16 px stays crisp) ---------- */
files["favicon.svg"] = svg("0 0 32 32", `<title>Independents</title><rect width="32" height="32" rx="7" fill="${C.card}"/><rect x=".5" y=".5" width="31" height="31" rx="6.5" fill="none" stroke="${C.chalk}" stroke-opacity=".28"/>${mark({ d: 3.4, arcs: 3, sw: 3, seedR: 2.3, tail: 8.5, fit: [16, 16] })}`, ` width="64" height="64"`);

/* ---------- 5. wordmark lockup ---------- */
{
  const [w, ww] = word("INDEPENDENTS", { x: 96, y: 20, s: 1.5, track: 8, sw: 2 });
  const H = 64, W = Math.ceil(96 + ww);
  files["logo-lockup.svg"] = svg(`0 0 ${W} ${H}`, `<title>INDEPENDENTS</title>${mark()}${w}`, ` width="${W * 1}" height="${H}" role="img" aria-label="Independents"`);
}

/* ---------- 6. the 19 project icons + 6 UI icons (24 grid, 1 px monoline, one ember mark each) ---------- */
const ac = (cx, cy, r) => `<circle class="ac" cx="${cx}" cy="${cy}" r="${r}"/>`;
const oc = (cx, cy, r) => `<circle class="o" cx="${cx}" cy="${cy}" r="${r}"/>`;
const ICONS = {
  /* projects, in tracklist order; ids follow content.js (icon || slug) */
  fogwalk: ["Fogwalk", `<path d="M3 11c2.2-1.6 3.8-1.6 6 0s3.8 1.6 6 0 3.8-1.6 6 0M3 15.5c2.2-1.6 3.8-1.6 6 0s3.8 1.6 6 0 3.8-1.6 6 0M7 20c1.5-1.1 2.6-1.1 4 0s2.6 1.1 4 0"/>${ac(12, 5.6, 1.6)}`],
  bloomwright: ["Bloomwright", `<path d="M12 21V12M12 12L6 6M12 12V4M12 12L18 6"/>${oc(6, 6, 1.6)}${oc(12, 4, 1.6)}${oc(18, 6, 1.6)}${ac(12, 12, 1.7)}`],
  tonguecracker: ["Tonguecracker", `<path d="M4 5.5H20V16H12.5L8.5 20V16H4Z M8 9.5H12M8 12.5H10.5"/>${ac(16, 11, 1.4)}`],
  "sealed-orders": ["Sealed Orders", `<path d="M3.5 6.5H20.5V18H3.5Z M3.5 6.5L12 13L20.5 6.5"/>${ac(12, 13.1, 1.9)}`],
  hushword: ["Hushword", `<rect x="2.5" y="7.5" width="5.5" height="7"/><rect x="9.25" y="7.5" width="5.5" height="7"/><path d="M5.25 12.5V9.5M11 9.5L13 12.5M13 9.5L11 12.5M2.5 19H21.5"/><rect class="ac" x="16" y="7.5" width="5.5" height="7"/>`],
  "scribble-club": ["Scribble Club", `<path d="M5 19L5.8 15.2L16.2 4.8A1.4 1.4 0 0 1 18.2 4.8L19.2 5.8A1.4 1.4 0 0 1 19.2 7.8L8.8 18.2Z M14.5 6.5L17.5 9.5M10.5 21c1.5-1 2.5 1 4 0s2.5 1 5.5 0"/>${ac(5.4, 18.6, 1.3)}`],
  azulejo: ["Azulejo", `<path d="M4 4H20V20H4Z M12 4L20 12L12 20L4 12Z M12 8.4L15.6 12L12 15.6L8.4 12Z"/>${ac(12, 12, 1.3)}`],
  longhaul: ["Long Haul", `<path d="M2.5 20.5H21.5"/><circle cx="6.5" cy="16.9" r="3.5"/><circle cx="12.6" cy="18.3" r="2.2"/><circle cx="16.4" cy="19.3" r="1.2"/>${ac(20, 18.7, 1.8)}`],
  sudoku: ["Sudoku & Tic-Tac-Toe", `<path d="M4 4H20V20H4Z M9.33 4V20M14.67 4V20M4 9.33H20M4 14.67H20 M5.8 5.8L7.6 7.6M7.6 5.8L5.8 7.6"/>${ac(12, 12, 1.5)}`],
  sporefront: ["Sporefront", `<rect x="10.2" y="5" width="3.6" height="3.6"/><rect x="5" y="15.4" width="3.6" height="3.6"/><rect x="10.2" y="15.4" width="3.6" height="3.6"/><rect x="15.4" y="15.4" width="3.6" height="3.6"/><rect class="ac" x="15.4" y="10.2" width="3.6" height="3.6"/>`],
  terrarium: ["Terrarium Hash", `<path d="M8.5 3.5H15.5M9.5 3.5V6.2C9.5 7.4 5.5 8.4 5.5 11.5V19A2 2 0 0 0 7.5 21H16.5A2 2 0 0 0 18.5 19V11.5C18.5 8.4 14.5 7.4 14.5 6.2V3.5M12 19V13.6M12 16C12 14 9.6 13.8 9.6 13.8"/>${ac(12, 12.4, 1.3)}`],
  driftwatch: ["Driftwatch", `<circle cx="12" cy="10.5" r="4.6"/><path d="M12 5.9V3M2.5 18c2.2-1.8 4.3-1.8 6.5 0s4.3 1.8 6.5 0 4.3-1.8 6 0M6 21.5c1.5-1.1 2.6-1.1 4 0s2.6 1.1 4 0"/>${ac(12, 10.5, 1.6)}`],
  loomweight: ["Loomweight", `<path d="M4 3.5H20M6 3.5V14.9M10 3.5V14.9M14 3.5V14.9M18 3.5V14.9M6 9c1.3-1.4 2.7 1.4 4 0s2.7-1.4 4 0 2.7 1.4 4 0"/>${oc(6, 16.8, 1.9)}${oc(10, 16.8, 1.9)}${oc(14, 16.8, 1.9)}${ac(18, 16.8, 1.9)}`],
  deadlock: ["Deadlock", `<path d="M3 7.5H21M3 16.5H21M3 12H9.5M7.2 9.6L9.5 12L7.2 14.4M21 12H14.5M16.8 9.6L14.5 12L16.8 14.4"/>${ac(12, 12, 1.5)}`],
  byzantine: ["Byzantine Choir", `<path d="M12 4.7L16.58 18.81L4.58 10.09H19.42L7.42 18.81Z"/>${oc(16.58, 18.81, 1.7)}${oc(4.58, 10.09, 1.7)}${oc(19.42, 10.09, 1.7)}${oc(7.42, 18.81, 1.7)}${ac(12, 4.7, 2)}`],
  gc: ["Garbage Collector", `<path d="M5.5 7H18.5M9.5 7V4.5H14.5V7M7 7L8 20.5H16L17 7"/>${ac(12, 14.2, 1.7)}`],
  cartel: ["Cartel of Cartographers", `<path d="M3 6.5L9 4.5L15 6.5L21 4.5V17.5L15 19.5L9 17.5L3 19.5Z M9 4.5V17.5M15 6.5V19.5"/>${ac(12, 12, 1.5)}`],
  shadow: ["Shadow Bidding", `<circle cx="12" cy="7.2" r="2.4"/><path d="M9.4 11.2H14.6M10.3 11.2C10.3 14 8.8 15.6 8.2 18.2H15.8C15.2 15.6 13.7 14 13.7 11.2M6.5 20.5H17.5"/>${ac(18.6, 6.2, 1.6)}`],
  lexicon: ["Lexicon Quarantine", `<circle cx="12" cy="12" r="8.2" stroke-dasharray="1.7 2.3"/><path d="M8.8 16.2L12 7.8L15.2 16.2M9.9 13.6H14.1"/>${ac(17.8, 6.2, 1.5)}`],
};
const UI = {
  live: ["Live", `<path d="M8.46 7.79A5.5 5.5 0 0 0 8.46 16.21M15.54 7.79A5.5 5.5 0 0 1 15.54 16.21M6.22 5.11A9 9 0 0 0 6.22 18.89M17.78 5.11A9 9 0 0 1 17.78 18.89"/>${ac(12, 12, 2.4)}`],
  roadmap: ["Roadmap", `<path d="M5 17.3C5 10.5 12 14.5 12 10.2S19 8.6 19 6.9" stroke-dasharray="2 2.3"/>${oc(5, 19, 1.7)}${ac(19, 5, 1.9)}`],
  map: ["Map", `<circle cx="12" cy="12" r="8.5"/><path d="M12 2.5V5M12 19V21.5M2.5 12H5M19 12H21.5M12 7.5L14 12L12 16.5L10 12Z"/>${ac(12, 12, 1.1)}`],
  index: ["Index", `<path d="M4 12H6M4 17.5H6M9 6.5H20M9 12H20M9 17.5H20"/>${ac(5, 6.5, 1.2)}`],
  play: ["Play", `<path d="M8 5.5L18.5 12L8 18.5Z"/>${ac(11.6, 12, 1.1)}`],
  peek: ["Peek", `<path d="M2.5 12C5 7.5 8.5 5.5 12 5.5S19 7.5 21.5 12C19 16.5 15.5 18.5 12 18.5S5 16.5 2.5 12Z"/><circle cx="12" cy="12" r="3.4"/>${ac(12, 12, 1.4)}`],
};
const SW = "fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"";
const sym = (id, [, body]) => `<symbol id="i-${id}" viewBox="0 0 24 24"><g ${SW}>${body}</g></symbol>`;
const markSymbol = `<symbol id="i-mark" viewBox="0 0 64 64">${mark({ chalk: "currentColor", ember: "var(--acc,#EE6A3C)" })}</symbol>`;
const symbols = markSymbol + Object.entries(ICONS).map(([k, v]) => sym(k, v)).join("") + Object.entries(UI).map(([k, v]) => sym(k, v)).join("");
const CSS = `.ac{fill:${C.ember};stroke:none}.o{fill:${C.card}}`;
files["icons.svg"] = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><style>${CSS}</style><defs>${symbols.replace(/var\(--acc,#EE6A3C\)/g, C.ember)}</defs></svg>\n`;

/* ---------- 7. contact sheet (every icon at 2x with a drawn label) ---------- */
{
  const all = [...Object.entries(ICONS).map(([k, v]) => [k, v, "project"]), ...Object.entries(UI).map(([k, v]) => [k, v, "ui"])];
  const cols = 5, cw = 168, ch = 136, pad = 40, rows = Math.ceil(all.length / cols), W = pad * 2 + cols * cw, H = pad * 2 + rows * ch + 36;
  let body = `<style>${CSS}</style><rect width="${W}" height="${H}" fill="${C.card}"/>`;
  all.forEach(([k, [label], kind], i) => {
    const x = pad + (i % cols) * cw, y = pad + Math.floor(i / cols) * ch;
    body += `<rect x="${x}" y="${y}" width="${cw - 16}" height="${ch - 16}" fill="none" stroke="${C.chalk}" stroke-opacity=".18"/>`;
    body += `<g transform="translate(${x + (cw - 16) / 2 - 24} ${y + 18}) scale(2)" color="${C.chalk}"><g ${SW}>${(ICONS[k] || UI[k])[1]}</g></g>`;
    body += word(k.toUpperCase().replace(/-/g, " "), { x: x + 10, y: y + 86, s: .42, track: 4, sw: 1.8, color: kind === "ui" ? C.ember : C.mute })[0];
  });
  files["icon-sheet.svg"] = svg(`0 0 ${W} ${H}`, `<title>Independents icon system</title>${body}`, ` width="${W}" height="${H}"`);
}

/* ---------- 7b. construction drawing of the crest ---------- */
{
  const d = 4, arcs = 5, tail = 28, S = 9, W = 560, H = 560, sp = spiral({ d, arcs, tail });
  const sx = W / 2 / S - (sp.minX + sp.maxX) / 2, sy = H / 2 / S - (sp.minY + sp.maxY) / 2;
  const px = (x) => (x + sx) * S, py = (y) => (y + sy) * S;
  let body = `<rect width="${W}" height="${H}" fill="${C.card}"/>`;
  body += `<g transform="scale(${S}) translate(${n(sx)} ${n(sy)})"><path d="${sp.d}" fill="none" stroke="${C.chalk}" stroke-opacity=".28" stroke-width="3.2"/><path d="${sp.tailD}" fill="none" stroke="${C.chalk}" stroke-opacity=".28" stroke-width="3.2" stroke-dasharray="3.2 3.2"/>`;
  body += `<path d="M${sp.minX - 5} 0H${sp.maxX + 5}" stroke="${C.mute}" stroke-width=".12" stroke-dasharray=".6 .6"/><path d="${sp.d}" fill="none" stroke="${C.ember}" stroke-width=".14"/><circle cx="${-d}" r=".55" fill="${C.card}" stroke="${C.chalk}" stroke-width=".14"/><circle r="2.6" fill="${C.ember}"/></g>`;
  body += word("A", { x: px(-d) - 5, y: py(0) + 26, s: .9, sw: 1.8, color: C.chalk })[0] + word("B · SEED", { x: px(0) - 5, y: py(0) + 26, s: .9, sw: 1.8, color: C.ember, track: 6 })[0];
  body += word("FIVE SEMICIRCLES ON TWO CENTRES", { x: 28, y: H - 36, s: .62, sw: 1.8, color: C.mute, track: 6 })[0];
  files["mark-construction.svg"] = svg(`0 0 ${W} ${H}`, `<title>Independents crest — construction</title>${body}`, ` width="${W}" height="${H}"`);
}

/* ---------- 8. brand poster 1200 x 630 ---------- */
{
  const [wm] = word("INDEPENDENTS", { x: 84, y: 232, s: 2.6, track: 8, sw: 2 });
  const [sub] = word("SCATTERED WORKS", { x: 86, y: 118, s: .9, track: 14, sw: 1.8, color: C.mute });
  const [tag, tagW] = word("THE GAME IS THE LINK", { x: 86, y: 322, s: 1.5, track: 8, sw: 2 });
  const [dot] = word(".", { x: 86 + tagW + 14, y: 322, s: 1.5, sw: 2, color: C.ember });
  const [foot] = word("BROWSER GAMES · NO INSTALL", { x: 86, y: 520, s: .9, track: 8, sw: 1.8, color: C.mute });
  const hair = `<rect x="28.5" y="28.5" width="1143" height="573" fill="none" stroke="${C.chalk}" stroke-opacity=".18"/>`;
  const ticks = [...Array(19)].map((_, i) => `<path d="M${86 + i * 14} 468v${i < 9 ? 14 : 14}" stroke="${i < 9 ? C.chalk : C.mute}" stroke-opacity="${i < 9 ? .75 : .55}" stroke-width="1.5"${i < 9 ? "" : ' stroke-dasharray="3 3"'}/>`).join("");
  files["brand-poster.svg"] = svg("0 0 1200 630", `<title>Independents — the game is the link</title><rect width="1200" height="630" fill="${C.card}"/>${hair}${sub}${wm}${tag}${dot}${ticks}${foot}${mark({ s: 8.4, sw: 3.2, tail: 90, seedR: 2.8, at: [117, 50.6] })}`, ` width="1200" height="630"`);
}

/* ---------- write ---------- */
for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), c);
/* inline sprite for the page: symbols only, colours come from the page */
if (fs.existsSync(PAGE)) {
  const html = fs.readFileSync(PAGE, "utf8"), a = "<!-- sprite:start -->", b = "<!-- sprite:end -->";
  if (html.includes(a) && html.includes(b)) {
    const sprite = `${a}\n<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>\n${b}`;
    fs.writeFileSync(PAGE, html.slice(0, html.indexOf(a)) + sprite + html.slice(html.indexOf(b) + b.length));
  }
}
console.log("brand: wrote " + Object.keys(files).join(", ") + "; " + Object.keys(ICONS).length + " project icons, " + Object.keys(UI).length + " ui icons");
module.exports = { ICONS, UI };
