#!/usr/bin/env node
/* Headless ladder: certify every rung for a seed and print par, states, time.
 *   node scripts/certify.mjs [seed] [--json] [--rungs=0-14] [--bigger]
 * Times use performance.now() here, never inside the engine. */
import { performance } from 'node:perf_hooks';
import { LADDER, levelFor, measure, replay, rungStats, CAP, STATUS_NAMES } from '../src/engine/index.mjs';

const args = process.argv.slice(2);
const seed = args.find((a) => !a.startsWith('--')) || 'CLAY';
const json = args.includes('--json');
const rr = (args.find((a) => a.startsWith('--rungs=')) || '').slice(8);
const [lo, hi] = rr ? rr.split('-').map(Number) : [0, LADDER.length - 1];
const rows = [];
for (let r = lo; r <= (hi ?? lo); r += 1) {
  const t0 = performance.now();
  const g = levelFor(seed, r);
  const tGen = performance.now() - t0;
  if (!g.ok) { rows.push({ rung: r, name: LADDER[r].name, ok: false, reason: g.reason }); continue; }
  const t1 = performance.now();
  const m = measure(g.level);
  const tMeasure = performance.now() - t1;
  // replay the certificate: it must actually win
  const win = replay(g.level, m.plan);
  const lv = g.level;
  rows.push({
    rung: r, name: lv.name, family: lv.family, mode: lv.mode,
    sections: lv.resources.length, carts: lv.carts.length,
    budget: `${lv.budget.hold}H/${lv.budget.loan}L`, par: m.par,
    default: m.defaultFailure, window: m.window, traps: `${m.traps}/${m.firstMoves}`,
    explored: m.cert.explored, generated: m.cert.generated, pruned: m.cert.pruned,
    attempts: g.attempts, genMs: +tGen.toFixed(1), measureMs: +tMeasure.toFixed(1),
    replayWins: win.status === 1,
    plan: m.plan.map((a) => `${a.kind}@${a.tick}:${a.cart}`).join(' '),
  });
}
if (json) console.log(JSON.stringify(rows, null, 2));
else {
  console.log(`seed ${seed} · cap ${CAP.sections} sections / ${CAP.carts} carts`);
  console.log('rung name               S  N  budget  par default    win traps  explored  pruned   gen ms  meas ms  try replay');
  for (const x of rows) {
    if (!x.ok && x.ok !== undefined) { console.log(String(x.rung).padStart(3), x.name, 'FAILED', x.reason); continue; }
    console.log(
      String(x.rung).padStart(3), x.name.padEnd(18), String(x.sections).padStart(2), String(x.carts).padStart(2),
      x.budget.padStart(6), String(x.par).padStart(4), String(x.default).padEnd(10),
      String(x.window).padStart(3), x.traps.padStart(5), String(x.explored).padStart(9), String(x.pruned).padStart(7),
      String(x.genMs).padStart(8), String(x.measureMs).padStart(8), String(x.attempts).padStart(4), x.replayWins ? ' ok' : ' FAIL');
  }
  console.log('\nplans:'); for (const x of rows) if (x.plan) console.log(String(x.rung).padStart(3), x.plan);
}
if (rows.some((x) => x.ok === false || x.replayWins === false)) process.exit(1);
