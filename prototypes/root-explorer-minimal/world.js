/* =====================================================================
   THE RECORD — the whole page is one Three.js scene.

   A vinyl record lies in perspective on the charcoal card. Nineteen standing plates sit along its
   groove, nine on Side A (live) and ten on Side B (roadmap). Two ways of being in it:

     WALK  the camera rides the groove. Scroll, swipe, drag or press an arrow key and the record turns
           under the needle; the plate you land on lifts, shows its liner card, and answers your pointer.
     MAP   the camera rises over the whole record. Drag to spin it like a DJ, point at a sleeve to read
           its name, click one to drop the needle there.

   There is no window and no frame: the canvas is 100vw x 100vh and the HTML is only a thin layer of
   liner notes on top of it.
   ===================================================================== */
import * as THREE from 'three';
import { SITE, TRACKS, pad2, sideName, openLabel, openUrl } from './content.js';
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
  a.innerHTML = `<span class="n">${pad2(i + 1)}</span><span class="t">${tr.name}</span><i class="lead"></i><span class="d">${tr.time}</span><span class="sub">${tr.hook}</span>`;
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
    <div class="c-head"><span>${pad2(i + 1)} / 19</span><span class="tag ${tr.side === 'A' ? 'live' : ''}">${sideName(tr)} · ${tr.side === 'A' ? 'SIDE A' : 'SIDE B'}</span></div>
    <h2 class="c-title"><span>${tr.name}</span><i class="lead"></i><time>${tr.time}</time></h2>
    <p class="c-hook">${tr.hook}</p>
    <p class="c-you">${tr.you}</p>
    <div class="row"><b>PLAYERS</b><i class="lead"></i><span>${tr.who}</span></div>
    <div class="row"><b>STATUS</b><i class="lead"></i><span>${tr.side === 'A' ? 'Open now, in your browser' : 'A playable sketch, still being finished'}</span></div>
    <div class="row like"><b>TRY NEXT</b><i class="lead"></i><button type="button" data-like="${nx.i}">${nx.name}</button></div>
    <div class="c-act"><button type="button" class="nav" data-step="-1" aria-label="Previous track" ${i === 0 ? 'disabled' : ''}>←</button>
      <a class="open ${tr.pending ? 'pending' : ''}" href="${openUrl(tr)}" data-slug="${tr.slug}"><span>${openLabel(tr)}</span><span aria-hidden="true">${tr.pending ? '' : '↗'}</span></a>
      <button type="button" class="nav" data-step="1" aria-label="Next track" ${i === N - 1 ? 'disabled' : ''}>→</button></div>`;
  els.card.classList.remove('swap'); void els.card.offsetWidth; els.card.classList.add('swap');
}

/* =====================================================================
   2. STATE + THE GEOMETRY OF THE GROOVE
   ===================================================================== */
const S = { mode: 'map', cur: 0, last: 0, tT: 0, hov: -1, interacted: false, indexOpen: false, pokes: 0, spin: 0.9, spinV: 0, drift: true, reduced: REDUCED };
const tS = new Spring(0, 62, .93), rotS = new Spring(S.spin + (REDUCED ? 0 : -TAU * .85), 26, 1), mapS = new Spring(0, 34, 1);
const camS = [new Spring(0, 36, .95), new Spring(60, 36, .95), new Spring(120, 36, .95)], lookS = [new Spring(0, 40, .95), new Spring(0, 40, .95), new Spring(0, 40, .95)];
const offS = [new Spring(0, 44, 1), new Spring(0, 44, 1)], parS = [new Spring(0, 30, 1), new Spring(0, 30, 1)];

/* the spiral: radius shrinks linearly with angle travelled; stations are spaced by arc length, with a run-out gap between sides */
const SP = { R0: 35, a: 3.4, step: 8.5, gap: 7 };
const STA = (() => { const out = []; let phi = 0, s = 0; const dp = .0005;
  for (let k = 0; k < N; k++) { const want = k * SP.step + (k >= SIDE_A ? SP.gap : 0); while (s < want) { const r = SP.R0 - SP.a * phi; s += Math.hypot(r, SP.a) * dp; phi += dp; } out.push({ phi, r: SP.R0 - SP.a * phi, th: -phi }); }
  return out; })();
const polar = u => { u = clamp(u, 0, N - 1); const i = Math.floor(u), j = Math.min(N - 1, i + 1), f = u - i; return { r: lerp(STA[i].r, STA[j].r, f), th: lerp(STA[i].th, STA[j].th, f) }; };
const PLATE_W = 5, PLATE_H = 6.25, LIFT = 1.1, VFOV = 34;

/* =====================================================================
   3. THREE: renderer, scene, record, plates
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

function labelTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), C = 512;
  g.fillStyle = '#101011'; g.beginPath(); g.arc(C, C, 500, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(234,232,227,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(C, C, 496, 0, TAU); g.stroke(); g.lineWidth = 1.5; for (const r of [470, 420, 330]) { g.beginPath(); g.arc(C, C, r, 0, TAU); g.stroke(); }
  for (let k = 0; k < 120; k++) { const a = k / 120 * TAU, l = k % 5 ? 16 : 30; g.beginPath(); g.moveTo(C + Math.cos(a) * 470, C + Math.sin(a) * 470); g.lineTo(C + Math.cos(a) * (470 - l), C + Math.sin(a) * (470 - l)); g.stroke(); }
  for (let k = 0; k < N; k++) { const a = -Math.PI / 2 + k / N * TAU; g.fillStyle = k < SIDE_A ? ACC : 'rgba(234,232,227,.8)'; g.beginPath(); g.arc(C + Math.cos(a) * 380, C + Math.sin(a) * 380, k < SIDE_A ? 8 : 5, 0, TAU); g.fill(); }
  g.fillStyle = CHALK; g.textAlign = 'center'; g.font = '600 46px "IBM Plex Mono", monospace'; if ('letterSpacing' in g) g.letterSpacing = '14px';
  g.fillText('INDEPENDENTS', C, C - 96); g.font = '400 24px "IBM Plex Mono", monospace'; if ('letterSpacing' in g) g.letterSpacing = '9px'; g.fillStyle = 'rgba(234,232,227,.75)'; g.fillText('SCATTERED WORKS', C, C - 56);
  g.fillText('SIDE A · LIVE · 09', C, C + 86); g.fillText('SIDE B · ROADMAP · 10', C, C + 122); g.fillText('IND-LP-019 · 33⅓', C, C + 176);
  g.fillStyle = ACC; g.beginPath(); g.arc(C, C, 22, 0, TAU); g.fill(); g.fillStyle = '#101011'; g.beginPath(); g.arc(C, C, 6, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function shadowTexture() { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'), q = g.createRadialGradient(64, 32, 0, 64, 32, 62); q.addColorStop(0, 'rgba(0,0,0,.75)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 64); return new THREE.CanvasTexture(c); }

let discMat, arm, armHead, motes, pointsMat;
const lineMat = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: o < 1, opacity: o });

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(CARD, 1);
  /* the disc */
  discMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uSheen: { value: 1 }, uNear: { value: 30 }, uFar: { value: 120 }, uCard: { value: new THREE.Color(.082, .082, .086) } },
    vertexShader: `varying vec2 vL; varying vec3 vW; void main(){ vL = position.xy; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCam; uniform float uSheen,uNear,uFar; uniform vec3 uCard; varying vec2 vL; varying vec3 vW;
      void main(){ float r = length(vL); if(r>48.0) discard; float ang = atan(vL.y,vL.x);
        float gr = sin(r*52.0 + sin(ang*5.0)*0.03)*0.5+0.5; float fine = sin(r*210.0)*0.5+0.5;
        vec3 base = vec3(0.105,0.105,0.114) + vec3(0.016)*smoothstep(.35,.95,gr) + vec3(0.006)*fine;
        float wa = atan(vW.z,vW.x); float lobe = pow(max(0.0,cos(2.0*(wa-uSheen))),12.0); float rad = smoothstep(9.0,20.0,r)*smoothstep(48.0,38.0,r);
        base += vec3(0.085)*lobe*rad*(0.55+0.45*gr);
        float rim = smoothstep(46.6,47.2,r)*(1.0-smoothstep(47.2,47.9,r)); base += rim*0.34;
        float rim2 = smoothstep(45.2,45.5,r)*(1.0-smoothstep(45.5,45.9,r)); base += rim2*0.09;
        float run = smoothstep(.0,.22,abs(r-27.7)-.0); base -= (1.0-run)*0.018*0.0;
        float d = distance(vW,uCam); float f = smoothstep(uNear,uFar,d); gl_FragColor = vec4(mix(base,uCard,f),1.0); }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(48, 192), discMat); disc.rotation.x = -Math.PI / 2; rec.add(disc);
  const label = new THREE.Mesh(new THREE.CircleGeometry(9.6, 96), new THREE.MeshBasicMaterial({ map: labelTexture(), fog: false })); label.rotation.x = -Math.PI / 2; label.position.y = .04; rec.add(label);

  /* the groove path: solid for Side A, dashed for Side B, with the run-out gap between */
  const pt = phi => new THREE.Vector3((SP.R0 - SP.a * phi) * Math.cos(-phi), .06, (SP.R0 - SP.a * phi) * Math.sin(-phi));
  const ptsA = [], segB = [], pA1 = STA[SIDE_A - 1].phi + .1, pB0 = STA[SIDE_A].phi - .1, pEnd = STA[N - 1].phi + .5;
  for (let p = -.35; p <= pA1; p += .02) ptsA.push(pt(p)); rec.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsA), lineMat(CHALK, .55)));
  for (let p = pB0; p < pEnd; p += .05) { segB.push(pt(p), pt(Math.min(pEnd, p + .028))); } rec.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segB), lineMat(CHALK, .5)));
  const gapTicks = []; for (const p of [pA1 + .02, pB0 - .02]) { const a = pt(p), r = Math.hypot(a.x, a.z), th = Math.atan2(a.z, a.x); gapTicks.push(new THREE.Vector3((r - 1.4) * Math.cos(th), .06, (r - 1.4) * Math.sin(th)), new THREE.Vector3((r + 1.4) * Math.cos(th), .06, (r + 1.4) * Math.sin(th))); }
  rec.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gapTicks), lineMat(ACC, .9)));
  /* registration rings on the disc (concentric chalk hairlines) */
  for (const r of [47.9, 14.2, 11.1]) { const pts = []; for (let k = 0; k <= 160; k++) pts.push(new THREE.Vector3(Math.cos(k / 160 * TAU) * r, .05, Math.sin(k / 160 * TAU) * r)); rec.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(CHALK, r > 40 ? .35 : .22))); }

  /* the plates */
  const shTex = shadowTexture(), ringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 41 }, (_, k) => new THREE.Vector3(Math.cos(k / 40 * TAU) * .62, .05, Math.sin(k / 40 * TAU) * .62)));
  TRACKS.forEach((tr, i) => {
    const { r, th } = STA[i], grp = new THREE.Group(); grp.position.set(r * Math.cos(th), 0, r * Math.sin(th)); grp.rotation.y = Math.PI / 2 - th;
    const inner = new THREE.Group(); inner.position.y = LIFT + PLATE_H / 2; grp.add(inner);
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const g = cv.getContext('2d'), pv = makePreview(tr.slug, tr, i);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), mat); mesh.userData.i = i; inner.add(mesh); meshes.push(mesh);
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W + .5, PLATE_H + .5), new THREE.MeshBasicMaterial({ color: '#0e0e0f', fog: true })); bk.position.z = -.06; inner.add(bk);
    const bk2 = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W + .5, PLATE_H + .5), new THREE.MeshBasicMaterial({ color: '#202022', fog: true })); bk2.position.set(.18, -.12, -.12); inner.add(bk2);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.4), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: .8, depthWrite: false, fog: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .03, -.8); grp.add(sh);
    const post = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, LIFT, 0)]), lineMat(CHALK, .8)); grp.add(post);
    const ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: CHALK })); grp.add(ring);
    rec.add(grp);
    const p = { i, grp, inner, mesh, mat, ring, post, tex, cv, g, pv, lit: new Spring(.9, 60, 1), rise: new Spring(0, 60, .7), lean: [new Spring(0, 80, .8), new Spring(0, 80, .8)], scale: new Spring(1, 60, .85), age: 99, ptr: null };
    plates.push(p);
  });

  /* tonearm (world space) */
  arm = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: CHALK, transparent: true, opacity: .8 })); arm.frustumCulled = false; scene.add(arm);
  armHead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(.9, 3.2, .0)]), new THREE.LineBasicMaterial({ color: ACC })); armHead.frustumCulled = false; scene.add(armHead);

  /* chalk dust */
  const mp = new Float32Array(360 * 3); for (let i = 0; i < 360; i++) { mp[i * 3] = (Math.random() - .5) * 150; mp[i * 3 + 1] = Math.random() * 26 + .5; mp[i * 3 + 2] = (Math.random() - .5) * 150; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); pointsMat = new THREE.PointsMaterial({ color: CHALK, size: .16, transparent: true, opacity: .42, sizeAttenuation: true, depthWrite: false }); motes = new THREE.Points(mg, pointsMat); scene.add(motes);
}

/* =====================================================================
   4. LAYOUT — where on the screen the thing we look at should sit
   ===================================================================== */
const L = { W: 1, H: 1, phone: false, cx: .5, cy: .5, availW: 1, availH: 1 };
let dockH = 330;
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.phone = L.W <= 760;
  const walk = S.mode === 'walk';
  if (L.phone) {
    const top = 56;
    if (walk) { const h = L.H - dockH - top; L.cx = L.W / 2; L.cy = top + h / 2 + 4; L.availH = h * .96; L.availW = L.W * .86; }
    else { L.cx = L.W / 2; L.cy = L.H * .5; L.availH = L.H * .5; L.availW = L.W * 1.1; }
  } else {
    const narrow = L.W < 1100;
    if (walk) { L.cx = L.W * (narrow ? .33 : .37); L.cy = L.H * .5; L.availH = L.H * .7; L.availW = L.W * (narrow ? .34 : .36); }
    else { L.cx = L.W * (narrow ? .64 : .67); L.cy = L.H * .52; L.availH = L.H * .9; L.availW = L.W * (narrow ? .6 : .62); }
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
function setMode(m) {
  if (S.mode === m) return; S.mode = m; document.body.dataset.mode = m;
  if (m === 'map') { S.spin = rotS.x; S.spinV = 0; } else { const th = polar(S.tT).th; rotS.x += TAU * Math.round((th - rotS.x) / TAU); }
  layout(); sync();
}
function go(i, quiet) {
  i = clamp(Math.round(i), 0, N - 1); S.interacted = true; document.body.classList.add('used');
  S.tT = i; S.last = i; S.cur = i;
  if (S.mode !== 'walk') { if (!renderer) { sync(); return; } tS.snap(i); setMode('walk'); }
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
  const h = ray.intersectObjects(meshes, false)[0]; if (h) { const i = h.object.userData.i; hit = { i, u: h.uv.x, v: h.uv.y }; }
}
const plateXY = h => ({ x: h.u * PW, y: (1 - h.v) * PH });

canvas.addEventListener('pointerdown', e => {
  if (e.button > 0) return; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
  if (S.indexOpen) closeIndex();
  P.down = true; P.id = e.pointerId; P.x0 = P.x = P.lx = e.clientX; P.y0 = P.y = e.clientY; P.on = true; P.moved = false; P.axis = null; P.dist = 0; P.base = S.tT; P.t0 = performance.now(); P.samples = [[P.t0, 0]]; P.touch = e.pointerType !== 'mouse'; S.interacted = true; document.body.classList.add('used'); S.spinV = 0;
});
canvas.addEventListener('pointermove', e => {
  const lx = P.x; P.x = e.clientX; P.y = e.clientY; P.on = true; P.nx = e.clientX / L.W * 2 - 1; P.ny = e.clientY / L.H * 2 - 1; P.lx = lx;
  if (!P.down) return; const dx = e.clientX - P.x0, dy = e.clientY - P.y0;
  if (!P.moved && Math.hypot(dx, dy) > 8) { P.moved = true; P.axis = S.mode === 'walk' ? (Math.abs(dx) >= Math.abs(dy) * .9 ? 'x' : 'y') : 'x'; document.body.classList.add('dragging'); closeIndex(); }
  if (!P.moved) return;
  if (S.mode === 'walk') { const unit = L.phone ? L.W * .55 : L.W * .27, d = P.axis === 'x' ? dx : dy; P.dist = d; S.tT = clamp(P.base - d / unit, -.3, N - 1 + .3); const now = performance.now(); P.samples.push([now, -d / unit]); P.samples = P.samples.filter(s => now - s[0] < 140); }
  else { const mx = e.clientX - (P.lx ?? e.clientX); S.spin += mx * .0062; const now = performance.now(); P.samples.push([now, mx]); P.samples = P.samples.filter(s => now - s[0] < 120); }
});
function endDrag(e) {
  if (!P.down) return; P.down = false; document.body.classList.remove('dragging'); try { canvas.releasePointerCapture(P.id); } catch (_) { }
  if (P.moved) {
    if (S.mode === 'walk') { const now = performance.now(), s = P.samples.filter(q => now - q[0] < 140), v = s.length > 1 ? (s[s.length - 1][1] - s[0][1]) / Math.max(.03, (s[s.length - 1][0] - s[0][0]) / 1000) : 0; S.tT = clamp(Math.round(clamp(S.tT + clamp(v, -6, 6) * .14, P.base - 1, P.base + 1)), 0, N - 1); S.last = S.tT; }
    else { const now = performance.now(), s = P.samples.filter(q => now - q[0] < 120); const sum = s.reduce((a, q) => a + q[1], 0); S.spinV = clamp(sum / Math.max(.05, s.length ? (now - s[0][0]) / 1000 : .1) * .0062, -4, 4); }
    return;
  }
  /* a click, not a drag */
  pickPlate();
  if (hit) {
    if (S.mode === 'walk' && hit.i === S.cur) { const p = plateXY(hit); plates[hit.i].pv.poke(p.x, p.y); S.pokes++; plates[hit.i].age = 99; }
    else go(hit.i);
  } else if (S.mode === 'map') { /* empty click in map: nothing */ }
  else if (e && e.pointerType !== 'mouse') { /* tap on empty world in walk: nothing */ }
}
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', e => { if (!P.down) { P.on = false; hit = null; } });

let wheelAcc = 0, wheelT = 0, wheelCool = 0, overs = 0, wheelTm = 0;
addEventListener('wheel', e => {
  if (e.target.closest && e.target.closest('#index')) return; e.preventDefault(); if (e.ctrlKey) return;
  S.interacted = true; document.body.classList.add('used'); const now = performance.now(); let dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1); if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) dy = e.deltaX * (e.deltaMode === 1 ? 32 : 1);
  if (S.mode === 'map') { if (dy > 24 && now > wheelCool) { go(S.last); wheelCool = now + 600; } else if (Math.abs(dy) > 0) { S.spinV += clamp(dy, -80, 80) * -.0004; } return; }
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
const mapPose = () => { const ppu = Math.min(L.availW / 98, L.availH / 70), D = L.H / (2 * Math.tan(VFOV * Math.PI / 360) * ppu), p = 50 * Math.PI / 180; return { pos: [0, Math.sin(p) * D, Math.cos(p) * D], look: [0, 0, 0], D }; };
function walkPose(u) {
  const { r } = polar(u), plateCy = LIFT + PLATE_H / 2, hpx = Math.min(L.availH, L.availW * PLATE_H / PLATE_W), ppu = hpx / PLATE_H;
  const D = L.H / (2 * Math.tan(VFOV * Math.PI / 360) * ppu), camY = plateCy + D * .4;
  return { pos: [r + D, camY, 0], look: [r, plateCy, 0], D };
}

let auto = true;
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; if (auto) tick(dt, true); }
function tick(dt, draw) {
  if (!renderer) return; clock += dt;
  /* --- inertia + idle drift of the record in MAP mode --- */
  if (S.mode === 'map' && !P.down) { S.spin += S.spinV * dt; S.spinV *= Math.pow(.04, dt); if (!S.interacted && !REDUCED && clock > 1.5) S.spin += dt * .035; else if (!REDUCED && Math.abs(S.spinV) < .02) S.spin += dt * .012; }
  /* --- travel --- */
  tS.t = S.tT; tS.step(dt); const u = clamp(tS.x, 0, N - 1); if (S.mode === 'walk') { const c = clamp(Math.round(S.tT), 0, N - 1); if (c !== S.cur) { S.cur = c; S.last = c; sync(); } }
  const walk = S.mode === 'walk'; mapS.t = walk ? 0 : 1; mapS.step(dt); const m = clamp(mapS.x, 0, 1);
  const wp = walkPose(u), mp = mapPose(), tgtPos = walk ? wp.pos : mp.pos, tgtLook = walk ? wp.look : mp.look;
  for (let k = 0; k < 3; k++) { camS[k].t = tgtPos[k]; lookS[k].t = tgtLook[k]; camS[k].step(dt); lookS[k].step(dt); }
  offS[0].t = L.cx - L.W / 2; offS[1].t = L.cy - L.H / 2; offS[0].step(dt); offS[1].step(dt);
  parS[0].t = P.nx * (walk ? 1.25 : 3.5); parS[1].t = P.ny * (walk ? .55 : 1.8); parS[0].step(dt); parS[1].step(dt);
  rotS.t = walk ? polar(u).th : S.spin; if (walk) { rotS.k0 = 120; } else rotS.k0 = 26; rotS.step(dt); rec.rotation.y = rotS.x;
  V.cam.set(camS[0].x, camS[1].x, camS[2].x); V.look.set(lookS[0].x, lookS[1].x, lookS[2].x);
  const pz = parS[0].x * (walk ? 1 : 1), py = parS[1].x; V.cam.z += pz * (1 - m) + pz * m * .6; V.cam.y += -py * .8; if (m > .5) V.cam.x += pz * .3;
  camera.position.copy(V.cam); camera.lookAt(V.look);
  camera.setViewOffset(L.W, L.H, -offS[0].x, -offS[1].x, L.W, L.H); camera.updateProjectionMatrix();
  const dist = V.cam.distanceTo(V.look); scene.fog.near = dist * 1.15; scene.fog.far = dist * (walk ? 5.2 : 3.4); discMat.uniforms.uNear.value = scene.fog.near; discMat.uniforms.uFar.value = scene.fog.far; discMat.uniforms.uCam.value.copy(V.cam); discMat.uniforms.uSheen.value = .85 + P.nx * .45 + Math.sin(clock * .12) * .08;
  rec.updateMatrixWorld(true);

  /* --- hover / pick --- */
  pickPlate(); const hv = hit ? hit.i : -1; S.hov = hv; document.body.classList.toggle('hot', hv >= 0 && !P.down);
  /* --- plates --- */
  const mapScale = 1 + m * .55;
  plates.forEach((p, i) => {
    const isCur = walk && i === S.cur, isHov = hv === i;
    p.lit.t = walk ? (isCur ? 1 : .36) : (isHov ? 1.08 : .88); p.lit.step(dt); p.mat.color.setScalar(clamp(p.lit.x, 0, 1.2));
    p.rise.t = isCur ? 1 : (!walk && isHov ? 1 : 0); p.rise.step(dt); p.scale.t = (walk ? 1 : mapScale) * (1 + (isHov && !walk ? .12 : 0)); p.scale.step(dt);
    p.grp.scale.setScalar(p.scale.x); p.inner.position.y = LIFT + PLATE_H / 2 + p.rise.x * (walk ? .35 : 0) + (isHov && !walk ? .6 : 0);
    /* lean toward the pointer, like a card you hold */
    let lx = 0, ly = 0; if (hit && hit.i === i) { lx = (hit.u - .5) * -.14; ly = (hit.v - .5) * .1; } p.lean[0].t = lx; p.lean[1].t = ly; p.lean[0].step(dt); p.lean[1].step(dt); const wp0 = V.tmp.setFromMatrixPosition(p.grp.matrixWorld); let face = Math.atan2(V.cam.x - wp0.x, V.cam.z - wp0.z) - (rec.rotation.y + p.grp.rotation.y); face = Math.atan2(Math.sin(face), Math.cos(face));
    p.inner.rotation.y = p.lean[0].x + face * m; p.inner.rotation.x = -p.lean[1].x - .62 * m;
    p.ring.material.color.set(i === S.last ? ACC : CHALK); p.ring.scale.setScalar(i === S.last ? 1.18 + Math.sin(clock * 3) * .06 : 1); p.post.material.color.set(i === S.last ? ACC : CHALK);
  });
  /* --- redraw textures: the focused plate often, the rest by turns --- */
  let budget = 3; const order = plates.map(p => p.i).sort((a, b) => (lastDraw[a] - lastDraw[b]));
  const want = i => { if (walk) { const d = Math.abs(i - S.cur); return d === 0 ? 1 / 30 : d <= 2 ? 1 / 8 : 1 / 2; } return 1 / 6; };
  for (const i of order) { if (budget <= 0) break; const p = plates[i]; if (clock - lastDraw[i] < want(i)) continue; const ptr = (hit && hit.i === i) ? plateXY(hit) : null; const dtp = lastDraw[i] < 0 ? 1 / 30 : clock - lastDraw[i]; p.pv.draw(p.g, clock, dtp, ptr); p.tex.needsUpdate = true; lastDraw[i] = clock; budget--; }
  /* --- tonearm: its head sits on the groove under the last track you touched --- */
  { const hp = plates[S.last].grp.position.clone().setY(.1); rec.localToWorld(hp); const pv = V.tmp.set(64, 1.4, -30), c = V.tmp2.set((pv.x + hp.x) / 2 + 6, 6, (pv.z + hp.z) / 2 - 8); const a = arm.geometry.attributes.position; for (let k = 0; k < a.count; k++) { const s = k / (a.count - 1), q = 1 - s; a.setXYZ(k, q * q * pv.x + 2 * q * s * c.x + s * s * hp.x, q * q * pv.y + 2 * q * s * c.y + s * s * hp.y, q * q * pv.z + 2 * q * s * c.z + s * s * hp.z); } a.needsUpdate = true; armHead.position.copy(hp); armHead.rotation.y = Math.atan2(pv.x - hp.x, pv.z - hp.z) + .6; arm.material.opacity = .25 + .65 * m; armHead.material.opacity = 1; }
  motes.rotation.y += dt * .01; motes.position.x = -P.nx * 1.2; pointsMat.opacity = .3 + .12 * Math.sin(clock * .5);
  /* --- map tooltip --- */
  if (!walk && hv >= 0) { const p = plates[hv], v = new THREE.Vector3(0, LIFT + PLATE_H + 1, 0); p.grp.localToWorld(v); v.project(camera); const sx = (v.x * .5 + .5) * L.W, sy = (-v.y * .5 + .5) * L.H; els.tip.textContent = `${pad2(hv + 1)}  ${TRACKS[hv].name} · ${sideName(TRACKS[hv])}`; els.tip.style.left = sx + 'px'; els.tip.style.top = sy + 'px'; els.tip.classList.add('on'); } else els.tip.classList.remove('on');
  if (draw) renderer.render(scene, camera); firstFrames++;
}

/* =====================================================================
   8. BOOT + the test hooks
   ===================================================================== */
if (renderer) { resize(); sync(); requestAnimationFrame(frame); } else { sync(); }
const hint = $('#coverHint'); if (matchMedia('(pointer: coarse)').matches) { hint.textContent = 'Swipe to turn the record, then tap a plate.'; $('#hintline').innerHTML = 'SWIPE TO TRAVEL<br>TAP THE PLATE TO PLAY'; }
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
const projectPlate = i => { const p = plates[i], v = new THREE.Vector3(0, LIFT + PLATE_H / 2, 0); p.grp.localToWorld(v); v.project(camera); const a = new THREE.Vector3(-PLATE_W / 2, LIFT + PLATE_H / 2, 0), b = new THREE.Vector3(PLATE_W / 2, LIFT + PLATE_H / 2, 0); p.grp.localToWorld(a); p.grp.localToWorld(b); a.project(camera); b.project(camera); return { x: (v.x * .5 + .5) * L.W, y: (-v.y * .5 + .5) * L.H, w: Math.abs(b.x - a.x) * .5 * L.W }; };
window.__independents = {
  ready: true, TRACKS, N, probe, go, toMap, next, prev, openIndex, closeIndex, openCurrent, projectPlate,
  state: () => ({ energy: [tS, rotS, mapS, ...camS, ...lookS, ...offS].reduce((a, q) => a + Math.abs(q.v) + Math.abs(q.x - q.t), 0), mode: S.mode, cur: S.cur, last: S.last, t: tS.x, tT: S.tT, rot: rotS.x, spin: S.spin, hov: S.hov, indexOpen: S.indexOpen, pokes: S.pokes, frames: firstFrames, gl: !!renderer, layout: { ...L }, cam: [camS[0].x, camS[1].x, camS[2].x], off: [offS[0].x, offS[1].x] }),
  setAuto: b => { auto = !!b; last = performance.now(); },
  stepSim: (n = 60, dt = 1 / 60, draw = true) => { for (let k = 0; k < n; k++) tick(dt, draw && k === n - 1); },
  energyParts: () => ({ tS: [tS.x, tS.t], rotS: [rotS.x, rotS.t], mapS: [mapS.x, mapS.t], cam: camS.map(q => [q.x, q.t]), look: lookS.map(q => [q.x, q.t]), off: offS.map(q => [q.x, q.t]) }),
};
