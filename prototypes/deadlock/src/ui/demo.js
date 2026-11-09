/* Demo: a wordless, hand-guided tour that runs on the real engine.
 * It never fakes motion: it loads real levels (Engine.levelFor), asks the
 * certifier for the winning move, and a clay hand shows where to drop the
 * token. Every drop goes through App.tryDrop -> Engine.replay.
 * Arc: ring freezes -> rewind -> chock (Hold) -> ring unzips -> VIP wait ->
 * wrong ticket target bounces -> ticket to the holder (Loan) -> everyone home. */
const Demo = (() => {
  const E = Engine, C = Clay;
  const D = { active: false, beat: null, stage: 0, levels: [], hints: [], t0: 0, anim: null, hand: null, carry: null, ov: null, userTouched: false, wrongShown: false, fails: 0, fn: 0 };

  const rect = (el) => el.getBoundingClientRect();
  const center = (el) => { const r = rect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const cartPx = (A, i) => {
    const r = rect(A.board.svg); const p = A.board.lastPos[i]; const sc = A.board.scale;
    return { x: r.left + (p.x / 1000) * r.width, y: r.top + ((p.y - 60 * sc) / 700) * r.height };
  };
  const tokenPx = (A, kind) => { const t = A.els.tray.querySelector(`.tok.${kind}:not(.used)`); return t ? center(t) : center(A.els.tray); };
  const ease = C.ease;

  function setBeat(name) { D.beat = name; D.t0 = performance.now() / 1000; D.userTouched = false; D.anim = null; D.carry = null; D.fn = 0; }
  const idx = (A, cartId) => A.level.carts.findIndex((c) => c.id === cartId);

  // keyframes: [{p:()=>{x,y}, d:seconds to reach, mode, press, carry}] looped
  function anim(keys, tail = 1.2) { D.anim = { keys, tail, t0: performance.now() / 1000 }; }
  function sampleAnim(t) {
    const an = D.anim; if (!an) return null;
    const total = an.keys.reduce((s, k) => s + k.d, 0) + an.tail;
    let lt = (t - an.t0) % total; const loops = Math.floor((t - an.t0) / total);
    let prev = an.keys[0].p(); let pm = an.keys[0].mode || 'point';
    for (let i = 0; i < an.keys.length; i += 1) {
      const k = an.keys[i]; const to = k.p();
      if (lt <= k.d) { const u = k.d ? ease(lt / k.d) : 1; return { x: prev.x + (to.x - prev.x) * u, y: prev.y + (to.y - prev.y) * u, mode: k.mode || 'point', press: k.press ? Math.sin(u * Math.PI) : 0, carry: k.carry, loops, i }; }
      lt -= k.d; prev = to; pm = k.mode || 'point';
    }
    const last = an.keys[an.keys.length - 1];
    return { ...prev, mode: last.mode || 'point', press: 0, carry: last.carry, loops, i: an.keys.length };
  }

  function start(A) {
    if (D.active) stop(false);
    D.active = true; A.demo = API; D.A = A; D.stage = 0; D.fails = 0;
    document.body.classList.add('demo');
    if (!D.ov) {
      D.ov = document.getElementById('overlay');
      D.ov.replaceChildren(C.defs());
      D.hand = C.createHand(); D.ov.appendChild(D.hand.el);
      D.tok = { hold: C.createChock(), loan: C.createTicket() };
      D.tokG = C.S('g'); D.tokG.append(D.tok.hold.el, D.tok.loan.el); D.ov.insertBefore(D.tokG, D.hand.el);
    }
    D.levels = [E.levelFor('DEMO', 0).level, E.levelFor('DEMO', 1).level];
    D.hints = D.levels.map((l) => E.analyse(l).plan[0]);
    D.hookFn = (type, data) => onEvent(A, type, data);
    A.on(D.hookFn);
    enterStage(A, 0);
  }
  function enterStage(A, s) {
    D.stage = s; D.fails = 0; D.wrongShown = false;
    A.loadLevel(D.levels[s], { demo: true });
    A.speed = 1;
    setBeat('watch'); A.tf = 0; A.play();
  }
  function stop(go = true) {
    D.active = false; A_off(); document.body.classList.remove('demo');
    if (D.hand) { D.hand.set({ x: -300, y: -300, opacity: 0 }); D.tokG.setAttribute('opacity', 0); }
    if (D.A) { D.A.demo = null; D.A.markSeenDemo(); }
  }
  function A_off() { if (D.A && D.hookFn) { const i = D.A.hooks.indexOf(D.hookFn); if (i >= 0) D.A.hooks.splice(i, 1); } }
  const stageName = () => (D.stage === 0 ? 'hold' : 'loan');

  function onEvent(A, type, data) {
    if (!D.active) return;
    const b = D.beat;
    if (type === 'end' && (b === 'watch' || b === 'run')) {
      if (A.rep.status === 1) { setBeat('joy'); return; }
      if (b === 'watch') setBeat('frozen'); else { D.fails += 1; setBeat('retry'); }
    } else if (type === 'rewound' && b === 'rewind') setBeat('hold');
    else if (type === 'dropped' && (b === 'hold' || b === 'rewind' || b === 'retry')) setBeat('play');
    else if (type === 'rejected' && b === 'hold') { D.userTouched = true; }
    else if (type === 'play' && b === 'play') setBeat('run');
    else if (type === 'reset' && b === 'retry') setBeat('hold');
    else if (type === 'scrub' && b === 'rewind' && A.tf < 0.5) setBeat('hold');
  }

  // per-frame: drive beats, hand and carried token
  function frame(t) {
    const A = D.A; if (!D.active || !A.level) return;
    const el = t - D.t0;
    const stage = D.stage;
    const hint = D.hints[stage];
    const hi = idx(A, hint.cart);
    const kind = hint.kind;
    const wrongI = stage === 1 ? A.level.carts.findIndex((c) => c.tight) : -1; // the waiter H: a ticket there does nothing
    switch (D.beat) {
      case 'frozen': if (el > 2.6) setBeat('rewind'); break;
      case 'rewind':
        if (!D.anim) anim([{ p: () => ({ x: window.innerWidth + 60, y: window.innerHeight + 60 }), d: 0.01 }, { p: () => center(A.els.rewind), d: 0.9 }, { p: () => center(A.els.rewind), d: 0.4, press: true }], 1.2);
        if (el > 5.5) { A.rewind(); }
        break;
      case 'hold': {
        if (!D.anim) {
          const keys = [{ p: () => ({ x: window.innerWidth + 60, y: window.innerHeight + 60 }), d: 0.01 }, { p: () => tokenPx(A, kind), d: 0.8, mode: 'point' }, { p: () => tokenPx(A, kind), d: 0.35, mode: 'grab', carry: kind }];
          if (stage === 1) keys.push({ p: () => cartPx(A, wrongI), d: 0.9, mode: 'grab', carry: kind }, { p: () => cartPx(A, wrongI), d: 0.5, mode: 'grab', carry: kind, press: true }, { p: () => tokenPx(A, kind), d: 0.8, mode: 'grab', carry: kind });
          keys.push({ p: () => cartPx(A, hi), d: 1.0, mode: 'grab', carry: kind }, { p: () => cartPx(A, hi), d: 0.45, mode: 'grab', carry: kind, press: true });
          anim(keys, 1.4);
        }
        const s = sampleAnim(t);
        if (stage === 1 && s && s.i === 5 && !D.wrongShown) { D.wrongShown = true; A.huh = { cart: wrongI, since: t, look: { x: 0, y: -0.6 } }; }
        if (s && s.loops === 0 && s.i === 4 && D.wrongShown === false) { /* approaching the waiter */ }
        if (el > (stage === 1 ? 16 : 11) && !A.drag) { A.tf = 0; const r = A.tryDrop(kind, hi); if (!r.ok) setBeat('rewind'); }
        break;
      }
      case 'play':
        if (!D.anim) anim([{ p: () => ({ x: window.innerWidth + 60, y: window.innerHeight + 60 }), d: 0.01 }, { p: () => center(A.els.play), d: 0.8 }, { p: () => center(A.els.play), d: 0.4, press: true }], 1.0);
        if (el > 4.5) A.play();
        break;
      case 'run': break;
      case 'retry':
        if (!D.anim) anim([{ p: () => ({ x: window.innerWidth + 60, y: window.innerHeight + 60 }), d: 0.01 }, { p: () => center(A.els.reset), d: 0.8 }, { p: () => center(A.els.reset), d: 0.4, press: true }], 1.0);
        if (el > 4.5) A.resetPlan();
        break;
      case 'joy':
        if (el > 2.8) { if (stage === 0) enterStage(A, 1); else { D.A.markSeenDemo(); stop(); A.go(0); } }
        break;
      default: break;
    }
    // hand + carried token
    const s = (A.drag || D.beat === 'watch' || D.beat === 'run' || D.beat === 'frozen' || D.beat === 'joy') ? null : sampleAnim(t);
    const vw = rect(A.board.svg).width / 1000;
    const hs = Math.max(0.55, Math.min(1.05, vw * 1.05));
    if (s) {
      D.hand.set({ x: s.x, y: s.y, mode: s.mode, press: s.press, t, s: hs, rot: -16, opacity: 1 });
      ['hold', 'loan'].forEach((k) => {
        const on = s.carry === k;
        D.tok[k].el.style.display = on ? '' : 'none';
        if (on) D.tok[k].set({ x: s.x + 8 * hs, y: s.y + 34 * hs, s: 1.1 * hs, rot: -8, t, frac: 1, sparkle: true });
      });
    } else {
      D.hand.set({ x: -300, y: -300, opacity: 0 });
      ['hold', 'loan'].forEach((k) => { D.tok[k].el.style.display = 'none'; });
    }
    D.tokG.setAttribute('opacity', 1);
  }

  const API = { start, stop, frame, get active() { return D.active; }, allowDrag: () => true, D };
  return API;
})();
