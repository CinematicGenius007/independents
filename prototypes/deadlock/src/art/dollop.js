/* Dollop: our own cast. A lump of coloured clay with googly eyes, riding a
 * chunky cart. Six skins, six silhouettes (hat), one face system. The face does
 * the explaining: worry, shock, smug, shrug, delight.
 * Clips are pure functions of local time -> pose; Clay.snap puts them on twos. */
(function (root) {
  const C = root.Clay;
  const { S, attr, lump, ell, circ, rrect, SKINS, INK, jit, clamp, lerp, snap, frame } = C;

  const mix = (a, b, t) => {
    const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16)); const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
    return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
  };

  function worm(d, color, w = 9, o = {}) {
    return S('g', { filter: 'url(#clay-sm)' }, S('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o }));
  }

  // silhouettes: sit on top of the head, which peaks near y=-126
  function hat(i, sk) {
    const g = S('g');
    if (i === 0) { g.append(worm('M0,-124 C-16,-136 -12,-156 4,-152 C16,-148 10,-134 2,-138', sk.dark, 9)); }
    else if (i === 1) {
      g.append(worm('M-14,-122 Q-28,-150 -24,-166', sk.dark, 5), worm('M14,-122 Q28,-150 24,-166', sk.dark, 5),
        lump(circ(-24, -168, 9), { main: sk.light, dark: sk.dark }, { small: true, noThumb: true }), lump(circ(24, -168, 9), { main: sk.light, dark: sk.dark }, { small: true, noThumb: true }));
    } else if (i === 2) {
      g.append(lump(ell(-36, -116, 15, 20), sk, { small: true }), lump(ell(36, -116, 15, 20), sk, { small: true }),
        S('ellipse', { cx: -36, cy: -114, rx: 7, ry: 11, fill: '#f4a5a0', opacity: 0.8 }), S('ellipse', { cx: 36, cy: -114, rx: 7, ry: 11, fill: '#f4a5a0', opacity: 0.8 }));
    } else if (i === 3) {
      g.append(worm('M0,-122 Q4,-140 0,-150', '#5f9a3a', 5),
        lump('M0,-150 Q-22,-160 -26,-142 Q-8,-134 0,-150Z', { main: '#7bc04a', dark: '#3f7a23' }, { small: true, noThumb: true }),
        lump('M0,-150 Q22,-164 28,-146 Q10,-136 0,-150Z', { main: '#8cd058', dark: '#3f7a23' }, { small: true, noThumb: true }));
    } else if (i === 4) {
      g.append(lump('M-24,-122 L-18,-146 L-9,-124Z', sk, { small: true, noThumb: true }), lump('M-8,-124 L0,-154 L8,-124Z', sk, { small: true, noThumb: true }), lump('M9,-124 L18,-146 L24,-122Z', sk, { small: true, noThumb: true }));
    } else {
      g.append(lump(circ(0, -138, 16), { main: sk.light, dark: sk.dark }, { small: true }), lump('M-6,-124 L-20,-118 L-14,-132Z M6,-124 L20,-118 L14,-132Z', { main: '#ee6b58', dark: '#b3402f' }, { small: true, noThumb: true }));
    }
    return g;
  }

  const MOUTHS = {
    smile: { d: 'M-13,0 Q0,13 13,0', fill: 'none' },
    flat: { d: 'M-9,4 L9,4', fill: 'none' },
    frown: { d: 'M-12,9 Q0,-4 12,9', fill: 'none' },
    wavy: { d: 'M-15,5 q4,-7 7.5,0 t7.5,0 t7.5,0', fill: 'none' },
    smirk: { d: 'M-11,4 Q4,11 13,-3', fill: 'none' },
    o: { d: 'M0,-4 a6.5,8 0 1 0 0.01,0Z', fill: '#5b2330' },
    grin: { d: 'M-17,-2 Q0,24 17,-2 Z', fill: '#5b2330' },
    oh: { d: 'M-7,0 Q0,-6 7,0 Q0,14 -7,0Z', fill: '#5b2330' },
  };
  const BROWS = { // [left deg, right deg, lift]
    neutral: [0, 0, 0], worried: [-22, 22, -2], angry: [20, -20, 2], up: [-6, 6, -6], smug: [14, -6, 1], confused: [-18, -4, -3], happy: [-8, 8, -5], sleepy: [8, -8, 3],
  };

  function create(o = {}) {
    const sk = SKINS[(o.skin || 0) % 6];
    const deep = mix(sk.main, sk.dark, 0.5);
    const cid = C.nextId();
    const root = S('g');
    const shadow = C.shadow(66, 12, 8, 4);
    const body = S('g');                      // squash/stretch/lean pivot at the ground
    const critterG = S('g');                  // head group (bobs, tilts)
    // critter lump (bean) + frost overlay
    const bean = 'M-46,-80 C-50,-114 -24,-128 0,-128 C24,-128 50,-114 46,-80 C44,-52 22,-42 0,-42 C-22,-42 -44,-52 -46,-80Z';
    const critter = lump(bean, sk);
    const frost = S('path', { d: bean, fill: '#bfe3ff', opacity: 0 });
    const cheeks = S('g', { opacity: 0.5 }, S('ellipse', { cx: -33, cy: -74, rx: 7, ry: 5, fill: '#ff8d7a' }), S('ellipse', { cx: 33, cy: -74, rx: 7, ry: 5, fill: '#ff8d7a' }));
    // eyes (googly): sclera, pupil, lid
    const eyeG = S('g'); const eyes = [];
    [-18, 18].forEach((x, k) => {
      const clip = S('clipPath', { id: `lid${cid}${k}` }, S('circle', { cx: x, cy: -92, r: 15.5 }));
      const white = S('circle', { cx: x, cy: -92, r: 15.5, fill: 'url(#eyeW)', stroke: '#9a8a64', 'stroke-opacity': '.55', 'stroke-width': 1.6 });
      const pupil = S('circle', { cx: x, cy: -92, r: 6.8, fill: INK });
      const hi = S('circle', { cx: x - 2, cy: -94, r: 2.2, fill: '#fff' });
      const lid = S('rect', { x: x - 17, y: -108, width: 34, height: 0, fill: sk.main, 'clip-path': `url(#lid${cid}${k})` });
      const lidLine = S('line', { x1: x - 14, x2: x + 14, y1: -108, y2: -108, stroke: sk.dark, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0, 'clip-path': `url(#lid${cid}${k})` });
      eyeG.append(clip, S('g', { filter: 'url(#clay-sm)' }, white), pupil, hi, lid, lidLine);
      eyes.push({ x, pupil, hi, lid, lidLine });
    });
    const brows = [-18, 18].map((x) => worm(`M${x - 9},0 L${x + 9},0`, sk.dark, 6));
    const browG = S('g'); brows.forEach((b) => browG.appendChild(b));
    const mouth = S('path', { d: MOUTHS.smile.d, fill: 'none', stroke: INK, 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const teeth = S('rect', { x: -9, y: 0, width: 18, height: 6, rx: 2, fill: '#fff', opacity: 0 });
    const mouthG = S('g', { transform: 'translate(0 -66)' }, mouth);
    const sweat = S('path', { d: 'M0,0 q-6,10 0,13 q6,-3 0,-13Z', fill: '#bfe6ff', stroke: '#6aa8d8', 'stroke-width': 1.4, opacity: 0, transform: 'translate(44 -112)' });
    critterG.append(hat(o.skin || 0, sk), critter, frost, cheeks, eyeG, browG, mouthG, sweat);

    // cart: tub + two wheels (+ optional pennant / candle)
    const tubD = 'M-64,-60 L64,-60 Q72,-60 70,-50 L62,-26 Q60,-19 52,-19 L-52,-19 Q-60,-19 -62,-26 L-70,-50 Q-72,-60 -64,-60Z';
    const tub = lump(tubD, { main: deep, dark: sk.dark });
    const band = S('path', { d: 'M-66,-56 L66,-56', stroke: sk.light, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.7 });
    const bumperF = lump(rrect(60, -34, 14, 10, 5), { main: sk.light, dark: sk.dark }, { small: true, noThumb: true });
    const wheelG = S('g'); const wheels = [];
    [-38, 38].forEach((x) => {
      const w = S('g', { transform: `translate(${x} -16)` });
      const tire = lump(circ(0, 0, 18), { main: '#5e4a3c', dark: '#2a1e17' }, { small: true });
      const hub = S('g', { class: 'hub' }, S('circle', { r: 8, fill: sk.light, stroke: sk.dark, 'stroke-opacity': '.6', 'stroke-width': 1.6 }), S('path', { d: 'M0,-8 L0,8 M-8,0 L8,0', stroke: sk.dark, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-opacity': '.7' }));
      w.append(tire, hub); wheels.push(hub); wheelG.append(w);
    });
    const pennant = C.createPennant();
    const penG = S('g', { transform: 'translate(52 -58)' }, pennant.el);
    const candle = C.createCandle();
    const candleG = S('g', { transform: 'translate(-50 -58)' }, candle.el);
    const cartG = S('g'); cartG.append(wheelG, tub, band, bumperF);

    // overlays
    const steam = S('g'); const puffs = [];
    for (let i = 0; i < 3; i += 1) { const p = lump(circ(0, 0, 11 + i * 2), { main: '#ffffff', dark: '#b9c8d6' }, { small: true, noThumb: true }); puffs.push(p); steam.append(p); }
    const q = S('text', { x: 0, y: 0, 'text-anchor': 'middle', 'font-size': 40, 'font-weight': 900, fill: '#ffd24a', stroke: '#8a5a00', 'stroke-width': 1.6, 'paint-order': 'stroke', 'font-family': 'ui-rounded, system-ui, sans-serif', opacity: 0 }, '?');
    const zzz = S('text', { x: 0, y: 0, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, fill: '#fff', stroke: '#5a7aa0', 'stroke-width': 1.4, 'paint-order': 'stroke', 'font-family': 'ui-rounded, system-ui, sans-serif', opacity: 0 }, 'z');
    const dizzy = S('g'); const dz = [0, 1, 2].map((i) => { const s = C.star(6, { fill: ['#ffd24a', '#fff', '#ff8e63'][i] }); dizzy.append(s); return s; });
    const glow = S('ellipse', { cx: 0, cy: -80, rx: 82, ry: 80, fill: '#fff2a8', opacity: 0, filter: 'url(#soft)' });
    const vipStar = C.createTicket({ small: true });
    const vipG = S('g', { opacity: 0 }, vipStar.el);
    const sparkG = S('g'); const sparks = [0, 1, 2, 3, 4].map(() => { const s = C.star(7, { fill: '#fff3a8' }); sparkG.append(s); return s; });

    body.append(critterG, cartG, penG, candleG);
    root.append(shadow, glow, body, steam, q, zzz, dizzy, vipG, sparkG);

    const api = {
      el: root, skin: o.skin || 0,
      set(p) {
        const t = p.t || 0;
        const x = p.x || 0, y = p.y || 0, lift = p.lift || 0;
        const sc = p.s || 1;
        const sx = p.sx ?? 1, sy = p.sy ?? 1;
        const j = p.boil === false ? 0 : 0.7;
        root.setAttribute('transform', `translate(${(x + jit(t, 1) * j).toFixed(2)} ${(y + jit(t, 2) * j * 0.6).toFixed(2)}) scale(${sc})`);
        attr(shadow, { transform: `scale(${(1 - lift / 160).toFixed(3)})`, opacity: clamp(1 - lift / 110, 0.35, 1) });
        body.setAttribute('transform', `translate(0 ${(-lift).toFixed(2)}) rotate(${(p.rot || 0).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
        critterG.setAttribute('transform', `translate(0 ${(p.bob || 0).toFixed(2)}) rotate(${(p.tilt || 0).toFixed(2)} 0 -60)`);
        // eyes
        const lk = p.look || { x: 0, y: 0 };
        const L = Math.hypot(lk.x, lk.y) || 1; const m = Math.min(1, L) * 6.6;
        const lx = (lk.x / L) * m, ly = (lk.y / L) * m;
        eyes.forEach((e, k) => {
          const jx = jit(t, 10 + k) * 0.35;
          attr(e.pupil, { cx: e.x + lx + jx, cy: -92 + ly });
          attr(e.hi, { cx: e.x + lx - 2 + jx, cy: -94 + ly });
          const lid = clamp(p.lid || 0, 0, 1);
          const h = lid * 31;
          attr(e.lid, { y: -108, height: h, opacity: lid > 0.02 ? 1 : 0 });
          attr(e.lidLine, { y1: -108 + h, y2: -108 + h, opacity: lid > 0.05 ? 0.9 : 0 });
        });
        const br = BROWS[p.brow || 'neutral'] || BROWS.neutral;
        brows.forEach((b, k) => attr(b, { transform: `translate(0 ${-114 + br[2]}) rotate(${br[k]} ${k ? 18 : -18} 0)` }));
        const mo = MOUTHS[p.mouth || 'smile'] || MOUTHS.smile;
        attr(mouth, { d: mo.d, fill: mo.fill });
        // overlays
        attr(frost, { opacity: p.frost || 0 });
        attr(sweat, { opacity: p.sweat ? 1 : 0, transform: `translate(${44} ${-112 + (frame(t) % 6)})` });
        steam.setAttribute('opacity', p.steam ? 1 : 0);
        if (p.steam) puffs.forEach((pf, i) => {
          const ph = ((snap(t) * 0.9 + i / 3) % 1);
          pf.setAttribute('transform', `translate(${(-26 + i * 26 + Math.sin(ph * 6 + i) * 6).toFixed(1)} ${(-132 - ph * 54 - lift).toFixed(1)}) scale(${(0.5 + ph * 0.9).toFixed(2)})`);
          pf.setAttribute('opacity', (1 - ph).toFixed(2));
        });
        attr(q, { opacity: p.q ? 1 : 0, transform: `translate(52 ${-128 - (frame(t) % 4) * 1.5}) rotate(${12 + jit(t, 7) * 4})` });
        attr(zzz, { opacity: p.zzz ? 1 : 0, transform: `translate(${48 + (frame(t) % 8) * 1.5} ${-122 - (frame(t) % 8) * 3}) scale(${0.8 + (frame(t) % 8) * 0.05})` });
        dizzy.setAttribute('opacity', p.dizzy ? 1 : 0);
        if (p.dizzy) dz.forEach((s, i) => { const a = snap(t) * 4 + (i * Math.PI * 2) / 3; s.setAttribute('transform', `translate(${(Math.cos(a) * 36).toFixed(1)} ${(-142 + Math.sin(a) * 9).toFixed(1)})`); });
        attr(glow, { opacity: p.glow || 0 });
        // wheels
        wheels.forEach((w) => w.setAttribute('transform', `rotate(${(p.wheel || 0).toFixed(1)})`));
        // pennant & candle
        if (p.stars) { penG.setAttribute('opacity', 1); pennant.set({ n: p.stars, t, x: 0, y: 0 }); } else penG.setAttribute('opacity', 0);
        if (p.candle != null) { candleG.setAttribute('opacity', 1); candle.set({ frac: p.candle, t }); } else candleG.setAttribute('opacity', 0);
        // vip ticket floating over the head
        if (p.ticket != null) {
          vipG.setAttribute('opacity', 1);
          vipStar.set({ frac: p.ticket, t, sparkle: true, x: -6 + jit(t, 21) * 0.8, y: -176 - lift + Math.sin(snap(t) * 5) * 3, rot: -8 + Math.sin(snap(t) * 3) * 4, s: 0.78 });
        } else vipG.setAttribute('opacity', 0);
        sparkG.setAttribute('opacity', p.sparkle ? 1 : 0);
        if (p.sparkle) sparks.forEach((s, i) => {
          const ph = (snap(t) * 1.4 + i / 5) % 1; const a = i * 1.26 + 0.4;
          s.setAttribute('transform', `translate(${(Math.cos(a) * (30 + ph * 56)).toFixed(1)} ${(-100 + Math.sin(a) * (30 + ph * 50) - lift).toFixed(1)}) scale(${(1 - ph).toFixed(2)})`);
        });
      },
    };
    return api;
  }

  /* ---------------- clips: local time -> pose. All motion is quantised by the caller. ---------------- */
  const sinc = (t, period, phase = 0) => Math.sin(((t / period) + phase) * Math.PI * 2);
  function blink(t, seed = 0) { const k = (t + seed * 0.77) % 3.2; return k < 0.18 ? Math.sin((k / 0.18) * Math.PI) : 0; }
  const CLIPS = {
    idle: (t, o) => ({ sy: 1 + 0.015 * sinc(t, 2.4, o.seed * 0.13), sx: 1 - 0.01 * sinc(t, 2.4, o.seed * 0.13), lid: blink(t, o.seed || 0), look: { x: sinc(t, 5.5, (o.seed || 0) * 0.3), y: 0.2 * sinc(t, 3.1) }, mouth: 'smile', brow: 'neutral', wheel: 0 }),
    roll: (t, o) => ({ sy: 1 + 0.035 * sinc(t, 0.5), sx: 1 - 0.02 * sinc(t, 0.5), rot: (o.dir || 1) * 3.2, bob: 1.5 * sinc(t, 0.5, 0.25), lift: 2.5 * Math.abs(sinc(t, 1)), look: { x: (o.dir || 1), y: 0 }, lid: blink(t, o.seed || 0), mouth: 'smile', brow: 'neutral', wheel: (o.dir || 1) * t * 420 }),
    // anticipation -> launch -> settle. p in [0,1] over one move.
    go: (t, o) => {
      const p = clamp(t / 0.6, 0, 1);
      const dir = o.dir || 1;
      let sx = 1, sy = 1, rot = 0;
      if (p < 0.3) { const k = C.ease(p / 0.3); sx = lerp(1, 1.1, k); sy = lerp(1, 0.86, k); rot = -5 * dir * k; }
      else if (p < 0.55) { const k = C.ease((p - 0.3) / 0.25); sx = lerp(1.1, 0.92, k); sy = lerp(0.86, 1.1, k); rot = lerp(-5, 6, k) * dir; }
      else { const k = (p - 0.55) / 0.45; const d = Math.exp(-4 * k) * Math.cos(k * 14); sx = 1 - 0.07 * d; sy = 1 + 0.08 * d; rot = 4 * dir * (1 - k); }
      return { sx, sy, rot, look: { x: dir, y: 0 }, mouth: p < 0.3 ? 'flat' : 'smile', brow: p < 0.3 ? 'worried' : 'up', lid: blink(t, o.seed || 0) * 0.5, wheel: (o.dir || 1) * t * 300 };
    },
    wait: (t, o) => ({ sy: 1 + 0.02 * sinc(t, 1.2), look: o.look || { x: 1, y: 0 }, brow: 'worried', mouth: 'flat', sweat: frame(t) % 24 < 10, lid: 0, tilt: 2 * sinc(t, 1.6), rot: 0.6 * jit(t, 8) }),
    bump: (t, o) => {
      const p = clamp(t / 0.7, 0, 1); const d = Math.exp(-4 * p) * Math.cos(p * 16);
      return { sx: 1 - 0.14 * d, sy: 1 + 0.12 * d, rot: (o.dir || 1) * 5 * d, look: o.look || { x: 1, y: 0 }, brow: 'worried', mouth: 'oh', sweat: p > 0.5 };
    },
    freeze: (t, o) => {
      const looks = o.looks && o.looks.length ? o.looks : [{ x: 1, y: 0 }, { x: -1, y: 0.2 }];
      const k = Math.floor(t * 2.2) % looks.length;
      return { sx: 1 + 0.01 * jit(t, 5), sy: 1 + 0.012 * jit(t, 6), rot: 0.9 * jit(t, 3), bob: 0.8 * jit(t, 4), look: looks[k], brow: 'worried', mouth: 'wavy', steam: true, sweat: true, frost: 0.28 + 0.06 * sinc(t, 1.4), lid: 0, tilt: 1.5 * jit(t, 9) };
    },
    dance: (t, o) => {
      const ph = sinc(t, 0.9, (o.seed || 0) * 0.08); const side = ph > 0 ? 1 : -1;
      return { x: 13 * side, rot: 5 * side, sy: 1 + 0.03 * Math.abs(ph), look: { x: -side, y: 0 }, brow: 'worried', mouth: 'smile', sweat: true, tilt: -4 * side, wheel: side * t * 120, lid: 0 };
    },
    held: (t, o) => ({ sy: 1 + 0.02 * sinc(t, 2.8), lid: 0.5 + 0.12 * sinc(t, 2.8), look: { x: sinc(t, 3.4), y: 0.3 }, brow: 'sleepy', mouth: 'o', zzz: frame(t) % 16 < 12, tilt: 3 * sinc(t, 3.2) }),
    vip: (t, o) => ({ sy: 1 + 0.04 * Math.abs(sinc(t, 0.5)), sx: 1 - 0.02 * Math.abs(sinc(t, 0.5)), lift: 3 * Math.abs(sinc(t, 0.5)), brow: 'up', mouth: 'grin', look: { x: 0, y: -0.7 }, glow: 0.5, sparkle: true, tilt: -2 * sinc(t, 1), wheel: t * 600, lid: 0 }),
    smug: (t, o) => ({ sy: 1 + 0.02 * sinc(t, 0.6), lid: 0.42, brow: 'smug', mouth: 'smirk', look: { x: o.dir || 1, y: 0.1 }, wheel: (o.dir || 1) * t * 500, rot: (o.dir || 1) * 2, bob: 1.2 * sinc(t, 0.6), lift: 2 * Math.abs(sinc(t, 1.2)) }),
    huh: (t, o) => {
      const p = clamp(t / 1.4, 0, 1);
      return { tilt: 14 * Math.sin(Math.min(1, p * 2) * Math.PI * 0.5) * (p < 0.8 ? 1 : 1 - (p - 0.8) * 5), brow: 'confused', mouth: 'o', q: p > 0.1 && p < 0.9, look: o.look || { x: 0, y: -0.6 }, sy: 1 + 0.02 * jit(t, 2), lid: 0 };
    },
    win: (t, o) => {
      const per = 0.7; const k = (t % per) / per;
      const lift = 34 * Math.sin(k * Math.PI) * (1 - 0.15 * Math.floor(t / per));
      const land = k > 0.85 || k < 0.1;
      return { lift: Math.max(0, lift), sx: land ? 1.12 : 0.94, sy: land ? 0.88 : 1.1, brow: 'happy', mouth: 'grin', look: { x: 0, y: -0.4 }, sparkle: true, glow: 0.35, wheel: t * 700, lid: 0, tilt: 5 * sinc(t, per) };
    },
    stunned: (t, o) => ({ dizzy: true, mouth: 'wavy', brow: 'worried', tilt: 6 * sinc(t, 0.8), look: { x: sinc(t, 0.6), y: sinc(t, 0.6, 0.25) * 0.8 }, sweat: true, sy: 1 + 0.02 * sinc(t, 0.8) }),
  };
  function pose(clip, t, o = {}) { return { t, ...(CLIPS[clip] || CLIPS.idle)(snap(t), o) }; }

  C.Dollop = { create, pose, CLIPS, MOUTHS, BROWS };
})(typeof window !== 'undefined' ? window : globalThis);
