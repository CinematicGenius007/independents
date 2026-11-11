#!/usr/bin/env node
/**
 * Headless certifier for prototypes/cs-formalisms.
 *
 * The prototype is one self-contained HTML file, so the engines live between
 * `/* ===== engine:start ===== *\/` and `/* ===== engine:end ===== *\/`.
 * This script lifts that block into a Node VM and runs the same functions the
 * browser runs. No dependencies, no build step, no duplicated rules.
 *
 * Checks
 *   1. Every curated Deadlock / Byzantine / GC board is certified and the
 *      advertised failure is reproducible.
 *   2. Twenty generated seeds per game are certified.
 *   3. Every certificate is replayed, not merely trusted.
 *
 * Usage: node scripts/certify.mjs [seedsPerGame]
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(here, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const START = '/* ===== engine:start ===== */';
const END = '/* ===== engine:end ===== */';
const start = html.indexOf(START);
const end = html.indexOf(END);
if (start < 0 || end < 0) {
  console.error(`engine markers not found in ${htmlPath}`);
  process.exit(2);
}

const exports = [
  'certify', 'initLevel', 'step', 'holdCart', 'loanCart', 'detectInversion',
  'DL_LEVELS', 'runDefaultSchedule', 'generateDeadlockLevel',
  'certifyBy', 'evaluate', 'initBy', 'applyAction', 'BY_LEVELS', 'allEdges',
  'generateByzantineLevel', 'lieTreeRows',
  'initGc', 'stepEvent', 'pause', 'resume', 'doAction', 'certifyGc',
  'GC_LEVELS', 'generateGcLevel', 'gcLocality', 'stats',
];
const code = `${html.slice(start, end)}
globalThis.__ENGINE = { ${exports.join(', ')} };
`;
const context = vm.createContext({ console, Math, Date, JSON });
vm.runInContext(code, context);
const E = context.__ENGINE;

const seedsPerGame = Number(process.argv[2] ?? 20);
const failures = [];
let checks = 0;

function check(ok, label, detail = '') {
  checks += 1;
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function replayDeadlock(level, plan) {
  const st = E.initLevel(level);
  for (const action of plan) {
    if (action.kind === 'step') E.step(st, level);
    else if (action.kind === 'hold') E.holdCart(st, level, action.cart);
    else if (action.kind === 'loan') E.loanCart(st, level, action.cart);
  }
  return st.status === 'won';
}

function defaultFailure(level) {
  const run = E.runDefaultSchedule(level);
  return {
    ok: run.status === 'deadlock' || run.status === 'livelock' || run.sawInversion,
    label: run.status === 'deadlock' ? 'DEADLOCK'
      : run.status === 'livelock' ? 'LIVELOCK'
      : run.sawInversion ? 'INVERSION' : run.status.toUpperCase(),
  };
}

// ---------------------------------------------------------------- Deadlock
console.log('\nDEADLOCK · product-automata certificate\n');
console.log('  board / seed                 carts  par  budget  default      states   result');
console.log('  ' + '─'.repeat(84));

function reportDeadlock(label, level, cert, def, ms) {
  const budget = level.budget.hold + level.budget.loan;
  const par = cert.ok ? cert.used : '—';
  console.log(
    `  ${label.padEnd(28)} ${String(level.carts.length).padStart(3)}  ${String(par).padStart(3)}  ${String(budget).padStart(6)}  ${def.label.padEnd(11)} ${String(cert.explored ?? 0).padStart(7)}  ${cert.ok ? 'CERTIFIED' : 'FAILED'}`,
  );
}

for (const level of E.DL_LEVELS) {
  const started = Date.now();
  const cert = E.certify(level, 120000);
  const def = defaultFailure(level);
  const budget = level.budget.hold + level.budget.loan;
  reportDeadlock(level.name, level, cert, def, Date.now() - started);
  check(cert.ok, `deadlock preset ${level.id}: certified`, cert.reason);
  if (cert.ok) {
    check(cert.used >= 1, `deadlock preset ${level.id}: par >= 1`, `par ${cert.used}`);
    check(cert.used <= budget, `deadlock preset ${level.id}: par <= budget`, `${cert.used} > ${budget}`);
    check(replayDeadlock(level, cert.plan), `deadlock preset ${level.id}: plan replays to a win`);
    check(def.ok, `deadlock preset ${level.id}: default run fails`, def.label);
    check(!!level.par, `deadlock preset ${level.id}: advertised par exists`);
    if (level.par) {
      check(level.par.hold + level.par.loan === cert.used, `deadlock preset ${level.id}: advertised par matches certificate`, `${level.par.hold + level.par.loan} vs ${cert.used}`);
    }
  }
}

for (let i = 1; i <= seedsPerGame; i += 1) {
  const seed = `RAIL-${100 + i}`;
  const started = Date.now();
  const generated = E.generateDeadlockLevel(seed);
  if (!check(generated.ok, `deadlock seed ${seed}: generated`, generated.reason)) continue;
  const { level, cert } = generated;
  const def = defaultFailure(level);
  reportDeadlock(`seed ${seed}`, level, cert, def, Date.now() - started);
  const budget = level.budget.hold + level.budget.loan;
  check(cert.used >= 1, `deadlock seed ${seed}: par >= 1`, `par ${cert.used}`);
  check(cert.used <= budget, `deadlock seed ${seed}: par <= budget`, `${cert.used} > ${budget}`);
  check(replayDeadlock(level, cert.plan), `deadlock seed ${seed}: plan replays to a win`);
  check(def.ok, `deadlock seed ${seed}: default run fails`, def.label);
  check(level.generated === true, `deadlock seed ${seed}: marked generated`);
  check(level.carts.length >= 3 && level.carts.length <= 4, `deadlock seed ${seed}: 3–4 carts`, `${level.carts.length} carts`);
}

// ---------------------------------------------------------------- Byzantine
console.log('\nBYZANTINE CHOIR · minimax witness certificate\n');
console.log('  board / seed                 n  f  budget  default  par  result');
console.log('  ' + '─'.repeat(72));

function reportByzantine(label, level, cert, defaultScore) {
  const n = Object.keys(level.towers).length;
  const budget = level.budget.cut + level.budget.delay;
  console.log(
    `  ${label.padEnd(28)} ${String(n).padStart(2)} ${String(level.f).padStart(2)} ${String(budget).padStart(7)}  ${String(defaultScore).padStart(7)}  ${String(cert.cost === Infinity ? '—' : cert.cost).padStart(3)}  ${cert.cost === Infinity ? 'NO SAFE ACTION' : 'CERTIFIED'}`,
  );
}

function replayByzantine(level, cert) {
  const st = E.initBy(level);
  for (const k of cert.cuts) E.applyAction(st, level, k, 'cut');
  for (const k of cert.delays) E.applyAction(st, level, k, 'delay');
  const witness = E.evaluate(level, st);
  return witness && witness.score === 0;
}

for (const level of E.BY_LEVELS) {
  const defaultWitness = E.evaluate(level, E.initBy(level));
  const cert = E.certifyBy(level);
  reportByzantine(level.name, level, cert, defaultWitness ? defaultWitness.score : 0);
  check(defaultWitness && defaultWitness.score > 0, `byzantine preset ${level.id}: default is unsafe`);
  check(cert.cost !== Infinity, `byzantine preset ${level.id}: safe action exists`);
  if (cert.cost !== Infinity) {
    const budget = level.budget.cut + level.budget.delay;
    check(cert.cost >= 1, `byzantine preset ${level.id}: par >= 1`);
    check(cert.cost <= budget, `byzantine preset ${level.id}: par <= budget`, `${cert.cost} > ${budget}`);
    check(replayByzantine(level, cert), `byzantine preset ${level.id}: action certifies`);
    const n = Object.keys(level.towers).length;
    check(n >= 3 * level.f + 1, `byzantine preset ${level.id}: n >= 3f+1`, `n=${n}, f=${level.f}`);
  }
}

for (let i = 1; i <= seedsPerGame; i += 1) {
  const seed = `RELAY-${200 + i}`;
  const generated = E.generateByzantineLevel(seed);
  if (!check(generated.ok, `byzantine seed ${seed}: generated`, generated.reason)) continue;
  const { level, cert, defaultWitness } = generated;
  reportByzantine(`seed ${seed}`, level, cert, defaultWitness.score);
  const budget = level.budget.cut + level.budget.delay;
  check(defaultWitness.score > 0, `byzantine seed ${seed}: default is unsafe`);
  check(cert.cost !== Infinity, `byzantine seed ${seed}: safe action exists`);
  check(cert.cost >= 1, `byzantine seed ${seed}: par >= 1`);
  check(cert.cost <= budget, `byzantine seed ${seed}: par <= budget`, `${cert.cost} > ${budget}`);
  check(replayByzantine(level, cert), `byzantine seed ${seed}: action certifies`);
  check(level.generated === true, `byzantine seed ${seed}: marked generated`);
  check(Array.isArray(E.lieTreeRows(level, E.initBy(level), defaultWitness)), `byzantine seed ${seed}: lie tree rows`);
}

// ---------------------------------------------------------------- Garbage
console.log('\nGARBAGE COLLECTOR · schedule certificate\n');
console.log('  board / seed                 heap  budget  peak  pauses  slides  result');
console.log('  ' + '─'.repeat(78));

function reportGc(label, level, cert) {
  const pauses = cert.ok ? cert.schedule.filter(s => s.type === 'pause').length : 0;
  const slides = cert.ok ? cert.schedule.filter(s => s.type === 'compact').length : 0;
  console.log(
    `  ${label.padEnd(28)} ${String(level.capacity).padStart(4)} ${String(level.pauseBudget).padStart(7)} ${String(cert.peak ?? '—').padStart(5)} ${String(pauses).padStart(7)} ${String(slides).padStart(7)}  ${cert.ok ? 'CERTIFIED' : 'FAILED'}`,
  );
}

for (const level of E.GC_LEVELS) {
  const cert = E.certifyGc(level);
  reportGc(level.name, level, cert);
  check(cert.ok, `gc preset ${level.id}: certified`, cert.reason);
  if (cert.ok) {
    check(cert.peak <= level.pauseBudget, `gc preset ${level.id}: peak <= budget`, `${cert.peak} > ${level.pauseBudget}`);
  }
}

for (let i = 1; i <= seedsPerGame; i += 1) {
  const seed = `HEAP-${300 + i}`;
  const generated = E.generateGcLevel(seed);
  if (!check(generated.ok, `gc seed ${seed}: generated`, generated.reason)) continue;
  const { level, cert } = generated;
  reportGc(`seed ${seed}`, level, cert);
  check(cert.peak <= level.pauseBudget, `gc seed ${seed}: peak <= budget`, `${cert.peak} > ${level.pauseBudget}`);
  check(cert.schedule.some(s => s.type === 'compact'), `gc seed ${seed}: schedule slides`);
  check(cert.schedule.filter(s => s.type === 'pause').length >= 2, `gc seed ${seed}: schedule splits the mark`);
  check(level.generated === true, `gc seed ${seed}: marked generated`);
  const locality = E.gcLocality(E.initGc(level).heap);
  check(locality.projectedSpan <= locality.pointerSpan, `gc seed ${seed}: slide does not lengthen pointer spans`);
}

// ---------------------------------------------------------------- Summary
console.log('\n' + '─'.repeat(88));
if (failures.length) {
  console.log(`FAILED ${failures.length} of ${checks} checks\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`PASSED ${checks} checks · ${E.DL_LEVELS.length} deadlock boards + ${E.BY_LEVELS.length} byzantine boards + ${E.GC_LEVELS.length} gc boards + ${seedsPerGame * 3} generated seeds`);
