// Certifier: lexicographic shortest-plan search over the product automaton.
//   cost = interventions (0-1 BFS: a scheduler step costs 0, a hold/loan costs 1)
// Pruning that keeps it interactive:
//   * tick-free, timer-relative state key (a state at tick 9 is the same state as
//     at tick 5 shifted in time; the earlier one dominates because deadlines are
//     absolute);
//   * budget dominance: (hold>=, loan>=, tick<=) with the same key subsumes;
//   * only *meaningful* interventions are branched: a hold on a cart that is
//     neither done, blocked nor already held; a loan only on a holder some higher
//     priority cart waits on.
// The engine never reads a clock; callers time it.
import { compile } from './model.mjs';
import {
  RUNNING, WON, initState, cloneState, step, canHold, canLoan, applyHold, applyLoan, dynKey,
} from './sim.mjs';
import { replay, failureKind, sawInversion } from './trace.mjs';

export function certifyFrom(level, S0, opts = {}) {
  const c = compile(level);
  const maxStates = opts.maxStates ?? 120000;
  const budget = opts.budget ?? { hold: S0[2], loan: S0[3] };
  const start = S0.slice();
  start[2] = budget.hold; start[3] = budget.loan;
  const total = budget.hold + budget.loan;

  const dom = new Map(); // dynKey -> [[hold, loan, tick], ...]
  const dominated = (key, S) => {
    const list = dom.get(key);
    if (!list) { dom.set(key, [[S[2], S[3], S[0]]]); return false; }
    for (const e of list) if (e[0] >= S[2] && e[1] >= S[3] && e[2] <= S[0]) return true;
    list.push([S[2], S[3], S[0]]);
    return false;
  };

  const nodes = [{ S: start, parent: -1, act: null }];
  dominated(dynKey(c, start), start);
  const buckets = Array.from({ length: total + 1 }, () => []);
  buckets[0].push(0);
  let explored = 0, generated = 1, pruned = 0;

  const plan = (idx) => {
    const out = [];
    for (let n = idx; n > 0; n = nodes[n].parent) if (nodes[n].act) out.push(nodes[n].act);
    return out.reverse();
  };
  const push = (S, parent, act, used) => {
    const key = dynKey(c, S);
    if (dominated(key, S)) { pruned += 1; return -1; }
    nodes.push({ S, parent, act });
    generated += 1;
    buckets[used].push(nodes.length - 1);
    return nodes.length - 1;
  };

  for (let used = 0; used <= total; used += 1) {
    const bucket = buckets[used];
    for (let head = 0; head < bucket.length; head += 1) {
      const idx = bucket[head];
      const S = nodes[idx].S;
      explored += 1;
      if (explored > maxStates) return { ok: false, reason: 'state-cap', explored, generated, pruned };
      const t = S[0];
      const next = cloneState(S);
      step(c, next);
      if (next[1] === WON) {
        const p = plan(idx);
        return { ok: true, used, plan: p, explored, generated, pruned, ticks: next[0] };
      }
      if (next[1] === RUNNING) push(next, idx, null, used);
      if (used >= total) continue;
      for (let i = 0; i < c.N; i += 1) {
        if (S[2] > 0 && canHold(c, S, i)) {
          push(applyHold(c, cloneState(S), i), idx, { tick: t, kind: 'hold', cart: c.carts[i].id }, used + 1);
        }
        if (S[3] > 0 && canLoan(c, S, i)) {
          push(applyLoan(c, cloneState(S), i), idx, { tick: t, kind: 'loan', cart: c.carts[i].id }, used + 1);
        }
      }
    }
  }
  return { ok: false, reason: 'exhausted', explored, generated, pruned };
}

export function certify(level, opts = {}) {
  const c = compile(level);
  return certifyFrom(level, initState(c), opts);
}

// BFS returns *a* shortest plan; slide each action as early as it still wins so
// the plan we show (Dev mode, ghosts) is the one a player would find first.
export function earliestPlan(level, plan) {
  const out = plan.map((a) => ({ ...a }));
  for (let i = 0; i < out.length; i += 1) {
    while (out[i].tick > 0) {
      out[i].tick -= 1;
      if (replay(level, out).status !== WON) { out[i].tick += 1; break; }
    }
  }
  return out.sort((a, b) => a.tick - b.tick);
}

// Latest tick at which a plan still exists from the given run (the open
// window). Winnability is monotone in tick (you can always just step), so a
// binary search over frames is exact. Returns -1 if already lost at frame 0.
export function lastSaveTick(level, rep, opts = {}) {
  if (rep.status === WON) return rep.frames.length - 1;
  let lo = -1, hi = rep.frames.length - 1;
  const ok = (t) => {
    const f = rep.frames[t];
    if (f.status !== RUNNING) return false;
    return certifyFrom(level, f.raw, opts).ok;
  };
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ok(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// Full report: certificate + the shipping rules. `accept` is the verdict.
export function analyse(level, opts = {}) {
  const c = compile(level);
  const cert = certify(level, opts);
  const report = { cert, accept: false, reason: '' };
  const fail = (reason) => { report.reason = reason; return report; };
  if (!cert.ok) return fail(`no certificate (${cert.reason})`);
  const par = cert.used;
  const budget = level.budget.hold + level.budget.loan;
  report.par = par;
  report.plan = earliestPlan(level, cert.plan);
  if (par < 1) return fail('won with zero interventions');
  if (par > budget) return fail('plan exceeds budget');
  const holds = cert.plan.filter((a) => a.kind === 'hold');
  const heldCarts = new Set(holds.map((a) => a.cart));
  if (c.N >= 3 && heldCarts.size >= c.N - 1) return fail('degenerate: holds everyone');
  if (budget > Math.max(1, c.N - 1) && c.N >= 3) return fail('budget would allow holding everyone');
  const def = replay(level, []);
  const kind = failureKind(def);
  report.defaultFailure = kind;
  if (kind === 'won' || kind === 'running') return fail('default run does not fail');
  if (kind === 'missed') return fail('default run misses without a named failure');
  if (level.family === 'inversion' && kind !== 'inversion') return fail('inversion board without inversion');
  report.defaultTicks = def.ticks;
  // window >= 2: still winnable from the default state one tick later.
  const f1 = def.frames[1];
  if (!f1 || f1.status !== RUNNING) return fail('window < 2 (failure at tick 1)');
  const w1 = certifyFrom(level, f1.raw, opts);
  if (!w1.ok) return fail('window < 2');
  report.accept = true;
  return report;
}

// Extra Dev-mode / ladder metrics, kept out of the generator hot path.
export function measure(level, opts = {}) {
  const rep = analyse(level, opts);
  if (!rep.cert.ok) return rep;
  const def = replay(level, []);
  rep.lastSave = lastSaveTick(level, def, opts);
  rep.window = rep.lastSave + 1;
  const c = compile(level);
  // traps: tick-0 first moves that do not lead to a win with the remaining budget.
  let traps = 0, firsts = 0;
  const S0 = initState(c);
  for (let i = 0; i < c.N; i += 1) {
    for (const kind of ['hold', 'loan']) {
      const S = cloneState(S0);
      const ok = kind === 'hold' ? canHold(c, S, i) : canLoan(c, S, i);
      if (!ok) continue;
      firsts += 1;
      if (kind === 'hold') applyHold(c, S, i); else applyLoan(c, S, i);
      if (!certifyFrom(level, S, opts).ok) traps += 1;
    }
  }
  rep.traps = traps; rep.firstMoves = firsts;
  rep.sawInversion = sawInversion(def);
  return rep;
}
