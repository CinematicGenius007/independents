/* The simulation's rules. pnpm test */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { newShift, tick, act, autopilot, summary, patientsOf, findGridlocks, blockers, actionsFor, CASES, ON_CALL } from '../src/engine/sim.mjs';
import { buildSchedule } from '../src/engine/scenario.mjs';
import { makePatient } from '../src/engine/patient.mjs';
import { news2 } from '../src/engine/news2.mjs';

/** An empty department with every on-call team already in the building. */
function quiet(seed = 'T') {
  const s = newShift(seed);
  s.patients = {}; s.schedule = []; s.timers = []; s.alerts = [];
  for (const u of Object.values(s.units)) if (u.holder !== 'bg') u.holder = null;
  for (const [k, oc] of Object.entries(ON_CALL)) { const u = oc.unit(); s.units[u.id] = u; s.called[k] = { here: true }; }
  s.units.PSY1.holder = null;
  return s;
}
function admit(s, key) {
  const p = makePatient(s, key, s.t);
  s.patients[p.id] = p;
  if (CASES[key].via === 'house') { const u = Object.values(s.units).find((x) => x.kind === 'icu' && x.holder === 'bg'); u.holder = p.id; p.loc = u.id; p.status = 'active'; p.placedAt = s.t; } else autopilot(s);
  return p;
}

test('NEWS2 scores match the published chart', () => {
  assert.equal(news2({ rr: 16, spo2: 98, o2: false, sbp: 122, hr: 72, gcs: 15, temp: 36.8 }).score, 0);
  const sick = news2({ rr: 26, spo2: 90, o2: true, sbp: 88, hr: 132, gcs: 14, temp: 39.4 });
  assert.equal(sick.score, 3 + 3 + 2 + 3 + 3 + 3 + 2);
  assert.equal(sick.risk, 'high');
  assert.equal(news2({ rr: 10, spo2: 94, o2: false, sbp: 105, hr: 45, gcs: 15, temp: 35.8 }).score, 1 + 1 + 0 + 1 + 1 + 0 + 1);
});

test('the same seed gives the same night', () => {
  const run = () => { const s = newShift('SAME'); while (!s.over) { autopilot(s); tick(s); } return JSON.stringify(summary(s)); };
  assert.equal(run(), run());
});

test('nothing is ever held by two patients, and holders exist', () => {
  const s = newShift('INV');
  while (!s.over) {
    autopilot(s); tick(s);
    for (const u of Object.values(s.units)) {
      if (!u.holder || u.holder === 'bg') continue;
      const p = s.patients[u.holder];
      assert.ok(p && (p.status === 'active' || (p.status === 'waiting' && p.arrest)), `${u.id} held by a patient who is gone`);   // a code can run in the waiting room
      assert.ok(p.loc === u.id || p.using.includes(u.id) || (p.arrest && p.arrest.team.includes(u.id)), `${u.id} held but not recorded on ${p.name}`);
    }
  }
});

for (const key of Object.keys(CASES)) {
  test(`${key}: with every resource free, the pathway ends well and on time`, () => {
    const s = quiet();
    const p = admit(s, key);
    for (let i = 0; i < 400 && (p.status === 'active' || p.status === 'waiting'); i += 1) tick(s);
    assert.ok(['admitted', 'home'].includes(p.status), `${key} ended as ${p.status}`);
    assert.equal(p.outcome.grade, 'good', JSON.stringify(p.clocks));
  });
}

test('gridlock: OR patient needs ICU, ICU patient needs OR; a huddle swaps them', () => {
  const s = quiet();
  for (const u of Object.values(s.units)) if (u.kind === 'icu' || u.id === 'OR2') u.holder = 'bg';
  const postop = admit(s, 'trauma');
  act(s, { type: 'move', pid: postop.id, unit: 'R1' });
  // jump him to "surgery finished, waiting for an ICU bed", sitting in OR 1
  s.units[postop.loc].holder = null; s.units.OR1.holder = postop.id; postop.loc = 'OR1'; postop.stepIdx = 2; postop.stepState = 'need'; postop.rate = 0; postop.sev = 0.1;
  const bleeder = admit(s, 'rebleed');
  tick(s);
  assert.equal(findGridlocks(s).length, 1);
  for (let i = 0; i < 20; i += 1) tick(s);
  assert.equal(postop.status, 'active', 'left alone, nothing moves');
  assert.ok(blockers(s, bleeder).length > 0);
  const cycle = findGridlocks(s)[0];
  assert.equal(act(s, { type: 'huddle', pids: cycle }).ok, true);
  assert.equal(postop.status, 'admitted');
  assert.equal(bleeder.loc, 'OR1');
  assert.equal(bleeder.stepState, 'run');
});

test('expedite beats first come first served', () => {
  const s = quiet();
  const stone = admit(s, 'colic'); const stroke = admit(s, 'stroke');
  s.units.CT1.holder = 'bg';                       // scanner busy while both get ready
  for (let i = 0; i < 12; i += 1) tick(s);
  assert.equal(stone.stepIdx, 1); assert.equal(stroke.stepIdx, 1);
  act(s, { type: 'expedite', pid: stroke.id });
  s.units.CT1.holder = null; tick(s);
  assert.equal(s.units.CT1.holder, stroke.id);
});

test('a reserved bed waits for its patient', () => {
  const s = quiet();
  const a = makePatient(s, 'stemi', s.t + 5); a.status = 'expected'; s.patients[a.id] = a;
  assert.equal(act(s, { type: 'reserve', pid: a.id, unit: 'R1' }).ok, true);
  const b = makePatient(s, 'trauma', s.t); s.patients[b.id] = b;
  assert.equal(act(s, { type: 'place', pid: b.id, unit: 'R1' }).ok, false);
  assert.equal(act(s, { type: 'place', pid: b.id, unit: 'R2' }).ok, true);
});

test('releasing a reservation is offered, and frees the unit', () => {
  const s = quiet();
  const a = makePatient(s, 'stemi', s.t + 5); a.status = 'expected'; s.patients[a.id] = a;
  act(s, { type: 'reserve', pid: a.id, unit: 'R1' });
  const offer = actionsFor(s, a).find((x) => x.key === 'unres:R1');
  assert.ok(offer, 'a release button for R1');
  assert.equal(act(s, offer.action).ok, true);
  assert.equal(s.units.R1.reservedFor, null);
});

test('placing a patient drops the other beds held for them', () => {
  const s = quiet();
  const a = makePatient(s, 'stemi', s.t); a.status = 'expected'; s.patients[a.id] = a;
  act(s, { type: 'reserve', pid: a.id, unit: 'R1' });
  act(s, { type: 'reserve', pid: a.id, unit: 'R2' });
  a.status = 'waiting';
  assert.equal(act(s, { type: 'place', pid: a.id, unit: 'R2' }).ok, true);
  assert.equal(s.units.R1.reservedFor, null, 'R1 is free for others again');
});

/* Doctor md1 is busy with a patient; every other doctor and nurse is out of reach. */
function codeSetup() {
  const s = quiet();
  for (const u of Object.values(s.units)) if ((u.kind === 'md' || u.kind === 'rn') && u.id !== 'md1') u.holder = 'bg';
  const q = makePatient(s, 'colic', s.t); s.patients[q.id] = q;
  Object.assign(q, { status: 'active', loc: 'A1', stepIdx: 0, stepState: 'run', stepLeft: 30, using: ['md1'] });
  s.units.A1.holder = q.id; s.units.md1.holder = q.id;
  const p = makePatient(s, 'stemi', s.t); s.patients[p.id] = p;
  Object.assign(p, { status: 'active', loc: 'R1', arrest: { at: s.t, teamAt: null, team: [] }, arrested: true });
  s.units.R1.holder = p.id;
  return { s, p, q };
}

test('a code that cannot get a nurse does not pull a doctor off anyone', () => {
  const { s, p, q } = codeSetup();
  for (let i = 0; i < 3; i += 1) tick(s);
  assert.equal(p.arrest.teamAt, null);
  assert.deepEqual(q.using, ['md1'], 'the doctor stays with their patient');
  assert.ok(!q.resume, 'never interrupted');
});

test('a code that can get a whole team takes it', () => {
  const { s, p, q } = codeSetup();
  s.units.rn1.holder = null;
  tick(s);
  assert.deepEqual([...p.arrest.team].sort(), ['md1', 'rn1']);
  assert.equal(q.resume, true, 'the doctor was pulled to the code');
});

test('an alert fires once per key all night, and the review counts every one', () => {
  const s = newShift('ALERTS');
  const keyOf = new Map();
  while (!s.over) {
    autopilot(s); tick(s);
    for (const a of s.alerts) keyOf.set(a.id, a.key);
  }
  const keys = [...keyOf.values()];
  assert.ok(keys.length > 80, `enough alerts to overflow the list (${keys.length})`);
  assert.equal(new Set(keys).size, keys.length, 'no key fired twice');
  assert.equal(Object.values(s.alertCounts).reduce((a, n) => a + n, 0), keys.length);
});

test('the first hour brings only cases that are minor and slow to worsen', () => {
  for (const seed of ['A', 'B', 'C', 'D', 'E']) {
    const s = newShift(seed);
    const scripted = new Set(['14 stemi', '52 colic', '58 stroke']);   // the set pieces of the first hour
    for (const e of buildSchedule(s).filter((x) => x.at >= 0 && x.at < 60 && !scripted.has(`${x.at} ${x.case}`))) {
      assert.ok(CASES[e.case].esi >= 3 && CASES[e.case].rate < 0.005, `${seed}: ${e.case} at ${e.at}`);
    }
  }
});
