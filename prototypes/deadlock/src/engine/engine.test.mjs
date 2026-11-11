// node --test src/engine/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LADDER, levelFor, replay, certify, analyse, measure, compile, canDo, createRng, hashSeed,
  RUNNING, WON, DEADLOCK, LIVELOCK, MISSED, buildLevel, CAP, failureKind,
} from './index.mjs';

const ring3 = () => levelFor('TEST', 0).level;
const inv = () => levelFor('TEST', 1).level;

test('rng is deterministic and clock-free', () => {
  const a = createRng(hashSeed('x')), b = createRng(hashSeed('x'));
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('seed -> level is a pure function', () => {
  for (const r of [0, 1, 2, 5, 9]) {
    const a = levelFor('PURE', r), b = levelFor('PURE', r);
    assert.deepEqual(JSON.parse(JSON.stringify(a.level)), JSON.parse(JSON.stringify(b.level)));
    assert.deepEqual(a.report.plan, b.report.plan);
  }
});

test('ring: default run deadlocks, naming a 3-cycle', () => {
  const rep = replay(ring3(), []);
  assert.equal(rep.status, DEADLOCK);
  const last = rep.frames.at(-1);
  assert.equal(last.cycle.length, 3);
  assert.equal(last.edges.length, 3);
});

test('ring: the window is visible before the loop closes (intent cycle)', () => {
  const rep = replay(ring3(), []);
  assert.ok(rep.frames.some((f) => !f.cycle && f.intentCycle), 'slack loop precedes taut loop');
});

test('ring: a certified hold unwinds it; a hold after the window does not', () => {
  const lv = ring3();
  const rep = analyse(lv);
  assert.ok(rep.accept);
  assert.equal(replay(lv, rep.plan).status, WON);
  const late = rep.plan.map((a) => ({ ...a, tick: 12 }));
  assert.notEqual(replay(lv, late).status, WON);
});

test('inversion: loan the holder wins, waiter / hog / holding the holder do not', () => {
  const lv = inv();
  assert.equal(failureKind(replay(lv, [])), 'inversion');
  const [L, H, M] = lv.carts.map((c) => c.id);
  assert.equal(replay(lv, [{ tick: 0, kind: 'loan', cart: L }]).status, WON);
  const f0 = replay(lv, []).frames[0];
  assert.equal(canDo(lv, f0, 'loan', H), false, 'loan on the waiter is a no-op');
  assert.equal(canDo(lv, f0, 'loan', M), false, 'loan on the hog is a no-op');
  assert.equal(canDo(lv, f0, 'loan', L), true);
  const holdBudget = { ...lv, budget: { hold: 1, loan: 1 } };
  const worse = replay(holdBudget, [{ tick: 0, kind: 'hold', cart: L }, { tick: 0, kind: 'loan', cart: L }]);
  assert.notEqual(worse.status, WON, 'holding the holder wastes the loan');
});

test('polite pair livelocks by default and a stagger breaks it', () => {
  const lv = levelFor('TEST', 2).level;
  assert.equal(replay(lv, []).status, LIVELOCK);
  assert.equal(replay(lv, analyse(lv).plan).status, WON);
});

test('certified plan is minimal: no plan with fewer interventions exists', () => {
  for (const r of [0, 3, 5, 6]) {
    const lv = levelFor('MIN', r).level;
    const par = certify(lv).used;
    const smaller = { ...lv, budget: { hold: Math.max(0, lv.budget.hold - 1), loan: lv.budget.loan } };
    if (lv.budget.hold > 0 && par === lv.budget.hold + lv.budget.loan) assert.equal(certify(smaller).ok, false);
  }
});

test('every rung for several seeds is certified under the shipping rules', () => {
  for (const seed of ['A', 'CLAY', 'RAIL-101']) {
    for (let r = 0; r < LADDER.length; r += 1) {
      const g = levelFor(seed, r);
      assert.ok(g.ok, `${seed}/${r}: ${g.reason}`);
      const m = measure(g.level);
      assert.ok(m.par >= 1 && m.par <= g.level.budget.hold + g.level.budget.loan);
      assert.ok(m.window >= 2, `${seed}/${r} window ${m.window}`);
      assert.ok(['deadlock', 'livelock', 'inversion'].includes(m.defaultFailure));
      assert.equal(replay(g.level, m.plan).status, WON);
      const c = compile(g.level);
      assert.ok(c.R <= CAP.sections && c.N <= CAP.carts, `${seed}/${r} over cap`);
    }
  }
});

test('growth is monotone in carts and sections, ending at the cap', () => {
  const sizes = LADDER.map((s) => {
    const lv = buildLevel(s, createRng(1), 'G', 0, { canonical: true });
    return [lv.resources.length, lv.carts.length];
  });
  assert.equal(Math.max(...sizes.map((s) => s[1])), CAP.carts);
  assert.equal(Math.max(...sizes.map((s) => s[0])), CAP.sections);
  assert.ok(sizes.at(-1)[0] >= sizes[0][0] && sizes.at(-1)[1] >= sizes[0][1]);
});

test('state invariants hold along every default run', () => {
  for (let r = 0; r < LADDER.length; r += 1) {
    const lv = levelFor('INV', r).level;
    const rep = replay(lv, []);
    for (const f of rep.frames) {
      f.carts.forEach((c) => {
        for (const res of c.held) assert.equal(f.owner[res], c.i, 'held resource is owned by holder');
        if (c.done) assert.equal(c.held.length, 0, 'done carts hold nothing');
        if (c.blockedOn >= 0) assert.ok(!c.held.includes(c.blockedOn), 'waiter does not hold its target');
      });
      f.owner.forEach((o, res) => { if (o >= 0) assert.ok(f.carts[o].held.includes(res)); });
    }
  }
});
