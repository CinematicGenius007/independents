// The product automaton, flat. One cart = one tape automaton; the monitor is
// owner[] + blocked + timers. step() is a pure function of (compiled, state).
// Disciplines: 'lockstep' (every runnable cart acts on one tick, contention
// resolved against the post-release snapshot) and 'priority' (one runner per
// tick, highest effective priority). Same rules as the cs-formalisms engine,
// minus the log/object overhead, plus: inheritance loan, wake-on-done.
import { OP, W, F } from './model.mjs';

export const RUNNING = 0, WON = 1, DEADLOCK = 2, LIVELOCK = 3, MISSED = 4;
export const STATUS_NAMES = ['running', 'won', 'deadlock', 'livelock', 'missed'];

export function initState(c) { return c.init.slice(); }
export function cloneState(S) { return S.slice(); }

const cb = (c, i) => c.base + i * W;

// Highest priority among carts blocked on a resource that cart i holds.
export function waiterPrio(c, S, i) {
  const held = S[cb(c, i) + F.HELD];
  if (!held) return 0;
  let m = 0;
  for (let j = 0; j < c.N; j += 1) {
    if (j === i) continue;
    const b = cb(c, j);
    const r = S[b + F.BLK];
    if (r >= 0 && !S[b + F.DONE] && ((held >> r) & 1) && c.prio[j] > m) m = c.prio[j];
  }
  return m;
}
// Effective priority. A live loan lets the *holder* inherit its best waiter.
export function eff(c, S, i) {
  const p = c.prio[i];
  if (S[0] < S[cb(c, i) + F.BOOST]) {
    const w = waiterPrio(c, S, i);
    if (w > p) return w;
  }
  return p;
}
export function isRunnable(c, S, i) {
  const b = cb(c, i);
  return !S[b + F.DONE] && S[b + F.BLK] < 0 && S[0] >= S[b + F.BUSY] && S[0] >= S[b + F.HOLD];
}

function releaseAll(c, S, i) {
  const b = cb(c, i);
  const held = S[b + F.HELD];
  for (let r = 0; r < c.R; r += 1) if ((held >> r) & 1 && S[4 + r] === i) S[4 + r] = -1;
  S[b + F.HELD] = 0;
  return held;
}

function wake(c, S, r, ev) {
  if (S[4 + r] !== -1) return;
  let best = -1, bestE = -1;
  for (let j = 0; j < c.N; j += 1) {
    const b = cb(c, j);
    if (S[b + F.BLK] === r && !S[b + F.DONE]) {
      const e = eff(c, S, j);
      if (e > bestE) { best = j; bestE = e; }
    }
  }
  if (best < 0) return;
  const b = cb(c, best);
  S[4 + r] = best;
  S[b + F.BLK] = -1;
  S[b + F.HELD] |= 1 << r;
  S[b + F.PC] += 1;
  if (ev) ev.push(['wake', best, r]);
}

function execUnlock(c, S, i, r, ev) {
  const b = cb(c, i);
  if (!((S[b + F.HELD] >> r) & 1)) return;
  S[b + F.HELD] &= ~(1 << r);
  if (S[4 + r] === i) S[4 + r] = -1;
  wake(c, S, r, ev);
}

function finish(c, S, i, wakeNow, ev) {
  const b = cb(c, i);
  const freed = releaseAll(c, S, i);
  S[b + F.DONE] = 1;
  S[b + F.PC] += 1;
  if (ev) ev.push(['done', i, -1]);
  if (wakeNow) for (let r = 0; r < c.R; r += 1) if ((freed >> r) & 1) wake(c, S, r, ev);
}

export function terminal(c, S) {
  const tick = S[0];
  let unfinished = 0, allBlocked = true, anyBusy = false, anyHeld = false;
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    if (S[b + F.DONE]) continue;
    unfinished += 1;
    if (tick > c.deadline[i]) { S[1] = MISSED; return; }
    if (S[b + F.BLK] < 0) allBlocked = false;
    if (tick < S[b + F.BUSY]) anyBusy = true;
    if (tick < S[b + F.HOLD]) anyHeld = true;
  }
  if (unfinished === 0) { S[1] = WON; return; }
  if (tick >= c.horizon) { S[1] = MISSED; return; }
  if (allBlocked && !anyBusy && !anyHeld) S[1] = DEADLOCK;
}

// ev (optional) collects [type, cartIdx, resIdx] for animation and the log.
export function step(c, S, ev) {
  if (S[1] !== RUNNING) return S;
  if (c.mode === 'priority') stepPriority(c, S, ev); else stepLockstep(c, S, ev);
  S[0] += 1;
  terminal(c, S);
  return S;
}

function stepPriority(c, S, ev) {
  let best = -1, bestE = -1;
  for (let i = 0; i < c.N; i += 1) {
    if (!isRunnable(c, S, i)) continue;
    const e = eff(c, S, i);
    if (e > bestE) { best = i; bestE = e; }
  }
  if (best < 0) return;
  const i = best;
  const b = cb(c, i);
  const ops = c.ops[i];
  const pc = S[b + F.PC];
  if (ev) ev.push(['run', i, -1]);
  if (pc * 3 >= ops.length) { S[b + F.DONE] = 1; return; }
  const k = ops[pc * 3], a1 = ops[pc * 3 + 1], a2 = ops[pc * 3 + 2];
  if (k === OP.LOCK) {
    if (S[4 + a1] === -1) { S[4 + a1] = i; S[b + F.HELD] |= 1 << a1; S[b + F.PC] += 1; if (ev) ev.push(['lock', i, a1]); }
    else { S[b + F.BLK] = a1; if (ev) ev.push(['wait', i, a1]); }
  } else if (k === OP.UNLOCK) {
    execUnlock(c, S, i, a1, ev); S[b + F.PC] += 1; if (ev) ev.push(['unlock', i, a1]);
  } else if (k === OP.TRAVEL) {
    S[b + F.BUSY] = S[0] + a1 + 1; S[b + F.PC] += 1; if (ev) ev.push(['travel', i, a1]);
  } else if (k === OP.WORK) {
    S[b + F.PC] += 1; if (ev) ev.push(['work', i, -1]);
  } else if (k === OP.TRY) {
    if (S[4 + a1] === -1) { S[4 + a1] = i; S[b + F.HELD] |= 1 << a1; S[b + F.PC] += 1; if (ev) ev.push(['lock', i, a1]); }
    else {
      const freed = releaseAll(c, S, i);
      S[b + F.BUSY] = S[0] + a2 + 1; S[b + F.PC] = 0;
      if (ev) ev.push(['backoff', i, a1]);
      for (let r = 0; r < c.R; r += 1) if ((freed >> r) & 1) wake(c, S, r, ev);
    }
  } else if (k === OP.DONE) {
    finish(c, S, i, true, ev);
  }
}

function stepLockstep(c, S, ev) {
  const run = [];
  for (let i = 0; i < c.N; i += 1) if (isRunnable(c, S, i)) run.push(i);
  if (!run.length) return;
  const reqs = [];
  // pass 1: everything that is not a lock/try, so releases are visible this tick
  for (const i of run) {
    const b = cb(c, i);
    const ops = c.ops[i];
    const pc = S[b + F.PC];
    if (pc * 3 >= ops.length) { S[b + F.DONE] = 1; continue; }
    const k = ops[pc * 3], a1 = ops[pc * 3 + 1];
    if (k === OP.UNLOCK) { execUnlock(c, S, i, a1, ev); S[b + F.PC] += 1; if (ev) ev.push(['unlock', i, a1]); }
    else if (k === OP.TRAVEL) { S[b + F.BUSY] = S[0] + a1 + 1; S[b + F.PC] += 1; if (ev) ev.push(['travel', i, a1]); }
    else if (k === OP.WORK) { S[b + F.PC] += 1; if (ev) ev.push(['work', i, -1]); }
    else if (k === OP.DONE) { finish(c, S, i, false, ev); }
    else reqs.push(i);
  }
  // pass 2: lock/try against the snapshot, so polite carts fail together
  const snap = S.slice(4, 4 + c.R);
  const byRes = new Map();
  for (const i of reqs) {
    const r = c.ops[i][S[cb(c, i) + F.PC] * 3 + 1];
    if (!byRes.has(r)) byRes.set(r, []);
    byRes.get(r).push(i);
  }
  const out = [];
  for (const [r, list] of byRes) {
    list.sort((x, y) => eff(c, S, y) - eff(c, S, x) || x - y);
    list.forEach((i, n) => out.push([i, r, snap[r] === -1 && n === 0]));
  }
  for (const [i, r, ok] of out) {
    const b = cb(c, i);
    const pc = S[b + F.PC];
    const k = c.ops[i][pc * 3];
    if (ok) {
      S[4 + r] = i; S[b + F.HELD] |= 1 << r; S[b + F.PC] += 1;
      if (ev) ev.push(['lock', i, r]);
    } else if (k === OP.LOCK) {
      S[b + F.BLK] = r; if (ev) ev.push(['wait', i, r]);
    } else {
      releaseAll(c, S, i);
      S[b + F.BUSY] = S[0] + c.ops[i][pc * 3 + 2] + 1; S[b + F.PC] = 0;
      if (ev) ev.push(['backoff', i, r]);
    }
  }
  // pass 3: free resources go to their best waiter
  for (let r = 0; r < c.R; r += 1) wake(c, S, r, ev);
}

// ---- interventions -------------------------------------------------------
export function canHold(c, S, i) {
  const b = cb(c, i);
  return S[1] === RUNNING && S[2] > 0 && !S[b + F.DONE] && S[b + F.BLK] < 0 && S[0] >= S[b + F.HOLD];
}
export function canLoan(c, S, i) {
  const b = cb(c, i);
  if (S[1] !== RUNNING || S[3] <= 0 || S[b + F.DONE] || S[0] < S[b + F.BOOST]) return false;
  return waiterPrio(c, S, i) > c.prio[i];
}
export function applyHold(c, S, i) {
  S[2] -= 1; S[cb(c, i) + F.HOLD] = S[0] + c.holdTicks; return S;
}
export function applyLoan(c, S, i) {
  S[3] -= 1; S[cb(c, i) + F.BOOST] = S[0] + c.boostTicks; return S;
}

// ---- readouts (pure functions of a state) --------------------------------
export function waitFor(c, S) {
  const edges = [];
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    const r = S[b + F.BLK];
    if (r >= 0 && !S[b + F.DONE] && S[4 + r] >= 0) edges.push({ from: i, to: S[4 + r], res: r });
  }
  return edges;
}
// "Wants" edges: who currently holds what each cart's *next* lock needs, even
// if the cart has not reached it yet. A closed loop of these is the open window.
export function intentEdges(c, S) {
  const edges = [];
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    if (S[b + F.DONE]) continue;
    const ops = c.ops[i];
    let pc = S[b + F.PC];
    if (S[b + F.BLK] >= 0) continue; // already a real wait edge
    while (pc * 3 < ops.length && ops[pc * 3] !== OP.LOCK && ops[pc * 3] !== OP.TRY && ops[pc * 3] !== OP.DONE) pc += 1;
    if (pc * 3 >= ops.length) continue;
    const k = ops[pc * 3];
    if (k === OP.DONE) continue;
    const r = ops[pc * 3 + 1];
    const o = S[4 + r];
    if (o >= 0 && o !== i) edges.push({ from: i, to: o, res: r });
  }
  return edges;
}
export function findCycle(edges) {
  const next = new Map(edges.map((e) => [e.from, e.to]));
  for (const start of next.keys()) {
    const path = []; const seen = new Set(); let cur = start;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); path.push(cur); cur = next.get(cur); }
    if (cur !== undefined && path.includes(cur)) return path.slice(path.indexOf(cur));
  }
  return null;
}
export function findInversion(c, S) {
  for (let h = 0; h < c.N; h += 1) {
    const b = cb(c, h);
    const r = S[b + F.BLK];
    if (r < 0 || S[b + F.DONE] || S[4 + r] < 0) continue;
    const l = S[4 + r];
    const el = eff(c, S, l);
    if (eff(c, S, h) <= el) continue;
    for (let m = 0; m < c.N; m += 1) {
      if (m === h || m === l || !isRunnable(c, S, m)) continue;
      if (eff(c, S, m) > el) return { high: h, low: l, medium: m, res: r };
    }
  }
  return null;
}
export function missedCart(c, S) {
  for (let i = 0; i < c.N; i += 1) if (!S[cb(c, i) + F.DONE] && S[0] > c.deadline[i]) return i;
  return -1;
}
export function signature(c, S) {
  let s = '';
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    s += `${S[b + F.PC]}.${S[b + F.HELD]}.${S[b + F.BLK]}.${S[b + F.DONE]}|`;
  }
  return s;
}
// Tick-free, budget-free, timer-relative key. Two states with equal keys have
// identical futures up to a shift in time, so the earlier one dominates.
export function dynKey(c, S) {
  const t = S[0];
  const a = [];
  for (let r = 0; r < c.R; r += 1) a.push(S[4 + r] + 1);
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    a.push(S[b + F.PC], S[b + F.BLK] + 1,
      Math.max(0, S[b + F.BUSY] - t), Math.max(0, S[b + F.HOLD] - t),
      Math.max(0, S[b + F.BOOST] - t), S[b + F.DONE]);
  }
  return String.fromCharCode.apply(null, a);
}
export function anyRunnable(c, S) {
  for (let i = 0; i < c.N; i += 1) if (isRunnable(c, S, i)) return true;
  return false;
}
export function allUnfinishedBlocked(c, S) {
  let any = false;
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    if (S[b + F.DONE]) continue;
    any = true;
    if (S[b + F.BLK] < 0) return false;
  }
  return any;
}
