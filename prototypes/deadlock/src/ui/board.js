/* Board: draws engine frames as a clay diorama. Pure view: draw(tf) is a function
 * of (level, replay frames, float tick time tf). Nothing here decides game rules. */
const Board = (() => {
  const C = Clay, E = Engine;
  const { S, attr, SKINS, clamp, lerp, ease } = C;
  const SEC = 0.8; // seconds per tick at 1x
  const W = 1000, H = 700;
  const mapStars = (p) => Math.min(3, Math.max(1, p));

  function create(svg) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren(C.defs());
    const world = C.createWorld(W, H);
    const gRails = S('g'), gPads = S('g'), gHuts = S('g'), gYarnBack = S('g'), gCarts = S('g'), gFx = S('g'), gSun = S('g'), gDev = S('g'), gDrag = S('g'), gHand = S('g');
    svg.append(world.el, gRails, gPads, gHuts, gSun, gYarnBack, gCarts, gFx, gDev, gDrag, gHand);

    const B = { svg, level: null, rep: null, wps: [], mv: [], pads: {}, huts: [], dollops: [], chocks: [], yarns: [], ghostYarns: [], sun: null, tags: [], dev: false, gDrag, gHand, gFx, W, H, SEC };
    const pt = (x, y) => ({ x, y });

    B.toWorld = (cx, cy) => {
      const r = svg.getBoundingClientRect();
      return pt(((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * H);
    };

    B.setLevel = (level) => {
      B.level = level;
      const L = level.layout;
      gRails.replaceChildren(); gPads.replaceChildren(); gHuts.replaceChildren(); gCarts.replaceChildren(); gYarnBack.replaceChildren(); gSun.replaceChildren(); gDev.replaceChildren(); gFx.replaceChildren();
      B.pads = {}; B.huts = []; B.dollops = []; B.chocks = []; B.yarns = []; B.ghostYarns = []; B.sun = null; B.tags = [];
      B.scale = L.scale || 1;
      // rails: every consecutive lock pair on any tape, plus depot->first and last->hut lanes
      const seen = new Set();
      const rail = (a, b, o) => { const k = [a.x, a.y, b.x, b.y].join(); if (seen.has(k) || (a.x === b.x && a.y === b.y)) return; seen.add(k); gRails.appendChild(C.createRail(a, b, o).el); };
      level.carts.forEach((c, ci) => {
        const pads = c.tape.filter((o) => o.k === 'lock' || o.k === 'try').map((o) => L.pads[o.r]);
        const dep = L.depots[c.id], hut = L.huts[c.id];
        if (!L.loops || !L.loops[c.id]) {
          if (pads.length) { rail(dep, pads[0], { opacity: 0.55 }); for (let k = 0; k + 1 < pads.length; k += 1) rail(pads[k], pads[k + 1]); rail(pads[pads.length - 1], hut, { opacity: 0.55 }); }
        } else {
          const lp = L.loops[c.id];
          const el = S('ellipse', { cx: lp.cx, cy: lp.cy, rx: lp.rx, ry: lp.ry, fill: 'none', stroke: C.PAL.rail, 'stroke-width': 24, 'stroke-dasharray': '5 15', opacity: 0.9 });
          const rl = S('ellipse', { cx: lp.cx, cy: lp.cy, rx: lp.rx, ry: lp.ry, fill: 'none', stroke: C.PAL.steel, 'stroke-width': 5, opacity: 0.95 });
          gRails.append(S('g', { filter: 'url(#clay-sm)' }, el), rl);
        }
      });
      Object.entries(L.pads).forEach(([id, p]) => {
        const pad = C.createPad({ label: id });
        gPads.appendChild(pad.el); pad.pos = p; B.pads[id] = pad;
        pad.set({ owner: -1, x: p.x, y: p.y });
        pad.el.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${B.scale * 0.9})`);
      });
      level.carts.forEach((c, ci) => {
        const hut = C.createHut(c.skin, { clock: !!c.tight });
        gHuts.appendChild(hut.el); B.huts.push(hut);
        hut.set({ x: L.huts[c.id].x, y: L.huts[c.id].y, s: B.scale * 0.85, t: 0, win: 0 });
        const d = C.Dollop.create({ skin: c.skin });
        gCarts.appendChild(d.el); B.dollops.push(d);
        B.chocks.push(null);
      });
      for (let i = 0; i < Math.max(4, level.carts.length * 2); i += 1) { const y = C.createYarn(); y.el.style.display = 'none'; gYarnBack.appendChild(y.el); B.yarns.push(y); }
      for (let i = 0; i < 6; i += 1) { const y = C.createYarn(); y.el.style.display = 'none'; gYarnBack.appendChild(y.el); B.ghostYarns.push(y); }
      if (level.mode === 'priority') { B.sun = C.createSun(); gSun.appendChild(B.sun.el); }
      B.wps = level.carts.map((_, ci) => E.cartWaypoints(level, ci));
      B.initPc = level.carts.map((c) => (level.initial && level.initial[c.id] && level.initial[c.id].pc) || 0);
    };

    B.setRun = (rep) => {
      B.rep = rep;
      const n = rep.frames.length; const level = B.level;
      B.mv = level.carts.map((c, i) => {
        const arr = new Array(n).fill(null);
        let cur = null;
        for (let T = 1; T < n; T += 1) {
          const a = rep.frames[T - 1].carts[i], b = rep.frames[T].carts[i];
          if (a.pc !== b.pc) {
            const op = c.tape[a.pc];
            const t1 = op && op.k === 'travel' ? T + b.busyLeft : T;
            cur = { pa: a.pc, pb: b.pc, t0: T - 1, t1: Math.max(T, t1), reset: b.pc < a.pc };
          }
          arr[T] = cur;
        }
        return arr;
      });
      // when each cart finished / got blocked (for timing of fx)
      B.doneAt = level.carts.map((_, i) => { const f = rep.frames.findIndex((fr) => fr.carts[i].done); return f < 0 ? Infinity : f; });
    };

    function frameAt(T) { const fr = B.rep.frames; return fr[clamp(T, 0, fr.length - 1)]; }

    B.cartPos = (i, tf) => {
      const fr = B.rep.frames; const n = fr.length;
      const T = clamp(Math.floor(tf), 0, n - 1);
      const Tn = Math.min(n - 1, T + 1);
      const f = fr[T];
      const seg = B.mv[i][Tn] || null;
      const wp = B.wps[i];
      if (!seg) {
        const pc = B.initPc[i];
        const c = f.carts[i];
        if (c.blockedOn >= 0) return E.waitSpot(B.level, i, B.level.resources[c.blockedOn], wp[pc]);
        return { ...wp[pc], lift: 0, moving: false, frac: 1 };
      }
      const raw = seg.t1 > seg.t0 ? (tf - seg.t0) / (seg.t1 - seg.t0) : 1;
      const k = clamp(raw, 0, 1);
      const from = wp[seg.pa], to = wp[seg.pb];
      const ke = seg.reset ? ease(k) : k < 0.2 ? 0 : ease((k - 0.2) / 0.8); // short anticipation hold before moving
      const x = lerp(from.x, to.x, ke), y = lerp(from.y, to.y, ke);
      const moving = k < 1 && ke > 0;
      return { x, y, lift: moving ? Math.sin(ke * Math.PI) * 6 : 0, moving, frac: k, dir: to.x >= from.x ? 1 : -1, seg };
    };

    function lookAt(from, to) { const dx = to.x - from.x, dy = to.y - from.y; const L2 = Math.hypot(dx, dy) || 1; return { x: dx / L2, y: (dy / L2) * 0.6 }; }

    // ctx: { t: wall seconds, dev, huh: {cart, since}, drag: {cartId}, labels }
    B.draw = (tf, ctx = {}) => {
      const level = B.level, rep = B.rep; if (!level || !rep) return;
      const fr = rep.frames; const n = fr.length;
      const tfc = clamp(tf, 0, n - 1);
      const T = Math.floor(tfc);
      const f = fr[T];
      const Tn = Math.min(n - 1, T + 1);
      const wall = ctx.t || 0;
      world.set(wall);
      const sc = B.scale;
      const last = T >= n - 1 && tfc >= n - 1;
      const terminal = last && f.status !== 0 && f.status !== 1;
      const pos = level.carts.map((_, i) => B.cartPos(i, tfc));
      const anchor = (i) => ({ x: pos[i].x, y: pos[i].y - 50 * sc });
      // pads
      level.resources.forEach((id, r) => {
        const o = f.owner[r];
        const p = B.pads[id];
        p.set({ owner: o >= 0 ? level.carts[o].skin : -1, labels: ctx.dev });
        const pulse = (fr[Tn].events || []).some((e) => e[0] === 'lock' && e[2] === r) && tfc - T < 0.4 ? Math.sin(((tfc - T) / 0.4) * Math.PI) : 0;
        p.el.setAttribute('transform', `translate(${p.pos.x} ${p.pos.y}) scale(${sc * 0.9 * (1 + pulse * 0.05)} ${sc * 0.9 * (1 - pulse * 0.06)})`);
      });
      // runner (preemptive): who got the sun this tick
      let runner = -1;
      if (level.mode === 'priority') {
        const ev = (last ? fr[T].events : fr[Tn].events) || [];
        const e = ev.find((x) => x[0] === 'run'); if (e) runner = e[1];
      }
      // dollops
      const order = level.carts.map((_, i) => i).sort((a, b) => pos[a].y - pos[b].y);
      const holderOf = (c) => (c.blockedOn >= 0 ? f.owner[c.blockedOn] : -1);
      level.carts.forEach((cart, i) => {
        const c = f.carts[i]; const d = B.dollops[i]; const ps = pos[i];
        const secs = (tfc - (ps.seg ? ps.seg.t0 : 0)) * SEC;
        let clip = 'idle', o = { seed: i, dir: ps.dir || 1 };
        const blocked = c.blockedOn >= 0;
        const hI = holderOf(c);
        let blockedSince = T;
        if (blocked) { while (blockedSince > 0 && fr[blockedSince - 1].carts[i].blockedOn === c.blockedOn) blockedSince -= 1; }
        const recentBackoff = (() => { for (let k = T; k >= Math.max(1, T - 6); k -= 1) { if ((fr[k].events || []).some((e) => e[0] === 'backoff' && e[1] === i)) return true; if (fr[k].carts[i].pc > (fr[k - 1].carts[i].pc)) return false; } return false; })();
        if (c.done) { const since = (tfc - B.doneAt[i]) * SEC; clip = since < 2.2 ? 'win' : 'idle'; o.t0 = since; }
        else if (terminal && f.status === 2 && blocked) { clip = 'freeze'; o.looks = [hI >= 0 ? lookAt(ps, pos[hI]) : { x: 1, y: 0 }, { x: -0.6, y: -0.4 }]; }
        else if (terminal && f.status === 3) { clip = 'stunned'; }
        else if (terminal && f.status === 4 && f.missed === i) { clip = 'stunned'; }
        else if (ps.moving && c.holdLeft <= 0) { clip = ps.frac < 0.3 ? 'go' : 'roll'; }
        else if (c.holdLeft > 0) clip = 'held';
        else if (level.carts[i].hog && runner === i) { clip = 'smug'; o.dir = 1; }
        else if (blocked) { clip = tfc - blockedSince < 0.5 ? 'bump' : 'wait'; o.look = hI >= 0 ? lookAt(ps, pos[hI]) : { x: 1, y: 0 }; }
        else if (c.busyLeft > 0 && recentBackoff) clip = 'dance';
        else if (c.boostLeft > 0) clip = 'vip';
        else if (level.mode === 'priority' && runner >= 0 && runner !== i && !c.done && !blocked) { clip = 'wait'; o.look = { x: 0.3, y: -1 }; }
        let local = clip === 'go' ? secs : clip === 'bump' ? (tfc - blockedSince) * SEC : clip === 'win' ? o.t0 : wall;
        if (ctx.huh && ctx.huh.cart === i && wall - ctx.huh.since < 1.6) { clip = 'huh'; local = wall - ctx.huh.since; o.look = ctx.huh.look || { x: 0, y: -0.6 }; }
        const p = C.Dollop.pose(clip, local, o);
        if (c.boostLeft > 0 && clip !== 'huh') { p.glow = 0.5; p.sparkle = true; p.ticket = c.boostLeft / level.boostTicks; }
        if (c.boostLeft > 0 && (fr[T].acts || []).some((a) => a.kind === 'loan' && a.ok && a.cart === i) && tfc - T < 0.9) p.ticket = null;
        if (level.showPrio) p.stars = mapStars(c.eff);
        if (cart.tight) p.candle = clamp((cart.deadline - tfc) / cart.deadline, 0, 1);
        if (!c.done && c.holdLeft > 0) p.lid = Math.max(p.lid || 0, 0.5);
        d.set({ ...p, x: ps.x, y: ps.y, lift: (p.lift || 0) + (ps.lift || 0), s: sc * 0.92, t: wall });
        // chock under the wheel
        if (c.holdLeft > 0) {
          if (!B.chocks[i]) { B.chocks[i] = C.createChock({ small: true }); gFx.appendChild(B.chocks[i].el); }
          const drop = (fr[T].acts || []).some((a) => a.kind === 'hold' && a.ok && a.cart === i) ? clamp((tfc - T) / 0.45, 0, 1) : 1;
          const bounce = drop < 1 ? -(1 - drop) * (1 - drop) * 110 : 0;
          B.chocks[i].set({ x: ps.x + 58 * sc, y: ps.y + 6 + bounce, s: 0.95 * sc, frac: c.holdLeft / level.holdTicks, squash: drop >= 1 && drop < 1.1 ? 0.1 : 0 });
          B.chocks[i].el.style.display = '';
        } else if (B.chocks[i]) B.chocks[i].el.style.display = 'none';
      });
      order.forEach((i) => gCarts.appendChild(B.dollops[i].el));
      // huts
      level.carts.forEach((cart, i) => {
        const w = f.carts[i].done ? clamp(((tfc - B.doneAt[i]) * SEC) / 1.4, 0, 1.2) : 0;
        const hp = level.layout.huts[cart.id];
        B.huts[i].set({ x: hp.x, y: hp.y, s: sc * 0.85, t: wall, win: w >= 1 ? 0 : w });
      });
      // yarn: real waits (red) + the slack loop that precedes a deadlock (pink dashes)
      B.yarns.forEach((y) => { y.el.style.display = 'none'; }); B.ghostYarns.forEach((y) => { y.el.style.display = 'none'; });
      f.edges.forEach((e, k) => {
        const y = B.yarns[k]; if (!y) return;
        let since = T; while (since > 0 && fr[since - 1].carts[e.from].blockedOn === f.carts[e.from].blockedOn) since -= 1;
        const taut = (terminal && f.status === 2) ? 1 : clamp(0.35 + (tfc - since) * 0.5, 0.35, 0.9);
        y.el.style.display = '';
        y.set({ a: anchor(e.from), b: anchor(e.to), t: wall, taut, k });
      });
      const ic = f.intentCycle;
      if (ic && !f.cycle) {
        f.intent.filter((e) => ic.includes(e.from) && ic.includes(e.to)).forEach((e, k) => {
          const y = B.ghostYarns[k]; if (!y) return; y.el.style.display = '';
          y.set({ a: anchor(e.from), b: anchor(e.to), t: wall, taut: 0.2, ghost: true });
        });
      }
      // sun
      if (B.sun) {
        const tgt = runner >= 0 ? { x: pos[runner].x - 880, y: pos[runner].y - 70 - 95 } : null;
        B.sun.set({ x: 880, y: 95, s: 0.95, t: wall, target: tgt ? { x: pos[runner].x - 880, y: pos[runner].y - 60 - 95 } : null });
      }
      // fx: the golden ticket flying from the waiter to the holder
      gFx.querySelectorAll('.fx').forEach((n) => n.remove());
      (fr[T].acts || []).forEach((a) => {
        const k = (tfc - T) / 0.9;
        if (a.kind === 'loan' && a.ok && a.from >= 0 && k >= 0 && k < 1) {
          const A = anchor(a.from), Bp = anchor(a.cart); const e = ease(k);
          const tk = C.createTicket({ small: true }); tk.el.setAttribute('class', 'fx');
          tk.set({ x: lerp(A.x, Bp.x, e), y: lerp(A.y, Bp.y, e) - Math.sin(e * Math.PI) * 110 - 40, rot: -20 + e * 40, s: 0.9, frac: 1, sparkle: true, t: wall });
          gFx.appendChild(tk.el);
        }
      });
      B.drawDev(f, pos, ctx, anchor);
      B.lastFrame = f; B.lastPos = pos;
    };

    // Dev overlay: the machinery, on the same scene.
    B.drawDev = (f, pos, ctx, anchor) => {
      gDev.replaceChildren();
      if (!ctx.dev) return;
      const level = B.level; const sc = B.scale;
      const txt = (x, y, s, o = {}) => S('text', { x, y, 'text-anchor': 'middle', 'font-size': o.size || 15, 'font-weight': 800, fill: o.fill || '#2b1d12', stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke', 'font-family': 'ui-monospace, Menlo, monospace', ...o.a }, s);
      const cyc = f.cycle || [];
      // mutex owners
      level.resources.forEach((id, r) => {
        const p = level.layout.pads[id]; const o = f.owner[r];
        gDev.appendChild(txt(p.x, p.y + 52 * sc, o >= 0 ? `${id}·mutex held` : `${id}·mutex free`, { size: 14 }));
        if (o >= 0) gDev.appendChild(S('g', { transform: `translate(${p.x - 36} ${p.y - 6})` }, S('rect', { x: -14, y: -11, width: 28, height: 16, rx: 5, fill: '#2b1d12' }), S('text', { x: 0, y: 1, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#ffe08a', 'font-family': 'ui-monospace, Menlo, monospace' }, 'ME')));
      });
      // wait-for graph
      const defs = S('defs', null, S('marker', { id: 'arr', markerWidth: 10, markerHeight: 10, refX: 8, refY: 5, orient: 'auto' }, S('path', { d: 'M0,0 L10,5 L0,10Z', fill: '#2b1d12' })), S('marker', { id: 'arrR', markerWidth: 10, markerHeight: 10, refX: 8, refY: 5, orient: 'auto' }, S('path', { d: 'M0,0 L10,5 L0,10Z', fill: '#d11' })));
      gDev.appendChild(defs);
      f.edges.forEach((e) => {
        const a = anchor(e.from), b = anchor(e.to);
        const inCycle = cyc.includes(e.from) && cyc.includes(e.to);
        const dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
        const a2 = { x: a.x + (dx / L) * 34, y: a.y - 60 * sc + (dy / L) * 34 }, b2 = { x: b.x - (dx / L) * 40, y: b.y - 60 * sc - (dy / L) * 40 };
        gDev.appendChild(S('path', { d: `M${a2.x},${a2.y} L${b2.x},${b2.y}`, stroke: inCycle ? '#d11' : '#2b1d12', 'stroke-width': inCycle ? 5 : 3, 'marker-end': inCycle ? 'url(#arrR)' : 'url(#arr)', fill: 'none', 'stroke-linecap': 'round' }));
        const mx = (a2.x + b2.x) / 2, my = (a2.y + b2.y) / 2;
        gDev.appendChild(txt(mx, my - 6, `c${e.from}→c${e.to} (${level.resources[e.res]})`, { size: 12, fill: inCycle ? '#d11' : '#2b1d12' }));
        gDev.appendChild(S('g', { transform: `translate(${mx} ${my + 10})` }, S('rect', { x: -12, y: -9, width: 24, height: 14, rx: 4, fill: '#2b1d12' }), S('text', { x: 0, y: 2, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 800, fill: '#ffe08a', 'font-family': 'ui-monospace, Menlo, monospace' }, 'NP')));
      });
      // cart tags: id, priority, pc, hold-and-wait
      level.carts.forEach((cart, i) => {
        const c = f.carts[i]; const p = pos[i];
        const tag = `c${i} pri${c.eff}${c.eff !== c.prio ? '*' : ''} pc${c.pc}`;
        gDev.appendChild(txt(p.x, p.y + 28 * sc, tag, { size: 13 }));
        if (c.held.length && c.blockedOn >= 0) {
          gDev.appendChild(S('g', { transform: `translate(${p.x} ${p.y - 150 * sc})` }, S('rect', { x: -22, y: -11, width: 44, height: 16, rx: 5, fill: '#7a2a2a' }), S('text', { x: 0, y: 1, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#ffd0c8', 'font-family': 'ui-monospace, Menlo, monospace' }, 'H&W')));
        }
        if (cyc.includes(i)) gDev.appendChild(S('ellipse', { cx: p.x, cy: p.y - 62 * sc, rx: 84 * sc, ry: 84 * sc, fill: 'none', stroke: '#d11', 'stroke-width': 3, 'stroke-dasharray': '7 6', opacity: 0.8 }));
      });
      if (f.inversion) {
        const i = f.inversion; const a = anchor(i.high), b = anchor(i.low), m = anchor(i.medium);
        gDev.appendChild(txt(m.x, m.y - 120 * sc, `inversion: c${i.high}>c${i.medium}>c${i.low}`, { size: 13, fill: '#b35c00' }));
      }
    };

    B.hit = (wx, wy) => {
      if (!B.lastPos) return null;
      let best = null, bd = 1e9;
      B.lastPos.forEach((p, i) => { const d = Math.hypot(wx - p.x, wy - (p.y - 60 * B.scale)); if (d < bd) { bd = d; best = i; } });
      return bd < 95 * B.scale ? best : null;
    };
    B.hand = null;
    return B;
  }
  return { create, SEC };
})();
