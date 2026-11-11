/* =====================================================================
   THEME PREVIEWS — nineteen art-directed plates, one per project.

   Not emulators. Each plate is a small vignette that carries the *mood and the core idea* of its
   project in a few seconds, on the same charcoal card as the page: chalk ink plus one accent colour,
   a numbered header, a footer that says LIVE or IN THE WORKSHOP. Every plate:
     - animates by itself (so a landing page never looks dead),
     - answers the pointer (hover moves something, a click does one more thing),
     - is drawn into a 600 x 750 canvas that the world maps onto a standing card.

   API:  const p = makePreview(slug, track, index)
         p.draw(g, t, dt, ptr)   ptr = { x, y } in plate pixels, or null
         p.poke(x, y)            a click on the plate
   ===================================================================== */

export const PW = 600, PH = 750;
const AX = 36, AY = 104, AW = 528, AH = 548;           // the art window inside the frame
const INK = '#EAE8E3', BG = '#1b1b1d', DIM = 'rgba(234,232,227,.52)', FAINT = 'rgba(234,232,227,.14)';
const MONO = '"IBM Plex Mono", "Space Mono", ui-monospace, Menlo, Consolas, monospace';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const back = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

/* ---- little drawing helpers ---- */
const line = (g, x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const circ = (g, x, y, r, fill, stroke) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 6.2832); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
function txt(g, s, x, y, size, col = INK, align = 'left', weight = 500, track = 0) {
  g.font = `${weight} ${size}px ${MONO}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col;
  if ('letterSpacing' in g) g.letterSpacing = track + 'px';
  g.fillText(s, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function hatch(g, x, y, w, h, gap = 7, col = FAINT) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = col; g.lineWidth = 1; for (let k = -h; k < w; k += gap) line(g, x + k, y + h, x + k + h, y); g.restore(); }

/* ---- the plate: paper, frame, header, footer ---- */
let NOISE = null;
function noise() {
  if (NOISE) return NOISE;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(PW, PH) : Object.assign(document.createElement('canvas'), { width: PW, height: PH });
  const g = c.getContext('2d'), r = rng(77);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(234,232,227,${(.02 + r() * .05).toFixed(3)})`; g.fillRect(r() * PW, r() * PH, 1 + (r() < .1), 1); }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(234,232,227,${(.03 + r() * .06).toFixed(3)})`; g.beginPath(); g.arc(r() * PW, r() * PH, .6 + r() * 1.6, 0, 6.3); g.fill(); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(234,232,227,${(.03 + r() * .04).toFixed(3)})`; g.beginPath(); const x = r() * PW, y = r() * PH; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 90, y + (r() - .5) * 90); g.stroke(); }
  return NOISE = c;
}
function plate(g, tr, idx, acc) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.fillStyle = BG; g.fillRect(0, 0, PW, PH); g.drawImage(noise(), 0, 0);
  const live = tr.side === 'A';
  g.lineWidth = 1; g.strokeStyle = 'rgba(234,232,227,.42)'; g.setLineDash(live ? [] : [7, 6]); g.strokeRect(14.5, 14.5, PW - 29, PH - 29); g.setLineDash([]);
  g.strokeStyle = 'rgba(234,232,227,.2)'; g.strokeRect(21.5, 21.5, PW - 43, PH - 43);
  g.strokeStyle = 'rgba(234,232,227,.55)'; for (const [x, y, sx, sy] of [[14, 14, 1, 1], [PW - 14, 14, -1, 1], [14, PH - 14, 1, -1], [PW - 14, PH - 14, -1, -1]]) { line(g, x, y, x + 12 * sx, y); line(g, x, y, x, y + 12 * sy); }
  txt(g, String(idx + 1).padStart(2, '0'), 38, 58, 30, INK, 'left', 600, 1);
  txt(g, tr.name.toUpperCase(), 98, 58, tr.name.length > 17 ? 15 : 19, INK, 'left', 600, tr.name.length > 17 ? 1.5 : 3);
  g.strokeStyle = 'rgba(234,232,227,.3)'; line(g, 38, 84.5, PW - 38, 84.5);
  g.strokeStyle = 'rgba(234,232,227,.3)'; line(g, 38, PH - 70.5, PW - 38, PH - 70.5);
  txt(g, tr.word, 38, PH - 44, 15, INK, 'left', 600, 4);
  if (live) { circ(g, PW - 150, PH - 44, 4.5, acc); txt(g, 'LIVE', PW - 138, PH - 44, 13, INK, 'left', 600, 3); }
  else { g.setLineDash([2, 2]); circ(g, PW - 262, PH - 44, 4.5, null, INK); g.setLineDash([]); txt(g, 'IN THE WORKSHOP', PW - 250, PH - 44, 13, INK, 'left', 500, 2); }
}

/* =====================================================================
   THE NINETEEN VIGNETTES.  (g, o) — g is already translated to the art window.
   o = { w, h, t, dt, px, py, on, st, acc }   px/py local, on = pointer inside
   ===================================================================== */
const V = {};

/* 01 FOGWALK — every possible you moves at once; the fog agrees on one place */
V.fogwalk = (g, o) => {
  const { st, w, h, t, dt, acc } = o, N = 9, C = 56, ox = (w - N * C) / 2, oy = 16, NN = N * N, DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const step = (i, d) => { const x = i % N, y = (i / N) | 0; if (!(st.open[i] >> d & 1)) return i; return (y + DY[d]) * N + x + DX[d]; };
  const solve = B => { const word = []; B = B.slice();
    for (let guard = 0; guard < 120; guard++) { const idx = []; B.forEach((v, i) => v && idx.push(i)); if (idx.length < 2) break;
      const a0 = idx[0], b0 = idx[idx.length - 1], seen = new Map([[a0 * NN + b0, null]]), q = [[a0, b0]]; let found = null;
      for (let k = 0; k < q.length && !found; k++) { const [a, b] = q[k]; for (let d = 0; d < 4; d++) { const na = step(a, d), nb = step(b, d), key = na * NN + nb; if (seen.has(key)) continue; seen.set(key, [a * NN + b, d]); if (na === nb) { found = key; break; } q.push([na, nb]); } }
      if (found === null) break; const w2 = []; for (let key = found; seen.get(key); key = seen.get(key)[0]) w2.push(seen.get(key)[1]); w2.reverse();
      for (const d of w2) { const nB = new Uint8Array(NN); B.forEach((v, i) => v && (nB[step(i, d)] = 1)); B = nB; word.push(d); } }
    return word; };
  const maze = seed => { const r = rng(seed); st.open = new Uint8Array(NN); const seen = new Uint8Array(NN), stack = [Math.floor(r() * NN)]; seen[stack[0]] = 1;
    while (stack.length) { const i = stack[stack.length - 1], x = i % N, y = (i / N) | 0, opts = []; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]) opts.push(d); }
      if (!opts.length) { stack.pop(); continue; } const d = opts[Math.floor(r() * opts.length)], j = (y + DY[d]) * N + x + DX[d]; st.open[i] |= 1 << d; st.open[j] |= 1 << ((d + 2) % 4); seen[j] = 1; stack.push(j); }
    st.B = new Uint8Array(NN).fill(1); st.word = solve(st.B); st.clock = 0; st.hold = 0; st.last = -1; st.pulse = 0; };
  if (!st.i) { st.i = 1; st.seed = st.seed || 5; maze(st.seed); }
  const count = () => st.B.reduce((a, b) => a + b, 0), apply = d => { const nB = new Uint8Array(NN); st.B.forEach((v, i) => v && (nB[step(i, d)] = 1)); st.B = nB; st.last = d; st.pulse = 1; };
  const n0 = count();
  if (n0 === 1) { st.hold += dt; if (st.hold > 2.2) maze(++st.seed); }
  else { st.clock += dt; const manual = o.on, gap = manual ? .3 : .38;
    if (st.clock > gap) { st.clock = 0;
      if (manual) { const dx = o.px - w / 2, dy = o.py - (oy + N * C / 2); apply(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); st.word = null; }
      else { if (!st.word || !st.word.length) st.word = solve(st.B); if (st.word.length) apply(st.word.shift()); } } }
  st.pulse = Math.max(0, st.pulse - dt * 4);
  const n = count();
  for (let i = 0; i < NN; i++) if (st.B[i]) { const x = ox + (i % N) * C + C / 2, y = oy + ((i / N) | 0) * C + C / 2, q = g.createRadialGradient(x, y, 0, x, y, C * .95); q.addColorStop(0, rgba(acc, .3)); q.addColorStop(1, rgba(acc, 0)); g.fillStyle = q; g.fillRect(x - C, y - C, C * 2, C * 2); }
  g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < NN; i++) { const x = ox + (i % N) * C, y = oy + ((i / N) | 0) * C; if (!(st.open[i] >> 1 & 1)) line(g, x + C, y, x + C, y + C); if (!(st.open[i] >> 2 & 1)) line(g, x, y + C, x + C, y + C); if (i % N === 0) line(g, x, y, x, y + C); if (i < N) line(g, x, y, x + C, y); }
  for (let i = 0; i < NN; i++) if (st.B[i]) { const x = ox + (i % N) * C + C / 2, y = oy + ((i / N) | 0) * C + C / 2; circ(g, x, y, n === 1 ? 10 + 5 * Math.sin(t * 6) : 6.5 + st.pulse * 1.6, n === 1 ? acc : INK); }
  const dir = ['UP', 'RIGHT', 'DOWN', 'LEFT'][st.last];
  txt(g, n === 1 ? 'FOUND YOURSELF' : `YOU MIGHT BE IN ${n} PLACES`, ox, oy + N * C + 36, 15, n === 1 ? acc : INK, 'left', 600, 2);
  txt(g, o.on ? 'POINT WHERE TO WALK' : (dir ? 'ALL OF THEM STEP ' + dir : 'ALL OF THEM STEP TOGETHER'), ox, oy + N * C + 62, 12, DIM, 'left', 500, 2);
};
V.fogwalk.poke = st => { st.seed = (st.seed || 5) + 1; st.i = 0; };

/* 02 BLOOMWRIGHT — a rule becomes a plant */
V.bloomwright = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.gen = 2; st.grow = 0; st.ang = 22.5; st.cache = {}; st.hold = 0; }
  const expand = n => st.cache[n] || (st.cache[n] = (() => { let s = 'F'; for (let i = 0; i < n; i++) s = s.replace(/F/g, 'FF+[+F-F-F]-[-F+F+F]'); return s; })());
  st.grow = Math.min(1, st.grow + dt / (1.3 + st.gen * .5));
  if (!o.on) { st.hold += dt; if (st.grow >= 1 && st.hold > 2.6) { st.hold = 0; st.gen = st.gen % 4 + 1; st.grow = 0; } } else st.hold = 0;
  const target = o.on ? 14 + (o.px / w) * 26 : 22.5 + Math.sin(t * .35) * 3; st.ang = lerp(st.ang, target, Math.min(1, dt * 5));
  const A = (st.ang + Math.sin(t * .9) * 1.1) * Math.PI / 180, s = expand(st.gen), len = (h * .5) / Math.pow(2, st.gen);
  const segs = []; let x = w / 2, y = h - 70, a = -Math.PI / 2, depth = 0; const stk = [];
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (c === 'F') { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; segs.push([x, y, x2, y2, depth]); x = x2; y = y2; }
    else if (c === '+') a += A; else if (c === '-') a -= A; else if (c === '[') { stk.push([x, y, a]); depth++; } else if (c === ']') { segs.push([x, y, x, y, -1]); [x, y, a] = stk.pop(); depth--; } }
  const n = Math.floor(segs.length * ease(st.grow)); g.lineCap = 'round';
  for (let i = 0; i < n; i++) { const [x1, y1, x2, y2, d] = segs[i]; if (d < 0) { circ(g, x1, y1, 2.6, rgba(acc, .85)); continue; } g.lineWidth = Math.max(.9, 4.2 - d * .8); g.strokeStyle = d > 1 ? rgba(acc, .95) : 'rgba(234,232,227,.88)'; line(g, x1, y1, x2, y2); }
  g.strokeStyle = DIM; g.lineWidth = 1; line(g, 30, h - 66, w - 30, h - 66); hatch(g, 30, h - 66, w - 60, 14, 6, 'rgba(234,232,227,.1)');
  txt(g, 'RULE', 34, 24, 12, DIM, 'left', 500, 3); txt(g, 'F → FF+[+F−F−F]−[−F+F+F]', 34, 46, 14, INK, 'left', 500, 0);
  txt(g, `ROUND ${st.gen} OF 4`, w - 34, 24, 12, DIM, 'right', 500, 3); txt(g, `BEND ${st.ang.toFixed(0)}°`, w - 34, 46, 14, acc, 'right', 600, 1);
  txt(g, o.on ? 'MOVE SIDEWAYS TO BEND THE RULE' : 'THE PLANT IS ONLY THE RULE, REPEATED', 34, h - 20, 12, DIM, 'left', 500, 2);
};
V.bloomwright.poke = st => { st.gen = (st.gen || 2) % 4 + 1; st.grow = 0; };

/* 03 TONGUECRACKER — three sentences, one grammar, one sentence to say */
V.tonguecracker = (g, o) => {
  const { st, w, h, t, dt, acc } = o;
  const NOUNS = ['cat', 'fox', 'owl', 'fish', 'moth'], SYL = ['ka', 'mi', 'to', 're', 'su', 'lo', 'vi', 'na', 'be', 'zu', 'pa', 'ko'], VERBS = ['sees', 'chases', 'follows'];
  const make = seed => { const r = rng(seed), pick = a => a.splice(Math.floor(r() * a.length), 1)[0], syl = SYL.slice(), words = {};
    const sy = () => { if (syl.length < 2) syl.push(...SYL.filter(x => !syl.includes(x))); return pick(syl); }; [...NOUNS, ...VERBS].forEach(k => { let wd = sy() + sy(); while (Object.values(words).includes(wd)) wd = sy() + sy(); words[k] = wd; }); const order = ['S', 'V', 'O'].sort(() => r() - .5), suffix = r() < .5 ? 'n' : 'ra';
    const sent = () => { const s = NOUNS[Math.floor(r() * 5)]; let ob = NOUNS[Math.floor(r() * 5)]; if (ob === s) ob = NOUNS[(NOUNS.indexOf(s) + 2) % 5]; const v = VERBS[Math.floor(r() * 3)];
      const tok = { S: { a: words[s], e: 'the ' + s }, V: { a: words[v] + (s.length > 3 ? suffix : ''), e: v }, O: { a: words[ob], e: 'the ' + ob } }; return order.map(k => tok[k]); };
    return { rows: [sent(), sent(), sent()], target: sent(), order }; };
  if (!st.i) { st.i = 1; st.seed = st.seed || 11; st.L = make(st.seed); st.placed = 0; st.clock = 0; st.hold = 0; st.tray = null; }
  const L = st.L, r = rng(st.seed * 7);
  st.clock += dt; if (st.placed < 3 && st.clock > 1.05) { st.clock = 0; st.placed++; } else if (st.placed >= 3) { st.hold += dt; if (st.hold > 2.6) { st.seed++; st.L = make(st.seed); st.placed = 0; st.hold = 0; st.clock = -.8; st.tray = null; } }
  if (!st.tray) st.tray = L.target.map((tk, i) => i).sort(() => r() - .5);
  g.textBaseline = 'middle';
  txt(g, 'THREE SENTENCES IN A NEW LANGUAGE', 8, 14, 12, DIM, 'left', 500, 2);
  L.rows.forEach((row, ri) => { const y = 66 + ri * 76; let x = 8, hot = o.on && o.py > y - 30 && o.py < y + 46;
    if (hot) { g.fillStyle = rgba(acc, .1); g.fillRect(0, y - 28, w, 72); }
    row.forEach((tk, ci) => { g.font = `600 28px ${MONO}`; const wd = g.measureText(tk.a).width; txt(g, tk.a, x, y, 28, hot ? acc : INK, 'left', 600); txt(g, tk.e, x, y + 28, 12, hot ? INK : DIM, 'left', 500, 0); x += Math.max(wd, g.measureText(tk.e).width * .8) + 28; });
    g.strokeStyle = FAINT; line(g, 8, y + 46, w - 8, y + 46); });
  const gy = 322; txt(g, 'NOW SAY:', 8, gy, 12, DIM, 'left', 500, 2); txt(g, L.target.map(k => k.e).join(' ').toUpperCase(), 100, gy, 13, acc, 'left', 600, 1);
  const slotY = gy + 52, tw = 150, gap = 14, x0 = (w - (tw * 3 + gap * 2)) / 2;
  L.target.forEach((tk, i) => { const x = x0 + i * (tw + gap), filled = i < st.placed, p = ease((st.clock - (i === st.placed - 1 ? 0 : -9)) / .35);
    g.lineWidth = 1.5; g.strokeStyle = filled ? acc : 'rgba(234,232,227,.4)'; g.setLineDash(filled ? [] : [5, 5]); rrect(g, x, slotY - 26, tw, 52, 6); g.stroke(); g.setLineDash([]);
    if (filled) { g.fillStyle = rgba(acc, .12); g.fill(); txt(g, tk.a, x + tw / 2, slotY, 24, INK, 'center', 600); } });
  const hoverTray = o.on ? st.tray.findIndex((k, i) => o.px > x0 + i * (tw + gap) && o.px < x0 + i * (tw + gap) + tw && Math.abs(o.py - (slotY + 92)) < 28) : -1;
  st.tray.forEach((k, i) => { const x = x0 + i * (tw + gap), tk = L.target[k], used = k < st.placed, hov = hoverTray === i, y = slotY + 92 - (hov ? 4 : 0);
    g.lineWidth = 1.5; g.strokeStyle = used ? FAINT : hov ? acc : 'rgba(234,232,227,.7)'; rrect(g, x, y - 26, tw, 52, 6); g.stroke(); txt(g, tk.a, x + tw / 2, y - 3, 22, used ? FAINT : INK, 'center', 600); txt(g, tk.e, x + tw / 2, y + 17, 11, used ? FAINT : hov ? acc : DIM, 'center', 500); });
  txt(g, st.placed >= 3 ? '✓ YOU SAID IT' : 'PICK THE RIGHT WORDS, IN THE RIGHT ORDER', 8, h - 18, 13, st.placed >= 3 ? acc : DIM, 'left', 600, 2);
};
V.tonguecracker.poke = st => { st.seed = (st.seed || 11) + 1; st.L = null; st.i = 0; };

/* 04 SEALED ORDERS — three secrets, one seal, one link */
V['sealed-orders'] = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.ord = [null, null, null]; st.clock = 0; st.sealT = -9; st.hold = 0; st.auto = 0; }
  const GL = ['←', '↑', '→', '↓'], cx = [w * .2, w * .5, w * .8], cy = 190, R = 66;
  const full = () => st.ord.every(v => v !== null), hash = () => full() ? fnv(st.ord.join('')) : '········';
  if (!o.on || true) { st.clock += dt; if (!full() && st.clock > 1.0) { st.clock = 0; const i = st.ord.indexOf(null); st.ord[i] = Math.floor(rng(i * 131 + Math.floor(t * 7))() * 4); if (full()) st.sealT = t; } else if (full()) { st.hold += dt; if (st.hold > 3) { st.ord = [null, null, null]; st.hold = 0; st.clock = 0; } } }
  const hov = o.on ? cx.findIndex(x => Math.hypot(o.px - x, o.py - cy) < R) : -1; st.rects = cx;
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(234,232,227,.5)'; rrect(g, 12, 70, w - 24, 240, 12); g.stroke();
  g.strokeStyle = 'rgba(234,232,227,.5)'; g.beginPath(); g.moveTo(12, 82); g.lineTo(w / 2, 190 - 30); g.lineTo(w - 12, 82); g.stroke();
  cx.forEach((x, i) => { const v = st.ord[i], hv = hov === i, r = R - (hv ? -4 : 0);
    g.lineWidth = hv ? 2.4 : 1.4; g.strokeStyle = v === null ? 'rgba(234,232,227,.45)' : INK; g.setLineDash(v === null ? [4, 5] : []); circ(g, x, cy + 22, r - 6, 'rgba(27,27,29,.9)', g.strokeStyle); g.setLineDash([]);
    txt(g, v === null ? '?' : GL[v], x, cy + 22, v === null ? 34 : 60, v === null ? DIM : INK, 'center', 600); txt(g, 'ORDER ' + (i + 1), x, cy + 108, 12, DIM, 'center', 500, 3); });
  if (full()) { const p = back((t - st.sealT) / .45), s = 34 * p; g.save(); g.translate(w / 2, 150); g.rotate(-.12); circ(g, 0, 0, s, acc); g.strokeStyle = 'rgba(21,21,22,.6)'; g.lineWidth = 2; circ(g, 0, 0, s * .66, null, 'rgba(21,21,22,.6)'); if (p > .8) txt(g, 'S', 0, 1, 26, '#151516', 'center', 700); g.restore(); }
  const by = 380; g.lineWidth = 1.5; g.strokeStyle = 'rgba(234,232,227,.6)'; rrect(g, 12, by, w - 24, 54, 27); g.stroke();
  txt(g, 'independents.link/#', 36, by + 27, 16, DIM, 'left', 500); g.font = `500 16px ${MONO}`; const wd = g.measureText('independents.link/#').width; txt(g, hash(), 36 + wd, by + 27, 16, full() ? acc : DIM, 'left', 700, 1);
  txt(g, full() ? 'SEALED. SEND THE LINK, NOT THE MOVES.' : 'CHOOSE THREE SECRET MOVES', 12, by + 92, 14, full() ? acc : INK, 'left', 600, 2);
  txt(g, 'THE SEAL TRAVELS IN THE LINK. NOTHING IS STORED.', 12, by + 120, 12, DIM, 'left', 500, 1);
  txt(g, 'CLICK AN ORDER TO CHANGE IT', 12, h - 16, 12, DIM, 'left', 500, 2);
};
V['sealed-orders'].poke = (st, x, y) => { if (!st.rects) return; const i = st.rects.findIndex(cx => Math.hypot(x - cx, y - 190) < 70); if (i >= 0) { st.ord[i] = st.ord[i] === null ? 0 : (st.ord[i] + 1) % 4; if (st.ord.every(v => v !== null)) st.sealT = st.t || 0; st.hold = 0; } };

/* 05 HUSHWORD — a word game with the blanks blacked out */
V.hushword = (g, o) => {
  const { st, w, h, t, dt, acc } = o;
  const SETS = [['EMBER', ['CRANE', 'SMELT']], ['MOONS', ['CRANE', 'SMOLT']], ['LIGHT', ['STAIR', 'FLINT']], ['PLANT', ['CRANE', 'SLANT']]];
  const fb = (a, s) => { const r = Array(5).fill(0), left = {}; for (let i = 0; i < 5; i++) if (a[i] === s[i]) r[i] = 2; else left[a[i]] = (left[a[i]] || 0) + 1; for (let i = 0; i < 5; i++) if (!r[i] && left[s[i]] > 0) { r[i] = 1; left[s[i]]--; } return r; };
  const init = k => { const [ans, gs] = SETS[k % 4], rows = [...gs, ans], r = rng(k * 99 + 5); st.k = k; st.rows = rows.map(wd => ({ wd, f: fb(ans, wd), red: [0, 1, 2, 3, 4].map(() => r() < .34) })); st.rows[2].red = [0, 0, 0, 0, 0].map((_, i) => i === 2); st.shown = 0; st.clock = 0; st.hold = 0; };
  if (!st.i) { st.i = 1; init(st.k || 1); }
  st.clock += dt; if (st.shown < 3 && st.clock > .9) { st.clock = 0; st.shown++; } else if (st.shown >= 3) { st.hold += dt; if (st.hold > 3.4) init(st.k + 1); }
  const S = 72, G = 10, x0 = (w - (S * 5 + G * 4)) / 2, y0 = 14; let reds = 0, tot = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = x0 + c * (S + G), y = y0 + r * (S + G), row = st.rows[r], vis = r < st.shown, hv = o.on && o.px > x && o.px < x + S && o.py > y && o.py < y + S;
    if (!vis || !row) { g.lineWidth = 1.3; g.strokeStyle = 'rgba(234,232,227,.28)'; g.strokeRect(x + .5, y + .5, S, S); continue; }
    const f = row.f[c], red = row.red[c] && !hv; tot++; if (row.red[c]) reds++;
    if (red) { g.fillStyle = '#0d0d0e'; g.fillRect(x, y, S, S); g.strokeStyle = 'rgba(234,232,227,.5)'; g.lineWidth = 1.3; g.strokeRect(x + .5, y + .5, S, S); hatch(g, x, y, S, S, 6, 'rgba(234,232,227,.16)'); txt(g, '▮▮', x + S / 2, y + S / 2, 20, 'rgba(234,232,227,.5)', 'center', 700); continue; }
    if (f === 2) { g.fillStyle = INK; g.fillRect(x, y, S, S); txt(g, row.wd[c], x + S / 2, y + S / 2 + 2, 38, '#151516', 'center', 700); }
    else if (f === 1) { g.fillStyle = acc; g.fillRect(x, y, S, S); txt(g, row.wd[c], x + S / 2, y + S / 2 + 2, 38, '#151516', 'center', 700); }
    else { g.lineWidth = 1.3; g.strokeStyle = 'rgba(234,232,227,.45)'; g.strokeRect(x + .5, y + .5, S, S); hatch(g, x, y, S, S, 8, 'rgba(234,232,227,.08)'); txt(g, row.wd[c], x + S / 2, y + S / 2 + 2, 38, 'rgba(234,232,227,.5)', 'center', 600); }
  }
  const ly = y0 + 4 * (S + G) + 22;
  g.fillStyle = INK; g.fillRect(x0, ly - 7, 14, 14); txt(g, 'RIGHT SPOT', x0 + 22, ly, 12, INK, 'left', 500, 1);
  g.fillStyle = acc; g.fillRect(x0 + 142, ly - 7, 14, 14); txt(g, 'WRONG SPOT', x0 + 164, ly, 12, INK, 'left', 500, 1);
  g.strokeStyle = DIM; g.strokeRect(x0 + 284.5, ly - 6.5, 13, 13); txt(g, 'NOT IN WORD', x0 + 306, ly, 12, INK, 'left', 500, 1);
  g.lineWidth = 1.4; g.strokeStyle = 'rgba(234,232,227,.55)'; rrect(g, x0, ly + 26, w - 2 * x0, 40, 20); g.stroke();
  txt(g, `…/#${fnv('hush' + st.k).slice(0, 4)}-${fnv('contract' + st.k).slice(0, 4)}`, x0 + 22, ly + 46, 14, acc, 'left', 600, 1); txt(g, 'THIS LINK IS THIS PUZZLE', w - x0 - 18, ly + 46, 11, DIM, 'right', 500, 2);
  txt(g, o.on ? 'HOVER A BLACK BAR TO PEEK' : `${reds} OF ${tot} CLUES BLACKED OUT`, x0, h - 12, 12, DIM, 'left', 500, 2);
};
V.hushword.poke = st => { st.k = (st.k || 1) + 1; st.i = 0; };

/* 06 SCRIBBLE CLUB — a shared page, a pencil that follows you */
V.pictionary = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.t0 = 0; st.trail = []; }
  const S = [[[.18, .5], [.5, .18], [.82, .5]], [[.26, .46], [.26, .86], [.74, .86], [.74, .46]], [[.44, .86], [.44, .62], [.58, .62], [.58, .86]], [[.64, .22], [.64, .36]], [[.62, .18], [.56, .1], [.62, .03], [.55, -.04]], [[.3, .6], [.38, .6], [.38, .72], [.3, .72], [.3, .6]]];
  st.t0 += dt; const cyc = 16, tt = st.t0 % cyc, prog = clamp(tt / 8.5, 0, 1) * S.length;
  const px0 = 10, py0 = 60, pw = w - 20, ph = 330; g.fillStyle = 'rgba(234,232,227,.045)'; rrect(g, px0, py0, pw, ph, 6); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(234,232,227,.35)'; g.stroke();
  for (const sx of [px0 + 6, px0 + pw - 6]) { g.save(); g.translate(sx, py0 + 2); g.rotate(sx < w / 2 ? -.5 : .5); g.fillStyle = 'rgba(234,232,227,.2)'; g.fillRect(-24, -8, 48, 16); g.restore(); }
  const jit = (x, y, k) => [x + Math.sin(k * 7.1 + x * .05) * 1.4, y + Math.cos(k * 5.3 + y * .05) * 1.4];
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 3.4; g.strokeStyle = INK; let tip = null;
  S.forEach((pl, si) => { const k = clamp(prog - si, 0, 1); if (k <= 0) return; const pts = pl.map(([u, v]) => [px0 + 20 + u * (pw - 40), py0 + 22 + (v + .1) * (ph - 60)]);
    let tot = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; } let rem = tot * k; g.beginPath(); g.moveTo(...jit(pts[0][0], pts[0][1], 0));
    for (let i = 1; i < pts.length && rem > 0; i++) { const f = Math.min(1, rem / seg[i - 1]), x = lerp(pts[i - 1][0], pts[i][0], f), y = lerp(pts[i - 1][1], pts[i][1], f); g.lineTo(...jit(x, y, i)); rem -= seg[i - 1]; tip = [x, y]; } g.stroke(); });
  if (tip && prog < S.length) { g.save(); g.translate(tip[0], tip[1]); g.rotate(.7); g.fillStyle = '#d6c690'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-5, -5); g.lineTo(-30, -30); g.lineTo(-24, -36); g.lineTo(-5, -5); g.fill(); g.restore(); rrect(g, tip[0] + 8, tip[1] + 4, 36, 18, 9); g.fillStyle = 'rgba(234,232,227,.9)'; g.fill(); txt(g, 'MO', tip[0] + 26, tip[1] + 13, 11, '#151516', 'center', 700, 1); }
  if (o.on) { const last = st.trail[st.trail.length - 1]; if (!last || Math.hypot(last.x - o.px, last.y - o.py) > 3) st.trail.push({ x: o.px, y: o.py, t: st.t0 }); }
  st.trail = st.trail.filter(p => st.t0 - p.t < 3.4); g.strokeStyle = acc; g.lineWidth = 4;
  for (let i = 1; i < st.trail.length; i++) { const a = st.trail[i - 1], b = st.trail[i]; if (Math.hypot(a.x - b.x, a.y - b.y) > 60) continue; g.globalAlpha = clamp(1 - (st.t0 - b.t) / 3.4, 0, 1); line(g, a.x, a.y, b.x, b.y); } g.globalAlpha = 1;
  if (o.on) { rrect(g, o.px + 10, o.py + 8, 42, 18, 9); g.fillStyle = acc; g.fill(); txt(g, 'YOU', o.px + 31, o.py + 17, 11, '#151516', 'center', 700, 1); }
  const chat = [['ines', 'A CAT?', 9.2], ['theo', 'A BARN?', 10.8], ['you', 'HOUSE!', 12.6]];
  chat.forEach(([n, m, at], i) => { if (tt < at) return; const y = 428 + i * 34, win = i === 2; txt(g, n.toUpperCase(), 14, y, 12, DIM, 'left', 500, 2); rrect(g, 76, y - 14, 150, 28, 14); g.fillStyle = win ? rgba(acc, .22) : 'rgba(234,232,227,.07)'; g.fill(); g.lineWidth = 1; g.strokeStyle = win ? acc : 'rgba(234,232,227,.3)'; g.stroke(); txt(g, m, 92, y, 14, win ? acc : INK, 'left', 600, 1); if (win) txt(g, '✓ +10', 244, y, 14, acc, 'left', 700); });
  if (tt < 9.2) ['MO · DRAWING', 'INES · GUESSING', 'THEO · GUESSING'].forEach((n, i) => { const y = 428 + i * 34; circ(g, 22, y, 5, i ? null : acc, i ? DIM : null); txt(g, n, 36, y, 12, i ? DIM : INK, 'left', 600, 2); if (i) { for (let k = 0; k < 3; k++) circ(g, 220 + k * 10, y + (Math.sin(t * 5 + k + i) > .5 ? -2 : 0), 2, DIM); } });
  txt(g, tt < 9 ? 'MO IS DRAWING… WORD: ▮▮▮▮▮' : tt < 12.6 ? 'THE GUESSES ARE COMING IN' : 'ROUND SOLVED. NEXT WORD…', 14, 28, 13, INK, 'left', 600, 2);
  txt(g, o.on ? 'YOUR PENCIL FOLLOWS YOUR CURSOR' : 'FRIENDS DRAW, YOU GUESS', 14, h - 14, 12, DIM, 'left', 500, 2);
};
V.pictionary.poke = st => { st.t0 = 0; st.trail = []; };

/* 07 AZULEJO — the wall fills tile by tile */
V.azul = (g, o) => {
  const { st, w, h, t, dt } = o; const PAL = ['#5d88d8', '#e6b93d', '#d6453a', '#37b3a6', '#EAE8E3'], S = 78, G = 8, x0 = (w - (5 * S + 4 * G)) / 2, y0 = 60;
  if (!st.i) { st.i = 1; st.at = Array(25).fill(-1); st.clock = 0; st.hold = 0; st.order = null; st.score = 0; }
  const colOf = (r, c) => (c - r + 5) % 5, cell = (r, c) => ({ x: x0 + c * (S + G), y: y0 + r * (S + G) });
  const place = i => { if (st.at[i] < 0) { st.at[i] = t; const r = (i / 5) | 0, c = i % 5; let s = 1; for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const rr2 = r + dr, cc = c + dc; if (rr2 >= 0 && rr2 < 5 && cc >= 0 && cc < 5 && st.at[rr2 * 5 + cc] >= 0) s++; } st.score += s; } };
  if (!st.order) st.order = [...Array(25).keys()].sort(() => Math.random() - .5);
  const done = st.at.every(v => v >= 0); st.clock += dt;
  if (!done && st.clock > .5) { st.clock = 0; const nxt = st.order.find(i => st.at[i] < 0); if (nxt !== undefined) place(nxt); } else if (done) { st.hold += dt; if (st.hold > 2.6) { st.at.fill(-1); st.order = null; st.hold = 0; st.score = 0; } }
  const hv = o.on ? (() => { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const q = cell(r, c); if (o.px > q.x && o.px < q.x + S && o.py > q.y && o.py < q.y + S) return r * 5 + c; } return -1; })() : -1; if (hv >= 0) place(hv);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const i = r * 5 + c, q = cell(r, c), col = PAL[colOf(r, c)], at = st.at[i];
    if (at < 0) { g.lineWidth = 1; g.strokeStyle = 'rgba(234,232,227,.22)'; g.strokeRect(q.x + .5, q.y + .5, S, S); g.globalAlpha = .13; g.fillStyle = col; g.beginPath(); g.arc(q.x + S / 2, q.y + S / 2, 9, 0, 6.3); g.fill(); g.globalAlpha = 1; continue; }
    const p = clamp((t - at) / .55, 0, 1), k = back(p), yy = q.y - (1 - ease(p)) * 160;
    g.save(); g.translate(q.x + S / 2, yy + S / 2); g.scale(.5 + .5 * k, .5 + .5 * k); g.globalAlpha = Math.min(1, p * 3);
    g.fillStyle = col; g.fillRect(-S / 2, -S / 2, S, S); g.fillStyle = 'rgba(21,21,22,.22)'; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.arc(sx * S / 2, sy * S / 2, S * .36, 0, 6.3); g.fill(); }
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -S * .22); g.lineTo(S * .22, 0); g.lineTo(0, S * .22); g.lineTo(-S * .22, 0); g.fill(); g.strokeStyle = 'rgba(21,21,22,.55)'; g.lineWidth = 2; g.stroke(); g.strokeRect(-S / 2 + 1, -S / 2 + 1, S - 2, S - 2); g.restore();
  }
  const n = st.at.filter(v => v >= 0).length;
  txt(g, 'YOUR WALL', x0, 24, 14, INK, 'left', 600, 4); txt(g, `${n} / 25 TILES`, x0 + 5 * S + 4 * G, 24, 12, DIM, 'right', 500, 2);
  txt(g, 'SCORE ' + String(st.score).padStart(2, '0'), x0, y0 + 5 * (S + G) + 16, 22, o.acc, 'left', 700, 3);
  txt(g, o.on ? 'HOVER A GHOST TILE TO LAY IT' : 'EVERY COLOUR ONCE PER ROW AND COLUMN', x0, h - 14, 12, DIM, 'left', 500, 2);
};
V.azul.poke = st => { st.at && st.at.fill(-1); st.order = null; st.score = 0; };

/* 08 LONG HAUL — the pile slows you down; dump it to block the devils */
V.longhaul = (g, o) => {
  const { st, w, h, t, dt, acc } = o;
  if (!st.i) { st.i = 1; const pts = [], X0 = 64, X1 = w - 64, Y0 = 70, Y1 = h - 130, R = 70;
    const arc = (cx, cy, a0, a1) => { for (let k = 0; k <= 14; k++) { const a = lerp(a0, a1, k / 14); pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
    for (let x = X0 + R; x < X1 - R; x += 6) pts.push([x, Y0]); arc(X1 - R, Y0 + R, -Math.PI / 2, 0); for (let y = Y0 + R; y < Y1 - R; y += 6) pts.push([X1, y]); arc(X1 - R, Y1 - R, 0, Math.PI / 2);
    for (let x = X1 - R; x > X0 + R; x -= 6) pts.push([x, Y1]); arc(X0 + R, Y1 - R, Math.PI / 2, Math.PI); for (let y = Y1 - R; y > Y0 + R; y -= 6) pts.push([X0, y]); arc(X0 + R, Y0 + R, Math.PI, Math.PI * 1.5);
    st.P = pts; st.s = 0; st.stones = 0; st.pellet = pts.map((_, i) => i % 7 === 0 && i > 14); st.wall = -1; st.wallT = 0; st.shed = 0; }
  const P = st.P, N = P.length, at = s => P[((Math.floor(s) % N) + N) % N]; const speed = 46 * (1 - .075 * st.stones) + 6;
  st.s += speed * dt / 6; const head = Math.floor(st.s) % N;
  if (st.pellet[head]) { st.pellet[head] = false; st.stones = Math.min(9, st.stones + 1); }
  if (o.on) for (let i = 0; i < N; i++) if (st.pellet[i] && Math.hypot(P[i][0] - o.px, P[i][1] - o.py) < 24) { st.pellet[i] = false; st.stones = Math.min(9, st.stones + 1); }
  if (st.stones >= 9 || (st.stones >= 6 && Math.sin(t * .3) > .9)) dump(st);
  if (st.wall >= 0) { st.wallT -= dt; if (st.wallT <= 0) st.wall = -1; }
  if (st.pellet.filter(Boolean).length < 8) st.pellet = P.map((_, i) => i % 7 === 0 && i > 14);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  g.strokeStyle = 'rgba(234,232,227,.8)'; g.lineWidth = 50; g.stroke(); g.strokeStyle = BG; g.lineWidth = 45.5; g.stroke();
  g.strokeStyle = 'rgba(234,232,227,.8)'; g.lineWidth = 2; g.setLineDash([]); g.strokeRect(w / 2 - 150.5, 104.5, 301, 112); g.fillStyle = BG; g.fillRect(w / 2 - 149, 106, 298, 109); hatch(g, w / 2 - 149, 106, 298, 109, 9, 'rgba(234,232,227,.07)');
  g.fillStyle = 'rgba(234,232,227,.5)'; P.forEach((p, i) => { if (st.pellet[i]) { g.beginPath(); g.arc(p[0], p[1], 3.4, 0, 6.3); g.fill(); } });
  if (st.wall >= 0) { const [wx, wy] = at(st.wall); g.fillStyle = acc; g.fillRect(wx - 17, wy - 17, 34, 34); hatch(g, wx - 17, wy - 17, 34, 34, 5, 'rgba(21,21,22,.5)'); }
  for (let k = Math.min(st.stones, 9); k >= 1; k--) { const [x, y] = at(st.s - k * 2.6); circ(g, x, y, 9 - k * .2, '#8a8a8d', 'rgba(21,21,22,.8)'); }
  const dv = [[24, 0], [34, 1], [44, 2], [54, 3]]; dv.forEach(([off, kind], i) => { let s = st.s - off - Math.sin(t * .8 + i) * 2; if (st.wall >= 0) { const gap = ((st.wall - s) % N + N) % N; if (gap < 3 + off * .05) s = st.wall - 3 - i * 1.6; } const [x, y] = at(s); g.save(); g.translate(x, y); g.fillStyle = acc; g.beginPath();
    if (kind === 0) { g.moveTo(0, -11); g.lineTo(10, 9); g.lineTo(-10, 9); g.closePath(); } else if (kind === 1) { g.rect(-9, -9, 18, 18); } else if (kind === 2) { g.moveTo(0, -12); g.lineTo(11, 0); g.lineTo(0, 12); g.lineTo(-11, 0); g.closePath(); } else { g.rect(-3.5, -11, 7, 22); g.rect(-11, -3.5, 22, 7); } g.fill(); g.fillStyle = '#151516'; g.fillRect(-5, -2, 3, 3); g.fillRect(2, -2, 3, 3); g.restore(); });
  const [hx, hy] = at(st.s); g.save(); g.translate(hx, hy); circ(g, 0, 0, 14, INK); circ(g, 0, 0, 14, null, '#151516'); g.fillStyle = '#151516'; g.fillRect(-6, -3, 4, 5); g.fillRect(2, -3, 4, 5); g.restore();
  txt(g, 'LOAD', 12, 20, 13, INK, 'left', 600, 3); for (let i = 0; i < 9; i++) { g.fillStyle = i < st.stones ? INK : 'rgba(234,232,227,.18)'; g.fillRect(70 + i * 15, 12, 11, 16); }
  txt(g, 'SPEED ' + Math.round(100 * (1 - .075 * st.stones)) + '%', w - 12, 20, 13, st.stones > 5 ? acc : INK, 'right', 600, 2);
  txt(g, 'A BIGGER PILE MEANS A SLOWER YOU', w / 2, 156, 13, DIM, 'center', 500, 1); txt(g, o.on ? 'POINT AT STONES TO EAT THEM' : 'CLICK TO DUMP THE PILE', w / 2, 180, 13, INK, 'center', 600, 2);
  txt(g, 'DEVILS CAN’T CLIMB WALLS YOU DROP', 12, h - 14, 12, DIM, 'left', 500, 2);
  function dump(s) { s.stones = 0; s.wall = ((Math.floor(s.s) - 9) % N + N) % N; s.wallT = 2.4; }
};
V.longhaul.poke = st => { if (st.P && st.stones > 0) { st.stones = 0; st.wall = ((Math.floor(st.s) - 9) % st.P.length + st.P.length) % st.P.length; st.wallT = 2.4; } };

/* 09 SUDOKU & TIC-TAC-TOE — a grid inside a grid: your move picks their board */
V.boards = (g, o) => {
  const { st, w, h, t, dt, acc } = o; const SZ = 480, B = SZ / 3, C = B / 3, x0 = (w - SZ) / 2, y0 = 6;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]], win = c => { for (const L of LINES) if (c[L[0]] && c[L[0]] === c[L[1]] && c[L[0]] === c[L[2]]) return c[L[0]]; return 0; };
  const reset = () => { st.b = Array.from({ length: 9 }, () => Array(9).fill(0)); st.win = Array(9).fill(0); st.next = -1; st.pl = 1; st.clock = 0; st.hold = 0; st.last = null; st.n = 0; st.rnd = rng(Math.floor(Math.random() * 1e6)); };
  const legal = (bd, c) => st.b[bd][c] === 0 && !st.win[bd] && (st.next < 0 || st.next === bd);
  const play = (bd, c) => { st.b[bd][c] = st.pl; st.win[bd] = win(st.b[bd]) || (st.b[bd].every(v => v) ? 3 : 0); st.next = st.win[c] || st.b[c].every(v => v) ? -1 : c; st.pl = 3 - st.pl; st.last = [bd, c]; st.n++; };
  if (!st.i) { st.i = 1; reset(); }
  const over = win(st.win.map(v => v === 3 ? 0 : v)) || st.n > 40; st.clock += dt;
  if (!over && st.clock > .75) { st.clock = 0; const mv = []; for (let bd = 0; bd < 9; bd++) for (let c = 0; c < 9; c++) if (legal(bd, c)) mv.push([bd, c]); if (mv.length) play(...mv[Math.floor(st.rnd() * mv.length)]); else st.n = 99; }
  else if (over) { st.hold += dt; if (st.hold > 2.4) reset(); }
  let hb = -1, hc = -1; if (o.on) { const lx = o.px - x0, ly = o.py - y0; if (lx >= 0 && ly >= 0 && lx < SZ && ly < SZ) { hb = Math.floor(ly / B) * 3 + Math.floor(lx / B); hc = Math.floor((ly % B) / C) * 3 + Math.floor((lx % B) / C); } }
  const target = hc >= 0 ? hc : st.next;
  for (let b = 0; b < 9; b++) { const bx = x0 + (b % 3) * B, by = y0 + ((b / 3) | 0) * B, live = target < 0 ? !st.win[b] : b === target;
    if (live && !st.win[b]) { g.fillStyle = rgba(acc, .12); g.fillRect(bx + 3, by + 3, B - 6, B - 6); g.strokeStyle = acc; g.lineWidth = 2; g.strokeRect(bx + 4, by + 4, B - 8, B - 8); }
    g.strokeStyle = 'rgba(234,232,227,.4)'; g.lineWidth = 1; for (let k = 1; k < 3; k++) { line(g, bx + 10, by + k * C, bx + B - 10, by + k * C); line(g, bx + k * C, by + 10, bx + k * C, by + B - 10); }
    for (let c = 0; c < 9; c++) { const v = st.b[b][c], cx = bx + (c % 3) * C + C / 2, cy = by + ((c / 3) | 0) * C + C / 2, lastMove = st.last && st.last[0] === b && st.last[1] === c; g.globalAlpha = st.win[b] ? .28 : 1; if (v === 1) { g.strokeStyle = INK; g.lineWidth = 3.2; line(g, cx - 11, cy - 11, cx + 11, cy + 11); line(g, cx + 11, cy - 11, cx - 11, cy + 11); } else if (v === 2) { g.lineWidth = 3.2; circ(g, cx, cy, 12, null, lastMove ? acc : INK); } g.globalAlpha = 1; if (lastMove) { g.strokeStyle = acc; g.lineWidth = 1.5; g.strokeRect(cx - C / 2 + 4, cy - C / 2 + 4, C - 8, C - 8); } }
    if (st.win[b] === 1 || st.win[b] === 2) { g.lineWidth = 7; if (st.win[b] === 1) { g.strokeStyle = INK; line(g, bx + 30, by + 30, bx + B - 30, by + B - 30); line(g, bx + B - 30, by + 30, bx + 30, by + B - 30); } else circ(g, bx + B / 2, by + B / 2, B / 2 - 28, null, acc); }
    if (hb === b && hc >= 0 && st.b[b][hc] === 0 && !st.win[b]) { const cx = bx + (hc % 3) * C + C / 2, cy = by + ((hc / 3) | 0) * C + C / 2; g.globalAlpha = .6; g.strokeStyle = st.pl === 1 ? INK : acc; g.lineWidth = 3; if (st.pl === 1) { line(g, cx - 10, cy - 10, cx + 10, cy + 10); line(g, cx + 10, cy - 10, cx - 10, cy + 10); } else circ(g, cx, cy, 11, null, acc); g.globalAlpha = 1; } }
  g.strokeStyle = INK; g.lineWidth = 3; for (let k = 1; k < 3; k++) { line(g, x0 + k * B, y0, x0 + k * B, y0 + SZ); line(g, x0, y0 + k * B, x0 + SZ, y0 + k * B); } g.lineWidth = 1; g.strokeRect(x0 + .5, y0 + .5, SZ, SZ);
  const nm = target < 0 ? 'ANY BOARD' : 'BOARD ' + (target + 1);
  txt(g, 'NEXT PLAYER GOES TO: ', x0, y0 + SZ + 26, 13, DIM, 'left', 500, 2); g.font = `500 13px ${MONO}`; txt(g, nm, x0 + 192, y0 + SZ + 26, 14, acc, 'left', 700, 2);
  txt(g, o.on ? 'THE SQUARE YOU POINT AT PICKS THE BOARD' : 'WHERE YOU PLAY DECIDES WHERE THEY PLAY', x0, h - 10, 12, DIM, 'left', 500, 1);
};
V.boards.poke = (st, x, y) => { if (!st.b) return; const SZ = 480, B = 160, C = B / 3, lx = x - (528 - SZ) / 2, ly = y - 6; if (lx < 0 || ly < 0 || lx >= SZ || ly >= SZ) return; const bd = Math.floor(ly / B) * 3 + Math.floor(lx / B), c = Math.floor((ly % B) / C) * 3 + Math.floor((lx % B) / C); if (st.b[bd][c] === 0 && !st.win[bd] && (st.next < 0 || st.next === bd)) { st.b[bd][c] = st.pl; st.pl = 3 - st.pl; st.next = st.win[c] || st.b[c].every(v => v) ? -1 : c; st.last = [bd, c]; st.clock = -.5; } };

/* 10 SPORE FRONT — a real Life board; your cursor sprinkles spores */
V.sporefront = (g, o) => {
  const { st, w, h, t, dt, acc } = o; const N = 44, M = 44, CS = 12, ox = (w - N * CS) / 2, oy = 4;
  const seed = () => { const r = rng(Math.floor(Math.random() * 1e6)); st.a = new Uint8Array(N * M); st.age = new Uint8Array(N * M); for (let i = 0; i < N * M; i++) if (r() < .24) st.a[i] = 1; st.gen = 0; st.hist = []; };
  if (!st.i) { st.i = 1; seed(); st.acc = 0; }
  st.acc += dt; if (st.acc > .12) { st.acc = 0; const nxt = new Uint8Array(N * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += st.a[((y + dy + M) % M) * N + (x + dx + N) % N]; const i = y * N + x; nxt[i] = st.a[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0); st.age[i] = nxt[i] ? Math.min(255, (st.a[i] ? st.age[i] : 0) + 1) : 0; }
    st.a = nxt; st.gen++; const pop = nxt.reduce((a, b) => a + b, 0); st.pop = pop; st.hist.push(pop); if (st.hist.length > 24) st.hist.shift(); if (pop < 12 || (st.hist.length > 23 && Math.max(...st.hist) - Math.min(...st.hist) < 4)) seed(); }
  if (o.on) { const cx = Math.floor((o.px - ox) / CS), cy = Math.floor((o.py - oy) / CS); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) < 4 && Math.random() < .45) { const x = (cx + dx + N) % N, y = (cy + dy + M) % M; if (cx + dx >= 0 && cx + dx < N && cy + dy >= 0 && cy + dy < M) { st.a[y * N + x] = 1; st.age[y * N + x] = 1; } } }
  g.strokeStyle = 'rgba(234,232,227,.35)'; g.lineWidth = 1; g.strokeRect(ox - .5, oy - .5, N * CS + 1, M * CS + 1);
  for (let i = 0; i < N * M; i++) if (st.a[i]) { const a = st.age[i], x = ox + (i % N) * CS, y = oy + ((i / N) | 0) * CS; g.fillStyle = a < 3 ? acc : a < 10 ? rgba(acc, .7) : 'rgba(234,232,227,.66)'; g.beginPath(); g.arc(x + CS / 2, y + CS / 2, a < 3 ? 4.6 : 3.8, 0, 6.3); g.fill(); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832, x = w / 2 + Math.cos(a) * (w / 2 - 2), y = oy + M * CS / 2 + Math.sin(a) * (M * CS / 2 + 2); if (k % 2 === 0) circ(g, x < 12 ? 2 : x > w - 12 ? w - 2 : x, clamp(y, 2, oy + M * CS), 0, null, null); }
  g.fillStyle = 'rgba(27,27,29,.85)'; g.fillRect(ox, oy + M * CS + 6, 300, 30); txt(g, `GENERATION ${st.gen} · ${st.pop || 0} ALIVE`, ox, oy + M * CS + 22, 13, INK, 'left', 600, 2);
  txt(g, o.on ? 'SPRINKLE SPORES' : 'THE EDGES WRAP AROUND', ox + N * CS, oy + M * CS + 22, 12, DIM, 'right', 500, 2);
};
V.sporefront.poke = st => { st.i = 0; };

/* 11 TERRARIUM HASH — a glass case whose recipe is the link */
V.terrarium = (g, o) => {
  const { st, w, h, t, dt, acc } = o; const CS = 13, N = 36, M = 38, ox = (w - N * CS) / 2, oy = 14, DOME = (x, y) => { const cx = N / 2, base = M - 3; if (y > base || x < 2 || x > N - 3) return false; if (y >= 12) return true; const dx = (x - cx + .5) / (N / 2 - 2), top = 12 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 11; return y >= top; };
  const hex = () => (st.gene >>> 0).toString(16).padStart(5, '0');
  const rule = () => { const B = [], S = []; for (let k = 0; k < 9; k++) { if (st.gene >> k & 1) B.push(k); if (st.gene >> (k + 9) & 1) S.push(k); } return { B, S }; };
  const seed = () => { const r = rng(Math.floor(Math.random() * 1e6)); st.a = new Uint8Array(N * M); for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (DOME(x, y) && y > 22 && r() < .16) st.a[y * N + x] = 1; st.hist = []; };
  if (!st.i) { st.i = 1; st.gene = (1 << 3) | (0b000111110 << 9) | 0; seed(); st.acc = 0; st.drops = []; }
  st.acc += dt; if (st.acc > .2) { st.acc = 0; const { B, S } = rule(), nxt = new Uint8Array(N * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (DOME(x, y)) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < M) n += st.a[(y + dy) * N + x + dx]; nxt[y * N + x] = st.a[y * N + x] ? (S.includes(n) ? 1 : 0) : (B.includes(n) ? 1 : 0); }
    st.a = nxt; const pop = nxt.reduce((a, b) => a + b, 0); st.pop = pop; st.hist.push(pop); if (st.hist.length > 20) st.hist.shift(); let cap = 0; for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) cap += DOME(x, y) ? 1 : 0;
    if (pop < 14 || pop > cap * .62 || (st.hist.length > 19 && Math.max(...st.hist) - Math.min(...st.hist) < 3)) seed(); }
  if (o.on) { st.drops.push({ x: o.px + (Math.random() - .5) * 40, y: o.py - 20, v: 90 + Math.random() * 60 }); const cx = Math.floor((o.px - ox) / CS), cy = Math.floor((o.py - oy) / CS); for (let k = 0; k < 2; k++) { const x = cx + Math.floor((Math.random() - .5) * 5), y = cy + Math.floor((Math.random() - .5) * 5); if (x >= 0 && x < N && y >= 0 && y < M && DOME(x, y)) st.a[y * N + x] = 1; } }
  st.drops.forEach(d => d.y += d.v * dt); st.drops = st.drops.filter(d => d.y < h - 70);
  g.save(); g.beginPath(); for (let k = 0; k <= 40; k++) { const a = Math.PI + k / 40 * Math.PI, x = w / 2 + Math.cos(a) * (N / 2 - 1.5) * CS, y = oy + 12 * CS + Math.sin(a) * 11.2 * CS; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.lineTo(ox + (N - 2) * CS, oy + (M - 3) * CS); g.lineTo(ox + 2 * CS, oy + (M - 3) * CS); g.closePath();
  g.strokeStyle = 'rgba(234,232,227,.8)'; g.lineWidth = 2.2; g.stroke(); const gl = g.createLinearGradient(0, oy, w, oy + M * CS); gl.addColorStop(0, 'rgba(234,232,227,.08)'); gl.addColorStop(.5, 'rgba(234,232,227,.01)'); gl.addColorStop(1, 'rgba(234,232,227,.05)'); g.fillStyle = gl; g.fill(); g.restore();
  g.strokeStyle = 'rgba(234,232,227,.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(w / 2, oy + 12 * CS, (N / 2 - 3) * CS, Math.PI * 1.05, Math.PI * 1.32); g.stroke();
  hatch(g, ox + 2 * CS, oy + (M - 3) * CS, (N - 4) * CS, 3 * CS - 6, 7, 'rgba(234,232,227,.16)'); g.strokeStyle = 'rgba(234,232,227,.5)'; line(g, ox + 2 * CS, oy + (M - 3) * CS, ox + (N - 2) * CS, oy + (M - 3) * CS);
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) if (st.a[y * N + x]) { g.fillStyle = y < 18 ? acc : rgba(acc, .78); g.beginPath(); g.arc(ox + x * CS + CS / 2, oy + y * CS + CS / 2, 4.6, 0, 6.3); g.fill(); }
  g.fillStyle = 'rgba(234,232,227,.6)'; st.drops.forEach(d => { g.beginPath(); g.ellipse(d.x, d.y, 1.6, 4, 0, 0, 6.3); g.fill(); });
  const by = h - 52, r = rule(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(234,232,227,.55)'; rrect(g, 6, by, w - 12, 38, 19); g.stroke(); txt(g, `…/#recipe=${hex()}`, 28, by + 19, 14, acc, 'left', 600, 1); txt(g, 'BORN ' + r.B.join('') + ' · STAYS ' + r.S.join(''), w - 24, by + 19, 12, DIM, 'right', 500, 1);
  txt(g, o.on ? 'MIST IT · CLICK TO CHANGE THE RECIPE' : 'THE LINK IS THE GARDEN', 12, 8, 12, DIM, 'left', 500, 2);
};
V.terrarium.poke = st => { if (!st.i) return; const bit = [9, 10, 11, 12, 13, 14, 15, 16, 17, 0, 1, 2, 4, 5, 6][Math.floor(Math.random() * 15)]; st.gene ^= 1 << bit; st.gene |= 1 << 3; st.i = 1; st.hist = []; };

/* 12 DRIFTWATCH — one valve, a river inside the sea */
V.driftwatch = (g, o) => {
  const { st, w, h, t, dt, acc } = o;
  if (!st.i) { st.i = 1; st.tb = document.createElement('canvas'); st.tb.width = w; st.tb.height = h; const r = rng(4); st.P = Array.from({ length: 420 }, () => ({ x: r() * w, y: r() * h })); st.s = { x: 90, y: h * .3 }; st.b = { x: w - 110, y: h * .68, t: 0 }; st.score = 0; st.buoy = 0; st.flash = 0; st.tg = st.tb.getContext('2d'); st.tg.fillStyle = BG; st.tg.fillRect(0, 0, w, h); }
  const flow = (x, y) => { const kx = 2 * Math.PI / w * 1.5, ky = 2 * Math.PI / h * 1.2, ph = t * .15; const u = ky * Math.sin(kx * x + ph) * Math.cos(ky * y), v = -kx * Math.cos(kx * x + ph) * Math.sin(ky * y); return [u * 2600, v * 2600]; };
  const tg = st.tg; tg.fillStyle = 'rgba(27,27,29,.07)'; tg.fillRect(0, 0, w, h); tg.strokeStyle = rgba('#a99bff', .95); tg.lineWidth = 1.8;
  for (const p of st.P) { const [u, v] = flow(p.x, p.y), nx = p.x + u * dt, ny = p.y + v * dt; tg.beginPath(); tg.moveTo(p.x, p.y); tg.lineTo(nx, ny); tg.stroke(); p.x = nx; p.y = ny; if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || Math.random() < .004) { p.x = Math.random() * w; p.y = Math.random() * h; } }
  g.drawImage(st.tb, 0, 0);
  const S = st.s, [fu, fv] = flow(S.x, S.y), want = o.on ? clamp((o.py - S.y) / 70, -1, 1) : clamp((st.b.y - S.y) / 90, -1, 1);
  st.buoy = lerp(st.buoy, want, Math.min(1, dt * 3)); S.x = clamp(S.x + (fu * .8) * dt + (o.on ? clamp((o.px - S.x) / 160, -1, 1) * 22 * dt : clamp((st.b.x - S.x) / 160, -1, 1) * 26 * dt), 20, w - 20); S.y = clamp(S.y + (fv * .8 + st.buoy * 46) * dt, 24, h - 24);
  st.b.t += dt; const pulse = (st.b.t * .9) % 1; for (let k = 0; k < 3; k++) { const p = (pulse + k / 3) % 1; g.strokeStyle = rgba(acc, (1 - p) * .8); g.lineWidth = 1.6; g.beginPath(); g.arc(st.b.x, st.b.y, 8 + p * 36, 0, 6.3); g.stroke(); } circ(g, st.b.x, st.b.y, 6, acc);
  if (Math.hypot(S.x - st.b.x, S.y - st.b.y) < 22) { st.score++; st.flash = 1; st.b.x = 60 + Math.random() * (w - 120); st.b.y = 60 + Math.random() * (h - 140); }
  st.flash = Math.max(0, st.flash - dt * 1.4);
  g.strokeStyle = INK; g.lineWidth = 2; circ(g, S.x, S.y, 14, '#1b1b1d', INK); circ(g, S.x + 3, S.y - 2, 4.5, null, INK); line(g, S.x, S.y - 14, S.x, S.y - 24); line(g, S.x - 4, S.y - 24, S.x + 4, S.y - 24);
  if (st.flash > 0) { g.strokeStyle = rgba(acc, st.flash); g.lineWidth = 2; g.beginPath(); g.arc(S.x, S.y, 14 + (1 - st.flash) * 30, 0, 6.3); g.stroke(); }
  g.strokeStyle = 'rgba(234,232,227,.5)'; g.lineWidth = 1; line(g, w - 10.5, 20, w - 10.5, h - 70); for (let k = 0; k <= 10; k++) line(g, w - 10.5, 20 + k * (h - 90) / 10, w - (k % 5 ? 16 : 22), 20 + k * (h - 90) / 10); const dy = 20 + (S.y / h) * (h - 90); g.fillStyle = acc; g.beginPath(); g.moveTo(w - 10, dy); g.lineTo(w - 26, dy - 6); g.lineTo(w - 26, dy + 6); g.fill();
  txt(g, 'BEACONS REACHED ' + st.score, 8, 14, 13, INK, 'left', 600, 2); txt(g, st.buoy > .25 ? 'FLOODING · SINKING' : st.buoy < -.25 ? 'VENTING · RISING' : 'DRIFTING', 8, 36, 12, st.buoy > .25 || st.buoy < -.25 ? acc : DIM, 'left', 600, 2);
  txt(g, o.on ? 'THE VALVE FOLLOWS YOUR CURSOR' : 'ONE VALVE. THE SEA DOES THE REST.', 8, h - 14, 12, DIM, 'left', 500, 2);
};

/* 13 LOOMWEIGHT — a three-beat treadle against a four-beat card */
V.loomweight = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.beat = 0; st.ph = 0; st.rows = []; st.knots = []; st.next = 2; st.puff = []; st.score = 0; }
  st.ph += dt * 2; const nb = Math.floor(st.ph); if (nb > st.beat) { st.beat = nb; const rowBits = []; for (let c = 0; c < 24; c++) rowBits.push(((c + st.beat) % 3 === 0) !== ((c + st.beat * 2) % 4 === 0) ? 1 : 0); const flaw = st.knots.filter(k => k.row === 0 && !k.done); st.knots.forEach(k => { k.row++; }); flaw.forEach(k => { }); st.rows.unshift({ bits: rowBits, flaw: new Set() }); if (st.rows.length > 15) st.rows.pop(); }
  st.next -= dt; if (st.next < 0) { st.next = 2.4 + Math.random() * 1.2; st.knots.push({ c: 3 + Math.floor(Math.random() * 18), row: 0, x: 0, y: 0, born: t, done: false }); }
  const cw = (w - 40) / 24, cy0 = 268, rh = 17;
  g.lineWidth = 1.2; for (const [cx, n, lab] of [[w * .28, 3, 'FOOT PEDAL · 3 BEATS'], [w * .72, 4, 'PATTERN CARD · 4 BEATS']]) { circ(g, cx, 106, 70, null, 'rgba(234,232,227,.5)'); const cur = Math.floor(st.ph) % n, fr = st.ph % 1;
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k / n * 6.2832, on = k === cur; circ(g, cx + Math.cos(a) * 70, 106 + Math.sin(a) * 70, on ? 8 + (1 - fr) * 4 : 5, on ? acc : BG, on ? acc : INK); }
    const ha = -Math.PI / 2 + ((st.ph % n) / n) * 6.2832; g.strokeStyle = INK; g.lineWidth = 2; line(g, cx, 106, cx + Math.cos(ha) * 52, 106 + Math.sin(ha) * 52); circ(g, cx, 106, 4, INK); txt(g, lab, cx, 198, 11, DIM, 'center', 500, 1); }
  txt(g, '3 × 4 = 12 BEATS BEFORE THE PATTERN REPEATS', w / 2, 18, 11, DIM, 'center', 500, 2);
  g.lineWidth = 1; g.strokeStyle = 'rgba(234,232,227,.22)'; for (let c = 0; c <= 24; c++) line(g, 20 + c * cw, cy0 - 14, 20 + c * cw, cy0 + 15 * rh);
  st.rows.forEach((row, ri) => { const y = cy0 + ri * rh; for (let c = 0; c < 24; c++) { if (row.bits[c]) { g.fillStyle = ri === 0 ? acc : rgba('#b79bff', .85 - ri * .03); g.fillRect(20 + c * cw + 2, y + 2, cw - 4, rh - 4); } } });
  g.strokeStyle = INK; g.lineWidth = 3; const sx = 20 + ((st.ph % 1) < .5 ? (st.ph % 1) * 2 : 2 - (st.ph % 1) * 2) * (w - 40); line(g, sx - 10, cy0 - 8, sx + 10, cy0 - 8);
  st.knots.forEach(k => { const x = 20 + k.c * cw + cw / 2, y = cy0 + k.row * rh + rh / 2; k.x = x; k.y = y; if (!k.done && o.on && Math.hypot(o.px - x, o.py - y) < 30) { k.done = true; st.score++; st.puff.push({ x, y, t0: t }); } if (k.done) return; g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 14; a += .3) { const r = 2 + a * .75; g.lineTo(x + Math.cos(a + t * 3) * r, y + Math.sin(a + t * 3) * r); } g.stroke(); });
  st.knots = st.knots.filter(k => !k.done && k.row < 13); st.puff = st.puff.filter(p => t - p.t0 < .6); st.puff.forEach(p => { g.strokeStyle = rgba(acc, 1 - (t - p.t0) / .6); g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + (t - p.t0) * 60, 0, 6.3); g.stroke(); });
  txt(g, `TANGLES CAUGHT ${st.score}`, 20, h - 14, 13, st.score ? acc : INK, 'left', 600, 2); txt(g, o.on ? 'SWEEP THE TANGLES AWAY' : 'YOU CANNOT STEER IT', w - 20, h - 14, 12, DIM, 'right', 500, 2);
};

/* 14 DEADLOCK — a ring of trains, each waiting on the next */
V.deadlock = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.mode = 'locked'; st.clock = 0; st.shift = 0; st.rot = 0; }
  st.clock += dt; if (st.mode === 'locked' && st.clock > (o.on ? 99 : 3.4)) { st.mode = 'flow'; st.clock = 0; } else if (st.mode === 'flow' && st.clock > 2.4) { st.mode = 'locked'; st.clock = 0; st.rot = (st.rot + 1) % 4; }
  const cx = w / 2, cy = 250, R = 150, SC = [[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R]], SZ = 86;
  g.strokeStyle = 'rgba(234,232,227,.6)'; g.lineWidth = 2; g.strokeRect(cx - R, cy - R, 2 * R, 2 * R); g.strokeStyle = 'rgba(234,232,227,.25)'; g.strokeRect(cx - R + 12, cy - R + 12, 2 * R - 24, 2 * R - 24);
  g.strokeStyle = 'rgba(234,232,227,.22)'; g.lineWidth = 6; g.setLineDash([2, 12]); g.strokeRect(cx - R + 6, cy - R + 6, 2 * R - 12, 2 * R - 12); g.setLineDash([]);
  const hov = o.on ? SC.findIndex(([x, y]) => Math.abs(o.px - x) < SZ / 2 && Math.abs(o.py - y) < SZ / 2) : -1;
  const per = pt => { const p = ((pt % 4) + 4) % 4, i = Math.floor(p), f = p - i, a = SC[i], b = SC[(i + 1) % 4]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
  SC.forEach(([x, y], i) => { g.fillStyle = BG; g.fillRect(x - SZ / 2, y - SZ / 2, SZ, SZ); g.lineWidth = hov === i ? 3 : 1.6; g.strokeStyle = hov === i ? acc : INK; g.strokeRect(x - SZ / 2 + .5, y - SZ / 2 + .5, SZ, SZ); txt(g, 'SECTION ' + 'ABCD'[i], x, y + SZ / 2 + 16, 11, DIM, 'center', 500, 2); });
  const prog = st.mode === 'flow' ? ease(st.clock / 1.6) : 0;
  for (let i = 0; i < 4; i++) { const [x, y] = per(i + prog), nxt = per(i + prog + .38); const ang = Math.atan2(per(i + prog + .02)[1] - y, per(i + prog + .02)[0] - x); g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = INK; g.fillRect(-26, -13, 52, 26); g.fillStyle = '#151516'; for (let k = -1; k <= 1; k++) g.fillRect(k * 14 - 4, -7, 8, 9); g.fillStyle = st.mode === 'locked' ? acc : INK; g.fillRect(20, -9, 5, 18); g.restore();
    txt(g, String.fromCharCode(65 + ((i + st.rot) % 4)), x, y + 31, 12, DIM, 'center', 700, 2); }
  if (st.mode === 'locked') { g.strokeStyle = acc; g.lineWidth = 2.5; g.fillStyle = acc;
    for (let i = 0; i < 4; i++) { const a = SC[i], b = SC[(i + 1) % 4], an = Math.atan2(b[1] - a[1], b[0] - a[0]), sx = lerp(a[0], b[0], .3), sy = lerp(a[1], b[1], .3), ex = lerp(a[0], b[0], .68), ey = lerp(a[1], b[1], .68);
      g.setLineDash([8, 6]); g.lineDashOffset = -t * 20; line(g, sx, sy, ex, ey); g.setLineDash([]); g.beginPath(); g.moveTo(ex + 6 * Math.cos(an), ey + 6 * Math.sin(an)); g.lineTo(ex - 8 * Math.cos(an - .6), ey - 8 * Math.sin(an - .6)); g.lineTo(ex - 8 * Math.cos(an + .6), ey - 8 * Math.sin(an + .6)); g.fill(); } }
  const lab = st.mode === 'locked' ? 'EVERYONE IS WAITING' : 'TRAINS ARE MOVING'; txt(g, lab, cx, cy - 6, 15, st.mode === 'locked' ? acc : INK, 'center', 700, 2); txt(g, st.mode === 'locked' ? 'EACH TRAIN NEEDS THE NEXT SECTION' : 'THE STANDOFF IS BROKEN', cx, cy + 16, 11, DIM, 'center', 500, 1);
  if (hov >= 0 && st.mode === 'locked') { const [x, y] = SC[hov]; g.fillStyle = rgba(acc, .2); g.fillRect(x - SZ / 2, y - SZ / 2, SZ, SZ); txt(g, 'CLICK: LET GO', x, y - SZ / 2 - 14, 12, acc, 'center', 700, 2); }
  txt(g, o.on ? 'CLICK A SECTION TO LET ITS TRAIN GO' : 'A CIRCLE OF WAITING NEVER ENDS ON ITS OWN', 12, h - 14, 12, DIM, 'left', 500, 1);
};
V.deadlock.poke = st => { if (st.mode === 'locked') { st.mode = 'flow'; st.clock = 0; } };

/* 15 BYZANTINE CHOIR — towers that must agree, and one that lies */
V.byzantine = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.cut = new Set(); st.traitor = 3; st.arm = Array.from({ length: 7 }, () => [0, 0]); st.order = 0; st.clock = 0; }
  st.clock += dt; if (st.clock > 3.6 && !o.on) { st.clock = 0; st.order = 1 - st.order; const k = Math.floor(Math.random() * 7) + '-' + ((Math.floor(Math.random() * 6) + 1 + 0) % 7); st.cut = new Set(Math.random() < .6 ? [k] : []); }
  const cx = w / 2, cy = 232, R = 176, T = i => { const a = -Math.PI / 2 + i / 7 * 6.2832; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * .94]; };
  const edges = []; for (let i = 0; i < 7; i++) { edges.push([i, (i + 1) % 7]); edges.push([i, (i + 2) % 7]); }
  const key = e => Math.min(e[0], e[1]) + '-' + Math.max(e[0], e[1]), seg = (p, a, b) => { const [x1, y1] = a, [x2, y2] = b, l = (x2 - x1) ** 2 + (y2 - y1) ** 2, u = clamp(((p[0] - x1) * (x2 - x1) + (p[1] - y1) * (y2 - y1)) / l, 0, 1); return Math.hypot(p[0] - (x1 + u * (x2 - x1)), p[1] - (y1 + u * (y2 - y1))); };
  let hover = -1; if (o.on) edges.forEach((e, i) => { if (seg([o.px, o.py], T(e[0]), T(e[1])) < 12 && hover < 0) hover = i; });
  edges.forEach((e, i) => { const k = key(e), cut = st.cut.has(k), a = T(e[0]), b = T(e[1]); g.lineWidth = hover === i ? 2.4 : 1.2; g.strokeStyle = cut ? rgba(acc, .9) : hover === i ? acc : 'rgba(234,232,227,.34)'; g.setLineDash(cut ? [4, 7] : []); line(g, a[0], a[1], b[0], b[1]); g.setLineDash([]);
    if (cut) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; txt(g, '✂', mx, my, 18, acc, 'center', 700); } else { const p = (t * .5 + i * .31) % 1, bad = e[0] === st.traitor || e[1] === st.traitor; circ(g, lerp(a[0], b[0], p), lerp(a[1], b[1], p), 2.6, bad ? acc : INK); } });
  const target = ord => ord ? [-2.5, -.64] : [-1.2, -1.9]; let agree = 0;
  for (let i = 0; i < 7; i++) { const [x, y] = T(i), tr = i === st.traitor, ord = tr ? (Math.sin(t * 9 + i) > 0 ? 1 : 0) : st.order, tg = target(ord), A = st.arm[i]; A[0] = lerp(A[0], tg[0] + (tr ? Math.sin(t * 13) * .3 : 0), Math.min(1, dt * 5)); A[1] = lerp(A[1], tg[1], Math.min(1, dt * 5)); if (!tr) agree++;
    g.fillStyle = BG; g.strokeStyle = tr ? acc : INK; g.lineWidth = 2.2; g.fillRect(x - 11, y - 8, 22, 46); g.strokeRect(x - 11, y - 8, 22, 46); g.lineWidth = 3.4; g.lineCap = 'round'; for (const a of A) line(g, x, y - 8, x + Math.cos(a) * 30, y - 8 + Math.sin(a) * 30); circ(g, x, y - 8, 4, tr ? acc : INK);
    txt(g, i === 0 ? 'COMMANDER' : tr ? 'LIAR' : 'TOWER ' + (i + 1), x, y + 56, 11, tr ? acc : DIM, 'center', 600, 1); }
  txt(g, st.order ? 'THE ORDER: ATTACK' : 'THE ORDER: HOLD', cx, cy - 4, 17, INK, 'center', 700, 3); txt(g, `${agree} OF 7 TOWERS AGREE`, cx, cy + 20, 13, acc, 'center', 700, 2); txt(g, '(ONE LIAR IS NOT ENOUGH TO BREAK THE VOTE)', cx, cy + 40, 10, DIM, 'center', 500, 0);
  txt(g, o.on ? 'CLICK A LINK TO CUT IT' : 'LIARS TELL EVERYONE DIFFERENT THINGS', 12, h - 14, 12, DIM, 'left', 500, 1); st.hover = hover; st.edges = edges.map(key);
};
V.byzantine.poke = st => { if (st.hover >= 0 && st.edges) { const k = st.edges[st.hover]; st.cut.has(k) ? st.cut.delete(k) : st.cut.add(k); } else { st.traitor = Math.floor(Math.random() * 6) + 1; } st.clock = 0; };

/* 16 GARBAGE COLLECTOR — mark what lives, sweep the rest */
V.gc = (g, o) => {
  const { st, w, h, t, dt, acc } = o;
  const build = () => { const r = rng(Math.floor(Math.random() * 1e6)); st.N = [{ x: .3, y: .06, root: 1 }, { x: .7, y: .06, root: 1 }]; for (let i = 0; i < 16; i++) st.N.push({ x: .06 + r() * .88, y: .2 + (i % 4) * .17 + r() * .08, col: 0, a: 1 }); st.N.forEach(n => { n.col = 0; n.a = 1; });
    st.E = []; st.N.forEach((n, i) => { const k = n.root ? 3 : r() < .55 ? 1 : 0; for (let j = 0; j < k; j++) { const c = Math.floor(2 + r() * 16); if (c !== i && st.N[c].y >= n.y - .05) st.E.push([i, c]); } }); st.phase = 'mark'; st.clock = 0; st.queue = [0, 1]; st.N[0].col = 1; st.N[1].col = 1; st.hold = 0; };
  if (!st.i) { st.i = 1; build(); } const W = w - 40, H = 400, px = i => 20 + st.N[i].x * W, py = i => 20 + st.N[i].y * H;
  st.clock += dt;
  if (st.phase === 'mark' && st.clock > .26) { st.clock = 0; if (st.queue.length) { const i = st.queue.shift(); st.N[i].col = 2; for (const [a, b] of st.E) if (a === i && st.N[b].col === 0) { st.N[b].col = 1; st.queue.push(b); } } else { st.phase = 'sweep'; } }
  else if (st.phase === 'sweep') { const dead = st.N.findIndex(n => n.col === 0 && n.a > 0); if (dead >= 0) { st.N[dead].a -= dt * 2.4; } else { st.hold += dt; if (st.hold > .9) { st.phase = 'done'; st.hold = 0; } } }
  else if (st.phase === 'done') { st.hold += dt; if (st.hold > 1.2) build(); }
  if (o.on && st.phase === 'mark') { let best = -1, bd = 40; st.N.forEach((n, i) => { const d = Math.hypot(px(i) - o.px, py(i) - o.py); if (d < bd && n.col === 0 && !n.root) { bd = d; best = i; } }); if (best >= 0) { st.N[best].col = 1; st.queue.push(best); } }
  for (const [a, b] of st.E) { if (st.N[a].a <= 0 || st.N[b].a <= 0) continue; const x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b), an = Math.atan2(y2 - y1, x2 - x1), live = st.N[a].col === 2; g.strokeStyle = live ? 'rgba(234,232,227,.6)' : 'rgba(234,232,227,.22)'; g.lineWidth = 1.3; line(g, x1 + Math.cos(an) * 17, y1 + Math.sin(an) * 17, x2 - Math.cos(an) * 19, y2 - Math.sin(an) * 19); g.fillStyle = g.strokeStyle; const ex = x2 - Math.cos(an) * 18, ey = y2 - Math.sin(an) * 18; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 9 * Math.cos(an - .4), ey - 9 * Math.sin(an - .4)); g.lineTo(ex - 9 * Math.cos(an + .4), ey - 9 * Math.sin(an + .4)); g.fill(); }
  st.N.forEach((n, i) => { if (n.a <= 0) return; const x = px(i), y = py(i); g.globalAlpha = Math.max(0, n.a); g.lineWidth = 2;
    if (n.root) { g.strokeStyle = INK; g.fillStyle = INK; g.fillRect(x - 15, y - 15, 30, 30); txt(g, 'ROOT', x, y - 26, 10, DIM, 'center', 600, 2); }
    else if (n.col === 2) circ(g, x, y, 15, INK); else if (n.col === 1) { circ(g, x, y, 15, rgba(acc, .22), acc); g.setLineDash([3, 3]); circ(g, x, y, 20, null, acc); g.setLineDash([]); } else circ(g, x, y, 15, BG, 'rgba(234,232,227,.75)'); g.globalAlpha = 1; });
  const total = st.N.filter(n => !n.root).length, dead = st.N.filter(n => n.col === 0 && !n.root).length, live = st.N.filter(n => n.col === 2 && !n.root).length;
  const by = 438; txt(g, st.phase === 'mark' ? 'MARKING WHAT IS STILL IN USE' : st.phase === 'sweep' ? 'SWEEPING UP THE REST' : 'TIDY. HEAP RECLAIMED.', 8, by, 14, st.phase === 'sweep' ? acc : INK, 'left', 700, 2);
  g.strokeStyle = 'rgba(234,232,227,.5)'; g.lineWidth = 1.2; g.strokeRect(8.5, by + 18.5, w - 17, 18); const used = st.phase === 'mark' ? Math.min(1, st.N.filter(n => n.col === 2).length / 16) * .6 : st.phase === 'sweep' ? .75 : .8; g.fillStyle = used > .7 ? acc : INK; g.fillRect(11, by + 21, (w - 22) * used, 13); txt(g, 'PAUSE BUDGET', 8, by + 54, 11, DIM, 'left', 500, 2);
  txt(g, `${live} IN USE · ${dead} GARBAGE`, w - 8, by + 54, 11, DIM, 'right', 500, 1); txt(g, o.on ? 'POINT AT A NODE TO KEEP IT ALIVE' : 'WHITE = UNSEEN · AMBER = NEXT · SOLID = SAFE', 8, h - 14, 11, DIM, 'left', 500, 1);
};
V.gc.poke = st => { st.i = 0; };

/* 17 CARTEL OF CARTOGRAPHERS — realms grow, treaties bite */
V.cartel = (g, o) => {
  const { st, w, h, t, dt, acc } = o; const COLS = 10, ROWS = 8, S = 50, x0 = (w - COLS * S) / 2, y0 = 20, PAL = [acc, INK, '#7fb2ff'];
  const river = (c, r) => c === Math.round(2 + r * .75) || c === Math.round(2 + r * .75) + 1;
  const reset = () => { st.grid = Array(COLS * ROWS).fill(-1); st.born = Array(COLS * ROWS).fill(-9); [[1, 6], [8, 1], [6, 6]].forEach(([c, r], i) => { st.grid[r * COLS + c] = i; st.born[r * COLS + c] = t; }); st.turn = 0; st.clock = 0; st.hold = 0; st.n = 0; st.flash = null; };
  if (!st.i) { st.i = 1; reset(); }
  const nb = i => { const c = i % COLS, r = (i / COLS) | 0, o2 = []; if (c > 0) o2.push(i - 1); if (c < COLS - 1) o2.push(i + 1); if (r > 0) o2.push(i - COLS); if (r < ROWS - 1) o2.push(i + COLS); return o2; };
  const legal = (i, realm) => st.grid[i] < 0 && !river(i % COLS, (i / COLS) | 0) && nb(i).some(j => st.grid[j] === realm);
  st.clock += dt; const full = !st.grid.some((v, i) => v < 0 && !river(i % COLS, (i / COLS) | 0));
  if (!full && st.clock > .22) { st.clock = 0; const realm = st.turn++ % 3, opts = st.grid.map((_, i) => i).filter(i => legal(i, realm)); st.n++;
    if (st.n % 11 === 0) { const cands = st.grid.map((v, i) => i).filter(i => st.grid[i] >= 0 && st.grid[i] !== realm && nb(i).some(j => st.grid[j] === realm)); if (cands.length) { const i = cands[Math.floor(Math.random() * cands.length)]; st.grid[i] = realm; st.born[i] = t; st.flash = { i, t }; } }
    else if (opts.length) { const i = opts[Math.floor(Math.random() * opts.length)]; st.grid[i] = realm; st.born[i] = t; } } else if (full) { st.hold += dt; if (st.hold > 2) reset(); }
  const hv = o.on ? Math.floor((o.py - y0) / S) * COLS + Math.floor((o.px - x0) / S) : -1, hvOk = o.on && o.px > x0 && o.px < x0 + COLS * S && o.py > y0 && o.py < y0 + ROWS * S;
  st.hv = hvOk ? hv : -1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c, x = x0 + c * S, y = y0 + r * S, v = st.grid[i];
    if (river(c, r)) { g.strokeStyle = 'rgba(127,178,255,.55)'; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 6, y + 14 + k * 12); g.bezierCurveTo(x + 18, y + 8 + k * 12, x + 30, y + 20 + k * 12, x + S - 6, y + 14 + k * 12); g.stroke(); } continue; }
    if (v >= 0) { const p = back((t - st.born[i]) / .4), s = S - 5; g.fillStyle = rgba(PAL[v], v === 1 ? .9 : .82); g.fillRect(x + 2.5 + (s - s * p) / 2, y + 2.5 + (s - s * p) / 2, s * p, s * p); if (v === 1) hatch(g, x + 2, y + 2, S - 4, S - 4, 8, 'rgba(21,21,22,.35)'); }
    else { g.strokeStyle = 'rgba(234,232,227,.14)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, S - 1, S - 1); }
    if (hvOk && st.hv === i && !river(c, r)) { const ok = legal(i, 0); g.strokeStyle = ok ? acc : DIM; g.lineWidth = 2.4; g.strokeRect(x + 3, y + 3, S - 6, S - 6); if (!ok && v < 0) txt(g, '✕', x + S / 2, y + S / 2, 18, DIM, 'center', 700); } }
  if (st.flash && t - st.flash.t < .7) { const i = st.flash.i, x = x0 + (i % COLS) * S, y = y0 + ((i / COLS) | 0) * S; g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x - 2 - (t - st.flash.t) * 10, y - 2 - (t - st.flash.t) * 10, S + 4 + (t - st.flash.t) * 20, S + 4 + (t - st.flash.t) * 20); txt(g, 'HOSTILE TAKEOVER', x0, y0 + ROWS * S + 38, 14, acc, 'left', 700, 3); }
  const cy = y0 + ROWS * S + 40; if (!(st.flash && t - st.flash.t < .7)) txt(g, 'TREATY: NO REALM MAY BUILD ON THE RIVER', x0, cy, 12, INK, 'left', 600, 1);
  [[acc, 'YOU'], [INK, 'MO'], ['#7fb2ff', 'INES']].forEach(([c, n], i) => { g.fillStyle = c; g.fillRect(x0 + i * 100, cy + 22, 12, 12); txt(g, n + ' · ' + st.grid.filter(v => v === i).length, x0 + i * 100 + 20, cy + 29, 12, INK, 'left', 600, 1); });
  txt(g, o.on ? 'CLICK A GLOWING TILE TO CLAIM IT' : 'REALMS GROW, TREATIES LIMIT, RIVALS SWALLOW', 12, h - 14, 11, DIM, 'left', 500, 1);
};
V.cartel.poke = st => { const i = st.hv; if (i >= 0 && st.grid && st.grid[i] < 0) { const c = i % 10, r = (i / 10) | 0; if (!(c === Math.round(2 + r * .75) || c === Math.round(2 + r * .75) + 1)) { const nbs = [c > 0 ? i - 1 : -1, c < 9 ? i + 1 : -1, r > 0 ? i - 10 : -1, r < 7 ? i + 10 : -1]; if (nbs.some(j => j >= 0 && st.grid[j] === 0)) { st.grid[i] = 0; st.born[i] = st.t || 0; } } } };

/* 18 SHADOW BIDDING — seal a number, reveal it, and the seal can’t lie */
V.shadow = (g, o) => {
  const { st, w, h, t, dt, acc } = o; if (!st.i) { st.i = 1; st.phase = 'sealed'; st.clock = 0; st.bids = [3, 5]; st.salt = 1; st.tamper = -1; }
  st.clock += dt; if (st.phase === 'sealed' && st.clock > (o.on ? 99 : 2.6)) { st.phase = 'reveal'; st.clock = 0; } else if (st.phase === 'reveal' && st.clock > 3) { st.phase = 'sealed'; st.clock = 0; st.salt++; const r = rng(st.salt * 17); st.bids = [1 + Math.floor(r() * 7), 1 + Math.floor(r() * 7)]; if (st.bids[0] === st.bids[1]) st.bids[1] = (st.bids[1] % 7) + 1; }
  const SQ = 50, bx = (w - 5 * SQ) / 2, by = 10, rows = ['rnbqk', 'ppppp', '.....', 'PPPPP', 'RNBQK'];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = bx + c * SQ, y = by + r * SQ; if ((r + c) % 2) { g.fillStyle = 'rgba(234,232,227,.08)'; g.fillRect(x, y, SQ, SQ); } const p = rows[r][c]; if (p === '.') continue; const wht = p === p.toUpperCase(); circ(g, x + SQ / 2, y + SQ / 2, 18, wht ? INK : '#151516', wht ? null : INK); g.lineWidth = 1.5; txt(g, p.toUpperCase(), x + SQ / 2, y + SQ / 2 + 1, 18, wht ? '#151516' : INK, 'center', 700); }
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(bx + .5, by + .5, 5 * SQ, 5 * SQ);
  const hv = o.on ? (o.px < w / 2 ? 0 : 1) : -1, inPanel = o.on && o.py > 322 && o.py < 450; st.tamper = inPanel ? hv : -1;
  const hashOf = i => { let hx = fnv(`bid${st.bids[i]}|salt${st.salt}|${i}`); if (st.tamper === i) hx = hx.slice(0, 3) + 'x' + hx.slice(4); return hx; };
  [['WHITE', 0], ['BLACK', 1]].forEach(([nm, i]) => { const x = i ? w / 2 + 8 : 8, pw = w / 2 - 16, py = 322, tam = st.tamper === i, revealed = st.phase === 'reveal';
    g.lineWidth = 1.6; g.strokeStyle = tam ? acc : 'rgba(234,232,227,.6)'; rrect(g, x, py, pw, 126, 8); g.stroke(); if (revealed) { g.fillStyle = rgba(acc, i === (st.bids[1] > st.bids[0] ? 1 : 0) ? .14 : 0); g.fill(); }
    txt(g, nm + "'S SEAL", x + 14, py + 20, 12, DIM, 'left', 600, 2);
    if (revealed) { txt(g, 'BID ' + st.bids[i], x + 14, py + 62, 30, INK, 'left', 700, 1); txt(g, tam ? '✗ SEAL BROKEN' : '✓ MATCHES THE SEAL', x + 14, py + 100, 12, tam ? acc : INK, 'left', 700, 1); }
    else { g.fillStyle = 'rgba(234,232,227,.88)'; for (let k = 0; k < 6; k++) g.fillRect(x + 14 + k * 22, py + 46, 17, 24); txt(g, tam ? '✗ TAMPERED' : 'HIDDEN UNTIL REVEAL', x + 14, py + 100, 12, tam ? acc : DIM, 'left', 600, 1); }
    txt(g, hashOf(i), x + pw - 14, py + 20, 12, tam ? acc : acc, 'right', 600, 1); });
  const win = st.bids[1] > st.bids[0] ? 'BLACK' : 'WHITE';
  txt(g, st.phase === 'reveal' ? `${win} BID HIGHER · ${win} MOVES FIRST` : 'BOTH SIDES SEAL A SECRET BID', w / 2, 294, 14, st.phase === 'reveal' ? acc : INK, 'center', 700, 2);
  txt(g, o.on ? 'HOVER A SEAL TO TRY TO TAMPER' : 'CHANGE ONE LETTER AND THE SEAL BREAKS', 8, h - 14, 12, DIM, 'left', 500, 1);
};
V.shadow.poke = st => { st.phase = 'reveal'; st.clock = 0; };

/* 19 LEXICON QUARANTINE — ink the chain, surround it, and it’s quarantined */
V.lexicon = (g, o) => {
  const { st, w, h, t, dt, acc } = o; const COLS = 7, ROWS = 6, S = 68, x0 = (w - COLS * S) / 2, y0 = 14;
  const WORDS = [['LANTERN', [[0, 1], [1, 1], [2, 1], [2, 2], [3, 2], [4, 2], [4, 3]]], ['MARGIN', [[5, 0], [5, 1], [4, 1], [3, 1], [3, 2], [3, 3]]], ['HUSH', [[1, 4], [2, 4], [3, 4], [3, 3]]], ['EMBERS', [[0, 3], [1, 3], [1, 2], [2, 2], [2, 3], [2, 4]]]];
  const mk = k => { const [wd, path] = WORDS[k % WORDS.length], r = rng(k * 41 + 9), key = new Set(path.map(p => p.join())); st.k = k; st.word = wd; st.path = path; st.letters = []; const F = 'AEIOURSTLNDHMC'; for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < COLS; c++) { const idx = path.findIndex(p => p[0] === c && p[1] === rr); st.letters.push(idx >= 0 ? wd[idx] : F[Math.floor(r() * F.length)]); }
    const lib = new Set(); path.forEach(([c, rr]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => { const x = c + dc, y = rr + dr; if (x >= 0 && x < COLS && y >= 0 && y < ROWS && !key.has(x + ',' + y)) lib.add(x + ',' + y); })); st.lib = [...lib]; st.stones = []; st.clock = 0; st.shown = 0; st.hold = 0; st.cap = false; };
  if (!st.i) { st.i = 1; mk(0); }
  st.clock += dt; if (st.shown < st.path.length) { if (st.clock > .32) { st.clock = 0; st.shown++; } } else if (!st.cap) { if (st.clock > .5) { st.clock = 0; const free = st.lib.filter(k => !st.stones.includes(k)); if (free.length) st.stones.push(free[Math.floor(Math.random() * free.length)]); if (st.lib.every(k => st.stones.includes(k))) { st.cap = true; st.hold = 0; } } } else { st.hold += dt; if (st.hold > 2.4) mk(st.k + 1); }
  const hc = o.on ? Math.floor((o.px - x0) / S) : -1, hr = o.on ? Math.floor((o.py - y0) / S) : -1; st.hv = hc >= 0 && hc < COLS && hr >= 0 && hr < ROWS ? hc + ',' + hr : null;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const x = x0 + c * S, y = y0 + r * S, key = c + ',' + r, idx = st.path.findIndex(p => p[0] === c && p[1] === r), inChain = idx >= 0 && idx < st.shown, stone = st.stones.includes(key), isLib = st.lib.includes(key);
    g.strokeStyle = 'rgba(234,232,227,.14)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, S, S);
    const L = st.letters[r * COLS + c]; if (!stone) txt(g, L, x + S / 2, y + S / 2 + 1, inChain ? 34 : 28, inChain ? (st.cap ? DIM : acc) : 'rgba(234,232,227,.5)', 'center', inChain ? 700 : 500);
    if (stone) { circ(g, x + S / 2, y + S / 2, 24, INK); circ(g, x + S / 2, y + S / 2, 24, null, '#151516'); }
    if (!stone && st.hv === key && isLib && st.shown >= st.path.length && !st.cap) { circ(g, x + S / 2, y + S / 2, 24, rgba(INK, .3), INK); } }
  g.strokeStyle = st.cap ? DIM : acc; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = .55; g.beginPath(); st.path.slice(0, st.shown).forEach(([c, r], i) => { const x = x0 + c * S + S / 2, y = y0 + r * S + S / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.globalAlpha = 1;
  if (st.cap) { const [c, r] = st.path[0], [c2, r2] = st.path[st.path.length - 1]; g.save(); g.translate(w / 2, y0 + ROWS * S / 2); g.rotate(-.08); g.strokeStyle = acc; g.lineWidth = 4; rrect(g, -140, -30, 280, 60, 4); g.fillStyle = 'rgba(21,21,22,.88)'; g.fill(); g.stroke(); txt(g, 'QUARANTINED', 0, 2, 32, acc, 'center', 700, 3); g.restore(); }
  const free = st.lib.filter(k => !st.stones.includes(k)).length, by = y0 + ROWS * S + 30;
  txt(g, 'POET’S WORD ', x0, by, 12, DIM, 'left', 500, 2); txt(g, st.word, x0 + 118, by, 15, acc, 'left', 700, 3); txt(g, st.cap ? 'NO ROOM LEFT' : `ROOM LEFT: ${free}`, x0 + COLS * S, by, 13, st.cap ? acc : INK, 'right', 700, 2);
  txt(g, o.on ? 'CLICK A SPACE NEXT TO THE WORD TO BLOCK IT' : 'ONE PLAYER WRITES. THE OTHER SURROUNDS.', x0, h - 14, 11, DIM, 'left', 500, 1);
};
V.lexicon.poke = st => { if (st.hv && st.lib && st.lib.includes(st.hv) && !st.stones.includes(st.hv) && st.shown >= st.path.length) { st.stones.push(st.hv); st.clock = 0; if (st.lib.every(k => st.stones.includes(k))) { st.cap = true; st.hold = 0; } } };

/* ---------------------------------------------------------------------
   factory
   --------------------------------------------------------------------- */
export function makePreview(slug, tr, idx) {
  const fn = V[slug], st = {}, acc = tr.look, state = { t: 0 };
  return {
    slug, st,
    draw(g, t, dt, ptr) {
      state.t = t; st.t = t; plate(g, tr, idx, acc);
      g.save(); g.beginPath(); g.rect(AX, AY, AW, AH); g.clip(); g.translate(AX, AY); g.lineCap = 'butt'; g.lineJoin = 'miter'; g.setLineDash([]); g.lineWidth = 1;
      const on = !!ptr && ptr.x > AX && ptr.x < AX + AW && ptr.y > AY && ptr.y < AY + AH;
      fn(g, { st, w: AW, h: AH, t, dt: Math.min(.1, dt), px: ptr ? ptr.x - AX : -999, py: ptr ? ptr.y - AY : -999, on, acc });
      g.restore();
    },
    poke(x, y) { const f = fn.poke; if (f) f(st, x - AX, y - AY); },
  };
}
export const ART_WINDOW = { x: AX, y: AY, w: AW, h: AH };
