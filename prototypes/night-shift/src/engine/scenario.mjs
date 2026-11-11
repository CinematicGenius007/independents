/* The night: who arrives when. Scripted set pieces carry the lessons; seeded random
 * arrivals around them keep the department busy and make each seed a different shift.
 * Times are minutes after 19:00. Negative times are the day shift's leftovers. */
import { CASE_WEIGHTS, CASES } from './casebook.mjs';
import { rnd, rint } from './rng.mjs';

/** [minute, case]. Ambulance cases are announced `pre` minutes before they arrive. */
const SET_PIECES = [
  [14, 'stemi'],            // 19:14  cath team is at home: call in on the pre-alert
  [52, 'colic'], [58, 'stroke'],   // a kidney stone reaches the CT queue just before the stroke
  [95, 'anaphylaxis'],      // walks in, sits in the waiting room
  [128, 'trauma'], [150, 'sepsis'],
  [185, 'ectopic'],         // under-triaged, deteriorates in the waiting room
  [215, 'gibleed'], [262, 'overdose'], [300, 'chf'], [330, 'psych'],
  [352, 'appendicitis'],
  [395, 'rebleed'],         // 01:35  ICU patient needs the OR while the OR patient needs an ICU bed
  [402, 'trauma'],
  [455, 'stemi'], [470, 'dka'],
  // 03:00 bus crash: a surge
  [480, 'trauma'], [483, 'hip'], [485, 'laceration'], [487, 'forearm'], [489, 'trauma'], [492, 'ankle'], [495, 'laceration'],
  [560, 'stroke'], [600, 'sepsis'], [640, 'chf'], [675, 'overdose'],
];

/** Unscripted arrivals per hour, 19:00 to 07:00. Evenings are the busiest. */
const PER_HOUR = [8, 8, 7, 7, 6, 5, 4, 4, 3, 4, 5, 6];
const WARMUP = ['hip', 'appendicitis', 'chf', 'colic', 'hip', 'laceration', 'dka', 'colic', 'forearm', 'appendicitis', 'ankle', 'laceration', 'colic', 'ankle'];

function weighted(state, allow) {
  const keys = Object.keys(CASE_WEIGHTS).filter(allow);
  let roll = rnd(state) * keys.reduce((a, k) => a + CASE_WEIGHTS[k], 0);
  for (const k of keys) { roll -= CASE_WEIGHTS[k]; if (roll <= 0) return k; }
  return keys[0];
}

export function buildSchedule(state) {
  const out = [];
  WARMUP.forEach((k, i) => out.push({ at: -70 + i * 5 + rint(state, 0, 3), case: k }));
  for (const [at, k] of SET_PIECES) out.push({ at, case: k });
  PER_HOUR.forEach((n, h) => {
    for (let i = 0; i < n; i += 1) {
      // first hour stays gentle: minor cases only, so the opening teaches placing and queues
      const k = weighted(state, (c) => (h === 0 ? CASES[c].esi >= 3 : true));
      out.push({ at: h * 60 + rint(state, 0, 59), case: k });
    }
  });
  for (const e of out) {
    const c = CASES[e.case];
    e.pre = c.via === 'ems' ? (c.prealert ? rint(state, 7, 10) : rint(state, 3, 5)) : 0;
  }
  return out.sort((a, b) => a.at - a.pre - (b.at - b.pre));
}

/** Inpatient beds that free up on their own overnight (very few do). [minute, kind] */
export const BED_RELEASES = [[70, 'ward'], [130, 'icu'], [160, 'ward'], [250, 'icu'], [300, 'ward'], [340, 'ward'], [420, 'icu'], [500, 'ward'], [540, 'icu'], [570, 'psych'], [610, 'ward'], [660, 'icu']];
