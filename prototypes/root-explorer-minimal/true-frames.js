/* =====================================================================
   true-frames.js — project-authentic frames for the nineteen works
   ---------------------------------------------------------------------
   Unlike the old monochrome re-inking pass, every painter here keeps the
   real palette, the real typography and the real instrument chrome of the
   project it represents. The surface is a 512 x 384 logical app window;
   renderTrueFrame can scale it to any resolution without losing detail.

   Exposes:
     window.TRUE_FRAMES = { THEMES, renderTrueFrame, getFrameChrome, ... }
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- font stacks: only the two committed display/mono faces plus system fallbacks ---------- */
  const FF = {
    mono: "'IBM Plex Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    space: "'Space Mono','IBM Plex Mono',ui-monospace,monospace",
    grotesk: "'Space Grotesk','Helvetica Neue',Arial,sans-serif",
    narrow: "'Arial Narrow','Helvetica Neue',Arial,sans-serif",
    serif: "Georgia,'Times New Roman',Times,serif",
    didone: "'Bodoni MT','Didot',Georgia,serif",
    type: "'Courier New',Courier,ui-monospace,monospace",
    hand: "'Bradley Hand','Segoe Print','Comic Sans MS',cursive",
    black: "'Arial Black','Helvetica Neue',Arial,sans-serif",
    swiss: "'Helvetica Neue',Helvetica,Arial,sans-serif"
  };

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function h32(a, b) {
    let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((b | 0) + 0x7F4A7C15, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- geometry / paint helpers ---------- */
  function rr(g, x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function vgrad(g, x, y, w, h, a, b) {
    const q = g.createLinearGradient(x, y, x, y + h);
    q.addColorStop(0, a); q.addColorStop(1, b);
    g.fillStyle = q; g.fillRect(x, y, w, h);
  }
  function glow(g, x, y, r, col) {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function T(g, s, x, y, o) {
    o = o || {};
    g.save();
    g.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    const size = o.size || 10, wt = o.wt || 400, ff = o.ff || FF.mono;
    g.font = `${wt} ${size}px ${ff}`;
    g.fillStyle = o.fill || '#fff';
    g.textBaseline = o.base || 'alphabetic';
    if (o.track) {
      const chars = [...String(s)];
      let width = 0;
      for (const c of chars) width += g.measureText(c).width + o.track;
      width -= o.track;
      let sx = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
      g.textAlign = 'left';
      for (const c of chars) { g.fillText(c, sx, y); sx += g.measureText(c).width + o.track; }
    } else {
      g.textAlign = o.align || 'left';
      g.fillText(String(s), x, y);
    }
    g.restore();
  }
  function hardBox(g, x, y, w, h, fill, ink, dx, dy, lw, rad) {
    dx = dx == null ? 3 : dx; dy = dy == null ? 3 : dy; lw = lw == null ? 3 : lw;
    g.save();
    g.fillStyle = ink; rr(g, x + dx, y + dy, w, h, rad || 0); g.fill();
    g.fillStyle = fill; rr(g, x, y, w, h, rad || 0); g.fill();
    g.strokeStyle = ink; g.lineWidth = lw; rr(g, x, y, w, h, rad || 0); g.stroke();
    g.restore();
  }
  function speckle(g, x, y, w, h, n, seed, col, alpha, max) {
    const r = rng(seed), m = max || 1.4;
    g.save(); g.globalAlpha *= alpha == null ? .18 : alpha; g.fillStyle = col;
    for (let i = 0; i < n; i++) g.fillRect(x + r() * w, y + r() * h, .5 + r() * m, .5 + r() * m);
    g.restore();
  }
  function scanlines(g, y0, y1, step, alpha) {
    g.save(); g.fillStyle = `rgba(0,0,0,${alpha == null ? .05 : alpha})`;
    for (let y = y0; y < y1; y += step || 3) g.fillRect(0, y, 512, 1);
    g.restore();
  }
  function pill(g, x, y, w, h, bg, fg, label, o) {
    o = o || {};
    g.save();
    g.fillStyle = bg; rr(g, x, y, w, h, o.r == null ? h / 2 : o.r); g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; rr(g, x, y, w, h, o.r == null ? h / 2 : o.r); g.stroke(); }
    T(g, label, x + w / 2, y + h / 2 + (o.size || 7) * .36, { size: o.size || 7, wt: 700, ff: o.ff || FF.mono, fill: fg, align: 'center', track: o.track || 1.2 });
    g.restore();
  }
  function rule(g, x, y, w, col, lw) { g.save(); g.strokeStyle = col; g.lineWidth = lw || 1; g.beginPath(); g.moveTo(x, y + .5); g.lineTo(x + w, y + .5); g.stroke(); g.restore(); }
  function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  function pointedStone(g, x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (rot || 0) + i / 7 * TAU, rr2 = r * (.72 + .35 * Math.sin(i * 2.3 + x));
      const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }
  function cross(g, x, y, r, col, lw) {
    g.save(); g.strokeStyle = col; g.lineWidth = lw || 1.4;
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
    g.restore();
  }
  function checkered(g, x, y, w, h, a, b, n) {
    const s = w / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { g.fillStyle = (r + c) & 1 ? a : b; g.fillRect(x + c * s, y + r * s, s + .5, s + .5); }
  }

  /* =====================================================================
     THEMES — one per adapter key. Every value is the project's own register,
     never the sleeve's charcoal/chalk monochrome.
     ===================================================================== */
  const THEMES = {
    fog: {
      key: 'fog', slug: 'fogwalk', name: 'FOGWALK', status: 'LIVE', formal: 'SYNCHRONIZING WORD',
      paper: '#070B14', paper2: '#0F2137', ink: '#E7FBFF', muted: '#7E99A8',
      accent: '#5CE1E6', accent2: '#8CFFD9', line: 'rgba(231,251,255,.17)',
      chromeBg: '#08111E', chromeInk: '#E7FBFF', pillBg: '#5CE1E6', pillInk: '#041014',
      ff: FF.mono, display: FF.mono, mono: FF.mono, register: 'DARK ACRYLIC / AURORA'
    },
    bloom: {
      key: 'bloom', slug: 'bloomwright', name: 'BLOOMWRIGHT', status: 'LIVE', formal: 'TURTLE REWRITING',
      paper: '#F4EFE6', paper2: '#E7DFD2', ink: '#231F1A', muted: '#7B6A55',
      accent: '#A8794A', accent2: '#687A4B', line: 'rgba(35,31,26,.22)',
      chromeBg: '#F4EFE6', chromeInk: '#231F1A', pillBg: '#231F1A', pillInk: '#F4EFE6',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'SEPIA BROADSHEET'
    },
    tongue: {
      key: 'tongue', slug: 'tonguecracker', name: 'TONGUECRACKER', status: 'LIVE', formal: 'GENERATED GRAMMAR',
      paper: '#DCEAF7', paper2: '#C9DEED', ink: '#101317', muted: '#647887',
      accent: '#E4472E', accent2: '#2547C9', line: 'rgba(16,19,23,.32)',
      chromeBg: '#DCEAF7', chromeInk: '#101317', pillBg: '#101317', pillInk: '#DCEAF7',
      ff: FF.grotesk, display: FF.black, mono: FF.mono, register: 'FLAT LINE-ART / TWO ACCENTS'
    },
    sealed: {
      key: 'sealed', slug: 'sealed-orders', name: 'SEALED ORDERS', status: 'LIVE', formal: 'HASH COMMITMENT',
      paper: '#FAF8F4', paper2: '#F1EDE6', ink: '#0B0B0B', muted: '#77726A',
      accent: '#5CE1E6', accent2: '#FF4D3D', line: 'rgba(11,11,11,.3)',
      chromeBg: '#FAF8F4', chromeInk: '#0B0B0B', pillBg: '#5CE1E6', pillInk: '#0B0B0B',
      ff: FF.grotesk, display: FF.black, mono: FF.mono, register: 'INK & MARKER / ONE CYAN BLOCK'
    },
    hush: {
      key: 'hush', slug: 'hushword', name: 'HUSHWORD', status: 'LIVE', formal: 'SELECTIVE DISCLOSURE',
      paper: '#0B0C10', paper2: '#14161E', ink: '#F7F7FB', muted: '#75788A',
      accent: '#FF2A85', accent2: '#00F0FF', line: 'rgba(247,247,251,.14)',
      chromeBg: '#101118', chromeInk: '#F7F7FB', pillBg: '#FF2A85', pillInk: '#0B0C10',
      ff: FF.grotesk, display: FF.grotesk, mono: FF.mono, register: 'NOCTURNAL ARCADE'
    },
    azul: {
      key: 'azul', slug: 'azul', name: 'AZULEJO', status: 'LIVE', formal: 'REPLICATED STATE',
      paper: '#F2EAE0', paper2: '#E5D8C8', ink: '#2B211B', muted: '#8A7764',
      accent: '#C8372D', accent2: '#2F5AA8', line: 'rgba(43,33,27,.22)',
      chromeBg: '#F2EAE0', chromeInk: '#2B211B', pillBg: '#C8372D', pillInk: '#F2EAE0',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'GLAZED CERAMIC / IBERIAN'
    },
    scribble: {
      key: 'scribble', slug: 'pictionary', name: 'SCRIBBLE CLUB', status: 'LIVE', formal: 'ORDERED CHANNELS',
      paper: '#FBF9F3', paper2: '#F1EDE2', ink: '#26221C', muted: '#7E776B',
      accent: '#2E5AA8', accent2: '#C8372D', line: 'rgba(38,34,28,.25)',
      chromeBg: '#FBF9F3', chromeInk: '#26221C', pillBg: '#26221C', pillInk: '#FBF9F3',
      ff: FF.hand, display: FF.hand, mono: FF.type, register: 'SKETCHBOOK / GRAPHITE'
    },
    boards: {
      key: 'boards', slug: 'boards', name: 'SUDOKU / UTTT', status: 'LIVE', formal: 'CONSTRAINT PROPAGATION',
      paper: '#F5F3EE', paper2: '#E9E6DF', ink: '#1C1C1C', muted: '#8C887E',
      accent: '#C8372D', accent2: '#2F5AA8', line: 'rgba(28,28,28,.22)',
      chromeBg: '#F5F3EE', chromeInk: '#1C1C1C', pillBg: '#1C1C1C', pillInk: '#F5F3EE',
      ff: FF.swiss, display: FF.swiss, mono: FF.mono, register: 'ARCHITECTURAL GRID'
    },
    haul: {
      key: 'haul', slug: 'longhaul', name: 'LONG HAUL / BALLAST', status: 'LIVE', formal: 'INTEGER PURSUIT',
      paper: '#E6CFA8', paper2: '#D7B984', ink: '#17130E', muted: '#6B5A44',
      accent: '#F6C90E', accent2: '#4A5568', line: 'rgba(23,19,14,.3)',
      chromeBg: '#E6CFA8', chromeInk: '#17130E', pillBg: '#F6C90E', pillInk: '#17130E',
      ff: FF.narrow, display: FF.black, mono: FF.mono, register: 'DESERT QUARRY COMIC'
    },
    spore: {
      key: 'spore', slug: 'sporefront', name: 'SPOREFRONT', status: 'ROADMAP', formal: 'LIFE-LIKE AUTOMATON',
      paper: '#1A0F07', paper2: '#2A180B', ink: '#F3D9A8', muted: '#9A7A54',
      accent: '#E0A34A', accent2: '#5FB7C8', line: 'rgba(243,217,168,.18)',
      chromeBg: '#1A0F07', chromeInk: '#F3D9A8', pillBg: '#E0A34A', pillInk: '#1A0F07',
      ff: FF.mono, display: FF.mono, mono: FF.mono, register: '1970s DARKROOM / AGAR'
    },
    terra: {
      key: 'terra', slug: 'terrarium', name: 'TERRARIUM HASH', status: 'ROADMAP', formal: 'TOTALISTIC GENOME',
      paper: '#0F1912', paper2: '#17281C', ink: '#DDE7D2', muted: '#7C947F',
      accent: '#7BE0A0', accent2: '#C9A227', line: 'rgba(221,231,210,.16)',
      chromeBg: '#0F1912', chromeInk: '#DDE7D2', pillBg: '#7BE0A0', pillInk: '#0F1912',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'WARDIAN FERN CASE'
    },
    drift: {
      key: 'drift', slug: 'driftwatch', name: 'DRIFTWATCH', status: 'ROADMAP', formal: 'STREAMFUNCTION FLOW',
      paper: '#EBF0E6', paper2: '#DDE7D2', ink: '#1E2B2B', muted: '#68786E',
      accent: '#B03A2E', accent2: '#2F6B6B', line: 'rgba(30,43,43,.25)',
      chromeBg: '#EBF0E6', chromeInk: '#1E2B2B', pillBg: '#B03A2E', pillInk: '#EBF0E6',
      ff: FF.type, display: FF.mono, mono: FF.type, register: 'GREEN-BAR PLOTTER PAPER'
    },
    loom: {
      key: 'loom', slug: 'loomweight', name: 'LOOMWEIGHT', status: 'ROADMAP', formal: 'POLYRHYTHM CARDS',
      paper: '#F3EBDD', paper2: '#E6D9C4', ink: '#211C15', muted: '#7E6E58',
      accent: '#C8372D', accent2: '#274C77', line: 'rgba(33,28,21,.24)',
      chromeBg: '#F3EBDD', chromeInk: '#211C15', pillBg: '#C8372D', pillInk: '#F3EBDD',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'MEIJI WASHI SAMPLE'
    },
    dead: {
      key: 'dead', slug: 'deadlock', name: 'DEADLOCK', status: 'ROADMAP', formal: 'COFFMAN CYCLES',
      paper: '#2B332B', paper2: '#374135', ink: '#E4E1D2', muted: '#9AA393',
      accent: '#F2B84B', accent2: '#C8372D', line: 'rgba(228,225,210,.2)',
      chromeBg: '#2B332B', chromeInk: '#E4E1D2', pillBg: '#F2B84B', pillInk: '#2B332B',
      ff: FF.swiss, display: FF.swiss, mono: FF.mono, register: 'SWISS INTERLOCKING ENAMEL'
    },
    byz: {
      key: 'byz', slug: 'byzantine', name: 'BYZANTINE CHOIR', status: 'ROADMAP', formal: 'GENERALS QUORUM',
      paper: '#F0E8D8', paper2: '#E4D8C1', ink: '#2A2418', muted: '#8A7A60',
      accent: '#A8794A', accent2: '#8A3B2E', line: 'rgba(42,36,24,.22)',
      chromeBg: '#F0E8D8', chromeInk: '#2A2418', pillBg: '#A8794A', pillInk: '#F0E8D8',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'COPPERPLATE TOPOGRAPHY'
    },
    gc: {
      key: 'gc', slug: 'gc', name: 'GARBAGE COLLECTOR', status: 'ROADMAP', formal: 'TRICOLOR MARKING',
      paper: '#08110B', paper2: '#0F1A11', ink: '#B9FFCB', muted: '#6F9D7F',
      accent: '#E9A63A', accent2: '#FF6FAE', line: 'rgba(185,255,203,.17)',
      chromeBg: '#08110B', chromeInk: '#B9FFCB', pillBg: '#E9A63A', pillInk: '#08110B',
      ff: FF.mono, display: FF.mono, mono: FF.mono, register: '1984 CRT LOGIC ANALYZER'
    },
    cartel: {
      key: 'cartel', slug: 'cartel', name: 'CARTEL OF CARTOGRAPHERS', status: 'ROADMAP', formal: 'COVENANT FILTERS',
      paper: '#F6F1E3', paper2: '#EBE2CB', ink: '#2A2418', muted: '#857456',
      accent: '#2E6B4F', accent2: '#6E2233', line: 'rgba(42,36,24,.25)',
      chromeBg: '#F6F1E3', chromeInk: '#2A2418', pillBg: '#2E6B4F', pillInk: '#F6F1E3',
      ff: FF.didone, display: FF.didone, mono: FF.mono, register: 'GILDED-AGE STOCK CERTIFICATE'
    },
    shadow: {
      key: 'shadow', slug: 'shadow', name: 'SHADOW BIDDING', status: 'ROADMAP', formal: 'SEALED AUCTION',
      paper: '#1E1814', paper2: '#2C231C', ink: '#F2E8D5', muted: '#AC967C',
      accent: '#C9A227', accent2: '#8A3B2E', line: 'rgba(242,232,213,.18)',
      chromeBg: '#1E1814', chromeInk: '#F2E8D5', pillBg: '#C9A227', pillInk: '#1E1814',
      ff: FF.serif, display: FF.serif, mono: FF.mono, register: 'VENETIAN COUNTING-HOUSE LEDGER'
    },
    lex: {
      key: 'lex', slug: 'lexicon', name: 'LEXICON QUARANTINE', status: 'ROADMAP', formal: 'LIBERTY CAPTURE',
      paper: '#EFECE6', paper2: '#E4E0D7', ink: '#211F1B', muted: '#86817A',
      accent: '#5B3A8E', accent2: '#C8372D', line: 'rgba(33,31,27,.24)',
      chromeBg: '#EFECE6', chromeInk: '#211F1B', pillBg: '#5B3A8E', pillInk: '#EFECE6',
      ff: FF.type, display: FF.mono, mono: FF.type, register: 'SAMIZDAT TYPEWRITER ZINE'
    }
  };

  const ALIAS = { sporefront: 'spore', terrarium: 'terra', driftwatch: 'drift', loomweight: 'loom', deadlock: 'dead', byzantine: 'byz', 'sealed-orders': 'sealed', hushword: 'hush', pictionary: 'scribble', longhaul: 'haul', 'lexicon-quarantine': 'lex' };
  const SLUG_TO_KEY = { fogwalk: 'fog', bloomwright: 'bloom', tonguecracker: 'tongue', 'sealed-orders': 'sealed', hushword: 'hush', pictionary: 'scribble', azul: 'azul', longhaul: 'haul', boards: 'boards', sporefront: 'spore', terrarium: 'terra', driftwatch: 'drift', loomweight: 'loom', deadlock: 'dead', byzantine: 'byz', gc: 'gc', cartel: 'cartel', shadow: 'shadow', lexicon: 'lex' };
  for (const k of Object.keys(ALIAS)) if (!THEMES[k]) Object.defineProperty(THEMES, k, { value: THEMES[ALIAS[k]], enumerable: false });
  for (const s of Object.keys(SLUG_TO_KEY)) if (!THEMES[s]) Object.defineProperty(THEMES, s, { value: THEMES[SLUG_TO_KEY[s]], enumerable: false });
  const themeFor = key => THEMES[ALIAS[key] || SLUG_TO_KEY[key] || key] || THEMES.fog;

  /* =====================================================================
     THE NINETEEN PAINTERS
     ===================================================================== */
  const P = {};

  /* ---------------------------------------------------------------- 01 FOGWALK */
  const FOG = ['.......', '.#..#..', '...#...', '.#...#.', '...#...', '..#..#.', '.......'];
  const FN = 7;
  P.fog = (g, v, t, session, th) => {
    v = v || {};
    vgrad(g, 0, 0, 512, 384, th.paper, th.paper2);
    glow(g, 92, 56, 210, 'rgba(56,158,180,.20)');
    glow(g, 430, 318, 240, 'rgba(88,230,180,.13)');
    const r = rng(19);
    for (let i = 0; i < 82; i++) {
      const x = r() * 512, y = 42 + r() * 336, a = .08 + r() * .32;
      g.fillStyle = `rgba(209,248,255,${a})`; g.fillRect(x, y, .7 + r() * 1.2, .7 + r() * 1.2);
    }
    g.fillStyle = 'rgba(7,11,20,.7)'; g.fillRect(0, 0, 512, 40);
    rule(g, 0, 40, 512, 'rgba(92,225,230,.34)', 1);
    T(g, 'FOGWALK', 16, 23, { size: 13, wt: 700, ff: th.mono, fill: th.ink, track: 4.2 });
    T(g, 'BELIEF-STATE NAVIGATION', 16, 33, { size: 6.5, wt: 500, ff: th.mono, fill: th.muted, track: 1.6 });
    const snapshot = session && session.snapshot ? (function () { try { return session.snapshot(); } catch (e) { return null; } })() : null;
    const moves = snapshot && snapshot.w ? snapshot.w.length : 0;
    T(g, `BELIEF STATES: ${(v.poss || []).length} · MOVES: ${moves} / PAR 5`, 496, 23, { size: 9.5, wt: 600, ff: th.mono, fill: th.accent, align: 'right', track: .5 });
    T(g, 'CLICK A DIRECTION TO SLIDE EVERY POSSIBLE YOU', 496, 33, { size: 6, wt: 400, ff: th.mono, fill: th.muted, align: 'right', track: 1 });
    const C = 41, ox = (512 - C * FN) / 2, oy = 56, set = new Set(v.poss || []);
    for (let y = 0; y < FN; y++) for (let x = 0; x < FN; x++) {
      const px = ox + x * C, py = oy + y * C, i = y * FN + x;
      if (FOG[y][x] === '#') {
        g.fillStyle = '#0D1726'; g.fillRect(px + 1, py + 1, C - 2, C - 2);
        g.fillStyle = 'rgba(156,196,214,.10)'; g.fillRect(px + 1, py + 1, C - 2, 3);
        g.strokeStyle = 'rgba(92,225,230,.20)'; g.lineWidth = 1; g.strokeRect(px + 1.5, py + 1.5, C - 3, C - 3);
        g.strokeStyle = 'rgba(140,255,217,.09)'; g.beginPath(); g.moveTo(px + 6, py + C - 6); g.lineTo(px + C - 6, py + 6); g.stroke();
      } else {
        g.fillStyle = 'rgba(92,225,230,.035)'; g.fillRect(px + 2, py + 2, C - 4, C - 4);
        g.strokeStyle = 'rgba(231,251,255,.075)'; g.lineWidth = 1; g.strokeRect(px + 2.5, py + 2.5, C - 5, C - 5);
        if (set.has(i)) {
          const pu = .5 + .5 * Math.sin(t * 3.4 + i * .9), mint = i % 3 === 0;
          const col = mint ? '140,255,217' : '92,225,230';
          glow(g, px + C / 2, py + C / 2, 24, `rgba(${col},${.30 + .20 * pu})`);
          const q = g.createRadialGradient(px + C / 2 - 3, py + C / 2 - 3, 1, px + C / 2, py + C / 2, 8.5);
          q.addColorStop(0, '#FFFFFF'); q.addColorStop(.4, mint ? '#B8FFE9' : '#9CF4FA'); q.addColorStop(1, mint ? '#2FAE96' : '#238EA4');
          g.fillStyle = q; g.beginPath(); g.arc(px + C / 2, py + C / 2, 7 + pu * 1.4, 0, TAU); g.fill();
          g.strokeStyle = `rgba(${col},.65)`; g.lineWidth = 1; g.beginPath(); g.arc(px + C / 2, py + C / 2, 11 + pu * 3, 0, TAU); g.stroke();
        }
      }
    }
    if (v.mark != null) {
      const mx = ox + (v.mark % FN) * C + C / 2, my = oy + ((v.mark / FN) | 0) * C + C / 2;
      const q = g.createLinearGradient(mx, my - 52, mx, my); q.addColorStop(0, 'rgba(140,255,217,0)'); q.addColorStop(1, 'rgba(140,255,217,.22)');
      g.fillStyle = q; g.fillRect(mx - 5, my - 52, 10, 52);
      g.save(); g.strokeStyle = v.solved ? '#8CFFD9' : '#5CE1E6'; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = -t * 14;
      g.beginPath(); g.arc(mx, my, 18 + Math.sin(t * 4) * 2, 0, TAU); g.stroke(); g.setLineDash([]);
      cross(g, mx, my, 13, v.solved ? '#8CFFD9' : '#5CE1E6', 1.2);
      g.restore();
      T(g, 'MARK', mx, my - 25, { size: 6, wt: 600, ff: th.mono, fill: th.accent2, align: 'center', track: 1.4 });
    }
    rule(g, 16, 350, 480, 'rgba(231,251,255,.12)', 1);
    const snapW = snapshot && snapshot.w != null ? String(snapshot.w).split('') : [];
    const word = snapW.map(d => '↑↓←→'[+d] || '?').join('') || '—';
    T(g, `WORD ${word}`, 16, 367, { size: 8, wt: 500, ff: th.mono, fill: th.accent, track: .8 });
    T(g, '↑ ↓ ← → SLIDE · Z UNDO · R RESET', 496, 367, { size: 7, wt: 400, ff: th.mono, fill: th.muted, align: 'right', track: .8 });
  };

  /* ---------------------------------------------------------------- 02 BLOOMWRIGHT */
  const BW = [
    { name: 'A · BRACKET WEED', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' } },
    { name: 'B · FERN', rules: { F: 'F[+F]F[-F]F' } },
    { name: 'C · THICKET', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' } }
  ];
  P.bloom = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 280, 7, '#7A674D', .09, 1.2);
    vgrad(g, 0, 0, 512, 22, 'rgba(120,96,64,.06)', 'rgba(120,96,64,0)');
    g.fillStyle = th.ink; g.fillRect(16, 28, 480, 2); g.fillRect(16, 33, 480, .8);
    T(g, 'BLOOMWRIGHT', 16, 22, { size: 17, wt: 700, ff: th.serif, fill: th.ink, track: 2.2 });
    T(g, 'A JOURNAL OF APPLIED BOTANY', 16, 44, { size: 6, wt: 600, ff: th.mono, fill: th.muted, track: 1.8 });
    let snap = null; try { snap = session && session.snapshot ? session.snapshot() : null; } catch (e) { }
    const gen = snap ? snap.gen : 3, angle = snap ? snap.angle : 25.7, ruleIdx = snap ? snap.rule : 1;
    T(g, `SPECIMEN ${'IV'} · GEN ${gen}`, 496, 22, { size: 9, wt: 600, ff: th.mono, fill: th.ink, align: 'right', track: 1 });
    T(g, `ANGLE ${angle}° · SEED 01`, 496, 34, { size: 7.5, wt: 400, ff: th.mono, fill: th.muted, align: 'right', track: 1 });
    const seg = v.seg || [], bbox = v.bbox || [0, 0, 1, 1], x0 = bbox[0], y0 = bbox[1], x1 = bbox[2], y1 = bbox[3];
    const aw = 306, ah = 262, sc = Math.min(aw / Math.max(1e-6, x1 - x0), ah / Math.max(1e-6, y1 - y0));
    const ox = 20 + (aw - (x1 - x0) * sc) / 2 - x0 * sc, by = 334;
    let maxd = 1; for (const q of seg) if (q[4] > maxd) maxd = q[4];
    g.save(); g.translate(10, -5); g.globalAlpha = .18; g.strokeStyle = '#A8794A'; g.lineWidth = 6; g.lineCap = 'round';
    for (const q of seg) { g.beginPath(); g.moveTo(ox + q[0] * sc, by - q[1] * sc); g.lineTo(ox + q[2] * sc, by - q[3] * sc); g.stroke(); }
    g.restore();
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const q of seg) {
      const k = q[4] / maxd;
      g.strokeStyle = k > .48 ? '#1E291C' : '#33402D';
      g.lineWidth = 3.4 - 2.2 * k;
      g.beginPath(); g.moveTo(ox + q[0] * sc, by - q[1] * sc); g.lineTo(ox + q[2] * sc, by - q[3] * sc); g.stroke();
    }
    g.fillStyle = 'rgba(72,92,55,.85)';
    for (let i = 0; i < seg.length; i += 11) { const q = seg[i]; g.beginPath(); g.arc(ox + q[2] * sc, by - q[3] * sc, 1.3, 0, TAU); g.fill(); }
    g.restore();
    // printer's caption under the plate
    T(g, 'FIG. 1 — THE PLANT AS THE RULES BECOME IT', 16, 350, { size: 6, wt: 500, ff: th.mono, fill: th.muted, track: 1.4 });
    // right column: stock-table figures
    g.fillStyle = th.paper2; g.fillRect(360, 58, 136, 128);
    g.strokeStyle = th.ink; g.lineWidth = 1; g.strokeRect(360.5, 58.5, 135, 127);
    T(g, 'TARGET OVERLAP', 370, 73, { size: 6.5, wt: 700, ff: th.mono, fill: th.ink, track: 1.4 });
    T(g, '68%', 370, 100, { size: 27, wt: 700, ff: th.serif, fill: th.accent });
    T(g, 'BOX-COUNT DIM', 370, 125, { size: 6.5, wt: 700, ff: th.mono, fill: th.ink, track: 1.4 });
    T(g, (v.dim || 0).toFixed(2), 370, 144, { size: 19, wt: 400, ff: th.serif, fill: th.ink });
    T(g, 'STRING / SEGMENTS', 370, 165, { size: 6.5, wt: 700, ff: th.mono, fill: th.ink, track: 1.4 });
    T(g, `${v.len || 0} / ${seg.length}`, 370, 179, { size: 12, wt: 600, ff: th.mono, fill: th.ink });
    rule(g, 360, 192, 136, th.line, 1);
    T(g, 'REWRITE RULES', 360, 206, { size: 6.5, wt: 700, ff: th.mono, fill: th.ink, track: 1.4 });
    const rules = BW[ruleIdx] ? BW[ruleIdx].rules : BW[1].rules;
    let ry = 222;
    for (const k of Object.keys(rules)) { T(g, `${k} → ${rules[k]}`, 360, ry, { size: 7, wt: 500, ff: th.mono, fill: th.accent2 }); ry += 13; }
    rule(g, 16, 344, 480, th.ink, 1);
    T(g, `REWRITE: ${(BW[ruleIdx] || BW[1]).name} · CLICK EDGES FOR ANGLE · TOP/BOTTOM FOR GENERATION`, 16, 372, { size: 6.5, wt: 500, ff: th.mono, fill: th.muted, track: .5 });
  };

  /* ---------------------------------------------------------------- 03 TONGUECRACKER */
  P.tongue = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 220, 3, '#FFFFFF', .35, 1.1);
    const sc = v.sc || { shape: 0, count: 1, color: 0, verb: 0 };
    g.fillStyle = th.ink; g.fillRect(16, 30, 480, 2);
    T(g, 'TONGUECRACKER', 16, 23, { size: 18, wt: 900, ff: th.display, fill: th.ink, track: 1.2 });
    T(g, 'A LANGUAGE INVENTED FRESH EACH ROUND', 16, 43, { size: 6.5, wt: 600, ff: th.mono, fill: th.muted, track: 1.4 });
    T(g, `SCENE ${String((v.scene || 0) + 1).padStart(2, '0')} / INFER`, 496, 23, { size: 8, wt: 700, ff: th.mono, fill: th.ink, align: 'right', track: 1.2 });
    T(g, v.gloss ? 'GLOSS: ON' : 'GLOSS: OFF', 496, 36, { size: 7, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: 1 });
    const cols = [th.accent, th.accent2];
    for (let i = 0; i < sc.count; i++) {
      const x = 256 + (i - (sc.count - 1) / 2) * 100;
      const bounce = sc.verb === 1 ? -Math.abs(Math.sin(t * 2.7 + i * .9)) * 20 : 0;
      const y = 132 + bounce, col = cols[sc.color % 2];
      g.save(); g.translate(x, y); if (sc.verb === 0) g.rotate(t * .55 + i * .3);
      g.strokeStyle = th.ink; g.lineWidth = 2.6; g.lineJoin = 'round'; g.fillStyle = col;
      if (sc.shape === 0) {
        g.beginPath(); g.rect(-24, -24, 48, 48); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-24, -24); g.lineTo(-12, -36); g.lineTo(36, -36); g.lineTo(24, -24); g.stroke();
        g.beginPath(); g.moveTo(24, -24); g.lineTo(36, -36); g.lineTo(36, 12); g.lineTo(24, 24); g.stroke();
      } else if (sc.shape === 1) {
        g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.arc(-7, -8, 10, 3.6, 5.9); g.stroke();
        g.beginPath(); g.arc(0, 0, 20, -.7, 1.1); g.stroke();
      } else {
        g.beginPath(); g.moveTo(0, -34); g.lineTo(32, 25); g.lineTo(-32, 25); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-12, 12); g.lineTo(12, 12); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-14, -14, 8, 5);
      g.restore();
    }
    // motion arcs
    g.save(); g.strokeStyle = 'rgba(16,19,23,.22)'; g.lineWidth = 1.2; g.setLineDash([3, 5]);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(256, 132, 58 + i * 16, -.4, 1.2); g.stroke(); }
    g.setLineDash([]); g.restore();
    // word chips
    const tokens = v.tokens || [];
    g.font = `700 21px ${th.grotesk}`;
    let total = 0; for (const tk of tokens) total += g.measureText(tk.text).width + 30;
    total += Math.max(0, tokens.length - 1) * 12;
    let x = Math.max(18, (512 - total) / 2), y = 242;
    for (const tk of tokens) {
      const w = g.measureText(tk.text).width + 30;
      g.fillStyle = 'rgba(255,255,255,.66)'; rr(g, x, y, w, 44, 3); g.fill();
      g.strokeStyle = th.ink; g.lineWidth = 2.2; rr(g, x, y, w, 44, 3); g.stroke();
      T(g, tk.text, x + 12, y + 29, { size: 21, wt: 700, ff: th.grotesk, fill: th.ink });
      if (v.gloss) T(g, tk.gloss || '', x + 12, y + 58, { size: 7.5, wt: 700, ff: th.mono, fill: th.accent, track: .6 });
      x += w + 12;
    }
    // inferred grammar bar
    const lang = v.lang || { verbPos: 'last', adjOrder: 'post', plural: { kind: 'suffix', morph: '-ka' }, agree: false };
    g.fillStyle = th.ink; g.fillRect(16, 314, 480, 2);
    T(g, 'INFERRED GRAMMAR', 16, 331, { size: 6.5, wt: 700, ff: th.mono, fill: th.muted, track: 1.5 });
    const grammar = `${lang.verbPos === 'first' ? 'V-INITIAL' : 'V-FINAL'} · ADJ ${lang.adjOrder === 'pre' ? 'PRE' : 'POST'} · PLURAL ${lang.plural.kind.toUpperCase()} ${lang.plural.morph}${lang.agree ? ' · AGREEMENT' : ''}`;
    T(g, grammar, 16, 351, { size: 9.5, wt: 600, ff: th.mono, fill: th.ink, track: .4 });
    T(g, '▶ NEXT SCENE', 496, 351, { size: 9, wt: 700, ff: th.mono, fill: th.accent, align: 'right', track: 1 });
  };

  /* ---------------------------------------------------------------- 04 SEALED ORDERS */
  P.sealed = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 190, 11, '#B8B1A6', .12, 1.2);
    // flat cyan block with a scalloped lower edge
    g.fillStyle = th.accent; g.beginPath(); g.moveTo(0, 0); g.lineTo(294, 0); g.lineTo(294, 34);
    for (let x = 294; x > 0; x -= 18) g.arc(x - 9, 34, 9, 0, Math.PI, false);
    g.closePath(); g.fill();
    g.strokeStyle = th.ink; g.lineWidth = 3; g.stroke();
    T(g, 'SEALED ORDERS', 18, 25, { size: 18, wt: 900, ff: th.display, fill: th.ink, track: 1.3 });
    T(g, 'COMMIT · PASS · REVEAL', 18, 37, { size: 6, wt: 700, ff: th.mono, fill: th.ink, track: 1.8 });
    T(g, 'WHITE PAPER', 496, 19, { size: 7, wt: 700, ff: th.mono, fill: th.muted, align: 'right', track: 1.4 });
    const phase = v.phase || 'open', sealed = phase === 'sealed', done = phase === 'revealed';
    T(g, done ? (v.verdict ? 'VERIFIED' : 'FORGED') : sealed ? 'SEALED' : 'PROGRAMMING', 496, 34, { size: 9, wt: 900, ff: th.mono, fill: done ? (v.verdict ? '#1E7A46' : th.accent2) : th.ink, align: 'right', track: 1.2 });
    const arrows = ['▲', '▶', '▼', '◀'];
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 158, y = 74, w = 142, h = 124;
      hardBox(g, x, y, w, h, sealed ? '#E9E5DD' : th.paper, th.ink, 4, 4, 3, 2);
      T(g, `STEP ${i + 1}`, x + 12, y + 20, { size: 7, wt: 800, ff: th.mono, fill: th.ink, track: 1.6 });
      if (sealed) {
        g.save(); g.beginPath(); g.rect(x + 2, y + 2, w - 4, h - 4); g.clip();
        g.strokeStyle = 'rgba(11,11,11,.16)'; g.lineWidth = 1;
        for (let k = -h; k < w; k += 8) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); g.stroke(); }
        g.restore();
        T(g, '▒', x + w / 2, y + 82, { size: 48, wt: 700, ff: th.mono, fill: 'rgba(11,11,11,.24)', align: 'center' });
      } else {
        T(g, arrows[v.orders ? v.orders[i] : 0], x + w / 2, y + 84, { size: 44, wt: 900, ff: th.grotesk, fill: th.ink, align: 'center' });
        g.strokeStyle = th.ink; g.lineWidth = 2; g.beginPath(); g.arc(x + w / 2, y + 68, 42, 0, TAU); g.stroke();
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(x + w / 2 + Math.cos(a) * 46, y + 68 + Math.sin(a) * 46); g.lineTo(x + w / 2 + Math.cos(a) * 51, y + 68 + Math.sin(a) * 51); g.stroke(); }
      }
      T(g, sealed ? 'ORDER HIDDEN' : 'CLICK THE DIAL', x + w / 2, y + h - 10, { size: 6, wt: 700, ff: th.mono, fill: th.muted, align: 'center', track: 1 });
    }
    // commitment seal badge
    const cx = 74, cy = 262, R = 31;
    g.save(); g.translate(cx + 4, cy + 4); g.fillStyle = 'rgba(11,11,11,.9)'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.restore();
    g.fillStyle = th.accent; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.strokeStyle = th.ink; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.save(); g.strokeStyle = 'rgba(11,11,11,.28)'; g.lineWidth = 1; g.setLineDash([2, 3]);
    g.beginPath(); g.arc(cx, cy, R - 7, 0, TAU); g.stroke(); g.restore();
    T(g, 'SHA-256', cx, cy - 3, { size: 8, wt: 900, ff: th.mono, fill: th.ink, align: 'center', track: 1.2 });
    T(g, 'COMMITMENT', cx, cy + 9, { size: 5.5, wt: 700, ff: th.mono, fill: th.ink, align: 'center', track: 1.2 });
    T(g, done ? (v.verdict ? 'HASH MATCHES ✓' : 'MISMATCH ✗ — CHEAT CAUGHT') : sealed ? 'HASH IN THE LINK' : 'NOTHING STORED ANYWHERE', 124, 246, { size: 9, wt: 800, ff: th.mono, fill: done ? (v.verdict ? '#1E7A46' : th.accent2) : th.ink, track: .6 });
    T(g, v.commit ? v.commit.slice(0, 44) : '— no commitment yet —', 124, 263, { size: 7, wt: 500, ff: th.mono, fill: th.muted, track: .4 });
    T(g, `PHASE ${phase.toUpperCase()} · THREE STEPS · ONE HASH`, 124, 280, { size: 6.5, wt: 500, ff: th.mono, fill: th.muted, track: .6 });
    // buttons
    const bt = [['SEAL', th.accent], ['CHEAT', th.accent2], ['REVEAL', th.ink], ['NEW', th.ink]];
    bt.forEach(([lab, col], i) => {
      const x = 16 + i * 122, y = 322, w = 114, h = 38;
      hardBox(g, x, y, w, h, i === 0 ? th.accent : th.paper, th.ink, 3, 3, 2.4, 2);
      T(g, lab, x + w / 2, y + 24, { size: 10, wt: 900, ff: th.mono, fill: i === 0 ? th.ink : col, align: 'center', track: 1.4 });
    });
    // doodle sparks
    g.strokeStyle = 'rgba(11,11,11,.35)'; g.lineWidth = 1.4;
    for (const [x, y, s] of [[455, 82, 1], [470, 100, -1], [440, 118, 1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9 * s, y - 6); g.lineTo(x + 13 * s, y + 3); g.stroke(); }
  };

  /* ---------------------------------------------------------------- 05 HUSHWORD */
  const HW_SECRETS = ['CRANE', 'MOUSE', 'PLANT', 'SHARD', 'TIGER'];
  function hwFeedback(secret, guess) {
    const res = Array(5).fill(2), left = {};
    for (let i = 0; i < 5; i++) if (guess[i] === secret[i]) res[i] = 0; else left[secret[i]] = (left[secret[i]] || 0) + 1;
    for (let i = 0; i < 5; i++) if (res[i] === 2 && left[guess[i]] > 0) { res[i] = 1; left[guess[i]]--; }
    return res;
  }
  P.hush = (g, v, t, session, th) => {
    v = v || {};
    vgrad(g, 0, 0, 512, 384, '#0B0C10', '#07080C');
    glow(g, 70, 30, 220, 'rgba(255,42,133,.12)');
    glow(g, 460, 330, 230, 'rgba(0,240,255,.10)');
    speckle(g, 0, 0, 512, 384, 300, 5, '#FFFFFF', .06, 1.1);
    scanlines(g, 0, 384, 3, .055);
    const rows = v.rows || [], perm = v.map || [0, 1, 2];
    const HW_COLS = ['#FF2A85', '#00F0FF', '#E4C25A'];
    const meanings = ['IN PLACE', 'SHIFTED', 'ABSENT'];
    let candidates = 0;
    for (const s of HW_SECRETS) {
      let ok = true;
      for (const row of rows) { const fb = hwFeedback(s, row.w); if (!fb.every((f, i) => f === row.fb[i])) { ok = false; break; } }
      if (ok) candidates++;
    }
    // header
    g.save(); g.shadowColor = 'rgba(255,42,133,.7)'; g.shadowBlur = 12;
    T(g, 'HUSHWORD', 16, 24, { size: 15, wt: 700, ff: th.grotesk, fill: '#FFFFFF', track: 2.6 });
    g.restore();
    T(g, `CASE READOUT: ${candidates} CANDIDATE${candidates === 1 ? '' : 'S'}`, 496, 20, { size: 8, wt: 600, ff: th.mono, fill: th.accent2, align: 'right', track: .8 });
    T(g, 'EVERY LINK CARRIES ITS OWN COLOUR CONTRACT', 496, 32, { size: 5.8, wt: 400, ff: th.mono, fill: th.muted, align: 'right', track: .9 });
    rule(g, 0, 38, 512, 'rgba(255,42,133,.34)', 1);
    // calibration row
    T(g, 'CALIBRATION', 16, 52, { size: 6, wt: 700, ff: th.mono, fill: th.muted, track: 1.6 });
    meanings.forEach((m, k) => {
      const col = HW_COLS[perm[k]];
      g.fillStyle = col; g.fillRect(84 + k * 94, 44, 12, 10);
      g.save(); g.shadowColor = col; g.shadowBlur = 8; g.fillStyle = col; g.fillRect(84 + k * 94, 44, 12, 10); g.restore();
      T(g, m, 100 + k * 94, 52, { size: 5.8, wt: 600, ff: th.mono, fill: '#D8D9E4', track: .8 });
    });
    T(g, 'LIFTS 0 / 3', 496, 52, { size: 6.5, wt: 700, ff: th.mono, fill: th.accent, align: 'right', track: 1 });
    // a worked calibration row: one annotated example recovers the whole code
    T(g, 'WORKED EXAMPLE', 16, 70, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    const exWord = 'CRANE', exFb = hwFeedback(v.secret || 'CRANE', exWord);
    for (let c = 0; c < 5; c++) {
      const x = 122 + c * 29, y = 58, col = HW_COLS[perm[exFb[c]]];
      g.save(); g.shadowColor = col; g.shadowBlur = 6; g.fillStyle = col; rr(g, x, y, 25, 16, 1.5); g.fill(); g.restore();
      T(g, exWord[c], x + 12.5, y + 12, { size: 10, wt: 700, ff: th.mono, fill: '#070A0F', align: 'center' });
    }
    T(g, 'CODE RECOVERED FROM ONE ROW', 496, 70, { size: 5.2, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: .8 });
    // board
    const S = 40, gap = 6, ox = 144, top = 88;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = ox + c * (S + gap), y = top + r * (S + gap);
      const row = rows[r - (4 - rows.length)];
      const red = v.redact === c;
      if (!row) {
        g.save(); g.setLineDash([4, 4]); g.strokeStyle = 'rgba(247,247,251,.17)'; g.lineWidth = 1.2;
        rr(g, x, y, S, S, 2); g.stroke(); g.restore();
        continue;
      }
      const col = HW_COLS[perm[row.fb[c]]];
      g.save(); g.shadowColor = col; g.shadowBlur = row.fb[c] === 2 ? 4 : 12;
      g.fillStyle = red ? '#14151C' : col; rr(g, x, y, S, S, 2); g.fill(); g.restore();
      g.strokeStyle = red ? 'rgba(255,42,133,.34)' : 'rgba(7,8,12,.72)'; g.lineWidth = 1.6; rr(g, x, y, S, S, 2); g.stroke();
      if (!red) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x + 4, y + 4, S - 8, 2); }
      T(g, red ? '▒' : row.w[c], x + S / 2, y + S / 2 + 11, { size: red ? 21 : 27, wt: 700, ff: th.mono, fill: red ? '#54566A' : '#070A0F', align: 'center' });
    }
    // physical redaction bars over the barred column
    if (v.redact >= 0 && v.redact < 5) {
      const x = ox + v.redact * (S + gap);
      g.save();
      for (let r = 0; r < 4; r++) {
        const y = top + r * (S + gap) - 1;
        const q = g.createLinearGradient(0, y, 0, y + S + 2); q.addColorStop(0, '#3B3D4A'); q.addColorStop(.5, '#1A1C25'); q.addColorStop(1, '#0E0F16');
        g.fillStyle = q; g.fillRect(x - 2, y + Math.sin(t * 2.2 + r) * 1.2, S + 4, S + 2);
        g.fillStyle = 'rgba(255,42,133,.8)'; g.fillRect(x - 2, y + 1, 2, S); g.fillRect(x + S, y + 1, 2, S);
        g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(x + 6, y + S / 2 - 2, S - 12, 3);
      }
      g.restore();
    }
    // footer
    rule(g, 16, 318, 480, 'rgba(247,247,251,.14)', 1);
    T(g, 'CONTRACT', 16, 333, { size: 6, wt: 700, ff: th.mono, fill: th.muted, track: 1.6 });
    meanings.forEach((m, k) => {
      const col = HW_COLS[perm[k]];
      g.fillStyle = col; g.fillRect(82 + k * 102, 325, 11, 9);
      T(g, m, 97 + k * 102, 333, { size: 5.8, wt: 600, ff: th.mono, fill: '#CFD0DC', track: .8 });
    });
    T(g, v.redact < 0 ? 'NO REDACTION' : `COLUMN ${v.redact + 1} BARRED`, 16, 352, { size: 6.5, wt: 600, ff: th.mono, fill: th.accent, track: 1 });
    T(g, '▶ NEXT GUESS', 496, 352, { size: 9, wt: 700, ff: th.grotesk, fill: th.accent2, align: 'right', track: 1.2 });
    T(g, 'ROTATE CONTRACT · C   REDACT · X   CLEAR · R', 496, 369, { size: 6, wt: 400, ff: th.mono, fill: th.muted, align: 'right', track: .8 });
  };

  /* ---------------------------------------------------------------- 06 AZULEJO */
  const AZ_PAL = ['#2F5AA8', '#C98A2E', '#C8372D', '#2A2622', '#2E6B4F'];
  const AZ_PEN = [1, 1, 2, 2, 2, 3, 3];
  function ceramic(g, x, y, s, c, o) {
    o = o || {};
    const col = AZ_PAL[c % 5] || '#888';
    g.save(); g.fillStyle = 'rgba(64,45,30,.16)'; rr(g, x + 1.4, y + 1.6, s, s, 2); g.fill();
    g.fillStyle = col; rr(g, x, y, s, s, 2); g.fill();
    const q = g.createLinearGradient(x, y, x + s, y + s);
    q.addColorStop(0, 'rgba(255,255,255,.42)'); q.addColorStop(.42, 'rgba(255,255,255,.04)'); q.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = q; rr(g, x, y, s, s, 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.62)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y + s - 3); g.lineTo(x + 2, y + 2); g.lineTo(x + s - 3, y + 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(x + s - 2, y + 3); g.lineTo(x + s - 2, y + s - 2); g.lineTo(x + 3, y + s - 2); g.stroke();
    if (o.motif !== false) {
      g.save(); g.translate(x + s / 2, y + s / 2);
      g.fillStyle = 'rgba(255,255,255,.28)'; diamond(g, 0, 0, s * .27); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .8; g.beginPath(); g.arc(0, 0, s * .34, 0, TAU); g.stroke();
      g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x + s * .27, y + s * .24, Math.max(1, s * .07), 0, TAU); g.fill();
    g.restore();
  }
  P.azul = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 260, 17, '#A87A55', .08, 1.5);
    vgrad(g, 0, 0, 512, 120, 'rgba(255,255,255,.16)', 'rgba(255,255,255,0)');
    T(g, 'AZULEJO', 22, 24, { size: 20, wt: 700, ff: th.serif, fill: th.ink, track: 2.6 });
    T(g, 'TILE · PATTERN · WALL', 22, 37, { size: 6, wt: 600, ff: th.mono, fill: th.muted, track: 1.8 });
    T(g, `ROUND ${v.round || 1} · SCORE ${v.score || 0}`, 492, 22, { size: 9, wt: 700, ff: th.mono, fill: th.ink, align: 'right', track: 1 });
    T(g, 'REPLICATED PEER TO PEER', 492, 34, { size: 5.8, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: 1 });
    rule(g, 18, 44, 476, th.ink, 1.4);
    // pattern lines
    T(g, 'PATTERN LINES', 22, 58, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    for (let r = 0; r < 5; r++) {
      for (let j = 0; j <= r; j++) {
        const x = 22 + j * 25, y = 66 + r * 34;
        g.fillStyle = 'rgba(255,255,255,.32)'; rr(g, x, y, 22, 22, 2); g.fill();
        g.strokeStyle = 'rgba(43,33,27,.16)'; g.lineWidth = 1; rr(g, x, y, 22, 22, 2); g.stroke();
        if (j < (v.lines && v.lines[r] ? v.lines[r].n : 0)) ceramic(g, x, y, 22, (v.lines[r].c + r) % 5);
      }
      T(g, String(r + 1), 10, 81 + r * 34, { size: 6, wt: 600, ff: th.mono, fill: th.muted, align: 'center' });
    }
    // wall
    T(g, 'WALL', 196, 58, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    const wx = 196, wy = 66, cell = 29.6;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const x = wx + c * cell, y = wy + r * cell, col = (c - r + 5) % 5;
      g.fillStyle = 'rgba(255,255,255,.30)'; g.fillRect(x, y, cell, cell);
      g.strokeStyle = 'rgba(43,33,27,.14)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
      if (v.wall && v.wall[r] && v.wall[r][c]) ceramic(g, x + 1.5, y + 1.5, cell - 3, col);
      else {
        g.save(); g.globalAlpha = .28; g.fillStyle = AZ_PAL[col];
        diamond(g, x + cell / 2, y + cell / 2, cell * .15); g.fill();
        g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * .28, 0, TAU); g.strokeStyle = AZ_PAL[col]; g.stroke();
        g.restore();
      }
    }
    // factory discs
    T(g, 'FACTORY', 378, 58, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    const fac = [[406, 94], [478, 94], [406, 166], [478, 166]];
    (v.factory || []).forEach((c, i) => {
      const [cx, cy] = fac[i] || [406, 94];
      g.fillStyle = 'rgba(43,33,27,.12)'; g.beginPath(); g.arc(cx + 2, cy + 2, 29, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.62)'; g.beginPath(); g.arc(cx, cy, 29, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(43,33,27,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 29, 0, TAU); g.stroke();
      g.beginPath(); g.arc(cx, cy, 23, 0, TAU); g.strokeStyle = 'rgba(43,33,27,.16)'; g.stroke();
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4; ceramic(g, cx + Math.cos(a) * 14 - 7, cy + Math.sin(a) * 14 - 7, 14, c); }
    });
    // centre pile
    T(g, 'CENTRE', 378, 212, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    (v.center || []).slice(0, 18).forEach((c, i) => ceramic(g, 378 + (i % 6) * 20, 220 + ((i / 6) | 0) * 20, 18, c));
    // floor
    T(g, 'FLOOR', 22, 252, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    for (let i = 0; i < 7; i++) {
      const x = 22 + i * 26, y = 260, hit = i < (v.floor || 0);
      g.fillStyle = hit ? AZ_PAL[2] : 'rgba(255,255,255,.3)'; rr(g, x, y, 22, 22, 2); g.fill();
      g.strokeStyle = hit ? th.ink : 'rgba(200,55,45,.42)'; g.lineWidth = hit ? 2 : 1; rr(g, x, y, 22, 22, 2); g.stroke();
      T(g, `−${AZ_PEN[i]}`, x + 11, y + 15, { size: 6, wt: 700, ff: th.mono, fill: hit ? '#fff' : th.accent, align: 'center' });
    }
    // hand + score + button
    T(g, 'HOLDING', 22, 304, { size: 6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    if (v.hand) for (let i = 0; i < v.hand.n; i++) ceramic(g, 84 + i * 25, 292 - Math.sin(t * 2.4 + i) * 2, 22, v.hand.c);
    T(g, `${v.score || 0} PTS`, 22, 342, { size: 24, wt: 700, ff: th.serif, fill: th.ink });
    T(g, `ROUND ${v.round || 1}`, 22, 360, { size: 7, wt: 600, ff: th.mono, fill: th.muted, track: 1.2 });
    g.fillStyle = th.accent; rr(g, 400, 310, 100, 34, 2); g.fill();
    g.strokeStyle = th.ink; g.lineWidth = 2.4; rr(g, 400, 310, 100, 34, 2); g.stroke();
    T(g, 'TILE THE WALL', 450, 332, { size: 7.5, wt: 700, ff: th.mono, fill: '#FFF8EC', align: 'center', track: 1 });
    if (v.last) T(g, v.last.slice(0, 24), 492, 290, { size: 6.5, wt: 600, ff: th.mono, fill: th.accent, align: 'right' });
  };

  /* ---------------------------------------------------------------- 07 SCRIBBLE CLUB */
  function roughRect(g, x, y, w, h, seed) {
    const r = rng(seed);
    g.beginPath(); g.moveTo(x + r() * 3, y + r() * 2);
    g.lineTo(x + w - r() * 3, y + r() * 2);
    g.lineTo(x + w - r() * 2, y + h - r() * 2);
    g.lineTo(x + r() * 3, y + h - r() * 2);
    g.closePath();
  }
  P.scribble = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 240, 23, '#9A8E79', .07, 1.4);
    // spiral binding
    for (let i = 0; i < 10; i++) {
      const y = 48 + i * 33;
      g.fillStyle = 'rgba(38,34,28,.13)'; g.beginPath(); g.arc(22, y, 5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(38,34,28,.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(22, y, 7.5, -1.2, 2.1); g.stroke();
    }
    T(g, 'SCRIBBLE CLUB', 42, 27, { size: 24, wt: 700, ff: th.hand, fill: th.ink });
    g.strokeStyle = th.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(42, 33); g.bezierCurveTo(140, 29, 240, 37, 326, 32); g.stroke();
    T(g, 'ROOM 7F2A · 2 / 8', 492, 20, { size: 7, wt: 700, ff: th.type, fill: th.ink, align: 'right', track: 1 });
    T(g, v.lossy ? 'UNRELIABLE · 35% LOSS' : 'RELIABLE · ORDERED', 492, 31, { size: 6.5, wt: 500, ff: th.type, fill: v.lossy ? th.accent2 : th.accent, align: 'right', track: .8 });
    const panels = [[[42, 48, 206, 202], 'YOU', th.accent, v.you || []], [[266, 48, 206, 202], `PEER · ${Math.round((v.lat || 0) * 1000 / 60)}ms`, th.accent2, v.peer || []]];
    for (const [[x, y, w, h], name, col, strokes] of panels) {
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(name === 'YOU' ? -.008 : .006); g.translate(-(x + w / 2), -(y + h / 2));
      g.fillStyle = 'rgba(255,255,255,.5)'; roughRect(g, x, y, w, h, 13 + x); g.fill();
      g.strokeStyle = 'rgba(38,34,28,.5)'; g.lineWidth = 1.7; roughRect(g, x, y, w, h, 13 + x); g.stroke();
      g.save(); roughRect(g, x, y, w, h, 13 + x); g.clip();
      g.fillStyle = 'rgba(38,34,28,.10)';
      for (let yy = y + 10; yy < y + h; yy += 13) for (let xx = x + 10; xx < x + w; xx += 13) { g.beginPath(); g.arc(xx, yy, .55, 0, TAU); g.fill(); }
      g.strokeStyle = name === 'YOU' ? '#3A3630' : 'rgba(38,34,28,.82)'; g.lineWidth = 2.1; g.lineCap = g.lineJoin = 'round';
      for (const s of strokes) {
        g.beginPath();
        s.forEach(([px, py], i) => { const X = x + px / 255 * w, Y = y + py / 255 * h; if (i) g.quadraticCurveTo(X + Math.sin(px * .3) * 1.2, Y + Math.cos(py * .3) * 1.2, X, Y); else g.moveTo(X, Y); });
        if (s.length === 1) g.lineTo(x + s[0][0] / 255 * w + .1, y + s[0][1] / 255 * h);
        g.stroke();
      }
      g.restore();
      T(g, name, x, y - 8, { size: 6.5, wt: 700, ff: th.type, fill: col, track: 1.4 });
      g.restore();
    }
    // data-channel arc
    g.save(); g.strokeStyle = v.lossy ? th.accent2 : th.accent; g.lineWidth = 1.8; g.setLineDash(v.lossy ? [4, 5] : []);
    g.beginPath(); g.moveTo(248, 150); g.quadraticCurveTo(256, 108, 266, 150); g.stroke(); g.setLineDash([]);
    for (const p of (v.queue || []).slice(0, 20)) { const k = v.lat ? clamp(1 - (p.at - v.tick) / v.lat, 0, 1) : 1; g.fillStyle = th.accent; g.beginPath(); g.arc(lerp(248, 266, k), 150 - 34 * Math.sin(k * Math.PI), 1.8, 0, TAU); g.fill(); }
    g.restore();
    // prompt strip
    g.fillStyle = 'rgba(255,255,255,.55)'; roughRect(g, 42, 258, 430, 54, 77); g.fill();
    g.strokeStyle = 'rgba(38,34,28,.55)'; g.lineWidth = 1.7; roughRect(g, 42, 258, 430, 54, 77); g.stroke();
    T(g, 'GUESS THIS', 56, 277, { size: 9, wt: 700, ff: th.type, fill: th.ink, track: 1.2 });
    g.strokeStyle = 'rgba(38,34,28,.5)'; g.lineWidth = 1.4; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(56, 294); g.lineTo(340, 294); g.stroke(); g.setLineDash([]);
    T(g, 'a wobbly one, drawn badly', 56, 304, { size: 7.5, wt: 400, ff: th.hand, fill: th.muted });
    // hand-drawn buttons, one row under the prompt
    const acts = [['LAT +', 0], ['LAT −', 1], ['LOSSY', 2], ['CLEAR', 3]];
    acts.forEach(([lab, i]) => {
      const x = 42 + i * 82, y = 318, w = 72, h = 22;
      g.fillStyle = 'rgba(255,255,255,.5)'; roughRect(g, x, y, w, h, x + y); g.fill();
      g.strokeStyle = 'rgba(38,34,28,.55)'; g.lineWidth = 1.2; roughRect(g, x, y, w, h, x + y); g.stroke();
      T(g, lab, x + w / 2, y + 15, { size: 5.8, wt: 700, ff: th.type, fill: th.ink, align: 'center', track: .6 });
    });
    T(g, `LATENCY ${Math.round((v.lat || 0) * 1000 / 60)} ms · ${v.lossy ? 'UNRELIABLE' : 'RELIABLE, ORDERED'}`, 496, 332, { size: 5.6, wt: 600, ff: th.type, fill: v.lossy ? th.accent2 : th.accent, align: 'right', track: .4 });
    // pencil doodle
    g.save(); g.translate(438, 296); g.rotate(-.6); g.fillStyle = '#D9A05B'; g.fillRect(-3, -20, 6, 34); g.fillStyle = '#3A3630'; g.beginPath(); g.moveTo(-3, 14); g.lineTo(0, 22); g.lineTo(3, 14); g.fill(); g.restore();
  };

  /* ---------------------------------------------------------------- 08 SUDOKU / UTTT */
  const SU_GIVEN = [1, 0, 0, 4, 0, 4, 1, 0, 2, 0, 0, 3, 0, 3, 2, 0];
  P.boards = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 200, 29, '#8C887E', .07, 1.2);
    const face = v.face || 'sudoku';
    T(g, 'SUDOKU / ULTIMATE TTT', 16, 24, { size: 12, wt: 700, ff: th.swiss, fill: th.ink, track: 1.6 });
    T(g, 'TWO FACES · ONE ARTIFACT', 16, 36, { size: 5.8, wt: 500, ff: th.mono, fill: th.muted, track: 1.2 });
    const tw = 86, tx = 496 - tw;
    g.fillStyle = th.ink; rr(g, tx, 12, tw, 22, 11); g.fill();
    T(g, face === 'sudoku' ? 'SUDOKU' : 'ULTIMATE TTT', tx + tw / 2, 26, { size: 6.5, wt: 700, ff: th.mono, fill: th.paper, align: 'center', track: 1.1 });
    if (face === 'sudoku') {
      const C = 56, ox = 144, oy = 62;
      const cand = v.cands || [];
      const conflict = v.conflict || [];
      for (let i = 0; i < 16; i++) {
        const x = ox + (i % 4) * C, y = oy + ((i / 4) | 0) * C, given = SU_GIVEN[i], bad = conflict[i];
        g.fillStyle = bad ? 'rgba(200,55,45,.14)' : given ? 'rgba(47,90,168,.07)' : 'rgba(255,255,255,.18)';
        g.fillRect(x, y, C, C);
        g.strokeStyle = 'rgba(28,28,28,.2)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, C - 1, C - 1);
        if (v.su && v.su[i]) T(g, String(v.su[i]), x + C / 2, y + C / 2 + 11, { size: 31, wt: given ? 700 : 400, ff: th.swiss, fill: bad ? th.accent : given ? th.ink : th.accent2, align: 'center' });
        else for (let k = 0; k < 4; k++) if ((cand[i] || 0) & (1 << k)) T(g, String(k + 1), x + 13 + (k % 2) * 26, y + 18 + ((k >> 1) | 0) * 26, { size: 8, wt: 500, ff: th.mono, fill: 'rgba(28,28,28,.34)', align: 'center' });
      }
      g.strokeStyle = th.ink; g.lineWidth = 3; g.strokeRect(ox, oy, 4 * C, 4 * C);
      g.lineWidth = 2; g.beginPath(); g.moveTo(ox + 2 * C, oy); g.lineTo(ox + 2 * C, oy + 4 * C); g.moveTo(ox, oy + 2 * C); g.lineTo(ox + 4 * C, oy + 2 * C); g.stroke();
      // active constraint box around the first conflict or the first empty
      let active = -1; for (let i = 0; i < 16; i++) if (conflict[i]) { active = i; break; }
      if (active < 0) for (let i = 0; i < 16; i++) if (!v.su || !v.su[i]) { active = i; break; }
      if (active >= 0) { const x = ox + (active % 4) * C, y = oy + ((active / 4) | 0) * C; g.strokeStyle = conflict[active] ? th.accent : th.accent2; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, C - 4, C - 4); }
      T(g, `4 × 4 · ${(v.su || []).filter(Boolean).length} / 16 FILLED`, 16, 320, { size: 6.5, wt: 600, ff: th.mono, fill: th.muted, track: 1 });
      T(g, v.solved ? 'SOLVED ✓' : 'CANDIDATE PENCIL MARKS IN THE CORNERS', 16, 336, { size: 6.5, wt: 600, ff: th.mono, fill: v.solved ? '#2E6B4F' : th.accent2, track: 1 });
      T(g, 'CLICK A CELL · FLIP F · HINT H', 496, 336, { size: 6, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: .8 });
    } else {
      const C = 38, ox = 96, oy = 48;
      for (let i = 0; i < 81; i++) {
        const b = (i / 9) | 0, c = i % 9, x = ox + ((b % 3) * 3 + c % 3) * C, y = oy + (((b / 3) | 0) * 3 + ((c / 3) | 0)) * C;
        const legal = v.legal && v.legal[i], o = v.cells ? v.cells[i] : 0;
        g.fillStyle = legal ? 'rgba(46,107,79,.10)' : 'rgba(255,255,255,.18)'; g.fillRect(x, y, C, C);
        g.strokeStyle = 'rgba(28,28,28,.16)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, C - 1, C - 1);
        if (o) T(g, o === 1 ? '✕' : '○', x + C / 2, y + C / 2 + 7, { size: 22, wt: 700, ff: th.swiss, fill: o === 1 ? th.accent : th.accent2, align: 'center' });
      }
      for (let b = 0; b < 9; b++) {
        const x = ox + (b % 3) * 3 * C, y = oy + ((b / 3) | 0) * 3 * C;
        const hot = v.next === b || (v.next < 0 && v.won && !v.won[b]);
        g.strokeStyle = hot ? th.accent : 'rgba(28,28,28,.5)'; g.lineWidth = hot ? 3 : 1.8; g.strokeRect(x, y, 3 * C, 3 * C);
        if (v.won && v.won[b] && v.won[b] < 3) { g.fillStyle = 'rgba(245,243,238,.7)'; g.fillRect(x, y, 3 * C, 3 * C); T(g, v.won[b] === 1 ? '✕' : '○', x + 1.5 * C, y + 1.5 * C + 18, { size: 58, wt: 700, ff: th.swiss, fill: v.won[b] === 1 ? 'rgba(200,55,45,.5)' : 'rgba(47,90,168,.5)', align: 'center' }); }
      }
      T(g, v.winner ? (v.winner === 3 ? 'DRAW' : (v.winner === 1 ? '✕' : '○') + ' WINS') : `TURN ${v.turn === 1 ? '✕' : '○'}`, 16, 336, { size: 8, wt: 700, ff: th.mono, fill: th.ink, track: 1 });
      T(g, 'CLICK A CELL · AUTO H · FLIP F', 496, 336, { size: 6, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: .8 });
    }
    rule(g, 16, 46, 480, th.line, 1);
    rule(g, 16, 354, 480, th.line, 1);
  };

  /* ---------------------------------------------------------------- 09 LONG HAUL / BALLAST */
  const HAUL_KIND_COL = { hound: '#D9CCB7', cutter: '#E7DCC9', flank: '#CDBFA9', shy: '#EFE4D2' };
  P.haul = (g, v, t, session, th) => {
    v = v || {};
    const W = v.W || 36, H = v.H || 22;
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 240, 13, '#8C6F45', .13, 1.5);
    // header: a yellow sticker wordmark
    g.fillStyle = th.accent; g.fillRect(0, 0, 512, 42);
    g.strokeStyle = th.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 42.5); g.lineTo(512, 42.5); g.stroke();
    g.save(); g.translate(14, 5); g.rotate(-.012); g.fillStyle = th.ink; g.fillRect(0, 0, 196, 30);
    T(g, 'LONG HAUL', 98, 22, { size: 17, wt: 900, ff: th.display, fill: th.accent, align: 'center', track: 1.2 }); g.restore();
    T(g, 'BALLAST / QUARRY PURSUIT', 220, 17, { size: 7, wt: 600, ff: th.mono, fill: th.ink, track: 1.2 });
    T(g, `SCORE ${String(v.score || 0).padStart(5, '0')}  ·  LIVES ${v.lives == null ? 3 : v.lives}`, 496, 17, { size: 9, wt: 700, ff: th.mono, fill: th.ink, align: 'right', track: .8 });
    T(g, `STONES ${v.stones || 0} / ${v.total || 0}  ·  ${v.charge ? 'DYNAMITE' : (v.mode || 'SCATTER').toUpperCase()}`, 496, 31, { size: 7, wt: 600, ff: th.mono, fill: th.ink, align: 'right', track: .8 });
    const TILE = Math.floor(Math.min(360 / W, 244 / H));
    const ox = 14 + (366 - TILE * W) / 2, oy = 48 + (250 - TILE * H) / 2;
    // sand floor
    vgrad(g, 8, 48, 378, 252, '#EFDDBB', '#D9BC8C');
    speckle(g, 8, 48, 378, 252, 180, 31, '#8C6F45', .12, 1.2);
    const tile = v.t || [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (tile[i] !== 1) continue;
      const px = ox + x * TILE, py = oy + y * TILE;
      g.fillStyle = '#4A5568'; g.fillRect(px + 2, py + 2, TILE, TILE);
      g.fillStyle = ((x + y) & 1) ? '#D5B98C' : '#CEB183'; g.fillRect(px, py, TILE - .5, TILE - .5);
      g.fillStyle = 'rgba(244,227,200,.55)'; g.fillRect(px, py, TILE - 1, 1.5);
      g.fillStyle = 'rgba(23,19,14,.24)'; g.fillRect(px, py + TILE - 1.4, TILE, 1);
      g.strokeStyle = 'rgba(23,19,14,.72)'; g.lineWidth = .9; g.strokeRect(px + .4, py + .4, TILE - 1.4, TILE - 1.4);
      const p = v.pk ? v.pk[i] : 0;
      if (p === 1) {
        g.fillStyle = '#2C2820'; pointedStone(g, px + TILE / 2, py + TILE / 2, TILE * .21, i * 1.7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(px + TILE / 2 - 1, py + TILE / 2 - 2, 1.6, 1.2);
      } else if (p === 2) {
        g.fillStyle = '#D8442F'; pointedStone(g, px + TILE / 2, py + TILE / 2, TILE * .30, 4 + i); g.fill();
        g.strokeStyle = th.ink; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#F6C90E'; g.fillRect(px + TILE / 2 - 1, py + TILE / 2 - 4, 2, 7);
      }
    }
    // heaps: outlined boulders
    (v.heaps || []).forEach((q, k) => {
      const px = ox + q.x * TILE + TILE / 2, py = oy + q.y * TILE + TILE / 2;
      g.fillStyle = '#8F6B43'; g.strokeStyle = th.ink; g.lineWidth = 1.3;
      for (let b = 0; b < 3; b++) { g.beginPath(); g.arc(px - 5 + b * 5, py - 2 + (b === 1 ? -4 : 2), 5.2 - b * .5, 0, TAU); g.fill(); g.stroke(); }
      T(g, String(q.n), px, py + TILE * .42, { size: 6, wt: 800, ff: th.mono, fill: '#FFF4DD', align: 'center' });
    });
    // dust devils
    const kinds = ['hound', 'cutter', 'flank', 'shy'];
    const names = ['DUST', 'GUST', 'DRIFT', 'HAZE'];
    (v.p || []).forEach((p) => {
      const px = ox + p.x * TILE + TILE / 2, py = oy + p.y * TILE + TILE / 2, k = kinds.indexOf(p.k) < 0 ? 0 : kinds.indexOf(p.k);
      const fr = !!p.fr, eyes = !!p.eyes;
      g.save();
      g.strokeStyle = th.ink; g.lineWidth = 1.5; g.fillStyle = HAUL_KIND_COL[p.k] || '#D9CCB7';
      if (fr) { g.globalAlpha = p.fr && (v.charge < 25) && ((v.charge >> 2) & 1) ? .55 : 1; g.fillStyle = 'rgba(255,248,232,.12)'; }
      const wob = Math.sin(t * 3.4 + k * 2) * 1.4;
      g.beginPath();
      if (p.k === 'cutter') { g.moveTo(px - 5 + wob, py + 7); g.lineTo(px - 2, py - 9); g.lineTo(px + 3, py - 1); g.lineTo(px + 6 + wob, py + 7); }
      else if (p.k === 'flank') { g.moveTo(px - 7, py + 7); g.lineTo(px - 1 + wob, py - 9); g.lineTo(px + 5, py + 2); g.lineTo(px + 9, py + 7); }
      else if (p.k === 'shy') { g.moveTo(px - 5, py + 6); g.lineTo(px - 3, py - 4); g.lineTo(px + 1, py - 8); g.lineTo(px + 5, py + 6); }
      else { g.moveTo(px - 7, py + 7); g.lineTo(px - 2, py - 6); g.lineTo(px + 2, py - 10); g.lineTo(px + 7, py + 7); }
      g.closePath(); if (!fr) g.fill(); g.stroke();
      if (!eyes) {
        g.fillStyle = th.ink;
        g.beginPath(); g.arc(px - 2.4, py + 1, 1.3, 0, TAU); g.fill();
        g.beginPath(); g.arc(px + 2.4, py + 1, 1.3, 0, TAU); g.fill();
      }
      T(g, names[k], px, py + 12, { size: 4.2, wt: 700, ff: th.mono, fill: 'rgba(23,19,14,.7)', align: 'center', track: .5 });
      g.restore();
    });
    // the crusher
    const h = v.h || { x: 0, y: 0, face: 3 };
    const px = ox + h.x * TILE + TILE / 2, py = oy + h.y * TILE + TILE / 2;
    if (!(v.inv && ((v.inv >> 2) & 1))) {
      // white dust plume
      g.save(); g.globalAlpha = .72; g.fillStyle = '#FFF9EA';
      for (let i = 0; i < 5; i++) {
        const q = (t * .8 + i * .22) % 1, dx = -12 - q * 26, dy = -4 - q * 12;
        g.beginPath(); g.arc(px + dx, py + dy, 4 + q * 7, 0, TAU); g.fill();
      }
      g.restore();
      g.fillStyle = th.shadow; g.fillRect(px - 11, py + 6, 22, 5);
      g.fillStyle = th.accent; g.strokeStyle = th.ink; g.lineWidth = 1.8;
      rr(g, px - 12, py - 8, 24, 14, 3); g.fill(); g.stroke();
      g.fillStyle = '#F9E27A'; g.fillRect(px - 8, py - 6, 9, 6);
      g.fillStyle = th.ink; g.fillRect(px - 12, py + 5, 5, 5); g.fillRect(px + 7, py + 5, 5, 5);
      g.fillStyle = '#3A3326'; g.fillRect(px + 8, py - 2, 5, 7); // hopper mouth
      g.fillStyle = '#F6C90E'; g.beginPath(); g.arc(px - 2, py - 11, 2, 0, TAU); g.fill();
      if (v.dumping) T(g, 'DUMP', px, py - 20, { size: 5, wt: 800, ff: th.mono, fill: th.ink, align: 'center' });
    }
    // load gauge: a column of individual stones
    const gx = 398, gy = 56, gw = 100;
    g.fillStyle = 'rgba(255,248,232,.5)'; g.fillRect(gx, gy, gw, 234);
    g.strokeStyle = th.ink; g.lineWidth = 1.4; g.strokeRect(gx + .5, gy + .5, gw - 1, 233);
    T(g, 'BALLAST', gx + 8, gy + 13, { size: 6.4, wt: 800, ff: th.mono, fill: th.ink, track: 1.2 });
    T(g, `${v.load || 0} / 30`, gx + gw - 8, gy + 13, { size: 7, wt: 700, ff: th.mono, fill: th.ink, align: 'right' });
    for (let i = 0; i < 30; i++) {
      const cx = gx + 14 + (i % 3) * 26, cy = gy + 30 + ((i / 3) | 0) * 19;
      g.fillStyle = i < (v.load || 0) ? (i > 20 ? th.accent2 : th.ink) : 'rgba(23,19,14,.10)';
      pointedStone(g, cx, cy, 7 + (i % 3) * .8, i * 2.1); g.fill();
      if (i < (v.load || 0)) { g.strokeStyle = 'rgba(23,19,14,.35)'; g.lineWidth = .7; g.stroke(); }
    }
    T(g, `SPEED ${v.speed == null ? 100 : v.speed}%`, gx + 8, gy + 228, { size: 6.5, wt: 700, ff: th.mono, fill: th.ink, track: .6 });
    // footer caption
    g.fillStyle = 'rgba(255,248,232,.72)'; g.fillRect(8, 308, 378, 24); g.strokeStyle = th.ink; g.lineWidth = 1.2; g.strokeRect(8.5, 308.5, 377, 23);
    T(g, v.flash || 'CLICK TO STEER · CLICK THE HAULER OR X TO DUMP BALLAST', 14, 324, { size: 6.2, wt: 600, ff: th.mono, fill: th.ink, track: .4 });
    T(g, 'DUMP · X', 398, 324, { size: 7, wt: 800, ff: th.mono, fill: th.ink, track: 1 });
    if (v.status && v.status !== 'play') {
      g.fillStyle = 'rgba(230,207,168,.9)'; g.fillRect(86, 160, 250, 62); g.strokeStyle = th.ink; g.lineWidth = 3; g.strokeRect(86.5, 160.5, 249, 61);
      T(g, v.status === 'won' ? 'HAUL COMPLETE' : 'HAULER LOST', 211, 198, { size: 20, wt: 900, ff: th.display, fill: th.ink, align: 'center', track: 1 });
    }
  };

  /* ---------------------------------------------------------------- 10 SPOREFRONT */
  const SPORE_PRE = [
    { n: 'Conway', c: '#E0A34A' }, { n: 'HighLife', c: '#D9683A' },
    { n: 'Day/Night', c: '#B45A8A' }, { n: 'Seeds', c: '#8FB0A4' }, { n: 'Maze', c: '#C9B26A' }
  ];
  const SPORE_SIDE = [['t', 0], ['t', 32], ['r', 0], ['r', 32], ['b', 0], ['b', 32], ['l', 0], ['l', 32]];
  P.spore = (g, v, t, session, th) => {
    v = v || {};
    vgrad(g, 0, 0, 512, 384, '#1A0F07', '#0D0703');
    // backlit darkroom halo
    glow(g, 168, 204, 260, 'rgba(224,163,74,.20)');
    glow(g, 168, 204, 130, 'rgba(255,214,140,.13)');
    speckle(g, 0, 0, 512, 384, 260, 41, '#F3D9A8', .05, 1.2);
    T(g, 'SPOREFRONT', 18, 23, { size: 12, wt: 700, ff: th.mono, fill: th.ink, track: 4.4 });
    T(g, 'LIFE-LIKE CULTURE · TOROIDAL PLATE', 18, 34, { size: 5.8, wt: 500, ff: th.mono, fill: th.muted, track: 1.2 });
    T(g, `T+${String(v.g || 0).padStart(2, '0')}  R${Math.min(4, (((v.g || 0) / 6) | 0) + 1)}/4  ACT ${v.budget == null ? 3 : v.budget}/3`, 496, 20, { size: 7.8, wt: 700, ff: th.mono, fill: th.accent, align: 'right', track: .6 });
    T(g, v.done ? (v.pass ? 'TRIAL CERTIFIED' : 'TRIAL FAILED') : (v.run ? 'IN CULTURE' : 'FROZEN'), 496, 33, { size: 6.5, wt: 700, ff: th.mono, fill: v.done ? (v.pass ? '#9AD17A' : '#E2572F') : th.muted, align: 'right', track: 1 });
    rule(g, 0, 40, 512, 'rgba(224,163,74,.34)', 1);
    const BX = 18, BY = 52, CS = 4.55, PS = 64 * CS;
    // agar plate
    g.fillStyle = 'rgba(255,219,150,.06)'; g.fillRect(BX - 5, BY - 5, PS + 10, PS + 10);
    g.strokeStyle = 'rgba(224,163,74,.36)'; g.lineWidth = 1.2; g.strokeRect(BX - 5.5, BY - 5.5, PS + 11, PS + 11);
    g.fillStyle = '#2A180B'; g.fillRect(BX, BY, PS, PS);
    for (let i = 0; i < 4096; i++) {
      const x = BX + (i & 63) * CS, y = BY + ((i >> 6) | 0) * CS;
      if (v.ghost && v.ghost[i] && !(v.rows && v.rows[i])) { g.fillStyle = 'rgba(224,163,74,.30)'; g.fillRect(x + 1, y + 1, 1.3, 1.3); }
      if (v.rows && v.rows[i]) {
        const cls = (v.cls && v.cls[i]) || 4, fresh = v.prev && !v.prev[i];
        g.fillStyle = fresh ? '#FFE2B8' : (cls === 1 ? '#E7D79A' : cls === 2 ? '#E6A93C' : cls === 3 ? '#5FB7C8' : '#C97A45');
        g.fillRect(x, y, CS - .45, CS - .45);
        if (cls === 3) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x + .6, y + .6, 1, 1); }
      }
    }
    // edge seed drums
    (v.drums || []).forEach((d, i) => {
      const [s, a] = SPORE_SIDE[i];
      for (let k = 0; k < 32; k++) {
        const on = d.ring >>> ((k - d.rot + 32) % 32) & 1, p = a + k;
        let x, y, w, h;
        if (s === 't' || s === 'b') { x = BX + p * CS; y = s === 't' ? BY - 11 : BY + PS + 2; w = CS - .4; h = 8; }
        else { y = BY + p * CS; x = s === 'l' ? BX - 11 : BX + PS + 2; w = 8; h = CS - .4; }
        g.fillStyle = on ? (d.armed ? '#FFB36B' : 'rgba(224,163,74,.62)') : 'rgba(224,163,74,.14)';
        g.fillRect(x, y, w, h);
      }
      if (i === v.sel) {
        g.strokeStyle = '#FFE2B8'; g.lineWidth = 1.4;
        if (s === 't' || s === 'b') g.strokeRect(BX + a * CS - 1, s === 't' ? BY - 12 : BY + PS + 1, 160, 10);
        else g.strokeRect(s === 'l' ? BX - 12 : BX + PS + 1, BY + a * CS - 1, 10, 160);
      }
      T(g, String(i + 1), s === 't' || s === 'b' ? BX + a * CS + 80 : s === 'l' ? BX - 15 : BX + PS + 14, s === 't' ? BY - 14 : s === 'b' ? BY + PS + 18 : BY + a * CS + 80, { size: 4.6, wt: 700, ff: th.mono, fill: th.muted, align: 'center' });
    });
    // toroidal rule lenses, clipped to the plate so their wrapped copies stay on the agar
    g.save(); g.beginPath(); g.rect(BX, BY, PS, PS); g.clip();
    (v.lenses || []).forEach((L, j) => {
      const col = SPORE_PRE[L.rule] ? SPORE_PRE[L.rule].c : '#E0A34A', cx = BX + (L.x + .5) * CS, cy = BY + (L.y + .5) * CS;
      g.save(); g.globalAlpha = .10; g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 7 * CS, 0, TAU); g.fill(); g.restore();
      for (const off of [-PS, 0, PS]) { g.strokeStyle = col; g.lineWidth = j === v.lsel ? 2 : 1; g.globalAlpha = j === v.lsel ? .95 : .62; g.beginPath(); g.arc(cx, cy + off, 7 * CS, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      T(g, `L${j + 1}`, cx, cy + 3, { size: 5, wt: 800, ff: th.mono, fill: col, align: 'center' });
    });
    g.restore();
    rule(g, BX, BY + PS + 12, PS, 'rgba(224,163,74,.18)', 1);
    T(g, `DENSITY ${(((v.sc && v.sc.d) || 0) * 100).toFixed(1)}% · STILL ${v.a ? v.a.still : 0}/6 · OSC ${v.a ? v.a.osc : 0}/4`, BX, BY + PS + 24, { size: 5.8, wt: 600, ff: th.mono, fill: th.muted, track: .5 });
    // right instrument panel
    const RX = 330;
    g.fillStyle = 'rgba(255,219,150,.035)'; g.fillRect(RX, 52, 166, 300);
    g.strokeStyle = 'rgba(224,163,74,.22)'; g.lineWidth = 1; g.strokeRect(RX + .5, 52.5, 165, 299);
    T(g, 'SCORE', RX + 10, 68, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.4 });
    T(g, String(v.sc ? v.sc.score : 0), RX + 10, 94, { size: 25, wt: 700, ff: th.mono, fill: th.accent });
    T(g, '/ 100 · NEED 80', RX + 62, 93, { size: 6, wt: 500, ff: th.mono, fill: th.muted });
    // status ticks
    [['STILL', v.a ? v.a.still : 0, 6, v.sc && v.sc.ok ? v.sc.ok[0] : false], ['OSC', v.a ? v.a.osc : 0, 4, v.sc && v.sc.ok ? v.sc.ok[1] : false], ['SHIP', v.a ? v.a.ship : 0, 3, true]].forEach(([lab, n, max, ok], i) => {
      T(g, lab, RX + 10, 112 + i * 14, { size: 5.4, wt: 600, ff: th.mono, fill: th.muted, track: 1 });
      for (let k = 0; k < max; k++) { g.fillStyle = k < n ? (ok ? '#9AD17A' : '#E2572F') : 'rgba(224,163,74,.16)'; g.fillRect(RX + 58 + k * 12, 106 + i * 14, 8, 6); }
    });
    // 6-tick forecast trace
    T(g, '6-TICK FORECAST', RX + 10, 168, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.3 });
    g.strokeStyle = 'rgba(224,163,74,.18)'; g.strokeRect(RX + 10.5, 176.5, 146, 54);
    const base = v.sc ? v.sc.score : 40;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = RX + 16 + k * 25, y = 224 - clamp(base * .4 + Math.sin(t * .8 + k * .9) * 18 + k * 2.2, 2, 50);
      if (k) g.lineTo(x, y); else g.moveTo(x, y);
      g.fillStyle = th.accent; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
    }
    g.strokeStyle = th.accent2; g.lineWidth = 1.4; g.stroke();
    // budget pips
    T(g, 'ACTIONS', RX + 10, 250, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.3 });
    for (let k = 0; k < 3; k++) { g.fillStyle = k < (v.budget == null ? 3 : v.budget) ? th.accent : 'rgba(224,163,74,.15)'; g.beginPath(); g.arc(RX + 74 + k * 17, 247, 5, 0, TAU); g.fill(); }
    // lens chips
    (v.lenses || []).forEach((L, j) => {
      const y = 264 + j * 19, col = SPORE_PRE[L.rule] ? SPORE_PRE[L.rule].c : th.accent;
      g.fillStyle = col; g.fillRect(RX + 10, y, 8, 12);
      T(g, `L${j + 1}  ${(SPORE_PRE[L.rule] || SPORE_PRE[0]).n}`, RX + 24, y + 10, { size: 6, wt: 600, ff: th.mono, fill: j === v.lsel ? '#FFE2B8' : th.ink });
    });
    T(g, 'ARM · ROTATE · STEP · RUN', RX + 10, 330, { size: 5.4, wt: 500, ff: th.mono, fill: th.muted, track: .6 });
    T(g, v.msg || 'TOROIDAL CULTURE · EDGE PULSE EVERY 6 TICKS', RX + 10, 346, { size: 5.4, wt: 600, ff: th.mono, fill: th.accent, track: .2 });
    if (v.done) { g.fillStyle = 'rgba(13,7,3,.84)'; g.fillRect(BX + 76, BY + 116, 210, 74); g.strokeStyle = v.pass ? '#9AD17A' : '#E2572F'; g.lineWidth = 2.4; g.strokeRect(BX + 76.5, BY + 116.5, 209, 73); T(g, v.pass ? 'CERTIFIED' : 'FAILED', BX + 181, BY + 160, { size: 22, wt: 700, ff: th.mono, fill: v.pass ? '#9AD17A' : '#E2572F', align: 'center', track: 2 }); }
  };

  /* ---------------------------------------------------------------- 11 TERRARIUM HASH */
  function brassDial(g, cx, cy, r, val, col, lab, marks) {
    const a0 = Math.PI * .75, a1 = Math.PI * 2.25;
    g.fillStyle = '#F3EBDD'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = '#8A6A3E'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(42,36,24,.4)'; g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * i / 10, r0 = r - 5, r1 = r - (i % 5 === 0 ? 12 : 8);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); g.arc(cx, cy, r - 3, a0, a1); g.stroke();
    const a = a0 + (a1 - a0) * clamp(val / 100, 0, 1);
    g.strokeStyle = '#2A2418'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); g.stroke();
    g.fillStyle = '#8A6A3E'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
    T(g, lab, cx, cy + r + 10, { size: 5, wt: 700, ff: FF.mono, fill: '#7A6A50', align: 'center', track: 1 });
    if (marks) for (const m of marks) { const am = a0 + (a1 - a0) * m / 100; g.fillStyle = '#B03A2E'; g.beginPath(); g.arc(cx + Math.cos(am) * (r - 3), cy + Math.sin(am) * (r - 3), 1.8, 0, TAU); g.fill(); }
  }
  P.terra = (g, v, t, session, th) => {
    v = v || {};
    vgrad(g, 0, 0, 512, 384, '#0F1912', '#08110C');
    glow(g, 160, 190, 230, 'rgba(123,224,160,.10)');
    T(g, 'TERRARIUM HASH', 18, 23, { size: 13, wt: 700, ff: th.serif, fill: th.ink, track: 1.8 });
    T(g, 'A WARDIAN CASE · A GENOME IN THE LINK', 18, 35, { size: 5.8, wt: 500, ff: th.mono, fill: th.muted, track: 1 });
    T(g, `#t1p.${v.seedHex || '0000'}`, 496, 20, { size: 8, wt: 700, ff: th.mono, fill: th.accent2, align: 'right', track: 1 });
    T(g, v.col ? 'PRESSED · COLLAPSED' : v.cert ? 'CERTIFIED' : v.run ? 'GROWING' : 'HELD', 496, 33, { size: 6.5, wt: 700, ff: th.mono, fill: v.col ? '#E2572F' : v.cert ? '#9AD17A' : th.accent, align: 'right', track: 1 });
    rule(g, 0, 41, 512, 'rgba(201,162,39,.38)', 1);
    // Wardian case
    const X = 16, Y = 50, W = 314, H = 304, br = 7;
    g.fillStyle = '#6E522F'; g.fillRect(X, Y, W, H);
    g.fillStyle = '#8A6A3E'; g.fillRect(X + 2, Y + 2, W - 4, br); g.fillRect(X + 2, Y + H - br - 2, W - 4, br);
    g.fillRect(X + 2, Y + 2, br, H - 4); g.fillRect(X + W - br - 2, Y + 2, br, H - 4);
    g.strokeStyle = 'rgba(243,235,221,.36)'; g.lineWidth = 1; g.strokeRect(X + 1.5, Y + 1.5, W - 3, H - 3);
    const glassX = X + br + 2, glassY = Y + br + 2, glassW = W - (br + 2) * 2, glassH = H - (br + 2) * 2;
    g.fillStyle = '#0A140E'; g.fillRect(glassX, glassY, glassW, glassH);
    g.fillStyle = 'rgba(169,214,187,.05)'; g.fillRect(glassX, glassY, glassW, glassH);
    g.save(); g.beginPath(); g.rect(glassX, glassY, glassW, glassH); g.clip();
    const cell = glassW / 64;
    for (let i = 0; i < 4096; i++) if (v.rows && v.rows[i]) {
      const cls = (v.cls && v.cls[i]) || 4, cx = glassX + (i & 63) * cell, cy = glassY + ((i >> 6) | 0) * cell;
      const species = cls === 1 ? '#C3D28A' : cls === 2 ? '#E0B04A' : cls === 3 ? '#5FB7C8' : ['#5E8F55', '#7FAF6A', '#4E7A4C', '#9ABF74', '#C9A227'][(i * 7 + (i >> 6)) % 5];
      g.fillStyle = species;
      const rr2 = rng(i + 7);
      for (let k = 0; k < 3; k++) g.fillRect(cx + rr2() * cell, cy + rr2() * cell, 1 + (cls === 2 ? .4 : 0), 1 + (cls === 2 ? .4 : 0));
    }
    // glass highlights
    g.strokeStyle = 'rgba(220,255,238,.055)'; g.lineWidth = 22; g.beginPath(); g.moveTo(glassX - 26, glassY + glassH); g.lineTo(glassX + glassW * .55, glassY - 16); g.stroke();
    g.strokeStyle = 'rgba(220,255,238,.04)'; g.lineWidth = 5; g.beginPath(); g.moveTo(glassX + glassW * .7, glassY + glassH); g.lineTo(glassX + glassW + 10, glassY + 20); g.stroke();
    // soil line
    g.fillStyle = 'rgba(62,44,26,.7)'; g.fillRect(glassX, glassY + glassH - 8, glassW, 8);
    // condensation
    for (let i = 0; i < 14; i++) { const q = h32(i, 9), x = glassX + (q % 1000) / 1000 * glassW, y = glassY + ((q >> 10) % 1000) / 1000 * glassH; g.fillStyle = 'rgba(230,255,242,.28)'; g.beginPath(); g.arc(x, y, .8 + (q % 4) * .35, 0, TAU); g.fill(); }
    g.restore();
    // case glass outline
    g.strokeStyle = 'rgba(201,162,39,.5)'; g.lineWidth = 1; g.strokeRect(glassX + .5, glassY + .5, glassW - 1, glassH - 1);
    // right panel
    const RX = 344;
    g.fillStyle = 'rgba(243,235,221,.035)'; g.fillRect(RX, 50, 152, 304);
    g.strokeStyle = 'rgba(201,162,39,.24)'; g.lineWidth = 1; g.strokeRect(RX + .5, 50.5, 151, 303);
    brassDial(g, RX + 40, 94, 27, v.health || 0, (v.health || 0) < 60 ? '#B03A2E' : '#5E8A48', 'HEALTH');
    brassDial(g, RX + 110, 94, 27, v.dist || 0, (v.dist || 0) > 60 ? '#B03A2E' : '#C9A227', 'DISTURB', [45, 60]);
    T(g, SPORE_LABEL(v.gm, v.gs), RX + 8, 150, { size: 7, wt: 700, ff: th.mono, fill: th.accent, track: .8 });
    T(g, `AGE ${v.tick || 0} · CARE ${v.cares || 0}`, RX + 8, 164, { size: 5.8, wt: 600, ff: th.mono, fill: th.ink, track: .4 });
    T(g, `CELLS ${v.a ? v.a.biomass : 0} · SPECIES ${v.a ? v.a.species : 0}`, RX + 8, 176, { size: 5.8, wt: 500, ff: th.mono, fill: th.muted, track: .3 });
    // genome bits
    T(g, 'GENOME  B / S', RX + 8, 194, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    for (let n = 0; n < 18; n++) {
      const bit = n < 9 ? ((v.db || 0) >> n) & 1 : ((v.ds || 0) >> (n - 9)) & 1;
      const x = RX + 8 + (n % 9) * 11, y = n < 9 ? 202 : 220;
      g.fillStyle = bit ? '#C3D28A' : 'rgba(243,235,221,.10)'; g.fillRect(x, y, 9, 14);
      g.strokeStyle = 'rgba(201,162,39,.30)'; g.lineWidth = .6; g.strokeRect(x + .3, y + .3, 8.4, 13.4);
      T(g, String(n % 9), x + 4.5, y + 10, { size: 4.4, wt: 600, ff: th.mono, fill: bit ? '#0F1912' : th.muted, align: 'center' });
    }
    T(g, 'B', RX + 1, 212, { size: 4.6, wt: 800, ff: th.mono, fill: th.accent2 });
    T(g, 'S', RX + 1, 230, { size: 4.6, wt: 800, ff: th.mono, fill: th.accent2 });
    // tools
    ['MIST', 'PRUNE', 'STIR'].forEach((s, i) => {
      const x = RX + 8 + i * 46, y = 244, on = (v.tool || 0) === i;
      g.fillStyle = on ? '#3A3216' : 'rgba(243,235,221,.04)'; g.fillRect(x, y, 42, 20);
      g.strokeStyle = on ? '#FFE9B0' : 'rgba(201,162,39,.45)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, 41, 19);
      T(g, s, x + 21, y + 13, { size: 5, wt: 700, ff: th.mono, fill: on ? '#FFE9B0' : th.muted, align: 'center', track: .4 });
    });
    T(g, 'PRESS · MUTATE · STEP · NEW', RX + 8, 282, { size: 5, wt: 500, ff: th.mono, fill: th.muted, track: .3 });
    T(g, v.msg || `HEALTH ${Math.round(v.health || 0)} · DISTURB ${Math.round(v.dist || 0)}`, RX + 8, 302, { size: 5.4, wt: 600, ff: th.mono, fill: v.col ? '#E2572F' : th.accent, track: .2 });
    T(g, `STILL ${v.a ? v.a.still : 0} · OSC ${v.a ? v.a.osc : 0} · SHIP ${v.a ? v.a.ship : 0}`, RX + 8, 318, { size: 5.2, wt: 500, ff: th.mono, fill: th.ink, track: .2 });
    T(g, `#t1p. RE-STAGES THE WHOLE CASE`, RX + 8, 338, { size: 4.8, wt: 400, ff: th.mono, fill: th.muted, track: .2 });
  };
  function SPORE_LABEL(bm, sm) { let b = '', s = ''; for (let n = 0; n < 9; n++) { if ((bm || 0) >> n & 1) b += n; if ((sm || 0) >> n & 1) s += n; } return 'B' + b + '/S' + s; }

  /* ---------------------------------------------------------------- 12 DRIFTWATCH */
  function driftFloor(x) {
    return clamp(92 - 7 * Math.sin(x / 95 + .7) - 3 * Math.sin(x / 33 + 2.2) - 18 * Math.exp(-Math.pow((x - 150) / 28, 2)) - 12 * Math.exp(-Math.pow((x - 330) / 30, 2)), 30, 96);
  }
  P.drift = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    for (let y = 0; y < 384; y += 16) { g.fillStyle = 'rgba(141,170,120,.15)'; g.fillRect(0, y, 512, 8); }
    for (let x = 0; x < 512; x += 64) { g.fillStyle = 'rgba(30,43,43,.025)'; g.fillRect(x, 0, 1, 384); }
    speckle(g, 0, 0, 512, 384, 160, 51, '#3A4A3A', .06, 1);
    T(g, 'DRIFTWATCH', 16, 22, { size: 12, wt: 700, ff: th.mono, fill: th.ink, track: 4 });
    T(g, 'BATHYMETRIC PLOT · ONE VALVE · DEAD RECKONING', 16, 34, { size: 5.4, wt: 500, ff: th.type, fill: th.muted, track: .7 });
    T(g, `LEG ${(v.legNo || 0) + 1} · FIXES ${v.fixes || 0}`, 496, 18, { size: 7.5, wt: 700, ff: th.type, fill: th.ink, align: 'right', track: .8 });
    T(g, `SHIFTS ${v.used || 0}/${v.budget || 0} · K=${v.K || 0}+2`, 496, 30, { size: 6, wt: 500, ff: th.type, fill: th.muted, align: 'right', track: .5 });
    // red confidential stamp
    g.save(); g.translate(430, 58); g.rotate(-.18); g.globalAlpha = .55; g.strokeStyle = th.accent; g.lineWidth = 1.6; g.strokeRect(-44, -9, 88, 18); T(g, 'CONFIDENTIAL', 0, 4, { size: 7, wt: 700, ff: th.type, fill: th.accent, align: 'center', track: 2 }); g.restore();
    rule(g, 0, 40, 512, 'rgba(30,43,43,.3)', 1);
    const X = x => 16 + (x / 420) * 480, Z = z => 48 + z * 2.62;
    // depth scale
    [0, 25, 50, 75].forEach(z => { T(g, `${z} m`, 8, Z(z) + 2, { size: 4.8, wt: 600, ff: th.type, fill: th.muted }); });
    // contour lines
    g.save(); g.strokeStyle = 'rgba(47,107,107,.22)'; g.lineWidth = .7;
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 6) { const y = 62 + k * 35 + Math.sin(x * .023 + k) * 6 + Math.cos(x * .011 + k * 2) * 4; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
    // turbulent eddies
    (v.E || []).forEach(e => {
      const cx = X(e[0]), cy = Z(e[1]), rx = Math.max(6, e[2] * 1.02), ry = Math.max(6, e[3] * 2.2);
      g.save(); g.strokeStyle = e[4] < 0 ? 'rgba(47,107,107,.55)' : 'rgba(176,58,46,.42)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
      g.beginPath(); g.ellipse(cx, cy, rx * .62, ry * .62, .3, 0, TAU); g.stroke(); g.restore();
    });
    // sea floor contour: fountain-pen line over hatched depths
    g.beginPath(); g.moveTo(16, 368);
    for (let x = 0; x <= 480; x += 4) g.lineTo(16 + x, Z(driftFloor(x / 480 * 420)));
    g.lineTo(496, 368); g.closePath();
    g.fillStyle = 'rgba(47,107,107,.12)'; g.fill();
    g.beginPath();
    for (let x = 0; x <= 480; x += 4) { const y = Z(driftFloor(x / 480 * 420)); if (x === 0) g.moveTo(16 + x, y); else g.lineTo(16 + x, y); }
    g.strokeStyle = 'rgba(30,43,43,.72)'; g.lineWidth = 1.5; g.stroke();
    // depth soundings
    for (let x = 40; x < 480; x += 78) T(g, `${Math.round(driftFloor(x / 480 * 420))}`, 16 + x, Z(driftFloor(x / 480 * 420)) - 4, { size: 4.5, wt: 500, ff: th.type, fill: 'rgba(30,43,43,.55)' });
    // uncertainty ellipse around the boat
    const sx = X(v.x || 0), sz = Z(v.z || 0);
    g.save(); g.setLineDash([3, 4]); g.strokeStyle = 'rgba(30,43,43,.55)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(sx, sz + 8, 46, 21, -.1, 0, TAU); g.stroke(); g.restore();
    speckle(g, sx - 46, sz - 12, 92, 42, 52, 61, '#1E2B2B', .22, .8);
    // beacon: red stamped sonar fix
    const bx = X(v.bx || 0), bz = Z(v.bz || 0);
    g.save(); g.strokeStyle = th.accent; g.lineWidth = 1.2; g.setLineDash([2, 3]);
    g.beginPath(); g.arc(bx, bz, 12 + (t * 10 % 16), 0, TAU); g.stroke(); g.setLineDash([]); g.restore();
    cross(g, bx, bz, 9, th.accent, 1.4);
    g.strokeStyle = th.accent; g.lineWidth = 1.2; g.beginPath(); g.arc(bx, bz, 5, 0, TAU); g.stroke();
    T(g, 'BEACON', bx, bz - 14, { size: 5, wt: 700, ff: th.type, fill: th.accent, align: 'center', track: 1.2 });
    // trail
    g.save(); g.strokeStyle = 'rgba(30,43,43,.68)'; g.lineWidth = 1.3; g.lineJoin = 'round';
    g.beginPath(); (v.trail || []).forEach((p, i) => { if (i) g.lineTo(X(p[0]), Z(p[1])); else g.moveTo(X(p[0]), Z(p[1])); }); g.lineTo(sx, sz); g.stroke(); g.restore();
    (v.marks || []).forEach(p => { cross(g, X(p[0]), Z(p[1]), 4, 'rgba(176,58,46,.7)', 1); });
    // submersible
    g.fillStyle = v.vent ? '#E8BE6E' : '#2F6B6B'; g.strokeStyle = th.ink; g.lineWidth = 1.2;
    g.beginPath(); g.arc(sx, sz, 6, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(sx + 1.5, sz - 1.5, 1.3, 0, TAU); g.fill();
    if (v.vent) { g.fillStyle = 'rgba(232,190,110,.7)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(sx - 2 + i * 2, sz - 10 - ((t * 14 + i * 5) % 12), 1.2, 0, TAU); g.fill(); } }
    // valve lever
    const lx = 420, ly = 320;
    g.fillStyle = 'rgba(30,43,43,.08)'; g.fillRect(lx - 4, ly - 30, 88, 54);
    g.strokeStyle = 'rgba(30,43,43,.34)'; g.strokeRect(lx - 3.5, ly - 29.5, 87, 53);
    T(g, 'VALVE', lx, ly - 34, { size: 5.2, wt: 700, ff: th.type, fill: th.muted, track: 1.2 });
    g.save(); g.translate(lx + 30, ly + 2); g.rotate(v.vent ? -.7 : .65);
    g.strokeStyle = th.ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -23); g.stroke();
    g.fillStyle = v.vent ? '#E8BE6E' : '#2F6B6B'; g.beginPath(); g.arc(0, -24, 5, 0, TAU); g.fill();
    g.restore();
    T(g, v.vent ? 'VENT ▲' : 'FLOOD ▼', lx + 30, ly + 26, { size: 5.6, wt: 700, ff: th.type, fill: v.vent ? '#9A6B20' : '#2F6B6B', align: 'center', track: .7 });
    // depth / status
    T(g, `${(v.z || 0).toFixed(1)} m · ${Math.round(v.dist || 0)} m TO BEACON`, 16, 374, { size: 7, wt: 700, ff: th.type, fill: th.ink, track: .4 });
    T(g, v.status === 'LIVE' ? (v.auto ? 'AUTOPILOT' : 'ON THE PLOT') : v.status === 'FIXED' ? 'FIX CONFIRMED' : v.status, 496, 374, { size: 6.5, wt: 700, ff: th.type, fill: v.status === 'FIXED' ? '#2E6B4F' : v.status === 'LIVE' ? th.muted : th.accent, align: 'right', track: .8 });
    // fold creases
    g.strokeStyle = 'rgba(30,43,43,.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(256, 40); g.lineTo(256, 360); g.stroke();
  };

  /* ---------------------------------------------------------------- 13 LOOMWEIGHT */
  const LOOM_COLS = [[46, 77, 123], [177, 57, 47], [185, 138, 60], [109, 144, 121], [51, 48, 46], [201, 98, 125]];
  P.loom = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 300, 71, '#8A7458', .07, 1.6);
    // kento registration marks
    g.strokeStyle = 'rgba(33,28,21,.55)'; g.lineWidth = 1.4;
    [[12, 44, 1, 1], [500, 44, -1, 1], [12, 340, 1, -1], [500, 340, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * 12); g.lineTo(x, y); g.lineTo(x + sx * 12, y); g.stroke(); });
    T(g, 'LOOMWEIGHT', 26, 25, { size: 15, wt: 700, ff: th.serif, fill: th.ink, track: 2.2 });
    T(g, 'A JACQUARD SAMPLE · 3:4 POLYRHYTHM', 26, 37, { size: 5.6, wt: 500, ff: th.mono, fill: th.muted, track: 1 });
    T(g, `SAMPLE ${(v.n || 0) + 1} · PICK ${v.pick || 0}/${v.goal || 120}`, 496, 23, { size: 7, wt: 700, ff: th.mono, fill: th.ink, align: 'right', track: .6 });
    T(g, v.status === 'WEAVING' ? (v.open ? 'SHED OPEN' : 'SHED CLOSED') : v.status, 496, 35, { size: 6, wt: 700, ff: th.mono, fill: v.status === 'FRAMED' ? '#2E6B4F' : v.status === 'HALT' ? th.accent : v.open ? th.accent : th.muted, align: 'right', track: .8 });
    rule(g, 16, 44, 480, th.ink, 1.2);
    // 3:4 polyrhythm wheel
    const cx = 84, cy = 112, R = 44;
    g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); g.arc(cx, cy, R + 10, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(33,28,21,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(33,28,21,.22)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R * .58, 0, TAU); g.stroke();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i / 3 * TAU; g.fillStyle = th.accent; g.beginPath(); g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3.4, 0, TAU); g.fill(); }
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + i / 4 * TAU; g.fillStyle = th.accent2; g.beginPath(); g.arc(cx + Math.cos(a) * R * .58, cy + Math.sin(a) * R * .58, 2.8, 0, TAU); g.fill(); }
    const fr = v.frac || 0, a3 = -Math.PI / 2 + (((v.pick || 0) % 3) + fr) / 3 * TAU, a4 = -Math.PI / 2 + (((v.pick || 0) % 4) + fr) / 4 * TAU;
    g.strokeStyle = th.accent; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a3) * R, cy + Math.sin(a3) * R); g.stroke();
    g.strokeStyle = th.accent2; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a4) * R * .58, cy + Math.sin(a4) * R * .58); g.stroke();
    T(g, '3', cx - 30, cy + R + 14, { size: 8, wt: 700, ff: th.serif, fill: th.accent });
    T(g, '4', cx + 28, cy + R + 14, { size: 8, wt: 700, ff: th.serif, fill: th.accent2 });
    // warp and fell
    const WX = 176, WY = 54, WW = 316, fell = 154;
    g.strokeStyle = 'rgba(33,28,21,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(WX - 4, WY); g.lineTo(WX + WW, WY); g.stroke();
    g.strokeStyle = 'rgba(33,28,21,.28)'; g.lineWidth = 1;
    const pitch = WW / 13;
    for (let i = 0; i < 14; i++) { const x = WX + pitch * i; g.beginPath(); g.moveTo(x, WY); g.lineTo(x - 5, fell); g.moveTo(x, WY); g.lineTo(x + 5, fell); g.stroke(); }
    g.fillStyle = 'rgba(33,28,21,.82)';
    (v.dead || []).forEach(d => g.fillRect(WX + pitch * d[0] - 6, WY, 12, fell - WY));
    T(g, 'WARP', WX, WY - 7, { size: 5, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    // tangles
    (v.tangles || []).forEach(tg => {
      const x = WX + pitch * tg[0], hot = tg[1] >= 3;
      g.strokeStyle = hot ? th.accent : 'rgba(33,28,21,.72)'; g.lineWidth = 1.6 + tg[1] * .35;
      for (let k = 0; k < tg[1]; k++) { g.beginPath(); g.ellipse(x, fell - 38, 3 + tg[1] * 1.3 + k * 1.2, 2.6 + tg[1] * .6, .5, 0, TAU); g.stroke(); }
    });
    // shuttle
    g.fillStyle = '#E9D9BB'; g.beginPath(); g.ellipse(WX + ((v.pick || 0) % 14) * pitch + 5, fell - 2, 10, 3.4, 0, 0, TAU); g.fill();
    // cloth picks
    const cx0 = 176, cy0 = 206, cw = 316 / 14, rh = 7.4;
    g.strokeStyle = 'rgba(33,28,21,.5)'; g.lineWidth = 1.4; g.strokeRect(cx0 - 4, cy0 - 8, 324, 126);
    T(g, 'CLOTH', cx0, cy0 - 12, { size: 5, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    // the empty loom still shows its warp and weft guides
    g.save(); g.strokeStyle = 'rgba(33,28,21,.10)'; g.lineWidth = .7;
    for (let c = 0; c <= 14; c++) { g.beginPath(); g.moveTo(cx0 + c * cw, cy0 - 4); g.lineTo(cx0 + c * cw, cy0 + 14 * rh); g.stroke(); }
    for (let r = 0; r <= 15; r++) { g.beginPath(); g.moveTo(cx0 - 2, cy0 + r * rh); g.lineTo(cx0 + 14 * cw, cy0 + r * rh); g.stroke(); }
    g.restore();
    (v.cloth || []).slice(-14).reverse().forEach((row, i) => {
      const f = row[0] === 1 ? .84 : row[0] === 2 ? .62 : row[0] === 3 ? .94 : 1, dry = row[6] ? .64 : 1;
      for (let c = 0; c < 14; c++) {
        if ((v.dead || []).some(d => d[0] === c && d[1] <= row[7])) continue;
        const on = row[1] >> (c % 12) & 1;
        const base = [235, 223, 196];
        g.fillStyle = on ? `rgb(${Math.round(base[0] + (row[3] - base[0]) * f * dry)},${Math.round(base[1] + (row[4] - base[1]) * f * dry)},${Math.round(base[2] + (row[5] - base[2]) * f * dry)})` : 'rgba(205,182,143,.22)';
        g.fillRect(cx0 + c * cw, cy0 + i * rh, cw - .6, rh - .6);
      }
      if (row[0] === 4) { g.fillStyle = th.accent; g.fillRect(cx0 + row[2] * cw + 2, cy0 + i * rh, 2.4, rh); }
    });
    // cards strip
    T(g, 'CARDS', 176, 348, { size: 5, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    const cardW = 11;
    for (let i = 0; i < 24; i++) {
      const x = 208 + i * cardW, y = 340, cur = (v.pick || 0) % 24 === i;
      g.fillStyle = cur ? '#E8DAB2' : 'rgba(33,28,21,.18)'; g.fillRect(x, y, cardW - 1.5, 16);
      for (let b = 0; b < 12; b++) if (v.cards && (v.cards[i] >> b & 1)) { g.fillStyle = cur ? '#211C15' : 'rgba(33,28,21,.55)'; g.fillRect(x + 2 + ((b / 4) | 0) * 3, y + 2 + (b % 4) * 3, 2, 2); }
    }
    // bobbin + tears
    const b = v.tray && v.tray[0] ? v.tray[0] : [0, 1, 120, 100, 80];
    T(g, 'BOBBIN', 26, 218, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    g.fillStyle = 'rgba(33,28,21,.12)'; g.fillRect(26, 226, 128, 13);
    g.fillStyle = `rgb(${b[2]},${b[3]},${b[4]})`; g.fillRect(26, 226, 128 * clamp(b[0] / Math.max(1, b[1]), 0, 1), 13);
    T(g, v.dry ? 'DRY · SPLICE' : `${Math.max(0, b[0])} PICKS LEFT`, 26, 252, { size: 6, wt: 700, ff: th.mono, fill: v.dry ? th.accent : th.ink, track: .4 });
    T(g, 'TEARS', 26, 274, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    for (let i = 0; i < 3; i++) { g.fillStyle = i < (v.tears || 0) ? th.accent : 'rgba(33,28,21,.14)'; g.beginPath(); g.arc(72 + i * 17, 270, 5, 0, TAU); g.fill(); }
    T(g, `CATCH ${v.clean || 0}+${v.hurry || 0} · SPLICE ${v.splices || 0}`, 26, 298, { size: 5.4, wt: 500, ff: th.mono, fill: th.ink, track: .2 });
    T(g, v.grade || 'STRIKE WHEN THE SHED OPENS', 26, 316, { size: 5.6, wt: 700, ff: th.mono, fill: (v.grade || '').indexOf('CLEAN') === 0 ? '#2E6B4F' : th.accent, track: .2 });
    // hanko stamp
    g.save(); g.translate(44, 352); g.rotate(.06); g.fillStyle = th.accent; g.fillRect(-17, -17, 34, 34); g.strokeStyle = 'rgba(255,255,255,.36)'; g.lineWidth = 1; g.strokeRect(-13, -13, 26, 26); T(g, '織', 0, 7, { size: 16, wt: 700, ff: th.serif, fill: '#FFF3E6', align: 'center' }); g.restore();
    if (v.status && v.status !== 'WEAVING') { g.fillStyle = 'rgba(243,235,221,.86)'; g.fillRect(120, 156, 280, 46); g.strokeStyle = th.ink; g.lineWidth = 2; g.strokeRect(120.5, 156.5, 279, 45); T(g, v.status === 'FRAMED' ? 'CLOTH FRAMED' : 'LOOM HALTED · 3 TEARS', 260, 185, { size: 16, wt: 700, ff: th.serif, fill: v.status === 'FRAMED' ? '#2E6B4F' : th.accent, align: 'center', track: 1.4 }); }
  };

  /* ---------------------------------------------------------------- 14 DEADLOCK */
  const DEAD_LV = [
    { name: 'THE RING', rect: { A: [30, 92, 120, 56], B: [362, 92, 120, 56], C: [196, 196, 120, 56] }, res: ['A', 'B', 'C'] },
    { name: 'INVERSION', rect: { S1: [176, 124, 160, 62] }, res: ['S1'] },
    { name: 'THE POLITE RING', rect: { A: [60, 112, 130, 56], B: [322, 112, 130, 56] }, res: ['A', 'B'] }
  ];
  const DEAD_COL = ['#F2B84B', '#5FB7C8', '#B79BFF'];
  P.dead = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 260, 81, '#E4E1D2', .07, 1.1);
    // enamel panel bevel and screws
    g.strokeStyle = 'rgba(228,225,210,.14)'; g.lineWidth = 2; g.strokeRect(4, 4, 504, 376);
    g.strokeStyle = 'rgba(0,0,0,.24)'; g.strokeRect(7, 7, 498, 370);
    [[11, 11], [501, 11], [11, 373], [501, 373]].forEach(([x, y]) => { g.fillStyle = 'rgba(228,225,210,.3)'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.stroke(); });
    const L = DEAD_LV[v.lv || 0] || DEAD_LV[0], byId = {};
    (v.carts || []).forEach(c => { byId[c.id] = c; });
    T(g, L.name, 18, 24, { size: 12, wt: 700, ff: th.swiss, fill: th.ink, track: 2.2 });
    T(g, 'INTERLOCKING · SYNCHRONOUS BLOCK SECTIONS', 18, 36, { size: 5.4, wt: 500, ff: th.mono, fill: th.muted, track: .8 });
    T(g, `T${String(v.tick || 0).padStart(3, '0')}`, 496, 18, { size: 9, wt: 700, ff: th.mono, fill: th.accent, align: 'right' });
    T(g, `HOLD ${v.hold || 0} · LOAN ${v.loan || 0}`, 496, 31, { size: 6, wt: 600, ff: th.mono, fill: th.muted, align: 'right', track: .6 });
    g.fillStyle = v.status === 'running' ? (v.run ? '#9AD17A' : th.accent) : (v.status === 'won' ? '#9AD17A' : th.accent2);
    g.beginPath(); g.arc(486, 42, 3, 0, TAU); g.fill();
    // block-instrument row: section lamps and a sleeper track
    T(g, 'BLOCK INSTRUMENTS', 18, 58, { size: 4.8, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    g.strokeStyle = 'rgba(228,225,210,.18)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(130, 54); g.lineTo(420, 54); g.stroke();
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(136 + i * 28, 50); g.lineTo(136 + i * 28, 58); g.stroke(); }
    for (let i = 0; i < 6; i++) {
      const lit = v.run && (i + (v.tick || 0) / 8 | 0) % 6 === 0;
      g.save(); if (lit) { g.shadowColor = 'rgba(242,184,75,.8)'; g.shadowBlur = 8; }
      g.fillStyle = lit ? th.accent : 'rgba(228,225,210,.14)'; g.beginPath(); g.arc(142 + i * 54, 66, 4, 0, TAU); g.fill(); g.restore();
    }
    T(g, 'SECTION RELEASE', 484, 58, { size: 4.8, wt: 700, ff: th.mono, fill: th.muted, align: 'right', track: 1.2 });
    // sections: illuminated track blocks
    L.res.forEach(r => {
      const q = L.rect[r], own = v.owner ? v.owner[r] : null, oc = own ? DEAD_COL[(byId[own] ? byId[own].i : 0) % 3] : 'rgba(228,225,210,.32)';
      g.fillStyle = 'rgba(0,0,0,.22)'; rr(g, q[0], q[1], q[2], q[3], 3); g.fill();
      g.fillStyle = own ? 'rgba(242,184,75,.24)' : 'rgba(228,225,210,.035)'; rr(g, q[0] + 2, q[1] + 2, q[2] - 4, q[3] - 4, 2); g.fill();
      g.strokeStyle = oc; g.lineWidth = own ? 3 : 1.4; rr(g, q[0], q[1], q[2], q[3], 3); g.stroke();
      if (own) { g.save(); g.shadowColor = 'rgba(242,184,75,.55)'; g.shadowBlur = 10; g.strokeStyle = oc; g.lineWidth = 1.2; rr(g, q[0] + 5, q[1] + 5, q[2] - 10, q[3] - 10, 2); g.stroke(); g.restore(); }
      T(g, r, q[0] + 9, q[1] + 17, { size: 13, wt: 700, ff: th.mono, fill: oc });
      T(g, own ? own : 'FREE', q[0] + q[2] - 9, q[1] + q[3] - 8, { size: 5.4, wt: 700, ff: th.mono, fill: own ? oc : th.muted, align: 'right', track: .8 });
      // the section itself is a piece of track: two rails and sleepers
      const ty = q[1] + q[3] * .62;
      g.save(); g.strokeStyle = own ? 'rgba(242,184,75,.45)' : 'rgba(228,225,210,.14)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(q[0] + 8, ty - 4); g.lineTo(q[0] + q[2] - 8, ty - 4); g.moveTo(q[0] + 8, ty + 4); g.lineTo(q[0] + q[2] - 8, ty + 4); g.stroke();
      for (let x = q[0] + 14; x < q[0] + q[2] - 10; x += 13) { g.beginPath(); g.moveTo(x, ty - 7); g.lineTo(x, ty + 7); g.stroke(); }
      g.restore();
    });
    // wait-for arcs
    (v.edges || []).forEach(([a, b]) => {
      const p = byId[a], q = byId[b]; if (!p || !q) return;
      const ang = Math.atan2(q.y - p.y, q.x - p.x), ex = q.x - Math.cos(ang) * 25, ey = q.y - Math.sin(ang) * 18;
      const inC = v.cyc && v.cyc.includes(a);
      g.save(); g.strokeStyle = th.accent2; g.lineWidth = inC ? 3.2 : 1.8; if (inC) { g.shadowColor = 'rgba(200,55,45,.7)'; g.shadowBlur = 8; }
      g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo((p.x + q.x) / 2 + 18, (p.y + q.y) / 2 - 22, ex, ey); g.stroke();
      g.fillStyle = th.accent2; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - Math.cos(ang - .5) * 9, ey - Math.sin(ang - .5) * 9); g.lineTo(ex - Math.cos(ang + .5) * 9, ey - Math.sin(ang + .5) * 9); g.fill();
      g.restore();
    });
    // carts as enamel plates
    (v.carts || []).forEach(c => {
      const col = DEAD_COL[(c.i || 0) % 3], x = Math.round(c.x), y = Math.round(c.y);
      g.save(); g.globalAlpha = c.done ? .5 : 1;
      g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x - 25 + 2, y - 13 + 2, 50, 26, 2); g.fill();
      g.fillStyle = '#1A211B'; rr(g, x - 25, y - 13, 50, 26, 2); g.fill();
      g.strokeStyle = c.blk ? th.accent2 : col; g.lineWidth = 2; rr(g, x - 25, y - 13, 50, 26, 2); g.stroke();
      T(g, c.id, x, y + 2, { size: 10, wt: 700, ff: th.mono, fill: col, align: 'center', track: .6 });
      g.fillStyle = 'rgba(228,225,210,.16)'; g.fillRect(x - 22, y + 8, 44, 3);
      g.fillStyle = col; g.fillRect(x - 22, y + 8, 44 * clamp(c.prog || 0, 0, 1), 3);
      for (let k = 0; k < Math.min(4, c.pr || 0); k++) { g.fillStyle = th.accent; g.fillRect(x - 20 + k * 7, y - 19, 4, 3); }
      if (c.holding) { g.fillStyle = '#FFB35C'; g.fillRect(x + 29, y - 10, 4, 16); }
      if (c.boosted) { g.fillStyle = '#9AD17A'; g.beginPath(); g.moveTo(x + 33, y + 6); g.lineTo(x + 43, y + 6); g.lineTo(x + 38, y - 5); g.fill(); }
      if (c.done) T(g, 'OK', x, y + 22, { size: 5, wt: 800, ff: th.mono, fill: '#9AD17A', align: 'center' });
      g.restore();
    });
    // cart tapes rack
    T(g, 'CART TAPES', 340, 270, { size: 5.2, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    for (let i = 0; i < 3; i++) {
      const y = 278 + i * 12;
      g.fillStyle = 'rgba(228,225,210,.16)'; g.fillRect(340, y, 156, 9);
      g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 12; k++) g.fillRect(344 + k * 12, y + 3, 3, 3);
      T(g, ['C0', 'C1', 'C2'][i], 500, y + 7, { size: 4.8, wt: 700, ff: th.mono, fill: th.muted, align: 'right' });
    }
    // status strip + buttons
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(8, 306, 496, 22);
    T(g, v.msg || 'RUNNING', 256, 321, { size: 7, wt: 700, ff: th.mono, fill: v.col || th.accent, align: 'center', track: .8 });
    const btns = [['GO / PAUSE', th.accent], ['STEP', th.accent], ['RESET', '#5FB7C8'], ['NEXT', th.ink]];
    btns.forEach(([lab, col], i) => {
      const x = 8 + i * 124, y = 336, w = 116, h = 36;
      g.fillStyle = v.run && i === 0 ? col : 'rgba(0,0,0,.26)'; rr(g, x, y, w, h, 2); g.fill();
      g.strokeStyle = col; g.lineWidth = 1.4; rr(g, x, y, w, h, 2); g.stroke();
      T(g, lab, x + w / 2, y + 23, { size: 7, wt: 700, ff: th.mono, fill: v.run && i === 0 ? '#2B332B' : col, align: 'center', track: 1 });
    });
  };

  /* ---------------------------------------------------------------- 15 BYZANTINE CHOIR */
  const BYZ_LV = [
    { name: 'THE SCHISM', tw: { C: [256, 76], A: [62, 178], B: [150, 262], D: [362, 262], E: [450, 178] }, miss: ['C-E', 'A-E'], sus: ['B'] },
    { name: 'THE EMPTY CHAIR', tw: { C: [256, 76], A: [100, 196], B: [256, 266], D: [412, 196] }, miss: ['A-D'], sus: ['C'] }
  ];
  function byzKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
  P.byz = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 240, 91, '#8A7A60', .08, 1.3);
    // engraved topography
    g.save(); g.strokeStyle = 'rgba(42,36,24,.10)'; g.lineWidth = .7;
    for (let k = 0; k < 13; k++) {
      g.beginPath();
      for (let x = -10; x <= 522; x += 7) { const y = 60 + k * 25 + Math.sin(x * .03 + k * .8) * 8 + Math.cos(x * .012 + k) * 5; if (x === -10) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
    T(g, 'BYZANTINE CHOIR', 18, 23, { size: 13, wt: 700, ff: th.serif, fill: th.ink, track: 2.4 });
    T(g, 'OPTICAL SEMAPHORE · ORAL MESSAGE TREE OM(1)', 18, 35, { size: 5.4, wt: 500, ff: th.mono, fill: th.muted, track: .8 });
    T(g, `n=${v.n || 5} · f=${v.f || 1} · NEED n ≥ 3f+1`, 496, 20, { size: 7, wt: 600, ff: th.mono, fill: th.ink, align: 'right', track: .5 });
    T(g, `CUT ${v.cuts || 0} · DELAY ${v.dels || 0}`, 496, 33, { size: 6, wt: 600, ff: th.mono, fill: th.muted, align: 'right', track: .6 });
    rule(g, 16, 42, 480, th.ink, 1.2);
    const L = BYZ_LV[v.lv || 0] || BYZ_LV[0], ids = Object.keys(L.tw);
    const edges = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!L.miss.includes(byzKey(ids[i], ids[j]))) edges.push(byzKey(ids[i], ids[j]));
    // links
    edges.forEach(k => {
      const [a, b] = k.split('-'), p = L.tw[a], q = L.tw[b], s = (v.S && v.S[k]) || 'open', mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      g.save(); g.lineWidth = s === 'cut' ? 1.8 : 1.2;
      g.strokeStyle = s === 'open' ? 'rgba(47,90,168,.62)' : s === 'cut' ? th.accent2 : '#A8794A';
      if (s === 'delay') g.setLineDash([5, 4]);
      g.beginPath();
      if (s === 'cut') { g.moveTo(p[0], p[1]); g.lineTo(p[0] + (q[0] - p[0]) * .4, p[1] + (q[1] - p[1]) * .4); g.moveTo(q[0], q[1]); g.lineTo(q[0] + (p[0] - q[0]) * .4, q[1] + (p[1] - q[1]) * .4); }
      else { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
      g.stroke(); g.setLineDash([]);
      if (s === 'cut') cross(g, mx, my, 5, th.accent2, 1.4);
      if (s === 'delay') T(g, '+1', mx, my - 6, { size: 5, wt: 700, ff: th.mono, fill: '#A8794A', align: 'center' });
      g.restore();
    });
    // towers
    ids.forEach(id => {
      const [x, y] = L.tw[id], traitor = L.sus.includes(id);
      g.save();
      g.fillStyle = 'rgba(42,36,24,.10)'; g.beginPath(); g.ellipse(x, y + 18, 16, 5, 0, 0, TAU); g.fill();
      g.strokeStyle = th.ink; g.lineWidth = 1.2;
      g.fillStyle = '#E6D9BE'; g.fillRect(x - 9, y - 9, 18, 27); g.strokeRect(x - 9.5, y - 9.5, 19, 28);
      g.fillStyle = '#A8794A'; g.fillRect(x - 12, y + 12, 24, 5); g.strokeRect(x - 12.5, y + 12.5, 25, 4);
      g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x, y - 34); g.stroke();
      // semaphore arms
      const a1 = -.8 + Math.sin(t * .7 + x) * .12, a2 = 1.1 + Math.cos(t * .55 + y) * .1;
      g.strokeStyle = traitor ? th.accent2 : '#6B5330'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + Math.cos(a1) * 17, y - 30 + Math.sin(a1) * 17); g.stroke();
      g.beginPath(); g.moveTo(x, y - 27); g.lineTo(x + Math.cos(a2) * 14, y - 27 + Math.sin(a2) * 14); g.stroke();
      g.fillStyle = traitor ? th.accent2 : th.ink; g.beginPath(); g.arc(x, y - 30, 2.2, 0, TAU); g.fill();
      T(g, id, x, y + 32, { size: 7, wt: 700, ff: th.mono, fill: traitor ? th.accent2 : th.ink, align: 'center', track: .6 });
      if (traitor) T(g, 'TRAITOR', x, y + 42, { size: 4.2, wt: 700, ff: th.mono, fill: th.accent2, align: 'center', track: .8 });
      g.restore();
    });
    // messages in flight
    if (v.sent && v.run && v.run.msgs) {
      v.run.msgs.forEach(m => {
        const st0 = m.r === 1 ? 0 : 70, dur = m.a === 2 ? 120 : 60, f = clamp((v.an - st0) / dur, 0, 1), p = L.tw[m.f], q = L.tw[m.t];
        if (!p || !q) return;
        g.fillStyle = m.v === 'A' ? '#2F5AA8' : th.accent2; g.beginPath(); g.arc(lerp(p[0], q[0], f), lerp(p[1], q[1], f), 2.2, 0, TAU); g.fill();
      });
    }
    // adversary equivocation badge
    g.save(); g.translate(448, 312); g.rotate(-.08);
    g.fillStyle = th.accent2; g.beginPath();
    for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, r2 = k % 2 ? 26 : 30; const px = Math.cos(a) * r2, py = Math.sin(a) * r2; if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(240,232,216,.9)'; g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
    T(g, 'EQUIVOCATION', 0, -2, { size: 4.8, wt: 700, ff: th.mono, fill: th.accent2, align: 'center', track: .8 });
    T(g, `WORST CASE · f=${v.f || 1}`, 0, 8, { size: 4.2, wt: 600, ff: th.mono, fill: th.accent2, align: 'center', track: .4 });
    g.restore();
    // readout + buttons
    rule(g, 16, 334, 480, th.ink, 1);
    const fin = v.sent && v.an >= 200;
    T(g, fin ? (v.ok ? 'CONSENSUS HELD' : 'SPLIT DECISION') : v.sent ? 'TALLYING…' : 'LINKS OPEN · SEND THE ORDER', 16, 352, { size: 8, wt: 700, ff: th.mono, fill: fin ? (v.ok ? '#2E6B4F' : th.accent2) : th.ink, track: .8 });
    T(g, 'CLICK A LINK · OPEN / CUT / DELAY', 16, 368, { size: 5.6, wt: 500, ff: th.mono, fill: th.muted, track: .5 });
    g.fillStyle = th.ink; rr(g, 396, 344, 100, 26, 1); g.fill();
    T(g, 'SEND ORDER', 446, 361, { size: 7, wt: 700, ff: th.mono, fill: th.paper, align: 'center', track: 1 });
  };

  /* ---------------------------------------------------------------- 16 GARBAGE COLLECTOR */
  P.gc = (g, v, t, session, th) => {
    v = v || {};
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    // CRT vignette and phosphor glow
    glow(g, 256, 210, 320, 'rgba(80,200,120,.08)');
    scanlines(g, 0, 384, 3, .07);
    speckle(g, 0, 0, 512, 384, 220, 101, '#B9FFCB', .05, 1.1);
    g.fillStyle = 'rgba(8,17,11,.82)'; g.fillRect(0, 0, 512, 40);
    rule(g, 0, 40, 512, 'rgba(185,255,203,.28)', 1);
    T(g, 'GARBAGE COLLECTOR', 16, 23, { size: 12, wt: 700, ff: th.mono, fill: th.ink, track: 3 });
    T(g, 'TRICOLOR MARK · PAUSE BUDGET · SWEEP', 16, 34, { size: 5.2, wt: 500, ff: th.mono, fill: th.muted, track: .8 });
    const sc = { running: ['#C9A227', 'MUTATOR RUNNING'], paused: ['#5FB7C8', 'PAUSED'], 'alloc-wait': ['#C9A227', 'ALLOC WAIT'], complete: ['#9AD17A', 'TRACE COMPLETE'], overrun: ['#FF6FAE', 'PAUSE OVERRUN'], corrupt: ['#FF6FAE', 'CORRUPTION'] }[v.status] || ['#C9A227', String(v.status || 'RUNNING').toUpperCase()];
    T(g, sc[1], 496, 19, { size: 7, wt: 700, ff: th.mono, fill: sc[0], align: 'right', track: .8 });
    T(g, `TRACE ${v.ti || 0}/${v.n || 0} · HEAP ${v.cap || 0} CELLS`, 496, 32, { size: 5.6, wt: 500, ff: th.mono, fill: th.muted, align: 'right', track: .4 });
    const cap = v.cap || 32, cw = 464 / cap, blocks = v.blocks || [];
    const mid = b => 24 + (b.at + b.size / 2) * cw;
    // pointer splines
    blocks.forEach(b => {
      if (b.free) return;
      (b.ptrs || []).forEach(tg => {
        const d = blocks.find(x => x.id === tg); if (!d) return;
        const x1 = mid(b), x2 = mid(d), top = Math.max(48, 92 - 12 - Math.abs(x2 - x1) * .18);
        const dirty = (v.dirty || []).some(q => q[0] === b.id && q[1] === tg);
        g.save(); g.strokeStyle = dirty ? th.accent2 : 'rgba(185,255,203,.46)'; g.lineWidth = dirty ? 2.4 : 1.2;
        g.beginPath(); g.moveTo(x1, 94); g.bezierCurveTo(x1 + (x2 - x1) * .3, top - 24, x2 - (x2 - x1) * .3, top - 24, x2, 94); g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(x2, 94); g.lineTo(x2 - 4, 86); g.lineTo(x2 + 4, 86); g.fill(); g.restore();
      });
    });
    // heap blocks
    blocks.forEach(b => {
      const x = 24 + b.at * cw, w = Math.max(2, b.size * cw), free = b.free;
      let fill = '#122018', stroke = 'rgba(111,157,127,.4)', txt = th.muted;
      if (!free && b.col === 'white') { fill = '#DFFBE6'; stroke = '#F2FFF5'; txt = '#0A160D'; }
      else if (!free && b.col === 'gray') { fill = 'rgba(233,166,58,.55)'; stroke = '#FFD08A'; txt = '#1A1205'; }
      else if (!free && b.col === 'black') { fill = '#163B22'; stroke = '#63C77E'; txt = '#CFFFD9'; }
      if (b.col === 'gray') { g.fillStyle = fill; g.fillRect(x + 1, 96, w - 2, 44); g.strokeStyle = 'rgba(26,18,5,.35)'; g.lineWidth = 1; for (let yy = 98; yy < 140; yy += 4) { g.beginPath(); g.moveTo(x + 1, yy); g.lineTo(x + w - 1, yy - 6); g.stroke(); } }
      else { g.fillStyle = fill; g.fillRect(x + 1, 96, w - 2, 44); }
      g.strokeStyle = stroke; g.lineWidth = free ? .8 : 1.5;
      if (free) g.setLineDash([2, 2]); g.strokeRect(x + 1.5, 96.5, w - 3, 43); g.setLineDash([]);
      if (w > 12) { T(g, free ? '' : String(b.id), x + w / 2, 116, { size: w > 24 ? 7 : 4.5, wt: 700, ff: th.mono, fill: txt, align: 'center' }); T(g, free ? String(b.size) : String(b.size), x + w / 2, 130, { size: 4.6, wt: 500, ff: th.mono, fill: free ? th.muted : txt, align: 'center' }); }
      if (b.root) { g.fillStyle = th.accent2; g.beginPath(); g.moveTo(x + w / 2, 142); g.lineTo(x + w / 2 - 4, 149); g.lineTo(x + w / 2 + 4, 149); g.fill(); }
    });
    T(g, 'WHITE', 24, 88, { size: 4.6, wt: 700, ff: th.mono, fill: '#DFFBE6', track: .6 });
    T(g, 'GREY', 74, 88, { size: 4.4, wt: 700, ff: th.mono, fill: '#FFD08A', track: .6 });
    T(g, 'BLACK', 120, 88, { size: 4.4, wt: 700, ff: th.mono, fill: '#63C77E', track: .6 });
    T(g, 'FREE', 172, 88, { size: 4.4, wt: 700, ff: th.mono, fill: th.muted, track: .6 });
    // address ruler under the heap
    g.strokeStyle = 'rgba(185,255,203,.16)'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(24, 149); g.lineTo(488, 149); g.stroke();
    for (let i = 0; i <= cap; i += Math.max(1, Math.round(cap / 12))) { const x = 24 + i * cw; g.beginPath(); g.moveTo(x, 145); g.lineTo(x, 151); g.stroke(); T(g, String(i), x, 158, { size: 4, wt: 500, ff: th.mono, fill: 'rgba(185,255,203,.35)', align: 'center' }); }
    // a quiet logic-analyser trace bed
    g.save(); g.strokeStyle = 'rgba(185,255,203,.08)'; g.lineWidth = .8;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 24; x <= 488; x += 6) { const y = 260 + k * 7 + Math.sin(x * .04 + t * .8 + k) * 2.5; if (x === 24) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
    g.restore();
    // stats
    const z = v.stats || { live: 0, garb: 0, free: 0, run: 0 };
    const rows = [['LIVE', z.live, th.ink], ['GARBAGE', z.garb, th.accent], ['FREE', z.free, '#9AD17A'], ['RUN / NEED', `${z.run}/${(v.nxt && v.nxt[0] && v.nxt[0].op === 'alloc') ? v.nxt[0].size : '-'}`, th.accent2], ['GREY', (v.gray || []).length, '#FFD08A'], ['ROOTS', (v.roots || []).join(' ') || '-', th.accent2]];
    rows.forEach((r, i) => {
      T(g, r[0], 24, 170 + i * 16, { size: 5.2, wt: 700, ff: th.mono, fill: th.muted, track: .8 });
      T(g, String(r[1]), 118, 170 + i * 16, { size: 6.4, wt: 700, ff: th.mono, fill: r[2], track: .3 });
    });
    // mutator trace
    T(g, 'MUTATOR TRACE', 270, 164, { size: 5.2, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    (v.nxt || []).forEach((e, i) => {
      T(g, `${i ? '  ' : '> '}${e.label}`, 270, 180 + i * 16, { size: 5.4, wt: i ? 400 : 700, ff: th.mono, fill: i ? th.muted : (v.status === 'alloc-wait' ? th.accent2 : th.accent), track: .2 });
    });
    // pause budget
    T(g, 'PAUSE', 24, 286, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    for (let i = 0; i < (v.pb || 6); i++) { g.fillStyle = i < (v.pu || 0) ? ((v.pu || 0) >= (v.pb || 6) ? th.accent2 : th.accent) : 'rgba(185,255,203,.10)'; g.fillRect(60 + i * 24, 276, 20, 16); }
    T(g, `${v.pu || 0}/${v.pb || 6}`, 60 + (v.pb || 6) * 24 + 6, 286, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted });
    // invariant strip
    const bad = (v.dirty || []).length;
    g.fillStyle = 'rgba(185,255,203,.05)'; g.fillRect(8, 306, 496, 20);
    T(g, bad ? `INVARIANT BROKEN: BLACK > WHITE ×${bad}` : (v.bar ? 'INVARIANT OK · WRITE BARRIER ON' : 'INVARIANT OK · NO BLACK > WHITE'), 256, 320, { size: 6.2, wt: 700, ff: th.mono, fill: bad ? th.accent2 : '#9AD17A', align: 'center', track: .6 });
    // buttons
    const btns = [[v.paused ? 'RESUME' : 'PAUSE', '#5FB7C8'], ['MARK', th.accent], ['SCAN', th.accent], ['SWEEP', '#9AD17A'], ['SLIDE', '#9AD17A'], ['BARRIER', th.accent2]];
    btns.forEach(([lab, col], i) => {
      const x = 8 + i * 83, y = 338, w = 79, h = 34;
      g.fillStyle = 'rgba(185,255,203,.04)'; g.fillRect(x, y, w, h);
      g.strokeStyle = col; g.lineWidth = 1.2; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
      T(g, lab, x + w / 2, y + 21, { size: 5.8, wt: 700, ff: th.mono, fill: col, align: 'center', track: .8 });
    });
  };

  /* ---------------------------------------------------------------- 17 CARTEL OF CARTOGRAPHERS */
  const CARTEL_COLS = ['#8A8F94', '#4F7A52', '#B07A3E', '#C9A227'];
  const CARTEL_NAMES = ['COAL', 'TIMBER', 'CATTLE', 'GRAIN'];
  const CARTEL_SEAT = ['#8A3B2E', '#2F5AA8', '#5B3A8E'];
  function cartelNB(i) { const r = (i / 5) | 0, c = i % 5, o = []; if (r > 0) o.push(i - 5); if (r < 4) o.push(i + 5); if (c > 0) o.push(i - 1); if (c < 4) o.push(i + 1); return o; }
  function cartelReg(g0) {
    const id = Array(25).fill(-1), mem = [];
    for (let i = 0; i < 25; i++) { if (!g0.tile || g0.tile[i] < 0 || id[i] >= 0) continue; const k = mem.length, st = [i], cells = []; id[i] = k; while (st.length) { const x = st.pop(); cells.push(x); for (const y of cartelNB(x)) if (g0.tile[y] >= 0 && id[y] < 0) { id[y] = k; st.push(y); } } mem.push(cells); }
    return { id, mem };
  }
  P.cartel = (g, v, t, session, th) => {
    v = v || {};
    const G = v.g || { tile: [], dir: [], score: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], hands: [[], [], []], cov: [], mover: 0, turn: 0, over: false };
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 280, 111, '#8A7456', .07, 1.4);
    // guilloche border
    g.save();
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = k % 2 ? 'rgba(110,34,51,.32)' : 'rgba(46,107,79,.34)'; g.lineWidth = k === 0 ? 1.6 : .7;
      g.beginPath();
      const m = 5 + k * 3.2, amp = 1.1 + k * .35, step = 4;
      for (let x = m; x <= 512 - m; x += step) { const y = m + Math.sin(x * .19 + k * 1.7) * amp; if (x === m) g.moveTo(x, y); else g.lineTo(x, y); }
      for (let y = m; y <= 384 - m; y += step) { const x = 512 - m + Math.sin(y * .19 + k * 1.7) * amp; g.lineTo(x, y); }
      for (let x = 512 - m; x >= m; x -= step) { const y = 384 - m + Math.sin(x * .19 + k * 1.7) * amp; g.lineTo(x, y); }
      for (let y = 384 - m; y >= m; y -= step) { const x = m + Math.sin(y * .19 + k * 1.7) * amp; g.lineTo(x, y); }
      g.closePath(); g.stroke();
    }
    g.restore();
    T(g, 'THE CARTEL OF CARTOGRAPHERS', 256, 26, { size: 15, wt: 700, ff: th.didone, fill: th.accent2, align: 'center', track: 1.6 });
    T(g, 'STOCK CERTIFICATE · THREE REALMS · ONE ACTION LOG', 256, 39, { size: 5.4, wt: 600, ff: th.mono, fill: th.muted, align: 'center', track: 1.2 });
    T(g, `TURN ${G.turn || 0} / 21`, 26, 56, { size: 6.4, wt: 700, ff: th.mono, fill: th.ink, track: .6 });
    T(g, G.over ? 'CLOSED' : `P${(G.mover || 0) + 1} TO ACT`, 486, 56, { size: 6.4, wt: 700, ff: th.mono, fill: G.over ? th.accent2 : CARTEL_SEAT[G.mover || 0], align: 'right', track: .6 });
    // board
    const BX = 26, BY = 64, C = 42, reg = cartelReg(G);
    for (let i = 0; i < 25; i++) {
      const x = BX + (i % 5) * C, y = BY + ((i / 5) | 0) * C, c = G.tile ? G.tile[i] : -1;
      g.fillStyle = c >= 0 ? CARTEL_COLS[c] : 'rgba(255,255,255,.28)'; g.fillRect(x + 1, y + 1, C - 2, C - 2);
      g.strokeStyle = 'rgba(42,36,24,.24)'; g.lineWidth = 1; g.strokeRect(x + 1.5, y + 1.5, C - 3, C - 3);
      if (c >= 0) { g.fillStyle = 'rgba(255,255,255,.20)'; g.fillRect(x + 2, y + 2, C - 4, 2); T(g, CARTEL_NAMES[c], x + C / 2, y + C / 2 + 3, { size: 5, wt: 700, ff: th.mono, fill: '#F6F1E3', align: 'center', track: .5 }); }
      const d = G.dir ? G.dir[i] : null;
      if (d) {
        g.fillStyle = 'rgba(42,36,24,.25)'; g.beginPath(); g.arc(x + C / 2 + 1, y + C / 2 + 1, 9, 0, TAU); g.fill();
        g.fillStyle = CARTEL_SEAT[d.p] || '#888'; g.beginPath(); g.arc(x + C / 2, y + C / 2, 9, 0, TAU); g.fill();
        g.strokeStyle = '#F6F1E3'; g.lineWidth = 1; g.beginPath(); g.arc(x + C / 2, y + C / 2, 6.5, 0, TAU); g.stroke();
        T(g, `P${d.p + 1}`, x + C / 2, y + C / 2 + 2, { size: 4.4, wt: 700, ff: th.mono, fill: '#F6F1E3', align: 'center' });
      }
    }
    // realm borders in the director's ink
    reg.mem.forEach((cells, r) => {
      let owner = -1; for (const x of cells) if (G.dir && G.dir[x]) { owner = G.dir[x].p; break; }
      if (owner < 0) return;
      g.strokeStyle = CARTEL_SEAT[owner]; g.lineWidth = 2.2;
      for (const x of cells) {
        const col = x % 5, row = (x / 5) | 0, px = BX + col * C, py = BY + row * C;
        if (col === 0 || reg.id[x - 1] !== r) { g.beginPath(); g.moveTo(px + 1, py + 1); g.lineTo(px + 1, py + C - 1); g.stroke(); }
        if (col === 4 || reg.id[x + 1] !== r) { g.beginPath(); g.moveTo(px + C - 1, py + 1); g.lineTo(px + C - 1, py + C - 1); g.stroke(); }
        if (row === 0 || reg.id[x - 5] !== r) { g.beginPath(); g.moveTo(px + 1, py + 1); g.lineTo(px + C - 1, py + 1); g.stroke(); }
        if (row === 4 || reg.id[x + 5] !== r) { g.beginPath(); g.moveTo(px + 1, py + C - 1); g.lineTo(px + C - 1, py + C - 1); g.stroke(); }
      }
    });
    // hand coupons
    T(g, 'YOUR HAND', 26, 292, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    (G.hands && G.hands[0] ? G.hands[0] : []).forEach((c, i) => {
      const x = 26 + i * 58, y = 300;
      g.fillStyle = CARTEL_COLS[c]; g.fillRect(x, y, 50, 34);
      g.strokeStyle = 'rgba(42,36,24,.4)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, 49, 33);
      T(g, CARTEL_NAMES[c], x + 25, y + 21, { size: 5.2, wt: 700, ff: th.mono, fill: '#F6F1E3', align: 'center', track: .4 });
      if (i === (v.sel || 0)) { g.strokeStyle = '#F6F1E3'; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, 52, 36); }
    });
    // score ledger
    const LX = 286;
    T(g, 'LEDGER OF SHARES', LX, 66, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    for (let c = 0; c < 4; c++) T(g, CARTEL_NAMES[c].slice(0, 3), LX + 64 + c * 34, 82, { size: 4.4, wt: 700, ff: th.mono, fill: CARTEL_COLS[c], align: 'center', track: .2 });
    for (let p = 0; p < 3; p++) {
      const y = 96 + p * 26;
      if ((G.mover || 0) === p && !G.over) { g.fillStyle = 'rgba(46,107,79,.08)'; g.fillRect(LX - 4, y - 11, 204, 22); }
      T(g, `P${p + 1}`, LX, y, { size: 6.4, wt: 700, ff: th.mono, fill: CARTEL_SEAT[p], track: .4 });
      for (let c = 0; c < 4; c++) T(g, String(G.score ? G.score[p][c] : 0), LX + 64 + c * 34, y, { size: 6, wt: 600, ff: th.mono, fill: th.ink, align: 'center' });
      T(g, String((G.score ? G.score[p] : [0, 0, 0, 0]).slice().sort((a, b) => a - b).slice(0, 2).reduce((a, b) => a + b, 0)), LX + 194, y, { size: 6.6, wt: 700, ff: th.mono, fill: th.accent, align: 'right' });
    }
    // covenants as stamped contract lines
    T(g, 'ACTIVE COVENANTS', LX, 186, { size: 5.6, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    g.strokeStyle = 'rgba(42,36,24,.2)'; g.lineWidth = 1; g.strokeRect(LX - 4.5, 192.5, 206, 52);
    if (!(G.cov || []).length) T(g, 'none signed', LX + 4, 208, { size: 5.4, wt: 400, ff: th.mono, fill: th.muted, track: .4 });
    (G.cov || []).slice(0, 2).forEach((c, i) => {
      T(g, `P${c.from + 1} NO ${String(c.kind).toUpperCase()} P${c.to + 1} ×${c.left}`, LX + 4, 208 + i * 15, { size: 5.2, wt: 600, ff: th.mono, fill: th.accent2, track: .2 });
    });
    // peer link
    T(g, 'PEER LINK', LX, 262, { size: 5.4, wt: 700, ff: th.mono, fill: th.muted, track: 1.2 });
    T(g, `${v.sent || 0} SENT / ${v.recv || 0} RECV · SIMULATED`, LX + 4, 276, { size: 5, wt: 500, ff: th.mono, fill: th.ink, track: .3 });
    // message + buttons
    T(g, (v.msg || 'SEAT A DIRECTOR, LAY A TILE').slice(0, 46), LX, 300, { size: 5.4, wt: 600, ff: th.mono, fill: th.ink, track: .1 });
    [['TREATY P2', 0], ['TREATY P3', 1], ['DISCARD', 2], ['NEW GAME', 3]].forEach(([lab, i]) => {
      const x = LX + (i % 2) * 102, y = 312 + ((i / 2) | 0) * 26;
      g.fillStyle = 'rgba(46,107,79,.08)'; g.fillRect(x, y, 96, 20);
      g.strokeStyle = th.accent2; g.lineWidth = .8; g.strokeRect(x + .5, y + .5, 95, 19);
      T(g, lab, x + 48, y + 13, { size: 5, wt: 700, ff: th.mono, fill: th.accent2, align: 'center', track: .6 });
    });
  };

  /* ---------------------------------------------------------------- 18 SHADOW BIDDING */
  const SHADOW_GL = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  const SHADOW_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  P.shadow = (g, v, t, session, th) => {
    v = v || {};
    vgrad(g, 0, 0, 512, 384, '#241C16', '#16110D');
    // walnut grain
    g.save(); g.strokeStyle = 'rgba(242,232,213,.06)'; g.lineWidth = 1;
    for (let i = 0; i < 18; i++) { g.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = 12 + i * 21 + Math.sin(x * .016 + i) * 4; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
    g.restore();
    // ivory title plate
    g.fillStyle = th.ink; g.fillRect(16, 10, 480, 34);
    g.strokeStyle = th.accent; g.lineWidth = 1.4; g.strokeRect(16.5, 10.5, 479, 33);
    T(g, 'SHADOW BIDDING', 30, 32, { size: 13, wt: 700, ff: th.serif, fill: th.paper, track: 1.8 });
    T(g, `TURN ${v.turn || 0} / 80 · QUIET ${(v.last && v.last.quiet) || 0} / 30`, 482, 27, { size: 6.4, wt: 700, ff: th.mono, fill: th.accent, align: 'right', track: .4 });
    T(g, 'SEALED BID · 5×5 GARDNER CHESS', 30, 42, { size: 5, wt: 500, ff: th.mono, fill: 'rgba(242,232,213,.65)', track: .7 });
    // board
    const BX = 22, BY = 58, C = 47;
    for (let i = 0; i < 25; i++) {
      const x = BX + (i % 5) * C, y = BY + ((i / 5) | 0) * C, dark = ((i % 5) + ((i / 5) | 0)) & 1;
      g.fillStyle = dark ? '#3A2A1C' : '#F2E8D5'; g.fillRect(x, y, C, C);
      g.strokeStyle = 'rgba(30,24,20,.28)'; g.lineWidth = .8; g.strokeRect(x + .4, y + .4, C - .8, C - .8);
      if ((v.last && v.last.mv || []).includes(i)) { g.fillStyle = 'rgba(201,162,39,.28)'; g.fillRect(x, y, C, C); }
      const ch = v.b && v.b[i];
      if (ch) {
        const white = ch === ch.toUpperCase(), glyph = SHADOW_GL[ch.toLowerCase()] || ch;
        T(g, glyph, x + C / 2, y + C / 2 + 13, { size: 34, wt: 700, ff: th.serif, fill: white ? '#F6EDD8' : '#1A1410', align: 'center' });
        T(g, glyph, x + C / 2 - .6, y + C / 2 + 12.4, { size: 34, wt: 700, ff: th.serif, fill: white ? 'rgba(30,24,20,.45)' : 'rgba(201,162,39,.55)', align: 'center' });
      }
      if (v.o && v.o.f === i) { g.strokeStyle = th.accent; g.lineWidth = 2.4; g.strokeRect(x + 2, y + 2, C - 4, C - 4); }
      if (v.dests && v.dests.includes(i)) { g.strokeStyle = 'rgba(201,162,39,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x + C / 2, y + C / 2, v.b[i] ? 18 : 6, 0, TAU); g.stroke(); }
      if (v.o && v.o.t === i) { g.strokeStyle = 'rgba(246,237,216,.9)'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, C - 4, C - 4); }
    }
    // right ivory ledger panel
    const RX = 278;
    g.fillStyle = th.ink; g.fillRect(RX, 58, 212, 306);
    g.strokeStyle = 'rgba(30,24,20,.35)'; g.lineWidth = 1; g.strokeRect(RX + .5, 58.5, 211, 305);
    T(g, 'TREASURY', RX + 10, 74, { size: 5.4, wt: 700, ff: th.mono, fill: '#8A7458', track: 1.2 });
    // stacked ducats
    [['W', v.tr ? v.tr[0] : 0, RX + 16], ['B', v.tr ? v.tr[1] : 0, RX + 106]].forEach(([lab, n, x]) => {
      T(g, lab, x, 92, { size: 7, wt: 700, ff: th.serif, fill: '#2A2418' });
      for (let k = 0; k < Math.min(9, n); k++) { g.fillStyle = k === 8 ? '#C9A227' : '#D9B74C'; g.beginPath(); g.ellipse(x + 18, 93 - k * 4, 9, 3, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(90,64,20,.5)'; g.lineWidth = .5; g.stroke(); }
      T(g, String(n), x + 34, 92, { size: 6.4, wt: 600, ff: th.mono, fill: '#2A2418' });
    });
    T(g, 'YOUR BID', RX + 10, 126, { size: 5.4, wt: 700, ff: th.mono, fill: '#8A7458', track: 1.2 });
    T(g, v.cW ? '?' : String((v.o && v.o.bid) || 0), RX + 10, 154, { size: 28, wt: 700, ff: th.serif, fill: v.cW ? '#8A7458' : '#2A2418' });
    // sealed envelopes
    g.fillStyle = 'rgba(201,162,39,.14)'; g.fillRect(RX + 10, 164, 94, 26); g.strokeStyle = 'rgba(90,64,20,.35)'; g.strokeRect(RX + 10.5, 164.5, 93, 25);
    T(g, 'YOUR SEAL', RX + 14, 176, { size: 5, wt: 700, ff: th.mono, fill: '#6B5638', track: .8 });
    T(g, v.cW ? v.cW.slice(0, 12) : '—', RX + 16, 186, { size: 5.4, wt: 600, ff: th.mono, fill: '#2A2418', track: .2 });
    g.fillStyle = 'rgba(138,59,46,.10)'; g.fillRect(RX + 108, 164, 94, 26); g.strokeStyle = 'rgba(138,59,46,.3)'; g.strokeRect(RX + 108.5, 164.5, 93, 25);
    T(g, 'THEIR SEAL', RX + 112, 176, { size: 5, wt: 700, ff: th.mono, fill: '#8A3B2E', track: .8 });
    T(g, v.cB ? v.cB.slice(0, 12) : 'writing…', RX + 114, 186, { size: 5.4, wt: 600, ff: th.mono, fill: '#2A2418', track: .2 });
    // move/verdict lines
    const L = v.over ? [(v.over.winner < 0 ? 'DRAW' : (v.over.winner ? 'BLACK' : 'WHITE') + ' WINS') + ' (' + v.over.reason + ')'] : ((v.last && v.last.lines) || []);
    T(g, 'EQUILIBRIUM', RX + 10, 208, { size: 5.4, wt: 700, ff: th.mono, fill: '#8A7458', track: 1.2 });
    L.slice(0, 5).forEach((q, i) => T(g, String(q).slice(0, 36), RX + 10, 222 + i * 12, { size: 4.9, wt: 500, ff: th.mono, fill: '#2A2418', track: 0 }));
    T(g, v.verdict ? (v.verdict[0] && v.verdict[1] ? 'SEALS VERIFIED' : 'SEAL BROKEN') : 'NO REVEAL YET', RX + 10, 292, { size: 5.6, wt: 700, ff: th.mono, fill: v.verdict ? (v.verdict[0] && v.verdict[1] ? '#2E6B4F' : '#8A3B2E') : '#8A7458', track: .6 });
    // buttons
    const B = [['−', 306, 300, 42], ['+', 354, 300, 42], ['SEAL', 402, 300, 78], ['REVEAL', 402, 326, 78], ['TAMPER', 306, 330, 78], ['PASS', 306, 356, 42]];
    B.forEach(([lab, x, y, w]) => { g.fillStyle = 'rgba(30,24,20,.06)'; g.fillRect(x, y, w, 22); g.strokeStyle = '#8A7458'; g.lineWidth = .8; g.strokeRect(x + .5, y + .5, w - 1, 21); T(g, lab, x + w / 2, y + 14, { size: 5.8, wt: 700, ff: th.mono, fill: '#2A2418', align: 'center', track: .6 }); });
    // equilibrium strip along the bottom of the board
    let mat = 0; for (const ch of (v.b || [])) if (ch) mat += (ch === ch.toUpperCase() ? 1 : -1) * (SHADOW_VAL[ch.toLowerCase()] || 0);
    T(g, `MATERIAL W−B ${mat >= 0 ? '+' : ''}${mat} · ${v.over ? 'SETTLED' : 'IN PLAY'}`, BX, 318, { size: 5.2, wt: 600, ff: th.mono, fill: 'rgba(242,232,213,.7)', track: .4 });
    if (v.over) { g.fillStyle = 'rgba(30,24,20,.75)'; g.fillRect(BX, BY + 100, 240, 44); T(g, (v.over.winner < 0 ? 'DRAW' : (v.over.winner ? 'BLACK' : 'WHITE') + ' WINS'), BX + 120, BY + 128, { size: 14, wt: 700, ff: th.serif, fill: '#F2E8D5', align: 'center', track: 1.4 }); }
  };

  /* ---------------------------------------------------------------- 19 LEXICON QUARANTINE */
  P.lex = (g, v, t, session, th) => {
    v = v || {};
    const G = v.g || { ch: Array(36).fill('e'), own: Array(36).fill(0), score: 0, round: 0, used: [], captured: 0 };
    g.fillStyle = th.paper; g.fillRect(0, 0, 512, 384);
    speckle(g, 0, 0, 512, 384, 300, 121, '#5B3A8E', .05, 1.5);
    // samizdat stamp
    g.save(); g.translate(430, 350); g.rotate(-.15); g.globalAlpha = .4; g.strokeStyle = th.accent; g.lineWidth = 2; g.strokeRect(-40, -10, 80, 20); T(g, 'SAMIZDAT', 0, 5, { size: 7, wt: 700, ff: th.type, fill: th.accent, align: 'center', track: 2.4 }); g.restore();
    T(g, 'LEXICON QUARANTINE', 14, 22, { size: 11, wt: 700, ff: th.mono, fill: th.ink, track: 2.2 });
    T(g, 'THE POET INKS · THE CENSOR GIVES BACK LIBERTIES', 14, 34, { size: 5, wt: 500, ff: th.type, fill: th.muted, track: .5 });
    T(g, `SCORE ${G.score || 0} / ${v.target || 30}`, 348, 18, { size: 6.2, wt: 700, ff: th.type, fill: th.ink, track: .5 });
    T(g, `ROUND ${Math.min((G.round || 0) + 1, v.rounds || 6)} / ${v.rounds || 6}`, 348, 30, { size: 6.2, wt: 700, ff: th.type, fill: th.muted, track: .5 });
    rule(g, 8, 38, 496, 'rgba(33,31,27,.32)', 1);
    const N = 6, C = 52, BX = 14, BY = 44;
    const at = i => [BX + (i % N) * C, BY + ((i / N) | 0) * C];
    for (let i = 0; i < 36; i++) {
      const [x, y] = at(i), own = G.own ? G.own[i] : 0, ch = G.ch ? G.ch[i] : '';
      if (own === 1) { g.fillStyle = th.accent; g.fillRect(x + 1, y + 1, C - 2, C - 2); g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 2, y + 2, C - 4, 2); }
      else if (own === 2) { g.fillStyle = '#1A1815'; g.fillRect(x + 1, y + 1, C - 2, C - 2); }
      else if (own === 3) { g.fillStyle = 'rgba(33,31,27,.10)'; g.fillRect(x + 1, y + 1, C - 2, C - 2); }
      else { g.fillStyle = 'rgba(255,255,255,.24)'; g.fillRect(x + 1, y + 1, C - 2, C - 2); }
      g.strokeStyle = 'rgba(33,31,27,.24)'; g.lineWidth = .8; g.strokeRect(x + 1.5, y + 1.5, C - 3, C - 3);
      if (own === 2) {
        // grease-marker censor stone: a black blob with a knocked-out letter
        g.save(); g.fillStyle = '#121110'; g.beginPath();
        for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, r2 = 17 + (k % 3) * 2.2; if (k === 0) g.moveTo(x + C / 2 + Math.cos(a) * r2, y + C / 2 + Math.sin(a) * r2); else g.lineTo(x + C / 2 + Math.cos(a) * r2, y + C / 2 + Math.sin(a) * r2); }
        g.closePath(); g.fill();
        T(g, String(ch).toUpperCase(), x + C / 2, y + C / 2 + 6, { size: 20, wt: 700, ff: th.mono, fill: '#EFECE6', align: 'center' });
        g.restore();
      } else {
        T(g, String(ch).toUpperCase(), x + C / 2, y + C / 2 + 8, { size: 24, wt: 700, ff: th.mono, fill: own === 1 ? '#F4EEE6' : own === 3 ? '#8C877E' : th.ink, align: 'center' });
      }
      if (v.flash && v.flash.includes(i)) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 1, y + 1, C - 2, C - 2); }
    }
    // air / liberty pips
    (v.ink || []).forEach(q => {
      const [x, y] = at(Math.min.apply(null, q.cells));
      const col = q.libs <= 1 ? th.accent2 : q.libs <= 3 ? '#B07A3E' : th.accent;
      g.fillStyle = col; g.fillRect(x + 1, y + 1, 15, 13);
      T(g, String(q.libs), x + 8, y + 10, { size: 6, wt: 700, ff: th.mono, fill: '#EFECE6', align: 'center' });
    });
    // carbon-copy path
    if (v.path && v.path.length) {
      g.save(); g.strokeStyle = v.ev && v.ev.ok ? '#2E6B4F' : 'rgba(91,58,142,.8)'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath(); v.path.forEach((c, i) => { const [x, y] = at(c); if (i) g.lineTo(x + C / 2, y + C / 2); else g.moveTo(x + C / 2, y + C / 2); }); g.stroke(); g.restore();
      const [lx, ly] = at(v.path[v.path.length - 1]); g.fillStyle = '#F4EEE6'; g.beginPath(); g.arc(lx + C / 2, ly + C / 2, 4, 0, TAU); g.fill();
    }
    // 2x2 rotation bracket
    const rx = 358, ry = 44;
    g.strokeStyle = v.canRot ? th.accent : 'rgba(33,31,27,.28)'; g.lineWidth = 1.6;
    g.strokeRect(rx, ry, 17, 17); g.strokeRect(rx + 21, ry, 17, 17); g.strokeRect(rx, ry + 21, 17, 17); g.strokeRect(rx + 21, ry + 21, 17, 17);
    T(g, '↻ 2×2', rx + 19, ry + 52, { size: 5.2, wt: 700, ff: th.mono, fill: v.canRot ? th.accent : th.muted, align: 'center', track: .6 });
    // right panel
    const PX = 344;
    T(g, v.word ? v.word.toUpperCase() : '—', PX, 124, { size: 22, wt: 700, ff: th.mono, fill: v.ev ? (v.ev.ok ? '#2E6B4F' : th.accent2) : th.muted, track: 1 });
    T(g, v.ev && !v.ev.ok ? String(v.ev.why).slice(0, 24) : v.ev ? `+${v.ev.mv.gain} POINTS` : 'TRACE A WORD', PX, 140, { size: 5.6, wt: 600, ff: th.type, fill: v.ev && !v.ev.ok ? th.accent2 : '#B07A3E', track: .3 });
    T(g, 'QUARANTINED', PX, 158, { size: 5.2, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    T(g, String(G.captured || 0), PX + 70, 158, { size: 7, wt: 700, ff: th.mono, fill: th.ink });
    T(g, 'WORDS', PX, 174, { size: 5.2, wt: 700, ff: th.mono, fill: th.muted, track: 1 });
    T(g, (G.used || []).slice(-3).join(' ').slice(0, 24) || '—', PX, 187, { size: 5, wt: 500, ff: th.type, fill: th.ink, track: .2 });
    // buttons
    [['INK IT', 236, 68], ['CLEAR', 236, 68], ['NEW GAME', 276, 144]].forEach(([lab, y, w], i) => {
      const x = PX;
      g.fillStyle = 'rgba(91,58,142,.08)'; g.fillRect(x, y, w, 26);
      g.strokeStyle = th.accent; g.lineWidth = .9; g.strokeRect(x + .5, y + .5, w - 1, 25);
      T(g, lab, x + w / 2, y + 17, { size: 5.8, wt: 700, ff: th.mono, fill: th.accent, align: 'center', track: .8 });
    });
    // footer status
    rule(g, 8, 360, 496, 'rgba(33,31,27,.26)', 1);
    T(g, String(v.msg || 'TRACE A WORD, THEN INK IT'), 14, 375, { size: 5.8, wt: 600, ff: th.type, fill: th.ink, track: .3 });
    T(g, v.thinking ? 'CENSOR THINKING…' : 'THE CENSOR ANSWERS', 496, 375, { size: 5.4, wt: 600, ff: th.type, fill: v.thinking ? th.accent2 : th.muted, align: 'right', track: .4 });
  };

  /* =====================================================================
     RENDER — canonical adapter lookup, then the painter at any resolution
     ===================================================================== */
  function renderTrueFrame(ctx, adapterKey, view, w, h, t, session) {
    if (!ctx) return;
    const key = ALIAS[adapterKey] || SLUG_TO_KEY[adapterKey] || adapterKey;
    const th = themeFor(adapterKey);
    const paint = P[key] || P.fog;
    const W = Math.max(1, w || 512), H = Math.max(1, h || 384);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(W / 512, H / 384);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    try { paint(ctx, view || {}, t || 0, session || null, th); }
    catch (err) {
      ctx.fillStyle = th.paper; ctx.fillRect(0, 0, 512, 384);
      ctx.fillStyle = th.ink; ctx.font = `700 14px ${FF.mono}`;
      ctx.fillText('FRAME ERROR · ' + String(err && err.message || err).slice(0, 48), 20, 40);
      ctx.fillStyle = th.muted; ctx.font = `10px ${FF.mono}`;
      ctx.fillText(String(adapterKey), 20, 58);
    }
    ctx.restore();
  }

  /* =====================================================================
     INNER APP WINDOW CHROME — real HTML/CSS header for the focused project
     ===================================================================== */
  let chromeReady = false;
  function ensureChromeCSS() {
    if (chromeReady || typeof document === 'undefined') return;
    chromeReady = true;
    const st = document.createElement('style');
    st.id = 'true-frames-css';
    st.textContent = `
      .tf-chrome{display:flex;align-items:center;gap:7px;min-width:0;padding:8px 10px 7px;
        background:var(--tf-chrome-bg);color:var(--tf-chrome-ink);
        border:1px solid var(--tf-line);border-bottom:2px solid var(--tf-accent);
        font-family:var(--tf-mono);font-size:10px;line-height:1;letter-spacing:.04em;
        box-shadow:0 12px 34px rgba(0,0,0,.34);white-space:nowrap;pointer-events:auto;overflow:hidden}
      .tf-chrome *{box-sizing:border-box}
      .tf-grip{display:flex;gap:3px;flex:0 0 auto;margin-right:1px}
      .tf-grip i{width:5px;height:5px;border-radius:50%;background:var(--tf-accent);opacity:.55}
      .tf-grip i:nth-child(2){background:var(--tf-accent-2);opacity:.45}
      .tf-grip i:nth-child(3){background:var(--tf-muted);opacity:.3}
      .tf-pill{flex:0 0 auto;padding:3px 6px 2px;border:1px solid transparent;font-size:8px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
      .tf-title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:var(--tf-display);font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
      .tf-formal{flex:0 1 104px;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--tf-muted);font-size:7.5px;letter-spacing:.1em;text-transform:uppercase}
      .tf-tele{flex:0 0 auto;display:inline-flex;gap:4px;align-items:baseline;padding-left:6px;border-left:1px solid var(--tf-line);color:var(--tf-muted);font-size:7px;letter-spacing:.08em}
      .tf-tele b{font-weight:600;color:var(--tf-accent);font-size:6.5px;letter-spacing:.12em}
      .tf-actions{display:flex;gap:3px;flex:0 1 auto;min-width:0;overflow:hidden;margin-left:auto}
      .tf-actions button{appearance:none;flex:0 0 auto;border:1px solid var(--tf-line);background:transparent;color:var(--tf-chrome-ink);
        font:600 6.8px/1 var(--tf-mono);letter-spacing:.08em;text-transform:uppercase;padding:4px 5px 3px;cursor:pointer}
      .tf-actions button:hover,.tf-actions button:focus-visible{border-color:var(--tf-accent);color:var(--tf-accent);outline:none}
      .tf-open{flex:0 0 auto;color:var(--tf-accent);font-weight:700;font-size:6.8px;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;white-space:nowrap}
      .tf-open:hover{text-decoration:underline;text-underline-offset:2px}
      .tf-open.tf-dead{color:var(--tf-muted);pointer-events:none}
      @media (max-width:760px){.tf-formal,.tf-tele:nth-of-type(2){display:none}.tf-actions{display:none}}
    `;
    (document.head || document.documentElement).appendChild(st);
  }
  function statusOf(track, e) {
    if (typeof track.n === 'number' && track.n > 0) return track.n <= 9 ? 'LIVE' : 'ROADMAP';
    if (e.status === 'shipped' || e.status === 'incoming') return 'LIVE';
    return 'ROADMAP';
  }
  function openUrlFor(track, e) {
    if (track.url) return track.url;
    if (track.href) return track.href;
    if (e.href) return e.href;
    if (e.dir && /^apps\//.test(e.dir)) return '../../' + e.dir.split(' ')[0] + '/';
    return '';
  }
  function keyHint(k) {
    if (!k) return '';
    const parts = String(k).split(','), one = parts.find(x => x.length === 1);
    return (one || ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' })[parts[0]] || parts[0]).toUpperCase();
  }
  function getFrameChrome(track) {
    ensureChromeCSS();
    track = track || {};
    const e = track.e || track;
    const key = track.adapter || e.adapter || track.key || SLUG_TO_KEY[track.slug] || 'fog';
    const th = themeFor(key);
    const status = statusOf(track, e);
    const live = status === 'LIVE';
    const title = String(track.title || e.name || th.name);
    const formal = String((e.formal && e.formal[0] && e.formal[0][0]) || th.formal);
    const session = track.session || null;
    let rev = 0, hash = '—';
    try { rev = session && session.rev ? session.rev | 0 : 0; hash = session && session.hash ? session.hash() : '—'; } catch (err) { }
    const acts = session && session.actions ? session.actions.filter(a => a.ui !== false).slice(0, 4) : [];
    const url = openUrlFor(track, e);
    const pillStyle = live
      ? `background:${th.accent};color:${th.pillInk};border-color:${th.accent}`
      : `background:transparent;color:${th.accent};border-color:${th.accent}`;
    const actsHTML = acts.map(a => {
      const full = String(a.id || a.label).toUpperCase().replace(/_/g, ' ');
      const lab = full.length > 6 ? full.slice(0, 5) + '…' : full;
      return `<button type="button" data-tf-act="${esc(a.id)}" title="${esc(a.label || a.id)}${a.key ? ' · ' + esc(keyHint(a.key)) : ''}">${esc(lab)}</button>`;
    }).join('');
    return `<div class="tf-chrome" style="--tf-chrome-bg:${th.chromeBg};--tf-chrome-ink:${th.chromeInk};--tf-accent:${th.accent};--tf-accent-2:${th.accent2};--tf-muted:${th.muted};--tf-line:${th.line};--tf-mono:${th.mono};--tf-display:${th.display}">
      <span class="tf-grip" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="tf-pill" style="${pillStyle}">${status}</span>
      <span class="tf-title">${esc(title)}</span>
      <span class="tf-formal">${esc(formal)}</span>
      <span class="tf-tele"><b>REV</b><span data-tf-rev>${rev}</span></span>
      <span class="tf-tele"><b>HASH</b><span data-tf-hash>${esc(hash)}</span></span>
      <span class="tf-actions">${actsHTML}</span>
      ${url ? `<a class="tf-open" href="${esc(url)}">OPEN PROJECT <span aria-hidden="true">↗</span></a>` : `<span class="tf-open tf-dead">NOT ON MAIN</span>`}
    </div>`;
  }

  /* =====================================================================
     EXPORT
     ===================================================================== */
  global.TRUE_FRAMES = {
    version: '1.0',
    THEMES,
    SLUG_TO_KEY,
    renderTrueFrame,
    getFrameChrome,
    PAINTERS: P,
    themeFor,
    statusOf
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

