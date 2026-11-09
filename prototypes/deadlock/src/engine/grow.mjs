// The grower: seed + rung -> certified level. Growth is data (LADDER): each rung
// adds sections, junction-like pads (tails), driveways or whole districts and
// carts, up to CAP. Every level is certified by the same search the player's
// Dev panel shows; rejected candidates are resampled, never shipped.
import { lock, unlock, travel, tryLock, work, done } from './model.mjs';
import { createRng, hashSeed, pickInt, shuffled } from './rng.mjs';
import { analyse } from './certify.mjs';

export const CAP = { sections: 10, carts: 6 };
export const SCENE = { w: 1000, h: 700 };

// Rung table. `districts` are independent sub-yards that share one scene;
// `tails` are carts that start on a private spur pad and want a ring pad (a
// tail hangs off the cycle, so a hold on the wrong cart cannot help it).
export const LADDER = [
  { name: 'First ring',        family: 'ring',      districts: [{ t: 'ring', n: 3 }],                                  budget: { hold: 1, loan: 0 } },
  { name: 'The VIP ticket',    family: 'inversion', districts: [{ t: 'inv', pairs: 1 }],                              budget: { hold: 0, loan: 1 } },
  { name: 'Polite pair',       family: 'polite',    districts: [{ t: 'polite' }],                                     budget: { hold: 1, loan: 0 } },
  { name: 'Four at the table', family: 'ring',      districts: [{ t: 'ring', n: 4 }],                                  budget: { hold: 1, loan: 0 } },
  { name: 'Ring with a tail',  family: 'ring',      districts: [{ t: 'ring', n: 3, tails: 1 }],                       budget: { hold: 1, loan: 0 } },
  { name: 'Two pairs',         family: 'multi',     districts: [{ t: 'pair' }, { t: 'pair' }],                        budget: { hold: 2, loan: 0 } },
  { name: 'Two VIP waits',     family: 'inversion', districts: [{ t: 'inv', pairs: 2 }],                              budget: { hold: 0, loan: 2 } },
  { name: 'Ring, two tails',   family: 'ring',      districts: [{ t: 'ring', n: 3, tails: 2 }],                       budget: { hold: 1, loan: 0 } },
  { name: 'Big ring, tails',   family: 'ring',      districts: [{ t: 'ring', n: 4, tails: 2 }],                       budget: { hold: 1, loan: 0 } },
  { name: 'Twin rings',        family: 'multi',     districts: [{ t: 'ring', n: 3 }, { t: 'ring', n: 3 }],            budget: { hold: 2, loan: 0 } },
  { name: 'Two hogs',          family: 'inversion', districts: [{ t: 'inv', pairs: 2, hogs: 2 }],                     budget: { hold: 0, loan: 2 } },
  { name: 'Ring and hallway',  family: 'multi',     districts: [{ t: 'ring', n: 3 }, { t: 'polite' }],                budget: { hold: 2, loan: 0 } },
  { name: 'Table and hallway', family: 'multi',     districts: [{ t: 'ring', n: 4 }, { t: 'polite' }],                budget: { hold: 2, loan: 0 } },
  { name: 'Long routes',       family: 'multi',     districts: [{ t: 'ring', n: 3, drive: true }, { t: 'pair' }],     budget: { hold: 2, loan: 0 } },
  { name: 'Full yard',         family: 'multi',     districts: [{ t: 'ring', n: 4, drive: true }, { t: 'pair' }],     budget: { hold: 2, loan: 0 } },
];

export function rungStats(spec) {
  const lv = buildLevel(spec, createRng(1), 'STATS', 0, { canonical: true });
  return { sections: lv.resources.length, carts: lv.carts.length };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TAU = Math.PI * 2;
const pt = (x, y) => ({ x: Math.round(x), y: Math.round(y) });

// Districts share the diorama width in proportion to how much room they need.
function slotsFor(districts) {
  const weight = (d) => (d.t === 'pair' ? 0.8 : d.t === 'polite' ? 1.05 : (d.n >= 4 ? 1.3 : 1.1) + (d.drive ? 0.55 : 0) + (d.tails ? 0.15 : 0));
  const ws = districts.map(weight); const sum = ws.reduce((x, y) => x + y, 0);
  const total = districts.length === 1 ? 940 : 920; let x = (1000 - total) / 2;
  return ws.map((w) => { const width = (w / sum) * total; const slot = { cx: x + width / 2, cy: 442, w: width, s: districts.length === 1 ? 1 : 0.72 }; x += width; return slot; });
}

export function buildLevel(spec, rng, seed, rung, opts = {}) {
  const canon = !!opts.canonical;
  const jit = (lo, hi) => (canon ? lo : pickInt(rng, lo, hi));
  const flip = !canon && rng() < 0.5;
  const slots = slotsFor(spec.districts);
  // pieces shrink as the yard fills so a 6-cart board stays legible
  const nCarts = spec.districts.reduce((n, d) => n + (d.t === 'ring' ? d.n + (d.tails || 0) : d.t === 'inv' ? (d.pairs || 1) * 2 + (d.hogs || 1) : 2), 0);
  const pieceScale = nCarts <= 3 ? 0.9 : nCarts === 4 ? 0.8 : nCarts === 5 ? 0.7 : 0.62;
  const resources = [];
  const carts = [];
  const layout = { pads: {}, depots: {}, huts: {}, loops: {}, tails: [], districts: [] };
  const initial = { owner: {} };
  let hasInv = false;
  const newRes = () => { const id = LETTERS[resources.length]; resources.push(id); return id; };
  const newCart = (tape, extra = {}) => {
    const id = `c${carts.length}`;
    carts.push({ id, prio: 1, deadline: 40, tape, ...extra });
    return id;
  };

  spec.districts.forEach((d, di) => {
    const slot = slots[di];
    const s = slot.s;
    layout.districts.push({ ...slot, t: d.t });
    if (d.t === 'ring' || d.t === 'pair') {
      const n = d.t === 'pair' ? 2 : d.n;
      const pads = Array.from({ length: n }, () => newRes());
      if (flip) pads.reverse();
      const big = spec.districts.length === 1;
      const dd = 128 * pieceScale;
      const ext = d.drive ? 2.0 : 1.55;
      const hw = slot.w / 2;
      const rx = n === 2 ? Math.max(48, Math.min(165, hw - dd * ext)) : Math.max(58, Math.min(285, hw - dd * ext));
      const ry = n === 2 ? 0 : Math.min(n === 3 ? 175 : n === 4 ? 150 : 140, rx * (n === 3 ? 0.78 : 0.6));
      const centre = { x: slot.cx, y: slot.cy + (n === 3 ? (big ? 22 : 10) : 0) };
      const ang = (k) => (n === 2 ? (k === 0 ? Math.PI : 0) : -Math.PI / 2 + (TAU * k) / n);
      const pos = pads.map((_, k) => ({ x: centre.x + rx * Math.cos(ang(k)), y: centre.y + (n === 2 ? 0 : ry * Math.sin(ang(k))) }));
      const unit = (k) => (n === 2 ? { x: k === 0 ? -1 : 1, y: 0 } : { x: Math.cos(ang(k)), y: Math.sin(ang(k)) });
      pads.forEach((id, k) => { layout.pads[id] = pt(pos[k].x, pos[k].y); });
      const rot = (u, a) => ({ x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) });
      const driveIds = [];
      for (let k = 0; k < n; k += 1) {
        const first = pads[k], second = pads[(k + 1) % n];
        const t1 = jit(1, 2), t2 = jit(1, 2), pre = jit(2, 3);
        let tape;
        if (d.drive) {
          const dr = newRes(); driveIds.push(dr);
          tape = [lock(dr), travel(1), lock(first), unlock(dr), travel(t1), lock(second), travel(t2), unlock(second), unlock(first), done()];
        } else {
          tape = [travel(pre), lock(first), travel(t1), lock(second), travel(t2), unlock(second), unlock(first), done()];
        }
        const id = newCart(tape, { prio: 3 - (carts.length % 3) });
        const u = unit(k);
        const pad0 = pos[k];
        if (d.drive) {
          layout.pads[driveIds[k]] = pt(pad0.x + u.x * dd, pad0.y + u.y * dd * 0.6);
          layout.depots[id] = pt(pad0.x + u.x * dd * 1.95, pad0.y + u.y * dd * 1.2);
        } else {
          layout.depots[id] = pt(pad0.x + u.x * dd, pad0.y + u.y * dd * 0.6);
        }
        const u2 = unit((k + 1) % n);
        const hv = n === 2 ? { x: u2.x, y: u2.y + (k === 0 ? 0.55 : -0.55) } : rot(u2, 0.95);
        const hd = dd * (d.drive ? 1.75 : 1.65);
        layout.huts[id] = pt(pos[(k + 1) % n].x + hv.x * hd, pos[(k + 1) % n].y + hv.y * hd * 0.55);
      }
      // tails: carts that hang off the ring
      const tails = d.tails || 0;
      const targets = shuffled(rng, pads.map((_, k) => k)).slice(0, tails);
      if (canon) targets.sort((a, b) => a - b);
      targets.forEach((k, j) => {
        const z = newRes();
        const target = pads[k];
        const tape = [travel(jit(2, 3)), lock(z), travel(1), lock(target), travel(1), unlock(target), unlock(z), done()];
        const id = newCart(tape, { prio: 1 });
        const p = pos[k];
        const inward = { x: centre.x + (p.x - centre.x) * 0.5, y: centre.y + (p.y - centre.y) * 0.5 };
        layout.pads[z] = pt(inward.x, inward.y);
        layout.depots[id] = pt(centre.x + (p.x - centre.x) * 0.12, centre.y + (p.y - centre.y) * 0.12);
        const side = rot(unit(k), Math.PI / 2);
        layout.huts[id] = pt(inward.x + side.x * 95, inward.y + side.y * 70);
        layout.tails.push(id);
      });
    } else if (d.t === 'polite') {
      const A = newRes(), B = newRes();
      const b1 = jit(2, 3), b2 = jit(2, 3);
      const cx = slot.cx, cy = slot.cy;
      const K = Math.min(1, slot.w / 600); const pd = 120 * Math.max(0.55, K);
      layout.pads[A] = pt(cx - pd, cy); layout.pads[B] = pt(cx + pd, cy);
      const p = newCart([travel(jit(1, 2)), lock(A), travel(1), tryLock(B, b1), travel(1), unlock(B), unlock(A), done()], { prio: 2 });
      const q = newCart([travel(jit(1, 2)), lock(B), travel(1), tryLock(A, b2), travel(1), unlock(A), unlock(B), done()], { prio: 1 });
      layout.depots[p] = pt(cx - 300 * K, cy - 70);
      layout.depots[q] = pt(cx + 300 * K, cy + 70);
      layout.huts[p] = pt(cx + 300 * K, cy - 85);
      layout.huts[q] = pt(cx - 300 * K, cy + 85);
    } else if (d.t === 'inv') {
      hasInv = true;
      const pairs = d.pairs || 1;
      const hogs = d.hogs || 1;
      const sp = 330;
      const cy = 300;
      const pads = [];
      const lows = [], highs = [];
      for (let j = 0; j < pairs; j += 1) {
        const S = newRes(); pads.push(S);
        const x = 500 + (j - (pairs - 1) / 2) * sp;
        layout.pads[S] = pt(x, cy);
        const dl = jit(10, 13) + j * 2;
        const L = newCart([unlock(S), done()], { prio: 1, deadline: 40 });
        const H = newCart([lock(S), travel(2), done()], { prio: pairs === 1 ? 3 : 4 - j, deadline: dl, tight: true });
        lows.push(L); highs.push(H);
        initial[L] = { held: [S], pc: 0 };
        initial[H] = { blockedOn: S, pc: 0, held: [] };
        initial.owner[S] = L;
        layout.depots[H] = pt(x - 200, cy + 8);
        layout.huts[H] = pt(x + 200, cy + 8);
        layout.depots[L] = pt(x, cy);
        layout.huts[L] = pt(x + 90 + (j % 2) * 10, cy - 100);
      }
      for (let m = 0; m < hogs; m += 1) {
        const M = newCart(Array.from({ length: jit(12, 14) }, () => work()).concat([done()]), { prio: 2, deadline: 40, hog: true });
        const mx = hogs === 1 ? 500 : 500 + (m === 0 ? -170 : 170);
        layout.loops[M] = { cx: mx, cy: 520, rx: hogs === 1 ? 200 : 150, ry: 52 };
        layout.depots[M] = pt(mx - (hogs === 1 ? 200 : 150), 520);
        layout.huts[M] = pt(mx + (hogs === 1 ? 200 : 150) + 40, 520);
      }
    }
  });

  // prios: ring-like levels keep distinct tie-break order; inversion keeps tiers.
  const mode = hasInv ? 'priority' : 'lockstep';
  const skins = canon ? carts.map((_, i) => i) : shuffled(rng, [0, 1, 2, 3, 4, 5]);
  carts.forEach((c, i) => { c.skin = skins[i % skins.length]; });
  const layoutOut = layout;
  layoutOut.scale = pieceScale;
  const level = {
    id: `${seed}-${rung}`, seed, rung, name: spec.name, family: spec.family, mode,
    resources, carts, budget: { ...spec.budget }, holdTicks: 6, boostTicks: 6, horizon: 90,
    layout: layoutOut,
  };
  if (hasInv) level.initial = initial;
  level.showPrio = hasInv;
  return level;
}

function stripInitial(level) { return level; }

// Seed -> level. Deterministic: same (seed, rung) -> same board and same plan.
export function levelFor(seedText, rung, opts = {}) {
  const spec = LADDER[Math.max(0, Math.min(LADDER.length - 1, rung))];
  const seed = String(seedText || 'CLAY').trim().toUpperCase() || 'CLAY';
  const maxAttempts = opts.maxAttempts ?? 40;
  let last = 'no candidate';
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rng = createRng((hashSeed(seed) ^ Math.imul(rung + 1, 0x85ebca6b) ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0);
    const level = stripInitial(buildLevel(spec, rng, seed, rung, { canonical: attempt === maxAttempts - 1 }));
    const rep = analyse(level, opts);
    if (!rep.accept) { last = rep.reason; continue; }
    return finalise(level, rep, attempt + 1, opts);
  }
  return { ok: false, reason: last, attempts: maxAttempts };
}

// Shrink the tray to exactly the certified plan's composition, then re-check.
function finalise(level, rep, attempts, opts) {
  const holds = rep.plan.filter((a) => a.kind === 'hold').length;
  const loans = rep.plan.filter((a) => a.kind === 'loan').length;
  let report = rep;
  if (holds !== level.budget.hold || loans !== level.budget.loan) {
    level.budget = { hold: holds, loan: loans };
    report = analyse(level, opts);
    if (!report.accept) return { ok: false, reason: `after shrink: ${report.reason}`, attempts };
  }
  level.par = report.par;
  level.defaultFailure = report.defaultFailure;
  return { ok: true, level, report, attempts };
}
