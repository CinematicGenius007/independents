#!/usr/bin/env node
/* Headless night: lets the autopilot (obvious bed placement only, no clever moves)
 * run a whole shift and prints what happened. A baseline for balancing.
 *   node scripts/night.mjs [seed] [--log] */
import { newShift, tick, autopilot, summary, patientsOf, clock, caseOf, act, actionsFor } from '../src/engine/sim.mjs';

const args = process.argv.slice(2);
const seed = args.find((a) => !a.startsWith('--')) || 'HARBOURSIDE';
const s = newShift(seed);
console.log(`seed ${seed}: 19:00 handover with ${summary(s).census} in beds, ${summary(s).waiting} waiting`);
const grids = new Set();
const smart = args.includes('--smart');
/* A competent charge nurse: calls teams in on the pre-alert, phones for beds, expedites
 * the sick, boards in the hallway and huddles gridlocks. Shows the night can be won. */
function smartMoves(st) {
  for (const p of patientsOf(st)) {
    if (!['expected', 'waiting', 'active'].includes(p.status)) continue;
    if (p.esi <= 2 && p.status === 'active' && !p.prio) act(st, { type: 'expedite', pid: p.id });
    for (const a of actionsFor(st, p)) {
      if (a.key.startsWith('call:') || a.key === 'huddle' || a.key === 'stepdown' || a.key === 'discharge' || a.key === 'blood') act(st, a.action);
      if (a.key === 'move' && a.label.includes('hallway')) { const h = a.choices.find((c) => c.hint.startsWith('Hallway')); if (h && patientsOf(st).some((q) => q.status === 'waiting' && q.esi <= 3)) act(st, h.action); }
    }
  }
}
while (!s.over) {
  if (smart) smartMoves(s);
  autopilot(s); tick(s);
  for (const g of s.gridlocks) { const k = g.join('-'); if (!grids.has(k)) { grids.add(k); console.log(`${clock(s.t)} GRIDLOCK ${g.map((id) => s.patients[id].name).join(' <-> ')}`); } }
}
if (args.includes('--log')) for (const e of s.log) if (e.t >= 0) console.log(clock(e.t), e.type.padEnd(8), e.pid ? s.patients[e.pid].name.padEnd(22) : ''.padEnd(22), e.text);
console.log(summary(s));
for (const p of patientsOf(s)) {
  if (p.outcome && p.outcome.grade !== 'good') console.log(`  ${p.outcome.grade.padEnd(5)} ${clock(p.arriveAt)} ${caseOf(p).title.padEnd(44)} ${p.outcome.text}`);
}
const stuck = patientsOf(s).filter((p) => p.status === 'active' || p.status === 'waiting');
console.log(`still in department at 07:00: ${stuck.length}`, stuck.map((p) => `${p.case}@${p.loc || 'WR'}:${p.stepIdx}`).join(' '));
