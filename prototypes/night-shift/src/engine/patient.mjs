/* One patient: identity, chart, and a simple physiology model.
 * "sev" runs from 0 (well) to 1 (cardiac arrest). Vital signs are read off it by
 * sliding between the case's well and collapse values, so a number on the monitor
 * always means the same thing as the number driving the simulation. */
import { CASES, NAMES } from './casebook.mjs';
import { rint, pick, rnd, jitter } from './rng.mjs';
import { news2 } from './news2.mjs';

export function makePatient(state, caseKey, at) {
  const c = CASES[caseKey];
  const sex = c.sex === 'any' ? (rnd(state) < 0.5 ? 'M' : 'F') : c.sex;
  const id = state.nextPid++;
  const p = {
    id, case: caseKey, sex,
    name: `${pick(state, NAMES.L)}, ${pick(state, NAMES[sex])}`,
    age: rint(state, c.age[0], c.age[1]),
    mrn: String(10400000 + rint(state, 1000, 899999)),
    esi: c.esi, cc: c.cc, via: c.via,
    arriveAt: at, placedAt: null, seenAt: null, leftAt: null,
    status: 'waiting',            // expected | waiting | active | admitted | home | died | lwbs
    loc: null, using: [], preplaced: false,
    stepIdx: 0, stepState: 'need', stepLeft: 0, reqAt: at,
    prio: false, hold: false,
    sev: c.sev0, rate: c.rate, peak: c.sev0,
    arrest: null, arrested: false,
    clocks: {}, labs: [], results: [], notes: [], outcome: null, newsBand: 0,
  };
  for (const k of c.clocks || []) p.clocks[k.key] = { label: k.label, limit: k.limit, at: null, met: null };
  p.notes.push({ t: at, kind: 'Triage', author: 'Tariq Aziz RN', text: c.triage });
  return p;
}

const lerp = (a, b, k) => a + (b - a) * k;

/** Vital signs at minute t. Pure: the same patient and minute always give the same reading. */
export function vitalsOf(p, t) {
  if (p.arrest) return { hr: 0, sbp: 0, dbp: 0, rr: 0, spo2: 0, temp: 36.0, gcs: 3, o2: true, arrest: true };
  const c = CASES[p.case], k = Math.max(0, Math.min(1, p.sev));
  const j = (i, amp) => jitter(p.id * 31 + i, Math.floor(t / 3)) * amp;
  const o2 = (p.placedAt !== null || p.via === 'ems') && c.vit.c.spo2 < 92 && k > 0.3;
  const spo2 = Math.round(Math.min(100, lerp(c.vit.s.spo2, c.vit.c.spo2, k) + (o2 ? 3 : 0) + j(5, 0.8)));
  return {
    hr: Math.round(lerp(c.vit.s.hr, c.vit.c.hr, k) + j(1, 3)),
    sbp: Math.round(lerp(c.vit.s.sbp, c.vit.c.sbp, k) + j(2, 4)),
    dbp: Math.round(lerp(c.vit.s.dbp, c.vit.c.dbp, k) + j(3, 3)),
    rr: Math.max(2, Math.round(lerp(c.vit.s.rr, c.vit.c.rr, k) + j(4, 1))),
    spo2,
    temp: Math.round((lerp(c.vit.s.temp, c.vit.c.temp, k) + j(6, 0.1)) * 10) / 10,
    gcs: Math.round(lerp(c.vit.s.gcs, c.vit.c.gcs, k)),
    o2, arrest: false,
  };
}

export const newsOf = (p, t) => news2(vitalsOf(p, t));
export const caseOf = (p) => CASES[p.case];
export const stepOf = (p) => CASES[p.case].steps[p.stepIdx] || null;
export const isBoarding = (p) => { const s = stepOf(p); return !!s && s.end === 'admit' && p.stepState === 'need'; };
export const inDepartment = (p) => p.status === 'waiting' || p.status === 'active';
