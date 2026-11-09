/* =====================================================================
   THE SPIRAL — the whole page is one Three.js scene.

   Nineteen plates hang along one hairline thread that winds up through the screen as a 3D helix, entering below
   the bottom edge and leaving above the top. the live games (solid thread) climb first, then a gap, then the roadmap
   (dashed thread). Two ways of being in it:

     MAP   the whole spiral at once, and it flows upward by itself, forever: a plate that leaves the top comes back
           in from the bottom. Hover a plate and the flow slows and the plate lifts; drag or scroll to scrub or
           speed it up; click a plate to step in front of it.
     WALK  the camera glides in front of one plate on the spiral. Scroll, swipe, drag or press an arrow key to
           climb to the next plate; the liner card follows.

   There is no window and no frame: the canvas is 100vw x 100vh and the HTML is only a thin layer of liner notes on
   top of it. Nothing here is a flat disc any more: the volume comes from the helix itself, front plates large and
   bright, back plates smaller and dim.
   ===================================================================== */
import * as THREE from 'three';
import { SITE, TRACKS, pad2, sideName, openLabel, openUrl, iconId } from './content.js';
const ico = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
import { makePreview, PW, PH } from './previews.js';

/* ---------- utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const N = TRACKS.length, SIDE_A = 9;
const CARD = '#151516', CHALK = '#EAE8E3', ACC = '#EE6A3C';
const navigate = u => window.__independents_nav ? window.__independents_nav(u) : location.assign(u);

class Spring {
  constructor(v = 0, k = 90, z = .9) { this.x = v; this.v = 0; this.t = v; this.k0 = k; this.z = z; }
  step(dt) { const k = REDUCED ? this.k0 * 2.4 : this.k0, c = 2 * Math.sqrt(k) * (REDUCED ? 1 : this.z), n = Math.max(1, Math.ceil(dt / .008)), h = dt / n; for (let i = 0; i < n; i++) { this.v += (-k * (this.x - this.t) - c * this.v) * h; this.x += this.v * h; } return this.x; }
  snap(v) { this.x = this.t = v; this.v = 0; }
}

/* ---------- the grain (cardstock, printed) ---------- */
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 240; const g = c.getContext('2d'); let s = 1337; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const id = g.createImageData(240, 240); for (let i = 0; i < id.data.length; i += 4) { const light = r() > .5, v = light ? 255 : 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = light ? 235 : 0; id.data[i + 3] = Math.floor(r() * (light ? 30 : 46)); } g.putImageData(id, 0, 0);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(234,232,227,${(.03 + r() * .05).toFixed(3)})`; g.beginPath(); const x = r() * 240, y = r() * 240; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 60, y + (r() - .5) * 60); g.stroke(); }
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

/* =====================================================================
   1. DOM: tracklist, rail, liner card
   ===================================================================== */
const els = { card: $('#card'), rail: $('#rail'), tip: $('#tip'), toast: $('#toast'), sides: $('#sides'), tools: $('#tools'), dock: $('#dock') };
let toastT = 0; const toast = (s, ms = 2600) => { els.toast.textContent = s; els.toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => els.toast.classList.remove('on'), ms); };

TRACKS.forEach((tr, i) => {
  const a = document.createElement('a'); a.className = 'trk'; a.href = tr.href; a.dataset.slug = tr.slug; a.dataset.i = i;
  a.innerHTML = `<span class="n">${pad2(i + 1)}</span>${ico(iconId(tr), 'ic ti')}<span class="t">${tr.name}</span><i class="lead"></i><span class="d">${tr.time}</span><span class="sub">${tr.hook}</span>`;
  $(tr.side === 'A' ? '#sideA' : '#sideB').appendChild(a);
});
/* rail: nineteen ticks, grouped by side */
(function buildRail() {
  const A = document.createElement('div'), B = document.createElement('div'); A.className = 'grp a'; B.className = 'grp b'; A.dataset.label = 'LIVE · 09'; B.dataset.label = 'ROADMAP · 10';
  TRACKS.forEach((tr, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tk'; b.dataset.i = i; b.setAttribute('aria-label', `${pad2(i + 1)} ${tr.name}`); b.innerHTML = `<span class="name">${pad2(i + 1)} ${tr.name}</span>`; (i < SIDE_A ? A : B).appendChild(b); });
  els.rail.append(A, B);
})();

function renderCard(i) {
  const tr = TRACKS[i], nx = TRACKS.find(t => t.slug === tr.like);
  els.card.innerHTML = `
    <div class="c-head"><span>${pad2(i + 1)} / 19</span><span class="tag ${tr.side === 'A' ? 'live' : ''}">${ico(tr.side === 'A' ? 'i-live' : 'i-roadmap')}${sideName(tr)}</span></div>
    <h2 class="c-title">${ico(iconId(tr), 'ic pi')}<span>${tr.name}</span><i class="lead"></i><time>${tr.time}</time></h2>
    <p class="c-hook">${tr.hook}</p>
    <p class="c-you">${tr.you}</p>
    <div class="row"><b>PLAYERS</b><i class="lead"></i><span>${tr.who}</span></div>
    <div class="row"><b>STATUS</b><i class="lead"></i><span>${tr.side === 'A' ? 'Open now, in your browser' : 'A playable sketch, still being finished'}</span></div>
    <div class="row like"><b>TRY NEXT</b><i class="lead"></i><button type="button" data-like="${nx.i}">${nx.name}</button></div>
    <div class="c-act"><button type="button" class="nav" data-step="-1" aria-label="Previous track" ${i === 0 ? 'disabled' : ''}>←</button>
      <a class="open ${tr.pending ? 'pending' : ''}" href="${openUrl(tr)}" data-slug="${tr.slug}"><span>${tr.pending ? '' : ico(tr.side === 'A' ? 'i-play' : 'i-peek')}${openLabel(tr)}</span><span aria-hidden="true">${tr.pending ? '' : '↗'}</span></a>
      <button type="button" class="nav" data-step="1" aria-label="Next track" ${i === N - 1 ? 'disabled' : ''}>→</button></div>`;
  els.card.classList.remove('swap'); void els.card.offsetWidth; els.card.classList.add('swap');
}


/* =====================================================================
   2. STATE + THE GEOMETRY OF THE SPIRAL
   ===================================================================== */
const S = { mode: 'map', cur: 0, last: 0, tT: 0, hov: -1, interacted: false, indexOpen: false, pokes: 0, flowT: 0, userV: 0, autoV: 0, wrap: 0, reduced: REDUCED };
/* flow: how far the spiral has risen, in stations. A plate at station coordinate q sits at height s = (q + flow) mod LOOP along the helix. */
const AUTO_V = REDUCED ? 0 : .42, HOVER_V = REDUCED ? 0 : .05, FLOW0 = 1.2;
const flowS = new Spring(FLOW0 - (REDUCED ? 0 : 5), 36, 1), mapS = new Spring(0, 34, 1);
const camS = [new Spring(0, 36, .95), new Spring(60, 36, .95), new Spring(120, 36, .95)], lookS = [new Spring(0, 40, .95), new Spring(0, 40, .95), new Spring(0, 40, .95)];
const offS = [new Spring(0, 44, 1), new Spring(0, 44, 1)], parS = [new Spring(0, 30, 1), new Spring(0, 30, 1)];
S.flowT = FLOW0;

const mod = (a, m) => ((a % m) + m) % m, smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const PLATE_W = 5, PLATE_H = 6.25, LIFT = 1.1, VFOV = 34;
/* the thread has stations 1 unit apart, a gap between the sides, and a longer seam where the loop closes below the screen */
const GAP = .7, SEAM = 1.8, PER_TURN = 7, DTH = TAU / PER_TURN;
const Q = TRACKS.map((_, k) => k + (k >= SIDE_A ? GAP : 0)), LOOP = Q[N - 1] + SEAM;
const qOf = u => u <= 0 ? u : u >= N - 1 ? Q[N - 1] + (u - (N - 1)) : lerp(Q[Math.floor(u)], Q[Math.floor(u) + 1], u - Math.floor(u));
const flowFor = u => LOOP / 2 - qOf(u);
/* helix size: solved from the layout so the loop is taller than the screen and the wrap happens out of sight */
const G = { R: 14, dy: 2.7, yoff: -4.5, mapScale: 1.5, ppu: 26, D: 56 };
const helixAt = (s, out) => { const ph = (s - LOOP / 2) * DTH; return out.set(G.R * Math.sin(ph), (s - LOOP / 2) * G.dy + G.yoff, G.R * Math.cos(ph)); };


/* =====================================================================
   3. THREE: renderer, scene, thread, plates
   ===================================================================== */
const canvas = $('#world');
let renderer;
try { if (/[?&]nogl\b/.test(location.search)) throw new Error('WebGL disabled by ?nogl'); renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) { document.body.classList.add('nogl'); document.body.dataset.mode = 'walk'; console.info('WebGL unavailable: showing the tracklist only'); }

const scene = new THREE.Scene(); scene.background = new THREE.Color(CARD); scene.fog = new THREE.Fog(CARD, 30, 120);
const camera = new THREE.PerspectiveCamera(VFOV, 1, .5, 400);
const rec = new THREE.Group(); scene.add(rec);
const plates = [], meshes = [];
const world = { ready: false };

let motes, pointsMat, threadA, threadB, gapTicks;
const lineMat = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: o < 1, opacity: o });
const SEG = .09, NSEG = Math.ceil(LOOP / SEG), CH = [.918, .91, .89];
const tA = { pos: new Float32Array(NSEG * 6), col: new Float32Array(NSEG * 6), n: 0 }, tB = { pos: new Float32Array(NSEG * 6), col: new Float32Array(NSEG * 6), n: 0 };
const gtPos = new Float32Array(2 * 2 * 3), gtCol = new Float32Array(2 * 2 * 3);
const edgeFade = s => smooth(s / 1.6) * smooth((LOOP - s) / 1.6);
const THREAD_ON_A = q => q <= Q[SIDE_A - 1] + .3 || q >= LOOP - .45, THREAD_ON_B = q => q >= Q[SIDE_A] - .3 && q <= Q[N - 1] + .5;
const TA = new THREE.Vector3(), TB = new THREE.Vector3();

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(CARD, 1);

  /* the thread: a 1px hairline that follows the helix. Solid for LIVE, dashed for ROADMAP, nothing in the gaps. It is rebuilt every
     frame from the flow, so the dashes ride up with the plates. */
  const mk = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(t.col, 3)); g.setDrawRange(0, 0); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); l.frustumCulled = false; rec.add(l); return l; };
  threadA = mk(tA); threadB = mk(tB);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(gtPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(gtCol, 3)); g.setDrawRange(0, 0); gapTicks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); gapTicks.frustumCulled = false; rec.add(gapTicks); }

  /* the plates */
  const ringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 41 }, (_, k) => new THREE.Vector3(Math.cos(k / 40 * TAU) * .62, .05, Math.sin(k / 40 * TAU) * .62)));
  TRACKS.forEach((tr, i) => {
    const grp = new THREE.Group();
    const inner = new THREE.Group(); inner.position.y = LIFT + PLATE_H / 2; grp.add(inner);
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const g = cv.getContext('2d'), pv = makePreview(tr.slug, tr, i);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), mat); mesh.userData.i = i; inner.add(mesh); meshes.push(mesh);
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W + .5, PLATE_H + .5), new THREE.MeshBasicMaterial({ color: '#0e0e0f', fog: true })); bk.position.z = -.06; inner.add(bk);
    const bk2 = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W + .5, PLATE_H + .5), new THREE.MeshBasicMaterial({ color: '#202022', fog: true })); bk2.position.set(.18, -.12, -.12); inner.add(bk2);
    const post = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, LIFT, 0)]), new THREE.LineBasicMaterial({ color: CHALK })); grp.add(post);
    const ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: CHALK })); grp.add(ring);
    rec.add(grp);
    const p = { i, grp, inner, mesh, mat, ring, post, tex, cv, g, pv, s: 0, cs: 1, env: 1, lit: new Spring(.9, 60, 1), rise: new Spring(0, 60, .7), lean: [new Spring(0, 80, .8), new Spring(0, 80, .8)], scale: new Spring(1, 60, .85), age: 99, ptr: null };
    plates.push(p);
  });

  /* chalk dust: it drifts upward with the spiral, a little slower, so the flow has parallax */
  const mp = new Float32Array(360 * 3); for (let i = 0; i < 360; i++) { mp[i * 3] = (Math.random() - .5) * 120; mp[i * 3 + 1] = (Math.random() - .5) * 68; mp[i * 3 + 2] = (Math.random() - .5) * 90; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); pointsMat = new THREE.PointsMaterial({ color: CHALK, size: .16, transparent: true, opacity: .42, sizeAttenuation: true, depthWrite: false }); motes = new THREE.Points(mg, pointsMat); motes.frustumCulled = false; scene.add(motes);
}

/** rebuild the thread for the current flow */
function updateThread(flow) {
  tA.n = tB.n = 0;
  for (let k = 0; k < NSEG; k++) {
    const s0 = k * SEG, s1 = Math.min(LOOP, (k + 1) * SEG), sm = (s0 + s1) / 2, q = mod(sm - flow, LOOP);
    const isA = THREAD_ON_A(q), isB = !isA && THREAD_ON_B(q) && mod(q * 2.6, 1) < .55; if (!isA && !isB) continue;
    const t = isA ? tA : tB, e = edgeFade(sm) * (isA ? .9 : .8), o = t.n * 6; helixAt(s0, TA); helixAt(s1, TB);
    t.pos[o] = TA.x; t.pos[o + 1] = TA.y; t.pos[o + 2] = TA.z; t.pos[o + 3] = TB.x; t.pos[o + 4] = TB.y; t.pos[o + 5] = TB.z;
    for (let c = 0; c < 2; c++) { t.col[o + c * 3] = CH[0] * e; t.col[o + c * 3 + 1] = CH[1] * e; t.col[o + c * 3 + 2] = CH[2] * e; } t.n++;
  }
  for (const [t, l] of [[tA, threadA], [tB, threadB]]) { l.geometry.setDrawRange(0, t.n * 2); l.geometry.attributes.position.needsUpdate = true; l.geometry.attributes.color.needsUpdate = true; }
  /* the two small accent ticks that mark the run-out gap between LIVE and ROADMAP */
  let n = 0; for (const q of [Q[SIDE_A - 1] + .3, Q[SIDE_A] - .3]) { const s = mod(q + flow, LOOP), ph = (s - LOOP / 2) * DTH, sn = Math.sin(ph), cs = Math.cos(ph), y = (s - LOOP / 2) * G.dy + G.yoff, e = edgeFade(s), o = n * 6;
    gtPos[o] = (G.R - 1.4) * sn; gtPos[o + 1] = y; gtPos[o + 2] = (G.R - 1.4) * cs; gtPos[o + 3] = (G.R + 1.4) * sn; gtPos[o + 4] = y; gtPos[o + 5] = (G.R + 1.4) * cs;
    for (let c = 0; c < 2; c++) { gtCol[o + c * 3] = .933 * e; gtCol[o + c * 3 + 1] = .416 * e; gtCol[o + c * 3 + 2] = .235 * e; } n++; }
  gapTicks.geometry.setDrawRange(0, n * 2); gapTicks.geometry.attributes.position.needsUpdate = true; gapTicks.geometry.attributes.color.needsUpdate = true;
}


/* =====================================================================
   4. LAYOUT — where on the screen the thing we look at should sit
   ===================================================================== */
const L = { W: 1, H: 1, phone: false, cx: .5, cy: .5, availW: 1, availH: 1 };
let dockH = 330;
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.phone = L.W <= 760;
  const walk = S.mode === 'walk', narrow = L.W < 1100;
  /* the spiral's own footprint on screen (always the map composition, so the helix does not change shape when you step in) */
  const mapCx = L.phone ? L.W / 2 : L.W * (narrow ? .68 : .7), mapW = L.phone ? L.W * 1.1 : L.W * (narrow ? .58 : .56);
  G.R = L.phone ? 8.5 : 11.5; G.mapScale = L.phone ? 1.0 : 1.05;
  G.ppu = mapW / (2 * G.R + PLATE_W * G.mapScale * 1.05); G.D = L.H / (2 * Math.tan(VFOV * Math.PI / 360) * G.ppu);
  G.dy = (L.H / G.ppu * 1.02 + (LIFT + PLATE_H) * G.mapScale * .85) / LOOP; G.yoff = -(LIFT + PLATE_H / 2) * G.mapScale * .75;
  if (L.phone) {
    const top = 56;
    if (walk) { const h = L.H - dockH - top; L.cx = L.W / 2; L.cy = top + h / 2 + 4; L.availH = h * .96; L.availW = L.W * .86; }
    else { L.cx = mapCx; L.cy = L.H * .5; L.availH = L.H; L.availW = mapW; }
  } else {
    if (walk) { L.cx = L.W * (narrow ? .33 : .37); L.cy = L.H * .5; L.availH = L.H * .7; L.availW = L.W * (narrow ? .34 : .36); }
    else { L.cx = mapCx; L.cy = L.H * .5; L.availH = L.H; L.availW = mapW; }
  }
}
function resize() {
  if (!renderer) return; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); layout();
}
addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(() => { dockH = els.dock.offsetHeight || 330; layout(); }).observe(els.dock);
/* the LIVE / ROADMAP switch lives in the top bar on a desktop and in the bottom sheet on a phone */
const mqPhone = matchMedia('(max-width: 760px)'), placeSides = () => { if (mqPhone.matches) els.dock.insertBefore(els.sides, els.card); else els.tools.insertBefore(els.sides, els.tools.firstChild); layout(); };
mqPhone.addEventListener('change', placeSides); placeSides();


/* =====================================================================
   5. NAVIGATION
   ===================================================================== */
const wrapFor = i => LOOP * Math.round((flowS.x - flowFor(i)) / LOOP);   /* the copy of the loop that is closest to where the spiral is now */
function setMode(m) {
  if (S.mode === m) return; S.mode = m; document.body.dataset.mode = m;
  if (m === 'map') { S.flowT = flowS.t; S.userV = 0; S.autoV = 0; }
  layout(); sync();
}
function go(i, quiet) {
  i = clamp(Math.round(i), 0, N - 1); S.interacted = true; document.body.classList.add('used');
  S.tT = i; S.last = i; S.cur = i;
  if (S.mode !== 'walk') { if (!renderer) { sync(); return; } S.wrap = wrapFor(i); setMode('walk'); }
  else S.wrap = wrapFor(i);
  closeIndex(); sync();
}
function toMap() { S.interacted = true; document.body.classList.add('used'); S.tT = S.last; closeIndex(); setMode('map'); }
const next = () => go(S.cur + 1), prev = () => go(S.cur - 1);
function openIndex() { S.indexOpen = true; document.body.classList.add('index-open'); $('#indexBtn').setAttribute('aria-expanded', 'true'); }
function closeIndex() { S.indexOpen = false; document.body.classList.remove('index-open'); $('#indexBtn').setAttribute('aria-expanded', 'false'); }
function openCurrent() { const tr = TRACKS[S.cur]; if (tr.pending) return toast('Long Haul is still being unpacked. It opens here soon.'); navigate(new URL(openUrl(tr), location.href).href); }

let shownCur = -1, shownMode = '';
function sync() {
  const i = S.cur;
  if (shownCur !== i) { shownCur = i; renderCard(i); document.querySelectorAll('.tk').forEach(b => b.toggleAttribute('aria-current', +b.dataset.i === i)); document.querySelectorAll('.tk[aria-current]').forEach(b => b.setAttribute('aria-current', 'true')); document.querySelectorAll('a.trk').forEach(a => a.toggleAttribute('aria-current', +a.dataset.i === i)); document.querySelectorAll('a.trk[aria-current]').forEach(a => a.setAttribute('aria-current', 'true')); }
  const side = S.mode === 'walk' ? TRACKS[i].side : '';
  els.sides.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
  shownMode = S.mode;
}

/* UI wiring */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-side],[data-step],[data-like],.tk,#mapBtn,#indexBtn,#closeIdx,a.trk,a.open'); if (!t) return;
  if (t.matches('[data-go]')) go(+t.dataset.go);
  else if (t.matches('[data-side]')) go(t.dataset.side === 'A' ? (S.mode === 'walk' && S.cur < SIDE_A ? S.cur : 0) : (S.mode === 'walk' && S.cur >= SIDE_A ? S.cur : SIDE_A));
  else if (t.matches('[data-step]')) go(S.cur + +t.dataset.step);
  else if (t.matches('[data-like]')) go(+t.dataset.like);
  else if (t.matches('.tk')) go(+t.dataset.i);
  else if (t.id === 'mapBtn') toMap();
  else if (t.id === 'indexBtn') S.indexOpen ? closeIndex() : openIndex();
  else if (t.id === 'closeIdx') closeIndex();
  else if (t.matches('a.trk')) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); if (document.body.classList.contains('nogl')) navigate(t.href); else go(+t.dataset.i); }
  else if (t.matches('a.open')) { e.preventDefault(); const tr = TRACKS.find(x => x.slug === t.dataset.slug); if (tr.pending) toast('Long Haul is still being unpacked. It opens here soon.'); else navigate(t.href); }
});
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key;
  if (k === 'Escape') { if (S.indexOpen) closeIndex(); else if (S.mode === 'walk') toMap(); return; }
  if (k === 'i' || k === 'I') { S.indexOpen ? closeIndex() : openIndex(); return; }
  if (k === 'm' || k === 'M') { S.mode === 'map' ? go(S.last) : toMap(); return; }
  if (S.indexOpen) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', 'd', 'D', 's', 'S'].includes(k)) { e.preventDefault(); S.mode === 'map' ? go(S.last) : next(); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'a', 'A', 'w', 'W'].includes(k)) { e.preventDefault(); S.mode === 'map' ? go(S.last) : prev(); }
  else if (k === 'Home') go(0); else if (k === 'End') go(N - 1);
  else if (k === 'Enter' && S.mode === 'walk' && document.activeElement === canvas) openCurrent();
  S.interacted = true; document.body.classList.add('used');
});


/* =====================================================================
   6. POINTER, WHEEL, TOUCH
   ===================================================================== */
const P = { x: -1, y: -1, nx: 0, ny: 0, on: false, down: false, id: null, x0: 0, y0: 0, base: 0, axis: null, dist: 0, moved: false, t0: 0, samples: [], touch: false };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hit = null;
function pickPlate() {
  hit = null; if (!renderer || !P.on) return; ndc.set(P.x / L.W * 2 - 1, -(P.y / L.H) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(meshes.filter(m => plates[m.userData.i].env > .45), false)[0]; if (h) { const i = h.object.userData.i; hit = { i, u: h.uv.x, v: h.uv.y }; }
}
const plateXY = h => ({ x: h.u * PW, y: (1 - h.v) * PH });
/* pixels the spiral moves on screen per station, for scrubbing */
const pxPerStation = () => Math.max(30, G.dy * G.ppu);

canvas.addEventListener('pointerdown', e => {
  if (e.button > 0) return; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
  if (S.indexOpen) closeIndex();
  P.down = true; P.id = e.pointerId; P.x0 = P.x = e.clientX; P.y0 = P.y = e.clientY; P.on = true; P.moved = false; P.axis = null; P.dist = 0; P.base = S.tT; P.t0 = performance.now(); P.samples = [[P.t0, 0]]; P.touch = e.pointerType !== 'mouse'; S.interacted = true; document.body.classList.add('used'); S.userV = 0;
});
canvas.addEventListener('pointermove', e => {
  const px = P.x, py = P.y; P.x = e.clientX; P.y = e.clientY; P.on = true; P.nx = e.clientX / L.W * 2 - 1; P.ny = e.clientY / L.H * 2 - 1;
  if (!P.down) return; const dx = e.clientX - P.x0, dy = e.clientY - P.y0;
  if (!P.moved && Math.hypot(dx, dy) > 8) { P.moved = true; P.axis = S.mode === 'walk' ? (Math.abs(dx) >= Math.abs(dy) * .9 ? 'x' : 'y') : 'xy'; document.body.classList.add('dragging'); closeIndex(); }
  if (!P.moved) return;
  const now = performance.now();
  if (S.mode === 'walk') { const unit = L.phone ? L.W * .55 : L.W * .27, d = P.axis === 'x' ? dx : dy; P.dist = d; S.tT = clamp(P.base - d / unit, -.3, N - 1 + .3); P.samples.push([now, -d / unit]); P.samples = P.samples.filter(s => now - s[0] < 140); }
  else { /* dragging up (or right) lifts the spiral with your finger */ const df = (-(e.clientY - py) + (e.clientX - px) * .5) / pxPerStation(); S.flowT += df; P.samples.push([now, df]); P.samples = P.samples.filter(s => now - s[0] < 120); }
});
function endDrag(e) {
  if (!P.down) return; P.down = false; document.body.classList.remove('dragging'); try { canvas.releasePointerCapture(P.id); } catch (_) { }
  if (P.moved) {
    if (S.mode === 'walk') { const now = performance.now(), s = P.samples.filter(q => now - q[0] < 140), v = s.length > 1 ? (s[s.length - 1][1] - s[0][1]) / Math.max(.03, (s[s.length - 1][0] - s[0][0]) / 1000) : 0; S.tT = clamp(Math.round(clamp(S.tT + clamp(v, -6, 6) * .14, P.base - 1, P.base + 1)), 0, N - 1); S.last = S.tT; S.wrap = wrapFor(S.tT); }
    else { const now = performance.now(), s = P.samples.filter(q => now - q[0] < 120), sum = s.reduce((a, q) => a + q[1], 0); S.userV = s.length > 1 ? clamp(sum / Math.max(.06, (now - s[0][0]) / 1000), -7, 7) : 0; }
    return;
  }
  /* a click, not a drag */
  pickPlate();
  if (hit) {
    if (S.mode === 'walk' && hit.i === S.cur) { const p = plateXY(hit); plates[hit.i].pv.poke(p.x, p.y); S.pokes++; plates[hit.i].age = 99; }
    else go(hit.i);
  }
}
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', e => { if (!P.down) { P.on = false; hit = null; } });

let wheelAcc = 0, wheelT = 0, wheelCool = 0, overs = 0, wheelTm = 0;
addEventListener('wheel', e => {
  if (e.target.closest && e.target.closest('#index')) return; e.preventDefault(); if (e.ctrlKey) return;
  S.interacted = true; document.body.classList.add('used'); const now = performance.now(); let dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1); if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) dy = e.deltaX * (e.deltaMode === 1 ? 32 : 1);
  /* in the map the wheel scrubs: scroll down and the spiral rises faster, scroll up and it slows, stops, then runs back */
  if (S.mode === 'map') { S.userV = clamp(S.userV + clamp(dy, -120, 120) * .018, -8, 8); return; }
  if (now - wheelT > 220) wheelAcc = 0; wheelT = now;
  if (now < wheelCool) { wheelAcc = 0; return; }
  wheelAcc += dy; S.tT = clamp(S.cur + clamp(wheelAcc / 260, -.38, .38), -.3, N - 1 + .3);
  if (Math.abs(wheelAcc) > 70) { const dir = wheelAcc > 0 ? 1 : -1; wheelAcc = 0; wheelCool = now + 520; if (dir < 0 && S.cur === 0) { overs++; if (overs >= 1) { overs = 0; toMap(); return; } } go(S.cur + dir); }
  clearTimeout(wheelTm); wheelTm = setTimeout(() => { if (S.mode === 'walk' && !P.down) S.tT = S.cur; }, 240);
}, { passive: false });

/* =====================================================================
   7. THE FRAME
   ===================================================================== */
const V = { cam: new THREE.Vector3(), look: new THREE.Vector3(), tmp: new THREE.Vector3(), tmp2: new THREE.Vector3() };
let last = performance.now(), clock = 0, firstFrames = 0, lastDraw = new Array(N).fill(-1);
const ELEV = 11 * Math.PI / 180;
const mapPose = () => ({ pos: [0, Math.sin(ELEV) * G.D, Math.cos(ELEV) * G.D], look: [0, 1, 0], D: G.D });
function walkPose() {
  const plateCy = G.yoff + LIFT + PLATE_H / 2, hpx = Math.min(L.availH, L.availW * PLATE_H / PLATE_W), ppu = hpx / PLATE_H;
  const D = L.H / (2 * Math.tan(VFOV * Math.PI / 360) * ppu), camY = plateCy + D * .4;
  return { pos: [0, camY, G.R + D], look: [0, plateCy, G.R], D };
}

let auto = true;
function frame(now) { requestAnimationFrame(frame); const dt = clamp((now - last) / 1000, 0, .05); last = now; if (auto) tick(dt, true); }
function tick(dt, draw) {
  if (!renderer) return; clock += dt;
  const walk = S.mode === 'walk';
  /* --- the flow: in the map the spiral rises on its own; hovering slows it, your hand or the wheel adds to it --- */
  if (!walk) {
    const dragging = P.down && P.moved, target = dragging ? 0 : (S.hov >= 0 ? HOVER_V : AUTO_V);
    S.autoV += (target - S.autoV) * (1 - Math.exp(-dt * (target < S.autoV ? 9 : 2.5)));   /* settles fast when you point at something, picks up gently when you leave */ if (!P.down) S.userV *= Math.pow(.06, dt);
    if (!dragging) S.flowT += (S.autoV + S.userV) * dt;
    flowS.k0 = 36; flowS.z = 1; flowS.t = S.flowT;
  } else { S.flowT = flowFor(S.tT) + S.wrap; flowS.k0 = 62; flowS.z = .93; flowS.t = S.flowT; }
  flowS.step(dt); const flow = flowS.x;
  if (walk) { const c = clamp(Math.round(S.tT), 0, N - 1); if (c !== S.cur) { S.cur = c; S.last = c; sync(); } }
  mapS.t = walk ? 0 : 1; mapS.step(dt); const m = clamp(mapS.x, 0, 1);
  const wp = walkPose(), mp = mapPose(), tgtPos = walk ? wp.pos : mp.pos, tgtLook = walk ? wp.look : mp.look;
  for (let k = 0; k < 3; k++) { camS[k].t = tgtPos[k]; lookS[k].t = tgtLook[k]; camS[k].step(dt); lookS[k].step(dt); }
  offS[0].t = L.cx - L.W / 2; offS[1].t = L.cy - L.H / 2; offS[0].step(dt); offS[1].step(dt);
  parS[0].t = P.nx * 2.2; parS[1].t = P.ny * 1.2; parS[0].step(dt); parS[1].step(dt);
  V.cam.set(camS[0].x, camS[1].x, camS[2].x); V.look.set(lookS[0].x, lookS[1].x, lookS[2].x);
  V.cam.x += parS[0].x * m; V.cam.y += -parS[1].x * m;   /* a little pointer parallax in the map only, so a plate never slides off its frame in the walk */
  camera.position.copy(V.cam); camera.lookAt(V.look);
  camera.setViewOffset(L.W, L.H, -offS[0].x, -offS[1].x, L.W, L.H); camera.updateProjectionMatrix();
  const dist = V.cam.distanceTo(V.look);
  scene.fog.near = lerp(dist * 1.15, dist - G.R * 1.1, m); scene.fog.far = lerp(dist * 5.2, dist + G.R * 3.1, m);

  /* --- the thread, then the plates along it --- */
  updateThread(flow);
  const hvPrev = S.hov; let centre = 0, cd = 1e9;
  plates.forEach((p, i) => {
    const s = mod(Q[i] + flow, LOOP), ph = (s - LOOP / 2) * DTH, sn = Math.sin(ph), cs = Math.cos(ph), env = edgeFade(s), dep = (cs + 1) / 2;
    p.s = s; p.cs = cs; p.env = env; if (Math.abs(s - LOOP / 2) < cd) { cd = Math.abs(s - LOOP / 2); centre = i; }
    const isCur = walk && i === S.cur, isHov = hvPrev === i && !walk, hot = isCur || isHov;
    p.lit.t = walk ? (isCur ? 1 : .3 * (.4 + .6 * dep)) : (isHov ? 1.1 : lerp(.34, .98, Math.pow(dep, .9))); p.lit.step(dt); p.mat.color.setScalar(clamp(p.lit.x, 0, 1.2) * Math.pow(env, .8));
    p.rise.t = isCur ? 1 : (isHov ? 1 : 0); p.rise.step(dt); p.scale.t = (walk ? 1 : G.mapScale * lerp(.88, 1, dep)) * (1 + (isHov ? .12 : 0)); p.scale.step(dt);
    helixAt(s, p.grp.position); p.grp.rotation.y = -.95 * sn * (1 - .6 * p.rise.x);   /* plates fan out like a carousel and turn toward you */
    p.grp.scale.setScalar(Math.max(.0001, p.scale.x * env)); p.inner.visible = env > .02;
    p.inner.position.y = LIFT + PLATE_H / 2 + p.rise.x * (walk ? .35 : 0) + (isHov ? .6 : 0);
    /* lean toward the pointer, like a card you hold */
    let lx = 0, ly = 0; if (hit && hit.i === i) { lx = (hit.u - .5) * -.14; ly = (hit.v - .5) * .1; } p.lean[0].t = lx; p.lean[1].t = ly; p.lean[0].step(dt); p.lean[1].step(dt);
    p.inner.rotation.y = p.lean[0].x; p.inner.rotation.x = -p.lean[1].x - (ELEV + .04) * m;
    p.ring.material.color.set(hot ? ACC : CHALK).multiplyScalar(env); p.ring.scale.setScalar(hot ? 1.18 + Math.sin(clock * 3) * .06 : 1); p.post.material.color.set(hot ? ACC : CHALK).multiplyScalar(env * (walk && !isCur ? .5 : .8));
  });
  if (!walk) S.last = centre;   /* the plate nearest the middle of the screen: where M and the arrow keys step in */
  rec.updateMatrixWorld(true);

  /* --- hover / pick --- */
  pickPlate(); const hv = hit ? hit.i : -1; S.hov = hv; document.body.classList.toggle('hot', hv >= 0 && !P.down);
  /* --- redraw textures: the focused plate often, the rest by turns --- */
  let budget = 3; const order = plates.map(p => p.i).sort((a, b) => (lastDraw[a] - lastDraw[b]));
  const want = i => { if (walk) { const d = Math.abs(i - S.cur); return d === 0 ? 1 / 30 : d <= 2 ? 1 / 8 : 1 / 2; } return plates[i].cs > 0 ? 1 / 6 : 1 / 3; };
  for (const i of order) { if (budget <= 0) break; const p = plates[i]; if (p.env < .08 && lastDraw[i] >= 0) continue; if (clock - lastDraw[i] < want(i)) continue; const ptr = (hit && hit.i === i) ? plateXY(hit) : null; const dtp = lastDraw[i] < 0 ? 1 / 30 : clock - lastDraw[i]; p.pv.draw(p.g, clock, dtp, ptr); p.tex.needsUpdate = true; lastDraw[i] = clock; budget--; }
  /* --- chalk dust rises with the spiral, slower --- */
  { const a = motes.geometry.attributes.position, fv = flowS.v * G.dy; for (let k = 0; k < a.count; k++) { let y = a.getY(k) + (fv * (.2 + (k % 5) * .08) + .12) * dt; if (y > 34) y -= 68; else if (y < -34) y += 68; a.setY(k, y); } a.needsUpdate = true; pointsMat.opacity = .3 + .12 * Math.sin(clock * .5); motes.position.x = -P.nx * 1.2; }
  /* --- map tooltip --- */
  if (!walk && hv >= 0) { const p = plates[hv], v = new THREE.Vector3(0, LIFT + PLATE_H + 1, 0); p.grp.localToWorld(v); v.project(camera); const sx = (v.x * .5 + .5) * L.W, sy = (-v.y * .5 + .5) * L.H; els.tip.textContent = `${pad2(hv + 1)}  ${TRACKS[hv].name} · ${sideName(TRACKS[hv])}`; els.tip.style.left = sx + 'px'; els.tip.style.top = sy + 'px'; els.tip.classList.add('on'); } else els.tip.classList.remove('on');
  if (draw) renderer.render(scene, camera); firstFrames++;
}

/* =====================================================================
   8. BOOT + the test hooks
   ===================================================================== */
if (renderer) { resize(); sync(); requestAnimationFrame(frame); } else { sync(); }
const hint = $('#coverHint'); if (matchMedia('(pointer: coarse)').matches) { hint.textContent = 'Swipe up or down to ride the spiral, then tap a plate.'; $('#hintline').innerHTML = 'SWIPE TO RIDE THE SPIRAL<br>TAP A PLATE TO PLAY WITH IT'; }
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 20px "IBM Plex Mono"'), document.fonts.load('400 20px "IBM Plex Mono"')]).then(() => { lastDraw.fill(-1); }).catch(() => { });

/* previews certified headlessly: lit, animated, reactive to a pointer, and poke-safe */
function probe(slug) {
  const i = TRACKS.findIndex(t => t.slug === slug), tr = TRACKS[i], R = Math.random; let s = 12345; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mk = () => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const sig = g => { const d = g.getImageData(36, 104, 528, 548).data; let h = 0, lit = 0; for (let k = 0; k < d.length; k += 12) { const v = d[k] + d[k + 1] + d[k + 2]; h = (Math.imul(h, 31) + v) | 0; if (v > 200) lit++; } return { h, lit }; };
  const run = withPtr => { s = 12345; const [c, g] = mk(), pv = makePreview(slug, tr, i), hs = []; for (let f = 0; f < 150; f++) { const ptr = withPtr && f >= 24 ? { x: 300 + Math.sin(f * .21) * 220, y: 380 + Math.cos(f * .17) * 250 } : null; pv.draw(g, f / 30, 1 / 30, ptr); if (f === 3 || f === 40 || f === 70 || f === 100 || f === 130 || f === 149) hs.push(sig(g)); } return { hs, pv, g }; };
  let res; try { const a = run(false), b = run(true); let poked = true; try { a.pv.poke(300, 400); a.pv.draw(a.g, 6, 1 / 30, null); b.pv.poke(120, 300); b.pv.poke(300, 400); } catch (e) { poked = String(e); }
    res = { slug, lit: a.hs[5].lit, animates: a.hs[0].h !== a.hs[5].h, reacts: a.hs.some((x, k) => k > 0 && x.h !== b.hs[k].h), poke: poked === true, err: poked === true ? '' : poked }; } catch (e) { res = { slug, lit: 0, animates: false, reacts: false, poke: false, err: String(e && e.stack || e) } } Math.random = R; return res;
}
const projectPlate = i => { const p = plates[i], v = new THREE.Vector3(0, LIFT + PLATE_H / 2, 0); p.grp.localToWorld(v); v.project(camera); const a = new THREE.Vector3(-PLATE_W / 2, LIFT + PLATE_H / 2, 0), b = new THREE.Vector3(PLATE_W / 2, LIFT + PLATE_H / 2, 0); p.grp.localToWorld(a); p.grp.localToWorld(b); a.project(camera); b.project(camera); return { x: (v.x * .5 + .5) * L.W, y: (-v.y * .5 + .5) * L.H, w: Math.abs(b.x - a.x) * .5 * L.W, env: p.env, front: p.cs, s: p.s, lit: p.mat.color.r }; };
window.__independents = {
  ready: true, TRACKS, N, probe, go, toMap, next, prev, openIndex, closeIndex, openCurrent, projectPlate,
  state: () => ({ energy: [flowS, mapS, ...camS, ...lookS, ...offS].reduce((a, q) => a + Math.abs(q.v) + Math.abs(q.x - q.t), 0), mode: S.mode, cur: S.cur, last: S.last, flow: flowS.x, flowT: S.flowT, autoV: S.autoV, userV: S.userV, loop: LOOP, tT: S.tT, hov: S.hov, indexOpen: S.indexOpen, pokes: S.pokes, frames: firstFrames, gl: !!renderer, layout: { ...L }, helix: { ...G, loop: LOOP, perTurn: PER_TURN }, cam: [camS[0].x, camS[1].x, camS[2].x], off: [offS[0].x, offS[1].x], thread: { a: tA.n, b: tB.n } }),
  /* what is in the scene: the flat record disc is gone, only plates and hairlines remain */
  scene: () => ({ flatDiscs: scene.children.concat(rec.children).filter(c => c.type === 'Mesh' && c.geometry && c.geometry.type === 'CircleGeometry').length, recMeshes: rec.children.filter(c => c.type === 'Mesh').length, threadLines: rec.children.filter(c => c.type === 'LineSegments').length }),
  setAuto: b => { auto = !!b; last = performance.now(); },
  stepSim: (n = 60, dt = 1 / 60, draw = true) => { for (let k = 0; k < n; k++) tick(dt, draw && k === n - 1); },
};
