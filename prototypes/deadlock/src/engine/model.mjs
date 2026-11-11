// Level data model + compiler to flat integer ops.
//
// A level is plain JSON:
//   { id, name, seed, rung, family, mode:'lockstep'|'priority', resources:[ids],
//     carts:[{ id, skin, prio, deadline, tape:[{k,...}], tight? }],
//     budget:{hold,loan}, holdTicks, boostTicks, horizon,
//     initial?:{ cartId:{held,pc,blockedOn}, owner:{res:cartId} },
//     layout:{...} }
// Tape ops: lock(r) unlock(r) travel(n) try(r,backoff) work() done()
export const OP = { LOCK: 0, UNLOCK: 1, TRAVEL: 2, TRY: 3, WORK: 4, DONE: 5 };
export const lock = (r) => ({ k: 'lock', r });
export const unlock = (r) => ({ k: 'unlock', r });
export const travel = (n) => ({ k: 'travel', n });
export const tryLock = (r, backoff) => ({ k: 'try', r, backoff });
export const work = () => ({ k: 'work' });
export const done = () => ({ k: 'done' });

// State layout (Int32Array): [tick,status,holdLeft,loanLeft, owner[R], per cart x W]
export const W = 7; // pc, blk, busyUntil, holdUntil, boostUntil, done, heldMask
export const F = { PC: 0, BLK: 1, BUSY: 2, HOLD: 3, BOOST: 4, DONE: 5, HELD: 6 };
export const NO_DEADLINE = 1 << 20;

const cache = new WeakMap();
export function compile(level) {
  const hit = cache.get(level);
  if (hit) return hit;
  const N = level.carts.length;
  const R = level.resources.length;
  if (R > 30) throw new Error('at most 30 resources (bitmask)');
  const resIdx = {};
  level.resources.forEach((r, i) => { resIdx[r] = i; });
  const cartIdx = {};
  level.carts.forEach((c, i) => { cartIdx[c.id] = i; });
  const ops = level.carts.map((c) => {
    const a = new Int32Array(c.tape.length * 3);
    c.tape.forEach((op, i) => {
      const k = OP[op.k.toUpperCase()];
      a[i * 3] = k;
      if (op.k === 'lock' || op.k === 'unlock') a[i * 3 + 1] = resIdx[op.r];
      if (op.k === 'try') { a[i * 3 + 1] = resIdx[op.r]; a[i * 3 + 2] = op.backoff; }
      if (op.k === 'travel') a[i * 3 + 1] = op.n;
    });
    return a;
  });
  const base = 4 + R;
  const init = new Int32Array(base + N * W);
  init[1] = 0;
  init[2] = level.budget.hold;
  init[3] = level.budget.loan;
  for (let r = 0; r < R; r += 1) init[4 + r] = -1;
  for (let i = 0; i < N; i += 1) init[base + i * W + F.BLK] = -1;
  if (level.initial) {
    level.carts.forEach((c, i) => {
      const ini = level.initial[c.id];
      if (!ini) return;
      const b = base + i * W;
      if (ini.pc != null) init[b + F.PC] = ini.pc;
      if (ini.held) for (const r of ini.held) init[b + F.HELD] |= 1 << resIdx[r];
      if (ini.blockedOn) init[b + F.BLK] = resIdx[ini.blockedOn];
    });
    for (const [r, cid] of Object.entries(level.initial.owner || {})) init[4 + resIdx[r]] = cartIdx[cid];
  }
  const compiled = {
    N, R, base, resIdx, cartIdx,
    mode: level.mode,
    prio: Int32Array.from(level.carts.map((c) => c.prio)),
    deadline: Int32Array.from(level.carts.map((c) => (c.deadline == null ? NO_DEADLINE : c.deadline))),
    ops, init,
    holdTicks: level.holdTicks ?? 6,
    boostTicks: level.boostTicks ?? 6,
    horizon: level.horizon ?? 90,
    resources: level.resources,
    carts: level.carts,
  };
  cache.set(level, compiled);
  return compiled;
}
