// replay(level, plan) -> frames. The whole UI is a view over this: the film
// strip, the scrubber, the demo, Dev mode. A plan is a list of
//   { tick, kind:'hold'|'loan', cart:cartId }
// applied before the scheduler step of that tick. Pure and deterministic.
import { compile, W, F } from './model.mjs';
import {
  RUNNING, WON, DEADLOCK, LIVELOCK, MISSED, STATUS_NAMES,
  initState, step, canHold, canLoan, applyHold, applyLoan, eff,
  waitFor, intentEdges, findCycle, findInversion, missedCart, signature, anyRunnable,
  allUnfinishedBlocked, dynKey,
} from './sim.mjs';

const cb = (c, i) => c.base + i * W;

export function viewOf(level, S, extra = {}) {
  const c = compile(level);
  const ids = level.resources;
  const carts = [];
  for (let i = 0; i < c.N; i += 1) {
    const b = cb(c, i);
    const held = [];
    for (let r = 0; r < c.R; r += 1) if ((S[b + F.HELD] >> r) & 1) held.push(r);
    carts.push({
      i, id: level.carts[i].id, pc: S[b + F.PC], held,
      blockedOn: S[b + F.BLK], done: !!S[b + F.DONE],
      busyLeft: Math.max(0, S[b + F.BUSY] - S[0]),
      holdLeft: Math.max(0, S[b + F.HOLD] - S[0]),
      boostLeft: Math.max(0, S[b + F.BOOST] - S[0]),
      eff: eff(c, S, i), prio: c.prio[i],
    });
  }
  const owner = [];
  for (let r = 0; r < c.R; r += 1) owner.push(S[4 + r]);
  const edges = waitFor(c, S);
  const cycle = findCycle(edges);
  const intent = intentEdges(c, S);
  const iCycle = findCycle(edges.concat(intent));
  return {
    tick: S[0], status: S[1], statusName: STATUS_NAMES[S[1]],
    budget: { hold: S[2], loan: S[3] },
    carts, owner, edges, intent, cycle, intentCycle: iCycle,
    inversion: findInversion(c, S),
    missed: S[1] === MISSED ? missedCart(c, S) : -1,
    key: dynKey(c, S),
    ...extra,
  };
}

export function replay(level, plan = [], opts = {}) {
  const c = compile(level);
  const maxTicks = opts.maxTicks ?? c.horizon + 2;
  const S = initState(c);
  const pend = plan.map((a, n) => ({ ...a, n })).sort((a, b) => a.tick - b.tick || a.n - b.n);
  const frames = [];
  const applied = [];
  const sigs = new Map();
  let pi = 0;
  let ev = [];
  for (let t = 0; t <= maxTicks; t += 1) {
    const acts = [];
    while (pi < pend.length && pend[pi].tick === t && S[1] === RUNNING) {
      const a = pend[pi]; pi += 1;
      const i = c.cartIdx[a.cart];
      let ok = false;
      if (i !== undefined) {
        const waiterFor = a.kind === 'loan' ? findWaiter(c, S, i) : -1;
        if (a.kind === 'hold' && canHold(c, S, i)) { applyHold(c, S, i); ok = true; }
        else if (a.kind === 'loan' && canLoan(c, S, i)) { applyLoan(c, S, i); ok = true; }
        acts.push({ kind: a.kind, cart: i, ok, from: waiterFor });
        applied.push({ ...a, ok });
      }
    }
    const view = viewOf(level, S, { acts, events: ev, raw: S.slice() });
    frames.push(view);
    if (S[1] !== RUNNING) break;
    ev = [];
    step(c, S, ev);
    if (S[1] === RUNNING && (anyRunnable(c, S) || allUnfinishedBlocked(c, S))) {
      const sg = signature(c, S);
      const n = (sigs.get(sg) || 0) + 1;
      sigs.set(sg, n);
      if (n >= 3) S[1] = LIVELOCK;
    }
  }
  const last = frames[frames.length - 1];
  const rejected = pend.slice(pi).concat(applied.filter((a) => !a.ok));
  return { frames, status: last.status, statusName: last.statusName, ticks: last.tick, applied, rejected, c };
}

// Which waiter is the loan lending priority from? (animation only)
function findWaiter(c, S, i) {
  const held = S[cb(c, i) + F.HELD];
  let best = -1, bp = -1;
  for (let j = 0; j < c.N; j += 1) {
    const b = cb(c, j);
    const r = S[b + F.BLK];
    if (r >= 0 && !S[b + F.DONE] && ((held >> r) & 1) && c.prio[j] > bp) { best = j; bp = c.prio[j]; }
  }
  return best;
}

export function failureKind(rep) {
  if (rep.status === DEADLOCK) return 'deadlock';
  if (rep.status === LIVELOCK) return 'livelock';
  if (rep.status === MISSED) {
    return rep.frames.some((f) => f.inversion) ? 'inversion' : 'missed';
  }
  return rep.status === WON ? 'won' : 'running';
}
export function sawInversion(rep) { return rep.frames.some((f) => f.inversion); }

// What the player can do right now (used by the UI to bounce bad drops).
export function canDo(level, frame, kind, cartId) {
  const c = compile(level);
  const i = c.cartIdx[cartId];
  if (i === undefined) return false;
  return kind === 'hold' ? canHold(c, frame.raw, i) : canLoan(c, frame.raw, i);
}
