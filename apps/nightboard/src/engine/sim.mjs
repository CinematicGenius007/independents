/* The simulation. One tick is one minute of the night.
 *
 * The rule that makes a hospital jam is the same rule that makes software deadlock:
 *   a care step starts only when EVERYTHING it needs is free at the same moment,
 *   and a patient keeps the place they are in until the next place is theirs.
 * The charge nurse never treats anyone. They decide who gets which bed, who goes
 * first, what is held back, who is called in, and when to swap. */
import { seedFrom, rnd } from './rng.mjs';
import { buildUnits, KINDS, ON_CALL, START_STOCK, SHIFT_MINUTES, clock, hm } from './hospital.mjs';
import { CASES } from './casebook.mjs';
import { makePatient, vitalsOf, newsOf, caseOf, stepOf, isBoarding, inDepartment } from './patient.mjs';
import { buildSchedule, BED_RELEASES } from './scenario.mjs';

const CODE_MINUTES = 8;

export function newShift(seed = 'HARBOURSIDE') {
  const state = {
    seed, rng: seedFrom(seed), t: -96, nextPid: 1, nextAlert: 1, over: false,
    units: buildUnits(), patients: {}, schedule: [], timers: [], alerts: [], log: [],
    alertSeen: {}, alertCounts: {},
    stock: { ...START_STOCK }, phone: { stepdown: 7, discharge: 8, blood: false },
    called: {}, divertUntil: -1, divertReadyAt: 0, diverted: 0, gridlocks: [],
  };
  state.schedule = buildSchedule(state);
  for (const [at, kind] of BED_RELEASES) state.timers.push({ at, type: 'bedFree', kind });
  while (state.t < 0) { autopilot(state); tick(state); }   // the day shift hands over a working department
  state.alerts = []; state.alertSeen = {}; state.alertCounts = {};
  return state;
}

export const patientsOf = (state) => Object.values(state.patients);
const unitsOfKinds = (state, kinds) => Object.values(state.units).filter((u) => kinds.includes(u.kind));
const say = (state, pid, text, type = 'event') => state.log.push({ t: state.t, pid, type, text });
const note = (state, p, kind, author, text) => p.notes.push({ t: state.t, kind, author, text });

/* Raise an alert once per key. The list shown is capped, so whether a key has fired and how
 * many of each kind fired (for the end-of-shift review) are kept apart from it. */
function alert(state, level, key, pid, title, text) {
  if (state.alertSeen[key]) return;
  state.alertSeen[key] = true;
  const kind = key.split(':')[0];
  state.alertCounts[kind] = (state.alertCounts[kind] || 0) + 1;
  state.alerts.unshift({ id: state.nextAlert++, t: state.t, level, key, pid, title, text, ack: false });
  if (state.alerts.length > 80) state.alerts.length = 80;
}

/* ---------- resources ---------- */

function release(state, uid, pid) {
  const u = state.units[uid];
  if (u && u.holder === pid) u.holder = null;
}

/** ED bed kinds this patient may be placed in. Boarders may also go to the hallway. */
export function allowedKinds(p) {
  const base = [...caseOf(p).bed];
  if (base.includes('acute') && !base.includes('resus')) base.push('resus');
  if (isBoarding(p) && !base.includes('hall')) base.push('hall');
  return base;
}

/** Match a step's needs against what is free right now. A unit reserved for this patient is
 * preferred; one reserved for somebody else is never used. Returns the units it would take
 * and the needs nothing free can meet. tryAcquire and blockers both use it, so the board
 * always explains exactly what the engine is waiting for. */
function matchStep(state, p, step) {
  const got = [], missing = [];
  let skipPlace = p.preplaced && step.place;
  for (const need of step.needs) {
    const kinds = need.split('|');
    if (skipPlace && kinds.includes(step.place)) { skipPlace = false; continue; }
    const free = unitsOfKinds(state, kinds).filter((u) => !u.holder && !got.includes(u) && (!u.reservedFor || u.reservedFor === p.id));
    const u = free.find((x) => x.reservedFor === p.id) || free[0];
    if (u) got.push(u); else missing.push({ need, kinds });
  }
  const bloodShort = !p.resume && !!step.blood && state.stock.prbc < step.blood;
  return { got, missing, bloodShort };
}

/** Try to take everything a step needs. Returns the units, or null and takes nothing. */
function tryAcquire(state, p, step) {
  const m = matchStep(state, p, step);
  return m.missing.length || m.bloodShort ? null : m.got;
}

/** Why can this patient not move on? One entry per missing thing, with who holds it. */
export function blockers(state, p) {
  if (p.status === 'expected') return [];
  if (p.status === 'waiting') return [{ need: 'bed', kinds: [], label: `No bed yet. Suitable: ${caseOf(p).bed.map((k) => KINDS[k].label.toLowerCase()).join(' or ')}`, holders: [], absent: false }];
  const step = stepOf(p);
  if (!step || p.stepState !== 'need') return [];
  const { missing, bloodShort } = matchStep(state, p, step), out = [];
  for (const { need, kinds } of missing) {
    const all = unitsOfKinds(state, kinds);
    out.push({
      need, kinds, label: kinds.map((k) => KINDS[k].label).join(' or '), absent: all.length === 0,
      holders: all.map((x) => ({ unit: x.id, name: x.name, pid: x.holder === 'bg' ? null : x.holder, bg: x.holder === 'bg', reservedFor: x.holder ? null : x.reservedFor })),
    });
  }
  if (bloodShort) out.push({ need: 'blood', kinds: [], label: `Red cells: needs ${step.blood} units, ${state.stock.prbc} in the fridge`, holders: [], absent: true });
  return out;
}

/* ---------- care steps ---------- */

function startStep(state, p, step, got) {
  const t = state.t, c = caseOf(p);
  for (const u of got) { u.holder = p.id; if (u.reservedFor === p.id) u.reservedFor = null; }
  const placeU = step.place ? got.find((u) => u.kind === step.place) : null;
  if (placeU) { release(state, p.loc, p.id); p.loc = placeU.id; }
  if (step.place) p.preplaced = false;
  p.using = got.filter((u) => u !== placeU).map((u) => u.id);
  for (const q of patientsOf(state)) {   // somebody who asked earlier for the same thing was passed over
    if (q !== p && q.status === 'active' && q.stepState === 'need' && !q.hold && q.reqAt < p.reqAt) {
      const qs = stepOf(q);
      if (qs && qs.needs.some((n) => got.some((u) => n.split('|').includes(u.kind)))) q.passed = (q.passed || 0) + 1;
    }
  }
  if (!p.resume) {
    const hall = state.units[p.loc] && state.units[p.loc].kind === 'hall';
    p.stepLeft = Math.round((step.dur || 0) * (hall ? 1.3 : 1));
    if (step.blood) state.stock.prbc -= step.blood;
    if (step.rate !== undefined) p.rate = step.rate;
    const doc = got.find((u) => ['md', 'pa', 'surg', 'cards', 'neuro', 'ob', 'gi', 'psy'].includes(u.kind));
    p.author = doc ? doc.name : (got.find((u) => u.kind === 'rn') || { name: 'ED nursing' }).name;
    if (p.seenAt === null && doc) p.seenAt = t;
    markClock(state, p, step, 'start');
    say(state, p.id, `${step.label} started`);
  }
  p.resume = false; p.passed = 0; p.stepState = 'run';
  if (p.stepLeft <= 0) finishStep(state, p);
}

function markClock(state, p, step, when) {
  for (const k of caseOf(p).clocks || []) {
    if (k.step !== step.key || (k.on || 'start') !== when || p.clocks[k.key].at !== null) continue;
    const took = state.t + (k.lead || 0) - p.arriveAt;
    p.clocks[k.key].at = took; p.clocks[k.key].met = took <= k.limit;
    if (!p.clocks[k.key].met) alert(state, 'warn', `clockmiss:${p.id}:${k.key}`, p.id, `${k.label} missed`, `${p.name}: ${took} min against a ${k.limit} min target.`);
  }
}

function finishStep(state, p) {
  const step = stepOf(p);
  for (const uid of p.using) release(state, uid, p.id);
  p.using = [];
  if (step.sev) p.sev = Math.max(0, p.sev + step.sev);
  if (step.note) note(state, p, step.place ? 'Procedure' : 'Provider', p.author, step.note);
  if (step.result) { p.results.push({ t: state.t, name: step.result[0], text: step.result[1] }); note(state, p, 'Result', step.result[0], step.result[1]); }
  markClock(state, p, step, 'end');
  if (step.end === 'admit') {
    state.units[p.loc].holder = 'bg';
    leave(state, p, 'admitted', `Admitted to ${state.units[p.loc].name}`);
  } else if (step.end === 'home') {
    release(state, p.loc, p.id);
    leave(state, p, 'home', 'Discharged home');
  } else { p.stepIdx += 1; p.stepState = 'need'; p.reqAt = state.t; }
}

function leave(state, p, status, text) {
  const c = caseOf(p);
  for (const u of Object.values(state.units)) if (u.reservedFor === p.id) u.reservedFor = null;
  for (const x of state.alerts) if (x.pid === p.id && !/^(death|lwbs|clockmiss)/.test(x.key)) x.ack = true;   // nothing left to act on
  p.dest = p.loc ? state.units[p.loc].name : null;
  p.status = status; p.leftAt = state.t; p.loc = null; p.using = [];
  if (status === 'died') p.outcome = { grade: 'died', text };
  else if (status === 'lwbs') p.outcome = { grade: 'harm', text: 'Left without being seen after a long wait.' };
  else {
    const missed = Object.values(p.clocks).some((k) => k.met === false);
    const bad = p.arrested || missed || p.peak >= 0.92;
    p.outcome = { grade: bad ? 'harm' : 'good', text: bad ? c.harm : c.good };
  }
  say(state, p.id, text, status);
}

function interrupt(state, q, why) {
  for (const uid of q.using) release(state, uid, q.id);
  q.using = []; q.stepState = 'need'; q.resume = true; q.stepLeft += 2;
  note(state, q, 'Nursing', 'ED nursing', `Care interrupted: ${why}. Step will resume when the team is back.`);
}

/* ---------- cardiac arrest ---------- */

function startArrest(state, p) {
  const step = stepOf(p);
  const stuck = blockers(state, p).map((b) => b.label).join('; ');
  p.why = p.status === 'waiting' ? 'Arrested without ever getting a bed.' : stuck ? `Arrested while waiting for: ${stuck}.` : 'Arrested during treatment.';
  p.arrest = { at: state.t, teamAt: null, team: [] };
  p.arrested = true;
  if (p.stepState === 'run' && step && step.place) p.arrest.teamAt = state.t;      // already surrounded by a team
  else if (p.stepState === 'run') interrupt(state, p, 'cardiac arrest');
  alert(state, 'crit', `code:${p.id}:${state.t}`, p.id, 'CODE BLUE', `${p.name}, ${p.loc ? state.units[p.loc].name : 'waiting room'}. Cardiac arrest.`);
  note(state, p, 'Nursing', 'ED nursing', 'Unresponsive, no pulse. CPR started. Code Blue called.');
  say(state, p.id, 'Cardiac arrest', 'code');
}

/* A code needs a doctor and a nurse. Each comes from someone free, or else is pulled off the
 * least urgent patient in a non-procedure step. The whole team is planned first, and nobody
 * is interrupted unless every member can be found: otherwise the same patient would lose
 * their doctor every minute for a code that cannot start. */
function codeTeam(state, p) {
  const team = [], victims = [];
  const pulled = (q, kind) => q.using.map((id) => state.units[id]).find((u) => u.kind === kind && !team.includes(u));
  for (const kind of ['md', 'rn']) {
    let u = unitsOfKinds(state, [kind]).find((x) => !x.holder && !team.includes(x));
    for (const q of victims) if (!u) u = pulled(q, kind);   // already being interrupted for this code
    if (!u) {
      const q = patientsOf(state)
        .filter((x) => x !== p && x.status === 'active' && x.stepState === 'run' && !x.arrest && !stepOf(x).place && !victims.includes(x) && pulled(x, kind))
        .sort((a, b) => b.esi - a.esi)[0];
      if (!q) return null;
      victims.push(q); u = pulled(q, kind);
    }
    team.push(u);
  }
  for (const q of victims) interrupt(state, q, `team pulled to the Code Blue for ${p.name}`);
  for (const u of team) u.holder = p.id;
  return team.map((u) => u.id);
}

function codeTick(state, p) {
  const a = p.arrest, c = caseOf(p);
  if (a.teamAt === null) {
    const team = codeTeam(state, p);
    if (team) { a.teamAt = state.t; a.team = team; }
    else if (state.t - a.at >= 10) die(state, p, `Cardiac arrest. Nobody was free to run the code. ${p.why}`);
    return;
  }
  if (state.t - a.teamAt < CODE_MINUTES) return;
  for (const uid of a.team) release(state, uid, p.id);
  const chance = (c.arrestP ?? 0.3) * Math.max(0, 1 - 0.15 * (a.teamAt - a.at));
  if (rnd(state) < chance) {
    p.arrest = null; p.sev = 0.8; p.rate *= 0.6;
    note(state, p, 'Provider', 'Code team', 'Return of spontaneous circulation after 3 cycles of CPR and epinephrine 1 mg x2. Post-arrest care started.');
    alert(state, 'info', `rosc:${p.id}:${state.t}`, p.id, 'ROSC', `${p.name}: pulse back. Still critical.`);
    say(state, p.id, 'Return of spontaneous circulation', 'event');
  } else die(state, p, `Died after cardiac arrest. ${p.why}`);
}

function die(state, p, text) {
  for (const uid of [...p.using, ...(p.arrest ? p.arrest.team : [])]) release(state, uid, p.id);
  release(state, p.loc, p.id);
  p.arrest = null;
  note(state, p, 'Provider', 'Code team', 'Resuscitation stopped. Time of death recorded. Family informed.');
  alert(state, 'crit', `death:${p.id}`, p.id, 'Patient died', `${p.name}. ${text}`);
  leave(state, p, 'died', text);
}

/* ---------- the minute ---------- */

function arrivals(state) {
  const t = state.t;
  while (state.schedule.length && state.schedule[0].at - state.schedule[0].pre <= t) {
    const e = state.schedule.shift(), c = CASES[e.case];
    if (c.via === 'ems' && t < state.divertUntil) { state.diverted += 1; say(state, null, `Ambulance diverted to another hospital (${c.cc})`, 'divert'); continue; }
    const p = makePatient(state, e.case, e.at);
    state.patients[p.id] = p;
    if (c.via === 'house') {
      const u = unitsOfKinds(state, ['icu']).find((x) => x.holder === 'bg');
      if (!u) { delete state.patients[p.id]; continue; }
      u.holder = p.id; p.loc = u.id; p.status = 'active'; p.placedAt = t; p.arriveAt = t; p.reqAt = t; p.name += ' (ICU)';
      p.labs = c.labs.map((l) => ({ l, at: t + l[5] }));
      alert(state, 'crit', `house:${p.id}`, p.id, 'ICU: return to theatre', `${p.name} in ${u.name} is bleeding and needs an operating room.`);
    } else if (e.pre > 0) {
      p.status = 'expected';
      alert(state, c.prealert ? 'crit' : 'info', `pre:${p.id}`, p.id, c.prealert ? `${c.prealert} inbound` : 'Ambulance inbound', `ETA ${e.at - t} min. ${p.age} ${p.sex}, ${c.cc.toLowerCase()}.`);
    } else say(state, p.id, 'Walked in, triaged', 'arrive');
  }
  for (const p of patientsOf(state)) {
    if (p.status === 'expected' && t >= p.arriveAt) { p.status = 'waiting'; p.reqAt = t; say(state, p.id, 'Ambulance arrived', 'arrive'); for (const x of state.alerts) if (x.key === `pre:${p.id}`) x.ack = true; alert(state, p.esi <= 2 ? 'warn' : 'info', `door:${p.id}`, p.id, 'Ambulance at the door', `${p.name}, ESI ${p.esi}. Needs a bed.`); }
  }
}

function runTimers(state) {
  const due = state.timers.filter((x) => x.at <= state.t);
  state.timers = state.timers.filter((x) => x.at > state.t);
  for (const x of due) {
    if (x.type === 'bedFree') {
      const u = unitsOfKinds(state, [x.kind]).find((y) => y.holder === 'bg');
      if (u) { u.holder = null; alert(state, 'info', `free:${u.id}:${state.t}`, null, `${u.name} is free`, x.why || 'An inpatient was discharged.'); }
    } else if (x.type === 'arrive') {
      const u = ON_CALL[x.kind].unit();
      state.units[u.id] = u; state.called[x.kind].here = true;
      alert(state, 'info', `here:${x.kind}`, null, `${u.name} is in house`, ON_CALL[x.kind].label);
    } else if (x.type === 'blood') { state.stock.prbc += 6; state.phone.blood = false; alert(state, 'info', `blood:${state.t}`, null, 'Blood delivered', '6 units of red cells from the blood bank.'); }
  }
}

function physiology(state, p) {
  if (p.arrest) return codeTick(state, p);
  const c = caseOf(p);
  const hall = p.loc && state.units[p.loc].kind === 'hall';
  p.sev = Math.max(0, Math.min(c.cap ?? 1.05, p.sev + p.rate * (hall ? 1.2 : 1)));
  p.peak = Math.max(p.peak, p.sev);
  if (p.sev >= 1) startArrest(state, p);
}

function postLabs(state, p) {
  for (const x of p.labs) {
    if (x.done || x.at > state.t) continue;
    x.done = true;
    const [name, val, unit, , flag] = x.l;
    if (flag === 'HH' || flag === 'LL') alert(state, 'warn', `lab:${p.id}:${name}`, p.id, 'Critical result', `${p.name}: ${name} ${val} ${unit}`.trim());
  }
}

function watch(state) {
  const t = state.t;
  for (const p of patientsOf(state)) {
    if (!inDepartment(p)) continue;
    const c = caseOf(p);
    if (p.status === 'waiting' && c.patience && t - p.arriveAt > c.patience) { leave(state, p, 'lwbs', 'Left without being seen'); alert(state, 'warn', `lwbs:${p.id}`, p.id, 'Left without being seen', `${p.name} walked out after ${Math.round((t - p.arriveAt) / 60)} h in the waiting room.`); continue; }
    if (p.arrest) continue;
    const n = newsOf(p, t).score, band = n >= 7 ? 2 : n >= 5 ? 1 : 0;
    if (band > p.newsBand && (t - p.arriveAt > 3)) {
      const where = p.status === 'waiting' ? 'Waiting room' : state.units[p.loc].name;
      if (band === 2) alert(state, 'crit', `news7:${p.id}`, p.id, `Deteriorating: NEWS ${n}`, `${p.name}, ${where}. Emergency review needed.`);
      else if (p.status === 'waiting') alert(state, 'warn', `news5:${p.id}`, p.id, `Waiting room recheck: NEWS ${n}`, `${p.name} is getting worse while waiting.`);
    }
    p.newsBand = Math.max(p.newsBand, band);
    if (p.status === 'waiting' && p.esi <= 2 && t - Math.max(p.arriveAt, 0) >= 8) alert(state, 'warn', `nobed:${p.id}`, p.id, `ESI ${p.esi} without a bed`, `${p.name} has waited ${t - p.arriveAt} min.`);
    for (const k of c.clocks || []) {
      const ck = p.clocks[k.key];
      if (ck.at === null && t - p.arriveAt >= Math.round(k.limit * 0.7)) alert(state, 'warn', `clock:${p.id}:${k.key}`, p.id, `${k.label} at risk`, `${p.name}: ${t - p.arriveAt} of ${k.limit} min used.`);
    }
    if (p.status === 'active' && p.stepState === 'need' && !p.hold && (p.passed || 0) >= 3 && t - p.reqAt >= 40) alert(state, 'warn', `forgot:${p.id}:${p.stepIdx}`, p.id, 'Passed over', `${p.name} has waited ${t - p.reqAt} min while ${p.passed} others went ahead.`);
  }
  if (state.stock.prbc <= 2 && !state.phone.blood) alert(state, 'warn', `lowblood:${Math.floor(t / 30)}`, null, 'Blood fridge low', `${state.stock.prbc} units of red cells left. Phone the blood bank.`);
  state.gridlocks = findGridlocks(state);
  for (const cyc of state.gridlocks) {
    const names = cyc.map((id) => state.patients[id].name.split(',')[0]);
    alert(state, 'crit', `grid:${[...cyc].sort().join('-')}`, cyc[0], 'Gridlock', `${names.join(' and ')} each hold what the other needs. Nothing will move until you swap them.`);
  }
}

export function tick(state) {
  if (state.over) return state;
  state.t += 1;
  runTimers(state);
  arrivals(state);
  for (const p of patientsOf(state)) if (inDepartment(p)) { physiology(state, p); if (inDepartment(p)) postLabs(state, p); }
  for (const p of patientsOf(state)) {
    if (p.status === 'active' && p.stepState === 'run' && !p.arrest) { p.stepLeft -= 1; if (p.stepLeft <= 0) finishStep(state, p); }
  }
  acquirePass(state);
  watch(state);
  if (state.t >= SHIFT_MINUTES) { state.over = true; say(state, null, 'Handover at 07:00', 'end'); }
  return state;
}

function acquirePass(state) {
  const queue = patientsOf(state).filter((p) => p.status === 'active' && p.stepState === 'need' && !p.hold && !p.arrest);
  queue.sort((a, b) => (b.prio - a.prio) || (a.reqAt - b.reqAt) || (a.id - b.id));
  for (const p of queue) {
    const step = stepOf(p);
    const got = step && tryAcquire(state, p, step);
    if (got) startStep(state, p, step, got);
  }
}

/* ---------- gridlock (the engineer's word: deadlock) ---------- */

/** Cycles of patients who each sit in the place the next one needs. [[pid, pid, ...]] */
export function findGridlocks(state) {
  const waiting = patientsOf(state).filter((p) => p.status === 'active' && p.stepState === 'need' && !p.hold && !p.arrest);
  const edges = new Map();
  for (const p of waiting) {
    const step = stepOf(p);
    if (!step || !step.place || p.preplaced) continue;
    const b = blockers(state, p).find((x) => x.kinds.includes(step.place));
    if (!b || b.holders.some((h) => !h.pid && !h.bg)) continue;    // a free (reserved) unit: not stuck on people
    const targets = b.holders.filter((h) => h.pid && waiting.some((q) => q.id === h.pid && q.loc === h.unit)).map((h) => h.pid);
    const moving = b.holders.some((h) => h.pid && !targets.includes(h.pid));   // someone there is mid-treatment and will leave
    if (!moving && targets.length) edges.set(p.id, targets);
  }
  const cycles = [], seen = new Set();
  for (const start of edges.keys()) {
    const path = [start];
    const walk = (id) => {
      for (const nx of edges.get(id) || []) {
        if (nx === start) { const key = [...path].sort().join('-'); if (!seen.has(key)) { seen.add(key); cycles.push([...path]); } return true; }
        if (!path.includes(nx) && path.length < 5) { path.push(nx); if (walk(nx)) return true; path.pop(); }
      }
      return false;
    };
    walk(start);
  }
  return cycles;
}

/* ---------- what the charge nurse can do ---------- */

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => ({ ok: true, msg });

export function act(state, a) {
  const p = a.pid ? state.patients[a.pid] : null, t = state.t;
  switch (a.type) {
    case 'place': case 'move': {
      const u = state.units[a.unit];
      if (!p || !u || u.holder) return fail('That bed is not free.');
      if (u.reservedFor && u.reservedFor !== p.id) return fail(`${u.name} is reserved for ${state.patients[u.reservedFor].name}.`);
      if (!allowedKinds(p).includes(u.kind)) return fail(`${u.name} is not suitable for this patient.`);
      if (a.type === 'place') {
        if (p.status !== 'waiting') return fail('Patient is not waiting for a bed.');
        p.status = 'active'; p.placedAt = t; p.reqAt = t;
        for (const x of state.alerts) if (x.key === `door:${p.id}` || x.key === `nobed:${p.id}` || x.key === `news5:${p.id}`) x.ack = true;
        p.labs = caseOf(p).labs.map((l) => ({ l, at: t + l[5] }));
      } else {
        if (p.status !== 'active' || !p.loc || !KINDS[state.units[p.loc].kind].ed) return fail('Patient cannot be moved now.');
        if (p.stepState === 'run' && stepOf(p).needs.length) return fail('In the middle of a procedure. Wait until it ends.');
        release(state, p.loc, p.id);
      }
      u.holder = p.id; u.reservedFor = null; p.loc = u.id;
      // any other bed held for this patient is no longer needed
      for (const x of Object.values(state.units)) if (x.reservedFor === p.id && KINDS[x.kind].ed) x.reservedFor = null;
      note(state, p, 'Charge', 'J. Alvarez RN', `${a.type === 'place' ? 'Roomed in' : 'Moved to'} ${u.name}.`);
      say(state, p.id, `${a.type === 'place' ? 'Placed in' : 'Moved to'} ${u.name}`, 'charge');
      acquirePass(state);
      return done(`${p.name} is in ${u.name}.`);
    }
    case 'expedite': if (!p) return fail('No patient.'); p.prio = !p.prio; if (p.prio) say(state, p.id, 'Expedited: first in every queue', 'charge'); acquirePass(state); return done(p.prio ? `${p.name} goes first.` : 'Back to normal order.');
    case 'hold': if (!p) return fail('No patient.'); p.hold = !p.hold; if (p.hold) say(state, p.id, 'Held: will not claim the next step', 'charge'); acquirePass(state); return done(p.hold ? `${p.name} is on hold.` : 'Hold released.');
    case 'reserve': {
      const u = a.unit ? state.units[a.unit] : unitsOfKinds(state, [a.kind]).filter((x) => !x.reservedFor && x.holder !== 'bg').sort((x, y) => !!x.holder - !!y.holder)[0];
      if (!p || !u) return fail('Nothing to reserve.');
      if (u.reservedFor && u.reservedFor !== p.id) return fail(`${u.name} is already reserved.`);
      u.reservedFor = p.id; say(state, p.id, `${u.name} reserved`, 'charge');
      return done(`${u.name} is reserved for ${p.name}${u.holder ? ' as soon as it is free' : ''}.`);
    }
    case 'unreserve': { const u = state.units[a.unit]; if (u) u.reservedFor = null; acquirePass(state); return done('Reservation released.'); }
    case 'callIn': {
      const oc = ON_CALL[a.kind];
      if (!oc || state.called[a.kind]) return fail('Already called.');
      state.called[a.kind] = { at: t, eta: t + oc.eta, here: false };
      state.timers.push({ at: t + oc.eta, type: 'arrive', kind: a.kind });
      say(state, null, `Called in: ${oc.label}. In house at ${clock(t + oc.eta)}`, 'charge');
      return done(`${oc.label} called. Here in ${oc.eta} min.`);
    }
    case 'phone': {
      if (a.what === 'stepdown') {
        if (state.phone.stepdown <= 0) return fail('ICU has nobody else fit to step down tonight.');
        const w = unitsOfKinds(state, ['ward']).find((u) => !u.holder && !u.reservedFor);
        if (!w) return fail('ICU can step a patient down, but there is no free ward bed to send them to.');
        w.holder = 'bg'; state.phone.stepdown -= 1;
        state.timers.push({ at: t + 20, type: 'bedFree', kind: 'icu', why: 'ICU stepped a patient down to the ward.' });
        say(state, null, `ICU step-down arranged into ${w.name}`, 'charge');
        return done('ICU will step a patient down. Bed free in 20 min.');
      }
      if (a.what === 'discharge') {
        if (state.phone.discharge <= 0) return fail('No more ward patients can go home tonight.');
        state.phone.discharge -= 1;
        state.timers.push({ at: t + 30, type: 'bedFree', kind: 'ward', why: 'Bed management sent a ward patient home.' });
        say(state, null, 'Bed management: early ward discharge arranged', 'charge');
        return done('Ward discharge arranged. Bed free in 30 min.');
      }
      if (a.what === 'blood') {
        if (state.phone.blood) return fail('Blood is already on its way.');
        state.phone.blood = true; state.timers.push({ at: t + 15, type: 'blood' });
        return done('Blood bank sending 6 units. Here in 15 min.');
      }
      return fail('Unknown call.');
    }
    case 'divert': {
      if (t < state.divertUntil) { state.divertUntil = t; return done('Diversion lifted.'); }
      if (t < state.divertReadyAt) return fail(`Diversion cannot be called again before ${clock(state.divertReadyAt)}.`);
      state.divertUntil = t + 60; state.divertReadyAt = t + 180;
      say(state, null, 'Ambulance diversion declared for 60 min', 'charge');
      return done('On diversion for 60 min. Ambulances go elsewhere; walk-ins still come.');
    }
    case 'huddle': {
      const cyc = (a.pids || []).map((id) => state.patients[id]);
      const n = cyc.length;
      if (n < 2) return fail('Nothing to swap.');
      for (let i = 0; i < n; i += 1) {
        const s = stepOf(cyc[i]), nextLoc = state.units[cyc[(i + 1) % n].loc];
        if (!s || cyc[i].stepState !== 'need' || !nextLoc || s.place !== nextLoc.kind) return fail('The swap no longer lines up.');
      }
      const locs = cyc.map((q) => q.loc);
      cyc.forEach((q, i) => { q.loc = locs[(i + 1) % n]; state.units[q.loc].holder = q.id; q.preplaced = true; note(state, q, 'Charge', 'J. Alvarez RN', `Bed huddle: moved to ${state.units[q.loc].name} in a coordinated swap.`); });
      say(state, cyc[0].id, `Bed huddle: ${cyc.map((q) => q.name.split(',')[0]).join(' and ')} swapped in one move`, 'charge');
      acquirePass(state);
      return done('Swapped. Both can move on.');
    }
    case 'ack': { for (const x of state.alerts) if (a.id === 'all' || x.id === a.id) x.ack = true; return done(''); }
    default: return fail('Unknown action.');
  }
}

/** The moves that make sense for this patient right now, ready for buttons. */
export function actionsFor(state, p) {
  const out = [], step = stepOf(p), block = blockers(state, p);
  const freeBeds = () => Object.values(state.units).filter((u) => KINDS[u.kind].ed && !u.holder && (!u.reservedFor || u.reservedFor === p.id) && allowedKinds(p).includes(u.kind));
  if (p.status === 'waiting') {
    out.push({ key: 'place', label: 'Assign bed', primary: true, choices: freeBeds().map((u) => ({ label: u.name, hint: KINDS[u.kind].label, action: { type: 'place', pid: p.id, unit: u.id } })), empty: 'No suitable bed is free. Move a boarder to the hallway or wait.' });
  }
  if (p.status === 'expected') {
    const beds = Object.values(state.units).filter((u) => caseOf(p).bed.includes(u.kind) && !u.reservedFor && u.holder !== 'bg');
    out.push({ key: 'reserveBed', label: 'Reserve a bed for arrival', primary: true, choices: beds.map((u) => ({ label: u.name, hint: u.holder ? `in use by ${state.patients[u.holder].name}` : 'free', action: { type: 'reserve', pid: p.id, unit: u.id } })), empty: 'No bed to reserve.' });
  }
  for (const cyc of state.gridlocks) if (cyc.includes(p.id)) out.push({ key: 'huddle', label: `Bed huddle: swap ${cyc.map((id) => state.patients[id].name.split(',')[0]).join(' and ')}`, primary: true, action: { type: 'huddle', pids: cyc } });
  // people and places the pathway will need that are not in the building or not free
  const ahead = caseOf(p).steps.slice(p.stepIdx).flatMap((s) => s.needs);
  for (const k of Object.keys(ON_CALL)) {
    if (k === 'rn' || state.called[k] || !ahead.some((n) => n.split('|').includes(k))) continue;
    if ((k === 'surg' || k === 'anes') && !block.some((b) => b.kinds.includes(k))) continue;
    out.push({ key: `call:${k}`, label: `Call in ${ON_CALL[k].label}`, hint: `${ON_CALL[k].eta} min`, primary: !unitsOfKinds(state, [k]).length, action: { type: 'callIn', kind: k } });
  }
  if (p.status === 'active') {
    for (const b of block) {
      if (b.kinds.includes('icu')) out.push({ key: 'stepdown', label: 'Phone ICU: step a patient down', hint: `${state.phone.stepdown} left`, action: { type: 'phone', what: 'stepdown' } });
      if (b.kinds.includes('ward')) out.push({ key: 'discharge', label: 'Phone bed management: send a ward patient home', hint: `${state.phone.discharge} left`, action: { type: 'phone', what: 'discharge' } });
      if (b.need === 'blood') out.push({ key: 'blood', label: 'Phone blood bank: 6 units', hint: '15 min', action: { type: 'phone', what: 'blood' } });
    }
    const next = p.stepState === 'need' ? step : caseOf(p).steps[p.stepIdx + 1];
    if (next) for (const need of next.needs) {
      const k = need.split('|')[0];
      if (KINDS[k].staff || !unitsOfKinds(state, [k]).length || unitsOfKinds(state, [k]).some((u) => u.reservedFor === p.id)) continue;
      out.push({ key: `res:${k}`, label: `Reserve ${KINDS[k].label.toLowerCase()}`, hint: 'kept for this patient', action: { type: 'reserve', pid: p.id, kind: k } });
    }
    out.push({ key: 'expedite', label: p.prio ? 'Stop expediting' : 'Expedite: first in every queue', on: p.prio, action: { type: 'expedite', pid: p.id } });
    out.push({ key: 'hold', label: p.hold ? 'Release hold' : 'Hold: do not claim the next step', on: p.hold, action: { type: 'hold', pid: p.id } });
    if (p.loc && KINDS[state.units[p.loc].kind].ed) out.push({ key: 'move', label: isBoarding(p) ? 'Move (board in hallway)' : 'Move to another bed', choices: freeBeds().map((u) => ({ label: u.name, hint: KINDS[u.kind].label, action: { type: 'move', pid: p.id, unit: u.id } })), empty: 'No other suitable bed is free.' });
  }
  // every reservation held for this patient can be handed back
  for (const u of Object.values(state.units)) if (u.reservedFor === p.id) out.push({ key: `unres:${u.id}`, label: `Release ${u.name}`, hint: 'reserved for this patient', action: { type: 'unreserve', unit: u.id } });
  return out;
}

/** Plays the obvious moves: sickest waiting patient into the best free bed. Used to warm the
 * department up before 19:00 and as the baseline in tests. */
export function autopilot(state) {
  const waiting = patientsOf(state).filter((p) => p.status === 'waiting').sort((a, b) => a.esi - b.esi || a.arriveAt - b.arriveAt);
  for (const p of waiting) {
    for (const kind of allowedKinds(p)) {
      const u = unitsOfKinds(state, [kind]).find((x) => !x.holder && (!x.reservedFor || x.reservedFor === p.id));
      if (u) { act(state, { type: 'place', pid: p.id, unit: u.id }); break; }
    }
  }
}

/** Numbers for the header and the end-of-shift review. */
export function summary(state) {
  const all = patientsOf(state).filter((p) => p.arriveAt >= -200 && p.status !== 'expected');
  const seen = all.filter((p) => p.seenAt !== null && p.arriveAt >= 0).map((p) => p.seenAt - p.arriveAt).sort((a, b) => a - b);
  const clocks = all.flatMap((p) => Object.values(p.clocks)).filter((k) => k.met !== null);
  const here = all.filter(inDepartment);
  return {
    census: here.filter((p) => p.status === 'active' && p.loc && KINDS[state.units[p.loc].kind].ed).length,
    edBeds: Object.values(state.units).filter((u) => KINDS[u.kind].ed).length,
    waiting: here.filter((p) => p.status === 'waiting').length,
    boarding: here.filter((p) => p.status === 'active' && isBoarding(p)).length,
    died: all.filter((p) => p.status === 'died').length,
    lwbs: all.filter((p) => p.status === 'lwbs').length,
    good: all.filter((p) => p.outcome && p.outcome.grade === 'good').length,
    harm: all.filter((p) => p.outcome && p.outcome.grade === 'harm').length,
    clocksMet: clocks.filter((k) => k.met).length, clocksTotal: clocks.length,
    doorToDoc: seen.length ? seen[Math.floor(seen.length / 2)] : 0,
    diverted: state.diverted,
  };
}

export { vitalsOf, newsOf, caseOf, stepOf, isBoarding, inDepartment, clock, hm, KINDS, ON_CALL, CASES, SHIFT_MINUTES };
