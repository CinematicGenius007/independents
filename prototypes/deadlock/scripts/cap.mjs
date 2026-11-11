#!/usr/bin/env node
/* Where does the certifier stop being interactive? Builds boards bigger than the
 * shipped cap straight from the grower's builder and times the full analysis.
 *   node scripts/cap.mjs */
import { performance } from 'node:perf_hooks';
import { buildLevel, createRng, analyse, CAP } from '../src/engine/index.mjs';

const R = (n, x = {}) => ({ t: 'ring', n, ...x });
const P = { t: 'pair' }, POL = { t: 'polite' };
const probes = [
  ['ring 6',                 [R(6)], 1],
  ['ring 8',                 [R(8)], 1],
  ['ring 6 + 2 tails',       [R(6, { tails: 2 })], 1],
  ['ring 4 + ring 4',        [R(4), R(4)], 2],
  ['ring 3 x3',              [R(3), R(3), R(3)], 3],
  ['ring 3 x3 + pair',       [R(3), R(3), R(3), P], 4],
  ['ring 4 drive + pair',    [R(4, { drive: true }), P], 2],
  ['ring 5 drive + ring 3',  [R(5, { drive: true }), R(3)], 2],
  ['pair x4',                [P, P, P, P], 4],
  ['ring3 + ring3 + ring3 + ring3', [R(3), R(3), R(3), R(3)], 4],
  ['pair x5 (N10)',          [P, P, P, P, P], 5],
];
console.log(`shipped cap: ${CAP.sections} sections / ${CAP.carts} carts`);
console.log('probe                          S   N  H  par  explored  generated   pruned    ms  verdict');
for (const [name, districts, hold] of probes) {
  const lv = buildLevel({ name, family: 'multi', districts, budget: { hold, loan: 0 } }, createRng(7), 'CAP', 0, { canonical: true });
  const t = performance.now();
  const rep = analyse(lv, { maxStates: 400000 });
  const ms = performance.now() - t;
  console.log(name.padEnd(30), String(lv.resources.length).padStart(2), String(lv.carts.length).padStart(3), String(hold).padStart(2),
    String(rep.par ?? '-').padStart(4), String(rep.cert.explored).padStart(9), String(rep.cert.generated).padStart(10), String(rep.cert.pruned).padStart(9),
    ms.toFixed(0).padStart(6), ' ', rep.accept ? 'accept' : rep.reason);
}
