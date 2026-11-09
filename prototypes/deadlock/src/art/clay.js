/* Clay: one coherent plasticine style, drawn as inline SVG.
 * Material = one SVG filter (wobbly hand-made edge, soft diffuse + specular
 * lighting off a blurred height map, fine grain) + a thumbprint pattern + a
 * darker seam stroke. Every piece uses it, so the set reads as one shelf of clay.
 * Motion is quantised to 12 fps ("on twos") by Clay.snap. No Math.random. */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const cfg = { fps: 12 }; // 12 = stop-motion "on twos"; 60 = smooth (specimen sheet toggle)
  const snap = (t) => Math.floor(t * cfg.fps) / cfg.fps;
  const frame = (t) => Math.floor(t * 12); // counters and boil always tick at 12
  // deterministic per-frame jitter in [-1,1] (the stop-motion "boil")
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n += n << 3; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
  const jit = (t, k = 0) => hash(frame(t) * 31 + k * 977) * 2 - 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  function S(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    for (const k of kids.flat()) if (k) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    return e;
  }
  const attr = (e, o) => { for (const k in o) e.setAttribute(k, o[k]); return e; };

  // skins: [main, dark seam, light]
  const SKINS = [
    { name: 'mustard', main: '#f3b53a', dark: '#b97d10', light: '#ffe08a' },
    { name: 'teal',    main: '#3db8a8', dark: '#1b7f74', light: '#92e3d5' },
    { name: 'coral',   main: '#ee6b58', dark: '#b3402f', light: '#ffa597' },
    { name: 'lilac',   main: '#a88bdc', dark: '#6f52ab', light: '#d2bff5' },
    { name: 'sky',     main: '#5ba9e8', dark: '#2f74b4', light: '#a5d3fb' },
    { name: 'oat',     main: '#f1e4c4', dark: '#b39f70', light: '#fff8e4' },
  ];
  const INK = '#33202a';
  const PAL = {
    ink: INK, cream: '#fff6df', rail: '#8d6b4e', railDark: '#5f452f', steel: '#aab2b8',
    sand: '#ead7a6', sandDark: '#c3a468', grass: '#8fbd4b', grassDark: '#62983a', grassLight: '#c4de7c',
    yarn: '#e3453f', yarnLight: '#ff9d8e', gold: '#f7c531', goldDark: '#c68a0b', goldLight: '#fff0a0',
    sky1: '#8ecdf2', sky2: '#e8f5fc',
  };

  let uid = 0;
  const nextId = () => `c${uid++}`;
  function defs() {
    return S('defs', null,
      S('filter', { id: 'clay', x: '-14%', y: '-14%', width: '128%', height: '132%', 'color-interpolation-filters': 'sRGB' },
        S('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02', numOctaves: '2', seed: '3', result: 'wob' }),
        S('feDisplacementMap', { in: 'SourceGraphic', in2: 'wob', scale: '4', xChannelSelector: 'R', yChannelSelector: 'G', result: 'shape' }),
        S('feGaussianBlur', { in: 'shape', stdDeviation: '2.6', result: 'b1' }),
        S('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.16 0.22', numOctaves: '2', seed: '11', result: 'grain' }),
        S('feComposite', { in: 'b1', in2: 'grain', operator: 'arithmetic', k1: '0', k2: '0.9', k3: '0.12', k4: '0', result: 'hm' }),
        S('feDiffuseLighting', { in: 'hm', surfaceScale: '4.5', diffuseConstant: '1.3', 'lighting-color': '#ffffff', result: 'lit' }, S('feDistantLight', { azimuth: '225', elevation: '54' })),
        S('feComposite', { in: 'lit', in2: 'shape', operator: 'in', result: 'litIn' }),
        S('feBlend', { in: 'shape', in2: 'litIn', mode: 'multiply', result: 'base' }),
        S('feSpecularLighting', { in: 'hm', surfaceScale: '4.5', specularConstant: '0.55', specularExponent: '16', 'lighting-color': '#fff6e0', result: 'spec' }, S('feDistantLight', { azimuth: '225', elevation: '54' })),
        S('feComposite', { in: 'spec', in2: 'shape', operator: 'in', result: 'specIn' }),
        S('feComposite', { in: 'base', in2: 'specIn', operator: 'arithmetic', k1: '0', k2: '1', k3: '0.5', k4: '0' })),
      // a lighter, cheaper variant for small pieces (no displacement/spec)
      S('filter', { id: 'clay-sm', x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' },
        S('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '1.6', result: 'b' }),
        S('feDiffuseLighting', { in: 'b', surfaceScale: '3', diffuseConstant: '1.3', 'lighting-color': '#fff', result: 'l' }, S('feDistantLight', { azimuth: '225', elevation: '54' })),
        S('feComposite', { in: 'l', in2: 'SourceAlpha', operator: 'in', result: 'li' }),
        S('feBlend', { in: 'SourceGraphic', in2: 'li', mode: 'multiply' })),
      S('filter', { id: 'soft', x: '-30%', y: '-60%', width: '160%', height: '220%' }, S('feGaussianBlur', { stdDeviation: '5' })),
      S('filter', { id: 'wobble', x: '-5%', y: '-5%', width: '110%', height: '110%' },
        S('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012 0.02', numOctaves: '2', seed: '8', result: 'w' }),
        S('feDisplacementMap', { in: 'SourceGraphic', in2: 'w', scale: '14', xChannelSelector: 'R', yChannelSelector: 'G' })),
      // fingerprint: concentric arcs, the signature of hand-pressed clay
      S('pattern', { id: 'thumb', width: '46', height: '46', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-18)' },
        [5, 9, 13, 17].map((r) => S('ellipse', { cx: 23, cy: 24, rx: r * 1.25, ry: r, fill: 'none', stroke: '#000', 'stroke-opacity': '.07', 'stroke-width': '1.6', 'stroke-dasharray': `${r * 5} ${r * 2.4}` }))),
      S('pattern', { id: 'thumbL', width: '46', height: '46', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(24)' },
        [6, 11, 15].map((r) => S('ellipse', { cx: 23, cy: 24, rx: r * 1.2, ry: r, fill: 'none', stroke: '#fff', 'stroke-opacity': '.12', 'stroke-width': '1.4', 'stroke-dasharray': `${r * 4} ${r * 3}` }))),
      S('radialGradient', { id: 'shadow', cx: '50%', cy: '50%', r: '50%' },
        S('stop', { offset: '0', 'stop-color': '#2b1d12', 'stop-opacity': '.42' }),
        S('stop', { offset: '.7', 'stop-color': '#2b1d12', 'stop-opacity': '.16' }),
        S('stop', { offset: '1', 'stop-color': '#2b1d12', 'stop-opacity': '0' })),
      S('radialGradient', { id: 'beam', cx: '50%', cy: '0%', r: '100%' },
        S('stop', { offset: '0', 'stop-color': '#fff2a8', 'stop-opacity': '.8' }),
        S('stop', { offset: '1', 'stop-color': '#fff2a8', 'stop-opacity': '0' })),
      S('radialGradient', { id: 'eyeW', cx: '38%', cy: '32%', r: '75%' },
        S('stop', { offset: '0', 'stop-color': '#ffffff' }), S('stop', { offset: '.75', 'stop-color': '#fbf4e2' }), S('stop', { offset: '1', 'stop-color': '#d9ccb0' })),
      S('linearGradient', { id: 'skyG', x1: '0', y1: '0', x2: '0', y2: '1' },
        S('stop', { offset: '0', 'stop-color': '#79c2ee' }), S('stop', { offset: '.7', 'stop-color': '#c5e6f8' }), S('stop', { offset: '1', 'stop-color': '#eef8e4' })),
      S('linearGradient', { id: 'grassG', x1: '0', y1: '0', x2: '0', y2: '1' },
        S('stop', { offset: '0', 'stop-color': '#a6cf58' }), S('stop', { offset: '1', 'stop-color': '#6aa13a' })),
      S('linearGradient', { id: 'soilG', x1: '0', y1: '0', x2: '0', y2: '1' },
        S('stop', { offset: '0', 'stop-color': '#9a6a43' }), S('stop', { offset: '1', 'stop-color': '#6e472c' })));
  }

  // A clay lump: filled path(s) with seam + thumbprint, lit by the clay filter.
  function lump(d, color, o = {}) {
    const g = S('g', { filter: o.small ? 'url(#clay-sm)' : 'url(#clay)' });
    const mk = (extra) => (typeof d === 'string' ? S('path', { d, ...extra }) : S(d.tag, { ...d.attrs, ...extra }));
    g.appendChild(mk({ fill: color.main || color, stroke: color.dark || 'none', 'stroke-opacity': '.45', 'stroke-width': o.seam ?? 2.2 }));
    if (!o.noThumb) { g.appendChild(mk({ fill: 'url(#thumb)' })); g.appendChild(mk({ fill: 'url(#thumbL)' })); }
    return g;
  }
  const ell = (cx, cy, rx, ry) => ({ tag: 'ellipse', attrs: { cx, cy, rx, ry } });
  const circ = (cx, cy, r) => ({ tag: 'circle', attrs: { cx, cy, r } });
  const rrect = (x, y, w, h, r) => ({ tag: 'rect', attrs: { x, y, width: w, height: h, rx: r, ry: r } });

  function shadow(rx = 60, ry = 12, dx = 8, dy = 4) {
    return S('ellipse', { cx: dx, cy: dy, rx, ry, fill: 'url(#shadow)' });
  }

  function starPath(r, ri = r * 0.45) {
    let d = '';
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? ri : r;
      d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`;
    }
    return d + 'Z';
  }
  function star(r = 9, o = {}) {
    return S('g', { filter: 'url(#clay-sm)' }, S('path', { d: starPath(r), fill: o.fill || PAL.gold, stroke: PAL.goldDark, 'stroke-opacity': '.6', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
  }

  /* ---------------- Pad: the mutex. A round clay platform with a lamp. ---------------- */
  function createPad(o = {}) {
    const root = S('g');
    const sh = shadow(112, 40, 10, 18);
    const side = lump(ell(0, 10, 100, 46), { main: PAL.sandDark, dark: '#8a6c36' }, { noThumb: true });
    const top = lump(ell(0, -2, 100, 46), { main: PAL.sand, dark: PAL.sandDark });
    const rim = S('ellipse', { cx: 0, cy: -2, rx: 78, ry: 33, fill: 'none', stroke: '#fff', 'stroke-width': 7, 'stroke-opacity': 0, 'stroke-linecap': 'round' });
    const inlay = S('ellipse', { cx: 0, cy: -2, rx: 62, ry: 26, fill: PAL.grassLight, 'fill-opacity': 0 });
    const sleepers = S('g', { opacity: '.5' });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      sleepers.appendChild(S('rect', { x: Math.cos(a) * 86 - 5, y: -2 + Math.sin(a) * 39 - 2.5, width: 10, height: 5, rx: 2.5, fill: PAL.rail, transform: `rotate(${(Math.atan2(Math.sin(a) * 39, Math.cos(a) * 86) * 180) / Math.PI + 90} ${Math.cos(a) * 86} ${-2 + Math.sin(a) * 39})` }));
    }
    // lamp: post + bulb
    const lampPost = lump(rrect(-4, -52, 8, 46, 4), { main: PAL.rail, dark: PAL.railDark }, { small: true, noThumb: true });
    const bulb = S('circle', { cx: 0, cy: -58, r: 13, fill: '#9ed06a', stroke: '#4a7a2a', 'stroke-opacity': '.5', 'stroke-width': 2 });
    const bulbHi = S('ellipse', { cx: -4, cy: -63, rx: 4, ry: 3, fill: '#fff', 'fill-opacity': '.8' });
    const halo = S('circle', { cx: 0, cy: -58, r: 24, fill: '#9ed06a', 'fill-opacity': '.28', filter: 'url(#soft)' });
    const lamp = S('g', { transform: `translate(${o.lampX ?? 70} ${o.lampY ?? -6})` }, halo, lampPost, S('g', { filter: 'url(#clay-sm)' }, bulb), bulbHi);
    const label = S('text', { x: 0, y: 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: PAL.railDark, 'fill-opacity': 0, 'font-family': 'ui-rounded, system-ui, sans-serif' }, o.label || '');
    root.append(sh, side, top, inlay, rim, sleepers, label, lamp);
    return {
      el: root,
      // owner: skin index or -1 (free). Held pads tint their rim and lamp in the holder's colour.
      set(p) {
        const sk = p.owner >= 0 ? SKINS[p.owner % 6] : null;
        attr(bulb, { fill: sk ? sk.main : '#9ed06a' });
        attr(halo, { fill: sk ? sk.main : '#9ed06a', 'fill-opacity': sk ? 0.5 : 0.25 });
        attr(rim, { stroke: sk ? sk.main : '#fff', 'stroke-opacity': sk ? 0.95 : 0 });
        attr(inlay, { fill: sk ? sk.light : PAL.grassLight, 'fill-opacity': sk ? 0.55 : 0 });
        attr(label, { 'fill-opacity': p.labels ? 0.75 : 0 });
        if (p.pulse != null) root.setAttribute('transform', `translate(${p.x || 0} ${p.y || 0}) scale(${1 + p.pulse * 0.04} ${1 - p.pulse * 0.05})`);
        else if (p.x != null) root.setAttribute('transform', `translate(${p.x} ${p.y})`);
      },
    };
  }

  /* ---------------- Rail: two steel rails over sleepers between two points ---------------- */
  function createRail(a, b, o = {}) {
    const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; const off = 9;
    const root = S('g', { opacity: o.opacity ?? 1 });
    const ties = S('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: PAL.rail, 'stroke-width': 24, 'stroke-dasharray': '5 15', 'stroke-linecap': 'butt' });
    const bed = S('line', { x1: a.x, y1: a.y + 4, x2: b.x, y2: b.y + 4, stroke: '#2b1d12', 'stroke-opacity': '.16', 'stroke-width': 26, 'stroke-linecap': 'round', filter: 'url(#soft)' });
    const r1 = S('line', { x1: a.x + nx * off, y1: a.y + ny * off, x2: b.x + nx * off, y2: b.y + ny * off, stroke: PAL.steel, 'stroke-width': 5.5, 'stroke-linecap': 'round' });
    const r2 = S('line', { x1: a.x - nx * off, y1: a.y - ny * off, x2: b.x - nx * off, y2: b.y - ny * off, stroke: PAL.steel, 'stroke-width': 5.5, 'stroke-linecap': 'round' });
    const hi = S('line', { x1: a.x + nx * off - 1, y1: a.y + ny * off - 1.5, x2: b.x + nx * off - 1, y2: b.y + ny * off - 1.5, stroke: '#fff', 'stroke-opacity': '.55', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    root.append(bed, S('g', { filter: 'url(#clay-sm)' }, ties), S('g', { filter: 'url(#clay-sm)' }, r1, r2), hi);
    return { el: root };
  }

  /* ---------------- Hut: a cart's station / goal ---------------- */
  function createHut(skinIdx, o = {}) {
    const sk = SKINS[skinIdx % 6];
    const root = S('g');
    const inner = S('g');
    const sh = shadow(60, 14, 8, 6);
    const body = lump(rrect(-40, -52, 80, 52, 10), { main: '#fff1d0', dark: '#b79e6b' });
    const roof = lump('M-52,-48 Q-48,-86 0,-92 Q48,-86 52,-48 Q0,-40 -52,-48Z', sk);
    const door = lump(rrect(-12, -34, 24, 34, 12), { main: '#6b4a38', dark: '#3b2a1f' }, { small: true, noThumb: true });
    const pole = S('rect', { x: 30, y: -128, width: 4, height: 44, rx: 2, fill: PAL.rail });
    const flag = S('g', { filter: 'url(#clay-sm)' }, S('path', { d: 'M34,-126 L62,-117 L34,-107Z', fill: sk.main, stroke: sk.dark, 'stroke-opacity': '.5', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
    const clock = o.clock ? S('g', { transform: 'translate(0 -66)' }, S('circle', { r: 11, fill: '#fffdf2', stroke: PAL.railDark, 'stroke-width': 2.4 }), S('path', { d: 'M0,0 L0,-7 M0,0 L5,2', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' })) : null;
    const confetti = S('g', { opacity: 0 });
    for (let i = 0; i < 8; i += 1) confetti.appendChild(S('circle', { r: 3.5, fill: [sk.main, PAL.gold, '#fff', sk.light][i % 4], cx: 0, cy: -70 }));
    inner.append(body, door, roof, S('g', null, pole), flag, clock, confetti);
    root.append(sh, inner);
    return {
      el: root,
      set(p) {
        const w = p.win || 0; // 0..1 win bounce progress
        const sy = 1 - 0.1 * Math.sin(w * Math.PI * 3) * (1 - w);
        inner.setAttribute('transform', `scale(${(2 - sy).toFixed(3)} ${sy.toFixed(3)})`);
        attr(flag, { transform: `rotate(${Math.sin((p.t || 0) * 5) * 4 + w * 12} 34 -116)` });
        attr(confetti, { opacity: w > 0 && w < 1 ? 1 : 0 });
        if (w > 0 && w < 1) {
          [...confetti.children].forEach((c, i) => {
            const a = (i / 8) * Math.PI * 2; const r = w * 70;
            attr(c, { cx: Math.cos(a) * r, cy: -70 + Math.sin(a) * r - w * 20 + w * w * 50, opacity: 1 - w * 0.6 });
          });
        }
        if (p.x != null) root.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${p.s ?? 1})`);
      },
    };
  }

  /* ---------------- Yarn: the wait-for arrow. Red = real wait, pink dashed = about to wait ---------------- */
  function createYarn() {
    const root = S('g', { 'pointer-events': 'none' });
    const shade = S('path', { fill: 'none', stroke: '#2b1d12', 'stroke-opacity': '.18', 'stroke-width': 8, 'stroke-linecap': 'round', filter: 'url(#soft)' });
    const rope = S('path', { fill: 'none', stroke: PAL.yarn, 'stroke-width': 8, 'stroke-linecap': 'round' });
    const twist = S('path', { fill: 'none', stroke: PAL.yarnLight, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-dasharray': '2 8' });
    const bead = S('g', { filter: 'url(#clay-sm)' }, S('circle', { r: 9, fill: PAL.yarn, stroke: '#8d1f1b', 'stroke-opacity': '.5', 'stroke-width': 1.6 }));
    const beadHi = S('circle', { r: 2.6, fill: '#fff', 'fill-opacity': '.8' });
    root.append(shade, S('g', { filter: 'url(#clay-sm)' }, rope), twist, bead, beadHi);
    return {
      el: root,
      // a,b world points; taut 0 (slack) .. 1 (taut); ghost = pale dashed "intent" yarn
      set(p) {
        const { a, b } = p;
        const t = p.t || 0;
        const taut = p.taut ?? 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const sag = (1 - taut) * 46 + 4;
        const trem = taut > 0.9 ? jit(t, p.k || 1) * 1.6 : 0;
        const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx + trem).toFixed(1)},${(my + sag + trem).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
        const w = p.ghost ? 5 : 8 + taut * 1.5;
        attr(rope, { d, 'stroke-width': w, stroke: p.ghost ? '#ff9d8e' : PAL.yarn, 'stroke-dasharray': p.ghost ? '1 11' : '', opacity: p.ghost ? 0.9 : 1 });
        attr(shade, { d: d.replace(/ ([\d.]+),([\d.]+)$/, ' $1,$2'), opacity: p.ghost ? 0 : 1 });
        attr(twist, { d, 'stroke-width': 3.2, opacity: p.ghost ? 0 : 0.85, 'stroke-dashoffset': (frame(t) % 5) * 0 });
        // bead sits at the holder end; slightly before the target so it does not hide the face
        const ex = lerp(b.x, mx, 0.0), ey = lerp(b.y, my + sag * 0.5, 0.0);
        attr(bead, { transform: `translate(${ex.toFixed(1)} ${ey.toFixed(1)})`, opacity: p.ghost ? 0 : 1 });
        attr(beadHi, { transform: `translate(${(ex - 3).toFixed(1)} ${(ey - 3).toFixed(1)})`, opacity: p.ghost ? 0 : 1 });
      },
    };
  }

  /* ---------------- Chock (Hold token): a doorstop wedge ---------------- */
  function createChock(o = {}) {
    const root = S('g');
    const sh = shadow(34, 8, 4, 6);
    const cid = nextId();
    const WD = 'M-34,4 L-34,-3 Q-33,-6 -28,-8 L28,-30 Q38,-34 40,-24 L40,0 Q40,4 34,4 Z';
    const wedge = lump(WD, { main: '#f0553f', dark: '#9b2a1c' }, { small: o.small });
    const stripes = S('g', { 'clip-path': `url(#wc${cid})`, opacity: 0.96 }, S('clipPath', { id: `wc${cid}` }, S('path', { d: WD })));
    [-18, -2, 14, 30].forEach((x) => stripes.appendChild(S('path', { d: `M${x},6 L${x + 14},-40`, stroke: '#fff3d6', 'stroke-width': 7, 'stroke-linecap': 'butt' })));
    const stripe1 = S('g', { filter: 'url(#clay-sm)' }, stripes);
    const rope = S('g');
    const timer = S('g', { transform: 'translate(8 -48)', opacity: 0 });
    const pie = S('path', { d: '', fill: '#fff6df', stroke: PAL.railDark, 'stroke-width': 2 });
    timer.append(S('circle', { r: 10, fill: '#e7d9bd', stroke: PAL.railDark, 'stroke-width': 2 }), pie);
    root.append(sh, S('g', { transform: o.flat ? '' : 'rotate(-4)' }, wedge, stripe1), rope, timer);
    return {
      el: root,
      set(p) {
        if (p.frac != null) {
          attr(timer, { opacity: 1 });
          const a = p.frac * Math.PI * 2 - Math.PI / 2;
          attr(pie, { d: p.frac >= 0.999 ? 'M0,-9 A9,9 0 1 1 -0.01,-9 Z' : `M0,0 L0,-9 A9,9 0 ${p.frac > 0.5 ? 1 : 0} 1 ${(Math.cos(a) * 9).toFixed(2)},${(Math.sin(a) * 9).toFixed(2)} Z` });
        } else attr(timer, { opacity: 0 });
        const sq = p.squash || 0;
        root.setAttribute('transform', `translate(${p.x || 0} ${p.y || 0}) rotate(${p.rot || 0}) scale(${(p.s || 1) * (1 + sq).toFixed(3)} ${((p.s || 1) * (1 - sq)).toFixed(3)})`);
      },
    };
  }

  /* ---------------- Ticket (Loan token): golden VIP ticket with a lease dot row ---------------- */
  function createTicket(o = {}) {
    const root = S('g');
    const sh = shadow(38, 8, 4, 28);
    const body = lump('M-36,-22 L36,-22 L36,-9 Q27,0 36,9 L36,22 L-36,22 L-36,9 Q-27,0 -36,-9 Z', { main: PAL.gold, dark: PAL.goldDark }, { small: o.small });
    const perf = S('line', { x1: -22, y1: -22, x2: -22, y2: 22, stroke: PAL.goldDark, 'stroke-opacity': '.55', 'stroke-width': 2, 'stroke-dasharray': '3 4' });
    const st = S('g', { transform: 'translate(8 0)' }, star(14, { fill: '#fff6bb' }));
    const dots = S('g', { transform: 'translate(2 14)' });
    for (let i = 0; i < 6; i += 1) dots.appendChild(S('circle', { cx: -18 + i * 7.5, cy: 0, r: 2.7, fill: '#8a5a00' }));
    const sparkle = S('g', { opacity: 0 });
    for (let i = 0; i < 4; i += 1) sparkle.appendChild(S('path', { d: starPath(6, 2), fill: '#fff9c8', transform: `translate(${[-40, 42, -28, 36][i]} ${[-24, -18, 24, 26][i]})` }));
    root.append(sh, body, perf, st, dots, sparkle);
    return {
      el: root,
      set(p) {
        const n = p.frac == null ? 6 : Math.ceil(p.frac * 6);
        [...dots.children].forEach((c, i) => attr(c, { 'fill-opacity': i < n ? 1 : 0.18 }));
        attr(sparkle, { opacity: p.sparkle ? 1 : 0, transform: `rotate(${(frame(p.t || 0) % 4) * 12})` });
        root.setAttribute('transform', `translate(${p.x || 0} ${p.y || 0}) rotate(${p.rot || 0}) scale(${p.s || 1})`);
      },
    };
  }

  /* ---------------- Sun / spotlight: the scheduler. It looks at whoever runs. ---------------- */
  function createSun() {
    const root = S('g');
    const beam = S('path', { d: '', fill: 'url(#beam)', opacity: 0.9 });
    const rays = S('g');
    for (let i = 0; i < 10; i += 1) {
      rays.appendChild(lump({ tag: 'rect', attrs: { x: -5, y: -66, width: 10, height: 20, rx: 5, transform: `rotate(${i * 36})` } }, { main: '#ffcf45', dark: '#c98a0b' }, { small: true, noThumb: true }));
    }
    const disc = lump(circ(0, 0, 44), { main: '#ffd54f', dark: '#c88a0a' });
    const eyes = S('g'); const pupils = [];
    [-15, 15].forEach((x) => {
      eyes.appendChild(S('circle', { cx: x, cy: -6, r: 12, fill: 'url(#eyeW)', stroke: '#b9a77a', 'stroke-width': 1.2 }));
      const p = S('circle', { cx: x, cy: -6, r: 5.2, fill: INK }); pupils.push(p); eyes.appendChild(p);
    });
    const mouth = S('path', { d: 'M-12,14 Q0,26 12,14', fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' });
    const cheeks = S('g', { opacity: 0.45 }, S('circle', { cx: -28, cy: 12, r: 6, fill: '#ff8e63' }), S('circle', { cx: 28, cy: 12, r: 6, fill: '#ff8e63' }));
    const glow = S('circle', { r: 70, fill: '#fff2a8', 'fill-opacity': 0.32, filter: 'url(#soft)' });
    root.append(beam, glow, S('g', { class: 'rays' }, rays), disc, cheeks, eyes, mouth);
    return {
      el: root,
      // target: world point it looks at / lights (or null = idle)
      set(p) {
        const t = p.t || 0;
        const tg = p.target;
        let lx = 0, ly = 0.3;
        if (tg) { const dx = tg.x - p.x, dy = tg.y - p.y; const L = Math.hypot(dx, dy) || 1; lx = dx / L; ly = dy / L; }
        pupils.forEach((pu, i) => attr(pu, { cx: (i ? 15 : -15) + lx * 5, cy: -6 + ly * 5 }));
        attr(rays, { transform: `rotate(${(frame(t) % 30) * 1.2})` });
        if (tg) {
          const dx = tg.x - p.x, dy = tg.y - p.y; const L = Math.hypot(dx, dy) || 1; const nx = -dy / L, ny = dx / L;
          const wTop = 12, wBot = 46;
          attr(beam, { d: `M${nx * wTop},${ny * wTop} L${dx + nx * wBot},${dy + ny * wBot} L${dx - nx * wBot},${dy - ny * wBot} L${-nx * wTop},${-ny * wTop}Z`, opacity: 0.6 });
        } else attr(beam, { opacity: 0 });
        attr(mouth, { d: p.mood === 'o' ? 'M-6,16 Q0,24 6,16 Q0,10 -6,16Z' : 'M-12,14 Q0,26 12,14' });
        const sc = (p.s || 1) * (1 + 0.02 * Math.sin(frame(t) * 0.7));
        root.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${sc})`);
      },
    };
  }

  /* ---------------- Candle: the deadline. It melts as time runs out. ---------------- */
  function createCandle() {
    const root = S('g');
    const wax = lump(rrect(-8, -30, 16, 30, 5), { main: '#fff3d4', dark: '#c9b27a' }, { small: true, noThumb: true });
    const drip = S('path', { d: 'M-8,-26 q-2,8 2,10 q4,2 2,-10Z', fill: '#fff3d4', stroke: '#c9b27a', 'stroke-opacity': '.5' });
    const wick = S('line', { x1: 0, y1: -30, x2: 0, y2: -35, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' });
    const flame = S('path', { d: 'M0,-52 Q9,-42 0,-33 Q-9,-42 0,-52Z', fill: '#ff9a2a' });
    const core = S('path', { d: 'M0,-46 Q4,-41 0,-36 Q-4,-41 0,-46Z', fill: '#ffe27a' });
    root.append(S('g', { class: 'candle' }, wax, drip, wick), flame, core);
    return {
      el: root,
      set(p) {
        const f = clamp(p.frac, 0.08, 1); // remaining time
        const h = 30 * f;
        const t = p.t || 0;
        [...wax.children].forEach((c) => { if (c.tagName === 'path' || c.tagName === 'rect') attr(c, { y: -h, height: h }); });
        const fy = -h + 30; // shift flame down as wax melts
        const fl = 1 + jit(t, 3) * 0.12;
        flame.setAttribute('transform', `translate(${jit(t, 4) * 1.2} ${fy}) scale(${fl} ${1 + jit(t, 5) * 0.1})`);
        core.setAttribute('transform', `translate(${jit(t, 4) * 1.2} ${fy})`);
        wick.setAttribute('transform', `translate(0 ${fy})`);
        attr(drip, { opacity: f < 0.7 ? 1 : 0, transform: `translate(0 ${30 - h})` });
        const low = f < 0.3;
        attr(flame, { fill: low ? '#ff5a2a' : '#ff9a2a' });
        root.setAttribute('transform', `translate(${p.x || 0} ${p.y || 0}) scale(${p.s || 1})`);
      },
    };
  }

  /* ---------------- Priority pennant: 1..3 gold stars on a little flag ---------------- */
  function createPennant() {
    const root = S('g');
    const pole = S('rect', { x: -2, y: -58, width: 4, height: 58, rx: 2, fill: PAL.rail });
    const cloth = lump('M2,-58 L50,-52 Q54,-40 50,-30 L2,-26 Z', { main: '#fff1cf', dark: '#b89c63' }, { small: true, noThumb: true });
    const stars = S('g', { transform: 'translate(0 -42)' });
    root.append(pole, cloth, stars);
    let last = -1;
    return {
      el: root,
      set(p) {
        if (p.n !== last) {
          stars.replaceChildren();
          for (let i = 0; i < p.n; i += 1) stars.appendChild(S('g', { transform: `translate(${14 + i * 13} ${i % 2 ? 3 : -2})` }, star(6.5)));
          last = p.n;
        }
        attr(stars, { opacity: 1 });
        const wave = Math.sin((p.t || 0) * 6) * 3;
        attr(cloth, { transform: `skewY(${wave})` });
        root.setAttribute('transform', `translate(${p.x || 0} ${p.y || 0}) scale(${p.s || 1})`);
      },
    };
  }


  /* ---------------- Hand: the wordless teacher. Points, grabs, taps. Fingertip is the origin. ---------------- */
  function createHand() {
    const root = S('g', { 'pointer-events': 'none' });
    const skin = { main: '#f3c6a2', dark: '#b97d56' };
    const arm = S('g', { filter: 'url(#clay-sm)' }, S('path', { d: 'M20,70 L190,230', stroke: '#6fb4e0', 'stroke-width': 40, 'stroke-linecap': 'round', fill: 'none' }), S('path', { d: 'M18,66 L40,86', stroke: '#fff6df', 'stroke-width': 46, 'stroke-linecap': 'round', fill: 'none' }));
    const point = S('g');
    point.append(lump(rrect(-8, 0, 17, 56, 8.5), skin, { small: true, noThumb: true }), lump(circ(12, 62, 27), skin, { small: true }), lump(ell(-12, 70, 11, 16), skin, { small: true, noThumb: true }));
    const grab = S('g');
    grab.append(lump(circ(14, 40, 30), skin), ...[-14, 0, 14, 28].map((x) => lump(circ(x + 2, 14, 11), skin, { small: true, noThumb: true })), lump(ell(-18, 52, 11, 14), skin, { small: true, noThumb: true }));
    const ring = S('circle', { cx: 0, cy: 0, r: 0, fill: 'none', stroke: '#fff', 'stroke-width': 4, opacity: 0 });
    root.append(S('ellipse', { cx: 18, cy: 78, rx: 36, ry: 8, fill: 'url(#shadow)' }), arm, point, grab, ring);
    return {
      el: root,
      // mode: 'point' | 'grab'; press 0..1 squashes down and pulses a ring (a tap)
      set(p) {
        const t = p.t || 0;
        attr(point, { opacity: p.mode === 'grab' ? 0 : 1 }); attr(grab, { opacity: p.mode === 'grab' ? 1 : 0 });
        const press = p.press || 0;
        const wig = p.mode === 'grab' ? 0 : Math.sin(snap(t) * 7) * 2.2;
        attr(ring, { r: press > 0 ? 8 + press * 30 : 0, opacity: press > 0 && press < 1 ? 1 - press : 0 });
        root.setAttribute('transform', `translate(${p.x} ${p.y + press * 6}) rotate(${(p.rot || -18) + wig}) scale(${(p.s || 1) * (1 - press * 0.04)} ${(p.s || 1) * (1 + press * 0.03)})`);
        root.setAttribute('opacity', p.opacity ?? 1);
      },
    };
  }

  /* ---------------- The diorama: sky, patchwork hills, hedges, meadow, soil lip ---------------- */
  function createWorld(W = 1000, H = 700) {
    const root = S('g');
    const back = S('g', { transform: 'translate(0 -66)' });
    const sky = S('rect', { x: -40, y: -40, width: W + 80, height: 400, fill: 'url(#skyG)' });
    root.append(back);
    back.append(sky);
    // clouds: clay lumps
    const clouds = S('g');
    const cl = (x, y, s) => {
      const g = S('g', { transform: `translate(${x} ${y}) scale(${s})` });
      g.append(lump(ell(0, 0, 70, 26), '#ffffff', { noThumb: true }), lump(circ(-24, -18, 24), '#ffffff', { noThumb: true }), lump(circ(18, -24, 30), '#ffffff', { noThumb: true }));
      return g;
    };
    const cloudA = cl(190, 70, 1), cloudB = cl(720, 44, 0.8), cloudC = cl(500, 110, 0.55);
    clouds.append(cloudA, cloudB, cloudC);
    back.append(clouds);
    // far hills + patchwork fields
    const hills = S('g');
    hills.append(lump('M-40,240 C80,170 190,190 300,215 C420,150 560,165 650,205 C780,160 900,175 1050,235 L1050,300 L-40,300Z', { main: '#a8c86a', dark: '#789a3e' }, { seam: 1.6 }));
    const fieldDefs = [
      ['M20,222 L120,196 L170,232 L40,246Z', '#c3d77c'], ['M330,214 L430,176 L520,196 L450,236Z', '#b4cf6a'],
      ['M700,196 L820,176 L900,214 L760,230Z', '#cfdf8a'], ['M560,200 L640,186 L690,214 L590,226Z', '#9fc260'],
    ];
    const fields = S('g', { opacity: 0.8 });
    fieldDefs.forEach(([d, c]) => fields.append(S('path', { d, fill: c, stroke: '#7b9a47', 'stroke-opacity': '.5', 'stroke-width': 1.4, 'stroke-dasharray': '6 5' })));
    hills.append(fields);
    hills.append(lump('M-40,270 C120,215 260,238 400,252 C560,226 700,232 820,246 C920,236 1010,250 1050,262 L1050,330 L-40,330Z', { main: '#8dbb4a', dark: '#5c8f33' }, { seam: 1.6 }));
    back.append(hills);
    // hedge row of little clay bushes
    const hedge = S('g');
    for (let i = 0; i < 15; i += 1) {
      const x = 10 + i * 68 + (i % 3) * 7;
      hedge.append(lump(circ(x, 270 + (i % 2) * 6, 25 + (i % 3) * 4), { main: ['#4f8f3a', '#5a9d41', '#468533'][i % 3], dark: '#2e5e22' }, { small: true }));
    }
    back.append(hedge);
    // a tree
    const tree = S('g', { transform: 'translate(906 250)' });
    tree.append(lump(rrect(-10, -10, 20, 56, 8), { main: '#8a5f3e', dark: '#4f3220' }, { small: true }), lump(circ(0, -42, 46), { main: '#4f9a3b', dark: '#2f6a24' }), lump(circ(-30, -22, 30), { main: '#5aa845', dark: '#2f6a24' }), lump(circ(30, -24, 32), { main: '#559f40', dark: '#2f6a24' }));
    back.append(tree);
    // meadow
    const meadow = S('g');
    meadow.append(lump(`M-40,238 C150,226 340,244 500,236 C700,228 860,244 1040,234 L1040,${H - 36} L-40,${H - 36}Z`, { main: '#8dbf49', dark: '#5f9738' }, { noThumb: false, seam: 0 }));
    const tufts = S('g', { opacity: 0.55 });
    for (let i = 0; i < 46; i += 1) {
      const x = (i * 211) % 980 + 10, y = 262 + ((i * 97) % 380);
      tufts.append(S('path', { d: `M${x},${y} q-3,-12 -7,-15 M${x},${y} q1,-13 1,-18 M${x},${y} q4,-11 8,-14`, stroke: '#4e8a2f', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
    }
    meadow.append(tufts);
    root.append(meadow);
    // soil lip: the edge of the miniature set
    root.append(lump(`M-40,${H - 40} L1040,${H - 40} L1040,${H + 40} L-40,${H + 40}Z`, { main: '#8b5e3c', dark: '#53351f' }, { seam: 0 }));
    root.append(S('rect', { x: -40, y: H - 44, width: 1080, height: 10, fill: '#b0d868', opacity: 0.9 }));
    return {
      el: root,
      set(t) {
        const s = snap(t);
        cloudA.setAttribute('transform', `translate(${190 + (s * 4) % 80 - 20} 70)`);
        cloudB.setAttribute('transform', `translate(${720 - (s * 3) % 60 + 20} 44) scale(.8)`);
        cloudC.setAttribute('transform', `translate(${500 + (s * 2.5) % 50} 110) scale(.55)`);
      },
    };
  }

  root.Clay = {
    NS, cfg, snap, frame, jit, hash, clamp, lerp, ease, S, attr, SKINS, PAL, INK,
    defs, lump, ell, circ, rrect, shadow, star, starPath,
    createPad, createRail, createHut, createYarn, createChock, createTicket, createSun, createCandle, createPennant, createHand, createWorld,
    nextId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
