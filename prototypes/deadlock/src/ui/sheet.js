/* Specimen sheet: every piece, every state, looping. Uses only the art modules. */
(function () {
  const C = window.Clay, S = C.S;
  const defsHost = document.getElementById('shared-defs');
  defsHost.replaceWith(C.defs());
  const main = document.getElementById('sheet');
  const items = [];

  function section(title, note) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h2>${title}</h2>${note ? `<p>${note}</p>` : ''}<div class="grid"></div>`;
    main.appendChild(sec);
    return sec.querySelector('.grid');
  }
  // one stage = one little svg diorama tile with a caption
  function stage(grid, label, w, h, build) {
    const fig = document.createElement('figure');
    const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    svg.appendChild(S('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#plinth)' }));
    const g = S('g'); svg.appendChild(g);
    fig.appendChild(svg);
    const cap = document.createElement('figcaption'); cap.textContent = label; fig.appendChild(cap);
    grid.appendChild(fig);
    const upd = build(g);
    if (upd) items.push(upd);
  }

  // plinth gradient (stage floor)
  const pl = S('linearGradient', { id: 'plinth', x1: 0, y1: 0, x2: 0, y2: 1 }, S('stop', { offset: 0, 'stop-color': '#cfe6f1' }), S('stop', { offset: 0.62, 'stop-color': '#e6f0d2' }), S('stop', { offset: 0.63, 'stop-color': '#a9cc62' }), S('stop', { offset: 1, 'stop-color': '#86b24a' }));
  document.querySelector('svg defs').appendChild(pl);

  const D = (skin, o = {}) => { const d = C.Dollop.create({ skin }); return d; };
  const at = (d, g, x, y) => { g.appendChild(d.el); return d; };

  /* 1. the cast */
  let grid = section('The cast', 'Six Dollops. Colour is identity; the silhouette on top of the head backs it up. Eyes always do the talking.');
  const names = ['curl', 'bobbles', 'ears', 'sprout', 'spikes', 'bun'];
  for (let i = 0; i < 6; i += 1) stage(grid, `${C.SKINS[i].name} · ${names[i]}`, 220, 236, (g) => {
    const d = D(i); g.appendChild(d.el);
    return (t) => d.set({ ...C.Dollop.pose('idle', t, { seed: i }), x: 110, y: 196, s: 1.05 });
  });

  /* 2. faces */
  grid = section('Faces', 'Eyes, brows and mouth are the whole vocabulary: worry, shock, smug, shrug, delight.');
  const faces = [
    ['calm', { brow: 'neutral', mouth: 'smile' }], ['worried (waiting)', { brow: 'worried', mouth: 'flat', sweat: true }],
    ['shocked (frozen)', { brow: 'worried', mouth: 'wavy', steam: true, frost: 0.3 }], ['smug (hog)', { brow: 'smug', mouth: 'smirk', lid: 0.42 }],
    ['huh? (no effect)', { brow: 'confused', mouth: 'o', q: true, tilt: 12 }], ['delight (win)', { brow: 'happy', mouth: 'grin', sparkle: true }],
    ['sleepy (held)', { brow: 'sleepy', mouth: 'o', lid: 0.55, zzz: true }], ['dizzy (polite loop)', { brow: 'worried', mouth: 'wavy', dizzy: true, sweat: true }],
  ];
  faces.forEach(([label, p], i) => stage(grid, label, 220, 236, (g) => {
    const d = D(i % 6); g.appendChild(d.el);
    return (t) => d.set({ t, x: 110, y: 196, s: 1.05, look: { x: Math.sin(t * 1.3), y: 0.1 }, ...p });
  }));

  /* 3. motion clips */
  grid = section('Movement', 'Squash and stretch, anticipation before a move, a settle after it, a small hand-made boil on every frame.');
  const clip = (label, name, extra = {}) => stage(grid, label, 300, 236, (g) => {
    const d = D(extra.skin ?? 0); g.appendChild(d.el);
    return (t) => {
      const L = extra.loopLen || 100;
      const lt = t % (extra.period || 100);
      const o = { dir: 1, seed: 1, ...(extra.opts || {}) };
      let x = 150;
      if (extra.travel) {
        const per = extra.period; const k = (t % per) / per;
        // anticipation 0..0.3 holds still, then glides
        const m = k < 0.3 ? 0 : C.ease(Math.min(1, (k - 0.3) / 0.55));
        x = 70 + m * 160;
        o.dir = 1;
      }
      d.set({ ...C.Dollop.pose(name, extra.period ? lt : t, o), x, y: 196, s: 1 });
    };
  });
  clip('idle', 'idle'); clip('go: anticipate → launch → settle', 'go', { period: 2.0, travel: true });
  clip('roll', 'roll', { skin: 1 });
  clip('wait (blocked)', 'wait', { skin: 2 }); clip('bump', 'bump', { skin: 3, period: 1.6 });
  clip('freeze (deadlock)', 'freeze', { skin: 4, opts: { looks: [{ x: 1, y: 0 }, { x: -1, y: 0.2 }, { x: 0, y: -1 }] } });
  clip('polite dance (livelock)', 'dance', { skin: 5 }); clip('held (chock)', 'held');
  clip('VIP (ticket)', 'vip', { skin: 1 }); clip('hog (smug)', 'smug', { skin: 2 });
  clip('huh? (wrong target)', 'huh', { skin: 3, period: 2.2 }); clip('win', 'win', { skin: 4 });
  clip('stunned', 'stunned', { skin: 5 });

  /* 4. pads */
  grid = section('Pad (a section)', 'The mutex. The lamp turns the holder’s colour; the rim and inlay follow. Free pads stay green.');
  [-1, 0, 1, 2, 3, 4, 5].forEach((own) => stage(grid, own < 0 ? 'free' : `held · ${C.SKINS[own].name}`, 260, 190, (g) => {
    const p = C.createPad({ label: 'A' }); g.appendChild(p.el);
    return (t) => p.set({ owner: own, x: 120, y: 110, labels: false });
  }));

  /* 5. rails, huts, yarn */
  grid = section('Rail, hut, yarn', 'Rails link pads. A hut is a cart’s goal. Yarn is the wait: pink dashes = about to wait, slack red = waiting, taut red = nobody can move.');
  stage(grid, 'rail', 300, 200, (g) => { g.appendChild(C.createRail({ x: 30, y: 150 }, { x: 270, y: 60 }).el); });
  [0, 3].forEach((i) => stage(grid, `hut · ${C.SKINS[i].name}`, 240, 200, (g) => {
    const h = C.createHut(i, { clock: i === 3 }); g.appendChild(h.el);
    return (t) => h.set({ x: 120, y: 170, t, win: i === 3 ? (t % 2.4) / 1.6 : 0 });
  }));
  const yarnStage = (label, o) => stage(grid, label, 300, 200, (g) => {
    const a = D(0), b = D(2); const y = C.createYarn();
    g.append(a.el, b.el, y.el);
    return (t) => {
      a.set({ ...C.Dollop.pose(o.taut >= 1 ? 'freeze' : 'wait', t, { looks: [{ x: 1, y: 0 }] }), x: 70, y: 170, s: 0.8 });
      b.set({ ...C.Dollop.pose('idle', t, { seed: 2 }), x: 230, y: 170, s: 0.8 });
      y.set({ a: { x: 70, y: 100 }, b: { x: 230, y: 100 }, t, ...o });
    };
  });
  yarnStage('yarn · about to wait', { ghost: true, taut: 0.2 }); yarnStage('yarn · waiting (slack)', { taut: 0.35 }); yarnStage('yarn · taut', { taut: 1 });
  stage(grid, 'ring of yarn = deadlock', 300, 220, (g) => {
    const ds = [0, 1, 2].map((i) => D(i)); const P = [{ x: 150, y: 60 }, { x: 240, y: 160 }, { x: 60, y: 160 }];
    const ys = [0, 1, 2].map(() => C.createYarn());
    ys.forEach((y) => g.appendChild(y.el)); ds.forEach((d) => g.appendChild(d.el));
    return (t) => {
      ds.forEach((d, i) => d.set({ ...C.Dollop.pose('freeze', t, { looks: [{ x: i === 0 ? 1 : i === 1 ? -1 : 0, y: 0.3 }] }), x: P[i].x, y: P[i].y + 36, s: 0.6 }));
      ys.forEach((y, i) => y.set({ a: { x: P[i].x, y: P[i].y - 14 }, b: { x: P[(i + 1) % 3].x, y: P[(i + 1) % 3].y - 14 }, t, taut: 1, k: i }));
    };
  });

  /* 6. tokens */
  grid = section('Tokens', 'Two tools, two shapes. The wedge stops a cart; the golden ticket lends priority. Both carry a visible timer.');
  [1, 0.5, 0.15].forEach((f) => stage(grid, `chock · lease ${Math.round(f * 100)}%`, 220, 150, (g) => {
    const c = C.createChock(); g.appendChild(c.el); return (t) => c.set({ x: 110, y: 100, s: 1.6, frac: f });
  }));
  [1, 0.5, 0.15].forEach((f) => stage(grid, `ticket · lease ${Math.round(f * 100)}%`, 220, 150, (g) => {
    const k = C.createTicket(); g.appendChild(k.el); return (t) => k.set({ x: 110, y: 80 + Math.sin(C.snap(t) * 3) * 4, s: 1.5, frac: f, sparkle: true, t, rot: -6 });
  }));
  stage(grid, 'chock on a cart', 300, 236, (g) => {
    const d = D(0); const c = C.createChock({ small: true }); g.append(d.el, c.el);
    return (t) => { d.set({ ...C.Dollop.pose('held', t), x: 140, y: 196 }); c.set({ x: 202, y: 200, s: 1.1, frac: 0.7 }); };
  });
  stage(grid, 'ticket on the holder', 300, 236, (g) => {
    const d = D(4); g.append(d.el);
    return (t) => d.set({ ...C.Dollop.pose('vip', t), x: 150, y: 196, ticket: 0.66, stars: 3 });
  });

  /* 7. priority, deadline, sun */
  grid = section('Priority, deadline, sun', 'Stars on the pennant say who outranks whom. The candle melts toward a missed connection. The sun is the scheduler: it lights one cart at a time.');
  [1, 2, 3].forEach((n) => stage(grid, `${n} star${n > 1 ? 's' : ''}`, 220, 236, (g) => {
    const d = D(n); g.appendChild(d.el); return (t) => d.set({ ...C.Dollop.pose('idle', t, { seed: n }), x: 110, y: 196, stars: n });
  }));
  [1, 0.55, 0.15].forEach((f) => stage(grid, `candle · ${Math.round(f * 100)}% left`, 220, 236, (g) => {
    const d = D(2); g.appendChild(d.el); return (t) => d.set({ ...C.Dollop.pose('wait', t), x: 110, y: 196, candle: f });
  }));
  stage(grid, 'sun looks at the runner', 360, 230, (g) => {
    const s = C.createSun(); const a = D(0), b = D(1), m = D(2);
    g.append(a.el, b.el, m.el, s.el);
    return (t) => {
      const k = Math.floor(t / 1.6) % 3; const xs = [70, 180, 290];
      [a, b, m].forEach((d, i) => d.set({ ...C.Dollop.pose(i === k ? 'roll' : 'wait', t, { seed: i }), x: xs[i], y: 205, s: 0.62, stars: i + 1, look: { x: 0, y: -0.5 } }));
      s.set({ x: 180, y: 52, s: 0.9, t, target: { x: xs[k] - 180, y: 150 } });
    };
  });

  /* 8. little scenes */
  grid = section('Scenes', 'The three moments the game is about.');
  const sceneRing = (label, mode) => stage(grid, label, 360, 300, (g) => {
    g.appendChild(S('rect', { x: 0, y: 0, width: 360, height: 300, fill: '#92bf52', opacity: 0.0 }));
    const P = [{ x: 180, y: 70 }, { x: 290, y: 200 }, { x: 70, y: 200 }];
    [0, 1, 2].forEach((i) => g.appendChild(C.createRail(P[i], P[(i + 1) % 3]).el));
    const pads = P.map((p) => { const pd = C.createPad(); g.appendChild(pd.el); return pd; });
    const ds = [0, 1, 2].map((i) => D(i)); const ys = [0, 1, 2].map(() => C.createYarn());
    ys.forEach((y) => g.appendChild(y.el)); ds.forEach((d) => g.appendChild(d.el));
    return (t) => {
      const cyc = mode === 'freeze' ? 6 : 8; const k = (t % cyc);
      pads.forEach((pd, i) => { pd.el.setAttribute('transform', `translate(${P[i].x} ${P[i].y}) scale(.5)`); pd.set({ owner: i }); pd.el.setAttribute('transform', `translate(${P[i].x} ${P[i].y}) scale(.5)`); });
      ds.forEach((d, i) => {
        if (mode === 'freeze') d.set({ ...C.Dollop.pose(k < 2 ? 'go' : 'freeze', k < 2 ? k : k - 2, { looks: [{ x: 1, y: 0 }, { x: -1, y: 0.2 }] }), x: P[i].x, y: P[i].y + 24, s: 0.52 });
        else d.set({ ...C.Dollop.pose(k < 5 ? 'roll' : 'win', k, { seed: i }), x: P[i].x, y: P[i].y + 24, s: 0.52 });
      });
      ys.forEach((y, i) => y.set({ a: { x: P[i].x, y: P[i].y - 6 }, b: { x: P[(i + 1) % 3].x, y: P[(i + 1) % 3].y - 6 }, t, taut: mode === 'freeze' ? Math.min(1, Math.max(0, (k - 2) / 1.5)) : 0.2, ghost: mode !== 'freeze', k: i }));
    };
  });
  sceneRing('ring closes: yarn tightens, steam', 'freeze'); sceneRing('after the hold: ring unwinds', 'unwind');

  /* runner: repaint only when the 12 fps frame changes */
  const smooth = document.getElementById('smooth');
  smooth.addEventListener('change', () => { C.cfg.fps = smooth.checked ? 60 : 12; last = -1; });
  let last = -1;
  function loop(ms) {
    const t = ms / 1000;
    const f = C.cfg.fps === 12 ? Math.floor(t * 12) : Math.floor(t * 30);
    if (f !== last) { last = f; for (const u of items) u(t); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__sheetReady = true;
})();
