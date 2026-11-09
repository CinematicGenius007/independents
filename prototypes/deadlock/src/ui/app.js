/* App: state, transport, film strip, drag-and-drop tokens, modes, persistence.
 * The plan (list of {tick,kind,cart}) is the only game state the player owns;
 * everything on screen is Engine.replay(level, plan) drawn by Board. */
const App = (() => {
  const E = Engine, C = Clay;
  const $ = (s, r = document) => r.querySelector(s);
  const A = {
    seed: 'CLAY', rung: 0, level: null, analysis: null, plan: [], rep: null, tf: 0, playing: false, until: null,
    mode: 'player', demo: null, started: false, lastSave: -1, huh: null, hover: null, drag: null, speed: 1,
    certMs: null, certState: 'idle', progress: {}, hooks: [],
  };
  const LS = 'deadlock.clay.v1';
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } },
    save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch { /* private mode */ } },
  };
  const saved = store.load();
  A.progress = saved.won || {};
  A.seenDemo = !!saved.seenDemo;

  let board, overlay, handPiece;
  const els = {};
  A.els = els;

  const emit = (type, data) => { A.hooks.forEach((h) => h(type, data)); };
  A.on = (fn) => { A.hooks.push(fn); };
  const say = (s) => { const n = $('#sr'); if (n) n.textContent = s; };

  /* ---------- level + run ---------- */
  A.loadLevel = (level, o = {}) => {
    A.level = level; A.plan = []; A.tf = 0; A.playing = false; A.until = null; A.huh = null; A.lastSave = -1; A.isDemo = !!o.demo;
    board.setLevel(level);
    A.analysis = null; A.certState = 'idle';
    A.recalc();
    buildTray(); renderFilm(); renderTrail(); syncButtons();
    certifyAsync(level);
    emit('loaded', level);
  };
  A.recalc = () => {
    A.rep = E.replay(A.level, A.plan);
    board.setRun(A.rep);
    A.tf = Math.min(A.tf, A.rep.frames.length - 1);
    A.lastSave = A.rep.status === 1 ? A.rep.frames.length - 1 : -1;
    if (A.rep.status !== 1) setTimeout(() => { if (A.rep) { A.lastSave = E.lastSaveTick(A.level, A.rep); renderFilm(); } }, 30);
  };
  A.nFrames = () => A.rep.frames.length;
  A.atEnd = () => A.tf >= A.nFrames() - 1 - 1e-6;
  A.frame = () => A.rep.frames[Math.min(A.nFrames() - 1, Math.round(A.tf))];

  A.play = () => {
    if (A.atEnd()) A.tf = 0;
    A.playing = true; A.until = null; syncButtons(); emit('play');
  };
  A.pause = () => { A.playing = false; A.until = null; syncButtons(); };
  A.rewind = () => { A.playing = false; A.until = null; A.tf = 0; syncButtons(); renderFilm(); emit('rewound'); say('Back at the start.'); };
  A.scrub = (T) => { A.playing = false; A.until = null; A.tf = Math.max(0, Math.min(A.nFrames() - 1, T)); syncButtons(); renderFilm(); emit('scrub', A.tf); };
  A.resetPlan = () => { A.plan = []; A.recalc(); A.tf = 0; A.playing = false; buildTray(); renderFilm(); syncButtons(); emit('reset'); };
  A.tokensLeft = (kind) => A.level.budget[kind] - A.plan.filter((a) => a.kind === kind).length;

  // Try to place a token on a cart at the current frame. Returns {ok, reason}.
  A.tryDrop = (kind, ci) => {
    const T = Math.round(A.tf);
    A.tf = T; A.playing = false;
    if (A.tokensLeft(kind) <= 0) return { ok: false, reason: 'none-left' };
    const cart = A.level.carts[ci];
    const f = A.rep.frames[T];
    const ok = f.status === 0 && E.canDo(A.level, f, kind, cart.id);
    if (!ok) {
      const holder = f.carts[ci].held.length ? ci : -1;
      A.huh = { cart: ci, since: now(), look: { x: 0, y: -0.6 } };
      say(kind === 'loan' ? 'That cart is not blocking anyone.' : 'That cart cannot be held now.');
      emit('rejected', { kind, cart: ci });
      return { ok: false, reason: 'no-effect' };
    }
    A.plan.push({ tick: T, kind, cart: cart.id });
    A.recalc();
    A.until = T + 1; A.playing = true;
    buildTray(); renderFilm(); syncButtons();
    emit('dropped', { kind, cart: ci, tick: T });
    return { ok: true };
  };
  A.setPlan = (plan) => { A.plan = plan; A.recalc(); A.tf = 0; A.playing = false; A.until = null; buildTray(); renderFilm(); syncButtons(); emit('planset'); };
  A.removeAction = (idx) => { A.plan.splice(idx, 1); A.recalc(); buildTray(); renderFilm(); emit('removed'); };

  /* ---------- time ---------- */
  const now = () => performance.now() / 1000;
  let lastWall = 0, lastDrawn = -1, endAnnounced = null;
  function loop(ms) {
    const t = ms / 1000;
    const f12 = Math.floor(t * 12);
    if (f12 !== lastDrawn) {
      const dt = Math.min(0.2, t - lastWall); lastWall = t; lastDrawn = f12;
      if (A.playing && A.rep) {
        A.tf += (dt / Board.SEC) * A.speed;
        const stop = A.until != null ? Math.min(A.until, A.nFrames() - 1) : A.nFrames() - 1;
        if (A.tf >= stop) {
          A.tf = stop; A.playing = false; A.until = null; syncButtons(); renderFilm();
          if (stop >= A.nFrames() - 1) onEnd();
        } else if (Math.floor(A.tf) !== A._lastT) renderFilm();
      }
      A._lastT = Math.floor(A.tf);
      if (A.rep && board.level) {
        board.draw(A.tf, { t, dev: A.mode === 'dev', huh: A.huh, hover: A.hover });
        drawHover();
        if (A.demo && A.demo.frame) A.demo.frame(t);
        if (A.mode === 'dev' && A._devT !== Math.floor(A.tf) + ':' + A.plan.length + ':' + A.certState) { A._devT = Math.floor(A.tf) + ':' + A.plan.length + ':' + A.certState; Dev.render(A); }
      }
    }
    requestAnimationFrame(loop);
  }
  function onEnd() {
    const st = A.rep.status;
    const used = A.plan.length;
    if (st === 1) {
      const key = `${A.seed}:${A.rung}`;
      if (!A.isDemo) {
        const par = A.analysis ? A.analysis.par : used;
        A.progress[key] = used <= par ? 3 : 2;
        store.save({ ...saved, won: A.progress, seenDemo: A.seenDemo });
        renderTrail();
      }
      say('Everyone made it home.');
    } else say(['', '', 'Frozen: a loop of waiting.', 'Stuck in a polite loop.', 'Too late.'][st] || '');
    emit('end', { status: st });
  }

  /* ---------- hover ring while dragging ---------- */
  function drawHover() {
    const g = board.gFx; let n = g.querySelector('.hover');
    if (A.hover == null) { if (n) n.remove(); return; }
    const p = board.lastPos && board.lastPos[A.hover]; if (!p) return;
    if (!n) { n = C.S('ellipse', { class: 'hover', fill: 'none', stroke: '#fff', 'stroke-width': 6, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round', opacity: 0.95 }); g.appendChild(n); }
    C.attr(n, { cx: p.x, cy: p.y - 56 * board.scale, rx: 90 * board.scale, ry: 82 * board.scale, 'stroke-dashoffset': (C.frame(now()) * 3) % 14 });
  }

  /* ---------- tray (tokens) ---------- */
  function tokenSvg(kind) {
    const svg = C.S('svg', { viewBox: '-70 -70 140 110', width: 96, height: 76 });
    const piece = kind === 'hold' ? C.createChock() : C.createTicket();
    piece.set({ x: 0, y: kind === 'hold' ? 20 : -10, s: kind === 'hold' ? 1.5 : 1.5, rot: kind === 'hold' ? 0 : -8, sparkle: kind === 'loan', t: 0 });
    svg.appendChild(piece.el);
    return svg;
  }
  function buildTray() {
    const tray = els.tray; tray.replaceChildren();
    ['hold', 'loan'].forEach((kind) => {
      const total = A.level.budget[kind];
      for (let i = 0; i < total; i += 1) {
        const used = i >= A.tokensLeft(kind);
        const b = document.createElement('button');
        b.className = `tok ${kind}${used ? ' used' : ''}`;
        b.dataset.kind = kind; b.setAttribute('aria-label', kind === 'hold' ? 'chock' : 'golden ticket');
        if (!used) b.appendChild(tokenSvg(kind));
        else b.appendChild(tokenSvg(kind));
        if (!used) b.addEventListener('pointerdown', (e) => startDrag(e, kind, b));
        tray.appendChild(b);
      }
    });
  }

  /* ---------- drag and drop ---------- */
  function startDrag(e, kind, btn) {
    e.preventDefault();
    if (A.demo && A.demo.allowDrag && !A.demo.allowDrag(kind)) return;
    A.pause(); A.tf = Math.round(A.tf);
    const piece = kind === 'hold' ? C.createChock() : C.createTicket();
    board.gDrag.appendChild(piece.el);
    A.drag = { kind, piece, btn };
    btn.classList.add('lifted');
    btn.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const w = board.toWorld(ev.clientX, ev.clientY);
      A.drag.w = w;
      const hit = board.hit(w.x, w.y);
      A.hover = hit;
      piece.set({ x: w.x, y: w.y, s: 1.5, rot: kind === 'hold' ? -6 : -12, sparkle: kind === 'loan', t: now(), squash: 0 });
    };
    const up = (ev) => {
      btn.releasePointerCapture(e.pointerId);
      btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up);
      const w = A.drag.w; const hit = w ? board.hit(w.x, w.y) : null;
      piece.el.remove(); btn.classList.remove('lifted'); A.hover = null; A.drag = null;
      if (hit != null && w) { const r = A.tryDrop(kind, hit); if (!r.ok) buildTray(); } else emit('dropped-nowhere', { kind });
    };
    btn.addEventListener('pointermove', move); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    move(e);
  }

  /* ---------- film strip ---------- */
  const ICON = {
    hold: '<svg viewBox="-12 -12 24 24"><path d="M-9,5 L-9,-1 L8,-8 Q10,-8 10,-5 L10,5Z" fill="#f0553f" stroke="#9b2a1c" stroke-width="1.5"/></svg>',
    loan: '<svg viewBox="-12 -12 24 24"><rect x="-10" y="-6" width="20" height="12" rx="2" fill="#f7c531" stroke="#c68a0b" stroke-width="1.5"/><path d="M0,-4 L1.3,-0.8 4.7,-0.6 2,1.5 3,4.8 0,2.8 -3,4.8 -2,1.5 -4.7,-0.6 -1.3,-0.8Z" fill="#fff6bb"/></svg>',
    won: '<svg viewBox="-12 -12 24 24"><path d="M0,-10 L3,-3 10,-3 4.5,2 6.5,9 0,5 -6.5,9 -4.5,2 -10,-3 -3,-3Z" fill="#f7c531" stroke="#c68a0b" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    deadlock: '<svg viewBox="-12 -12 24 24"><g stroke="#2f74b4" stroke-width="2.4" stroke-linecap="round"><path d="M0,-9 V9 M-8,-4.5 L8,4.5 M-8,4.5 L8,-4.5"/></g></svg>',
    livelock: '<svg viewBox="-12 -12 24 24"><path d="M-8,-2 A8,8 0 0 1 6,-6 M8,2 A8,8 0 0 1 -6,6" fill="none" stroke="#8f5ad6" stroke-width="2.6" stroke-linecap="round"/><path d="M6,-9 L7,-4 L2,-5Z M-6,9 L-7,4 L-2,5Z" fill="#8f5ad6"/></svg>',
    missed: '<svg viewBox="-12 -12 24 24"><path d="M0,-3 Q6,-9 0,-11 Q-6,-9 0,-3Z" fill="#ff9a2a"/><rect x="-3.5" y="-3" width="7" height="12" rx="2" fill="#fff3d4" stroke="#c9b27a" stroke-width="1.2"/></svg>',
  };
  function renderFilm() {
    if (!A.rep) return;
    const film = els.film; const n = A.nFrames(); const cells = Math.max(n, 14);
    const T = Math.round(A.tf);
    const st = A.rep.status;
    let html = '';
    for (let i = 0; i < cells; i += 1) {
      const real = i < n;
      const acts = A.plan.map((a, idx) => ({ ...a, idx })).filter((a) => a.tick === i);
      const cls = ['cell', real ? '' : 'blank', i === T && real ? 'now' : '', real && st !== 1 && st !== 0 && i <= A.lastSave ? 'open' : '', real && i === n - 1 ? `end end-${st}` : ''].join(' ');
      const endIcon = real && i === n - 1 ? ICON[['', 'won', 'deadlock', 'livelock', 'missed'][st]] || '' : '';
      html += `<div class="${cls}" data-t="${i}">${acts.map((a) => `<b class="mk ${a.kind}" data-idx="${a.idx}">${ICON[a.kind]}</b>`).join('')}${endIcon ? `<i class="endi">${endIcon}</i>` : ''}</div>`;
    }
    film.innerHTML = html;
    const now = film.querySelector('.now');
    if (now && film.scrollWidth > film.clientWidth) now.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function bindFilm() {
    const film = els.film;
    const at = (x) => { const r = film.getBoundingClientRect(); const cells = film.children.length; const w = film.scrollWidth; return Math.max(0, Math.min(A.nFrames() - 1, Math.floor(((x - r.left + film.scrollLeft) / w) * cells))); };
    let down = false;
    film.addEventListener('pointerdown', (e) => {
      const mk = e.target.closest('.mk');
      if (mk) { A.removeAction(+mk.dataset.idx); return; }
      down = true; film.setPointerCapture(e.pointerId); A.scrub(at(e.clientX));
    });
    film.addEventListener('pointermove', (e) => { if (down) A.scrub(at(e.clientX)); });
    film.addEventListener('pointerup', () => { down = false; });
    film.addEventListener('pointercancel', () => { down = false; });
  }

  /* ---------- transport buttons ---------- */
  function syncButtons() {
    if (!els.play) return;
    els.play.classList.toggle('on', A.playing);
    els.play.dataset.state = A.playing ? 'pause' : 'play';
    els.play.setAttribute('aria-label', A.playing ? 'pause' : 'play');
  }

  /* ---------- trail (level stones) ---------- */
  function unlocked() { let m = 0; for (let r = 0; r < E.LADDER.length; r += 1) if (A.progress[`${A.seed}:${r}`]) m = r + 1; return m; }
  function renderTrail() {
    const t = els.trail; if (!t) return; t.replaceChildren();
    const maxR = A.mode === 'dev' ? E.LADDER.length - 1 : Math.min(E.LADDER.length - 1, unlocked());
    for (let r = 0; r < E.LADDER.length; r += 1) {
      const b = document.createElement('button');
      const won = A.progress[`${A.seed}:${r}`];
      b.className = `stone${r === A.rung ? ' here' : ''}${won ? ' won' : ''}${r > maxR ? ' locked' : ''}`;
      b.textContent = r + 1; b.disabled = r > maxR; b.setAttribute('aria-label', `board ${r + 1}`);
      if (won) b.innerHTML = `${r + 1}<s>${'★'.repeat(won)}</s>`;
      b.addEventListener('click', () => A.go(r));
      t.appendChild(b);
    }
    const here = t.querySelector('.here'); if (here) here.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  A.go = (rung, seed) => {
    if (A.demo && A.demo.active) A.demo.stop();
    if (seed != null) A.seed = String(seed).trim().toUpperCase() || 'CLAY';
    A.rung = Math.max(0, Math.min(E.LADDER.length - 1, rung));
    const g = E.levelFor(A.seed, A.rung);
    if (!g.ok) { say('Could not build that board.'); return; }
    A.loadLevel(g.level);
    A.analysis = g.report;
    syncHash();
  };
  A.next = () => A.go(A.rung + 1);

  /* ---------- certify (worker with sync fallback) ---------- */
  let worker = null;
  function certifyAsync(level) {
    A.certState = 'working'; A.certMs = null;
    const done = (m, ms, viaWorker) => { if (A.level !== level) return; A.analysis = m; A.certMs = ms; A.certState = viaWorker ? 'worker' : 'main'; A._devT = ''; emit('certified', m); };
    try {
      if (!worker) {
        const src = document.getElementById('engine-src').textContent;
        worker = new Worker(URL.createObjectURL(new Blob([`${src}\nonmessage=(e)=>{const t=performance.now();const m=Engine.measure(e.data.level);postMessage({id:e.data.id,m,ms:performance.now()-t});};`], { type: 'text/javascript' })));
      }
      const id = (certifyAsync.n = (certifyAsync.n || 0) + 1);
      worker.onmessage = (e) => { if (e.data.id === certifyAsync.n) done(e.data.m, e.data.ms, true); };
      worker.onerror = () => { worker = null; syncCert(level, done); };
      worker.postMessage({ id, level: JSON.parse(JSON.stringify(level)) });
    } catch { syncCert(level, done); }
  }
  function syncCert(level, done) { const t = performance.now(); const m = E.measure(level); done(m, performance.now() - t, false); }

  /* ---------- hash / share ---------- */
  function syncHash() {
    const h = `#s=${encodeURIComponent(A.seed)}&r=${A.rung}${A.mode === 'dev' ? '&dev=1' : ''}`;
    try { history.replaceState(null, '', h); } catch { /* file:// quirks */ }
  }
  A.shareLink = () => location.href.split('#')[0] + `#s=${encodeURIComponent(A.seed)}&r=${A.rung}&dev=1`;
  function parseHash() {
    const o = {}; (location.hash || '').replace(/^#/, '').split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) o[k] = decodeURIComponent(v || ''); });
    return o;
  }

  /* ---------- modes ---------- */
  A.setMode = (m) => {
    A.mode = m; $('#app').dataset.mode = m; A._devT = '';
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    renderTrail(); syncHash();
    if (m === 'dev') Dev.render(A);
  };

  /* ---------- boot ---------- */
  A.boot = () => {
    document.querySelectorAll('svg.defsHost').forEach((s) => s.replaceChildren(C.defs()));
    board = Board.create($('#board')); A.board = board;
    els.tray = $('#tray'); els.film = $('#film'); els.play = $('#btn-play'); els.rewind = $('#btn-rewind'); els.reset = $('#btn-reset'); els.trail = $('#trail');
    els.help = $('#btn-help'); els.skip = $('#btn-skip');
    els.play.addEventListener('click', () => (A.playing ? A.pause() : A.play()));
    els.rewind.addEventListener('click', () => A.rewind());
    els.reset.addEventListener('click', () => A.resetPlan());
    document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => A.setMode(b.dataset.mode)));
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); A.playing ? A.pause() : A.play(); }
      else if (e.key === 'ArrowRight') A.scrub(Math.round(A.tf) + 1);
      else if (e.key === 'ArrowLeft') A.scrub(Math.round(A.tf) - 1);
      else if (e.key === 'Home') A.rewind();
      else if (e.key.toLowerCase() === 'd') A.setMode(A.mode === 'dev' ? 'player' : 'dev');
    });
    bindFilm();
    els.help.addEventListener('click', () => Demo.start(A));
    els.skip.addEventListener('click', () => { Demo.stop(); A.seenDemo = true; store.save({ ...saved, won: A.progress, seenDemo: true }); A.go(A.rung); });
    const h = parseHash();
    A.seed = (h.s || 'CLAY').toUpperCase();
    const startRung = Math.max(0, Math.min(E.LADDER.length - 1, +(h.r || 0) || 0));
    // cover: frozen ring behind the mode choice
    $('#cover').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      $('#cover').classList.add('gone'); A.started = true; A.setMode(b.dataset.pick);
      if (!A.seenDemo && b.dataset.pick === 'player' && !h.r) Demo.start(A); else A.go(startRung);
    }));
    A.go(startRung);
    // the cover shows the real engine's deadlock, frozen
    A.scrub(A.nFrames() - 1);
    if (A.rep.status === 0) A.tf = A.nFrames() - 1;
    A.setMode(h.dev ? 'dev' : 'player');
    if (h.r != null || h.dev) { /* deep link: skip the cover */ $('#cover').classList.add('gone'); A.started = true; if (h.dev) A.setMode('dev'); }
    requestAnimationFrame(loop);
    window.__app = A;
  };
  A.overlay = () => overlay;
  A.markSeenDemo = () => { A.seenDemo = true; store.save({ ...saved, won: A.progress, seenDemo: true }); };
  return A;
})();
