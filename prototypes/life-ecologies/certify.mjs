#!/usr/bin/env node
/* ============================================================
   LIFE ECOLOGIES — certification
   Extracts the exact engine and solver that ship in index.html,
   runs the beam search for each trial, verifies every witness by
   replay, and (with --write) writes the certified block back.

     node certify.mjs           # verify the shipped certificates
     node certify.mjs --write   # re-solve and rewrite the block
     node certify.mjs --trial 3 # one trial only (1..5)

   No dependencies. The page and this script run the same code.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, 'index.html');

const PRELUDE = `const N=64, CELLS=N*N, MASK=(1n<<64n)-1n;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const bit=(x)=>1n<<BigInt(63-x);`;

function sliceBetween(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`missing markers: ${start} / ${end}`);
  return src.slice(a, b);
}

function load(file) {
  const html = fs.readFileSync(file, 'utf8');
  const core = sliceBetween(html, '/* ==== CORE START ==== */', '/* ==== CORE END ==== */');
  const solver = sliceBetween(html, '/* ==== SOLVER START ==== */', '/* ==== SOLVER END ==== */');
  const duel = sliceBetween(html, '/* ==== DUEL START ==== */', '/* ==== DUEL END ==== */');
  const trials = sliceBetween(html, '/* ==== TRIALS START ==== */', '/* ==== TRIALS END ==== */');
  const herbarium = sliceBetween(html, '/* ==== HERBARIUM START ==== */', '/* ==== HERBARIUM END ==== */');
  const exported = [
    'N', 'CELLS', 'MASK', 'PRESETS', 'seedSpore', 'stepRule', 'analyse', 'biomassOf',
    'trialState', 'cloneTrial', 'advancePulse', 'applyActions', 'candidateActions',
    'sporeTargetScore', 'quickRank', 'replayWitness', 'solveTrial', 'witnessActionCount',
    'buildRuleOf', 'rulesFor', 'regionMasks', 'stepRowsFast', 'boardKey', 'cleanAction',
    'sameSlot', 'mkRing', 'TRIAL_SPECS', 'CERTIFIED',
    'sha256Hex', 'commitSeal', 'commitVerify', 'duelInitial', 'duelReplay', 'duelScoreFor',
    'HERBARIUM', 'decodeTerrariumProgram', 'simulateTerrarium', 'encodeTerrariumProgram',
    'unb64url', 'b64url', 'fnv1a', 'packBoard',
  ];
  const body = `${PRELUDE}\n${core}\n${solver}\n${duel}\n${trials}\n${herbarium}\nreturn { ${exported.join(', ')} };`;
  return { html, ...new Function(body)() };
}

function hex32(n) {
  return '0x' + (n >>> 0).toString(16).padStart(8, '0');
}

function emptyScore(E, spec) {
  const s = E.trialState(spec);
  for (let r = 0; r < 4; r++) E.advancePulse(s, []);
  return E.sporeTargetScore(s.rows, spec.target);
}

// Bounded BFS over the reduced candidate move set for the final pulse.
// Proves the claimed final pulse is reachable; returns the shortest bundle.
function bfsFinalPulse(E, spec, witness) {
  const pre = E.trialState(spec);
  for (let r = 0; r < witness.length - 1; r++) E.advancePulse(pre, witness[r]);
  let level = [{ pending: E.cloneTrial(pre), bundle: [] }];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const node of level) {
      for (const a of E.candidateActions(node.pending)) {
        if (node.bundle.some((b) => E.sameSlot(b, a))) continue;
        const pending = E.cloneTrial(node.pending);
        E.applyActions(pending, [a]);
        const bundle = node.bundle.concat([E.cleanAction(a)]);
        const result = E.cloneTrial(pending);
        E.advancePulse(result, []);
        const score = E.sporeTargetScore(result.rows, spec.target);
        if (score.pass) return { found: true, depth: depth + 1, bundle, score };
        next.push({ pending, bundle });
      }
    }
    // keep the frontier bounded and deterministic
    level = next.slice(0, 600);
    if (!level.length) break;
  }
  return { found: false, depth: 0 };
}

function lensUse(E, spec, certified) {
  const tally = {};
  for (const p of E.PRESETS) tally[p.id] = 0;
  const lines = certified.length ? certified : [];
  for (const line of lines) {
    const rep = E.replayWitness(spec, line.witness);
    const ids = new Set(rep.state.lenses.map((l) => E.PRESETS[l.rule].id));
    for (const id of ids) tally[id] = (tally[id] || 0) + 1;
  }
  const out = {};
  for (const p of E.PRESETS) {
    const v = lines.length ? tally[p.id] / lines.length : 0;
    if (v > 0) out[p.id] = Math.round(v * 100) / 100;
  }
  return out;
}

function certifyOne(E, spec, opts) {
  const solved = E.solveTrial(spec, opts);
  if (!solved.best) {
    return {
      ok: false,
      spec,
      reason: 'no certified line',
      explored: solved.explored,
      final: solved.finalBeam || [],
    };
  }
  let witness = solved.best.witness.map((r) => r.map((a) => ({ ...a })));
  let replay = E.replayWitness(spec, witness);
  if (!replay.score.pass) return { ok: false, spec, reason: 'replay did not pass' };

  const bfs = bfsFinalPulse(E, spec, witness);
  // If the BFS proves a shorter final pulse, adopt it and re-verify.
  let bfsAdopted = false;
  if (bfs.found && bfs.depth < witness[witness.length - 1].length) {
    witness = witness.slice(0, -1).concat([bfs.bundle]);
    replay = E.replayWitness(spec, witness);
    if (replay.score.pass) bfsAdopted = true;
    else witness = solved.best.witness.map((r) => r.map((a) => ({ ...a })));
  }

  const actions = E.witnessActionCount(witness);
  const pulses = witness.filter((r) => r.length > 0).length;
  const nullScore = emptyScore(E, spec);
  const cert = {
    version: 1,
    seed: hex32(spec.seed),
    reachable: true,
    par: { pulses, actions },
    nullScore: nullScore.score,
    bestScore: replay.score.score,
    lensUse: lensUse(E, spec, solved.certified),
    bfsFinal: bfs.found,
    bfsDepth: bfsAdopted ? bfs.depth : witness[witness.length - 1].length,
    replay: true,
    verifiedLines: solved.certified.length,
    explored: solved.explored,
    result: {
      still: replay.score.still,
      osc: replay.score.osc,
      ship: replay.score.ship,
      density: Math.round(replay.score.density * 10000) / 10000,
      score: replay.score.score,
    },
    witness,
  };
  return { ok: true, spec, cert, bfs, solved };
}

function verifyExtras(E) {
  let fail = 0;
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ];
  for (const [input, want] of vectors) {
    if (E.sha256Hex(input) !== want) {
      console.log(`SHA-256 vector failed for ${JSON.stringify(input.slice(0, 12))}`);
      fail++;
    }
  }

  for (const spec of E.HERBARIUM) {
    try {
      if (!spec.program.startsWith('t1p.')) throw new Error('not a program');
      const p = E.decodeTerrariumProgram(E.unb64url(spec.program.slice(4)));
      const sim = E.simulateTerrarium({ bm: p.bm, sm: p.sm, seed: p.seed, tick: p.tick, care: p.care });
      const checksumOk = p.checksum === E.fnv1a(E.packBoard(sim.rows));
      const a = E.analyse(sim.rows, p.bm, p.sm);
      const statsOk = a.biomass === spec.stats.biomass && a.still === spec.stats.still &&
        a.osc === spec.stats.osc && a.ship === spec.stats.ship && a.species === spec.stats.species;
      if (!checksumOk || !statsOk) {
        console.log(`herbarium ${spec.name}: ${checksumOk ? 'stats drift' : 'checksum drift'}`);
        fail++;
      } else {
        console.log(`herbarium ${spec.no} ${spec.name.padEnd(22)} ${String(spec.program.length).padStart(3)} ch  replay ok  species ${a.species}`);
      }
    } catch (err) {
      console.log(`herbarium ${spec.name}: ${err.message}`);
      fail++;
    }
  }

  const seed = 0x5eed1234;
  const lenses = E.TRIAL_SPECS[0].lenses;
  const drums = E.TRIAL_SPECS[0].drums;
  const history = [
    { A: { actions: [{ t: 'arm', d: 0, rot: 3 }, { t: 'arm', d: 1, rot: 5 }] }, B: { actions: [{ t: 'arm', d: 5, rot: 7 }, { t: 'arm', d: 6, rot: 2 }] } },
    { A: { actions: [{ t: 'arm', d: 2, rot: 11 }] }, B: { actions: [{ t: 'arm', d: 4, rot: 9 }] } },
    { A: { actions: [] }, B: { actions: [{ t: 'arm', d: 7, rot: 13 }] } },
    { A: { actions: [{ t: 'arm', d: 3, rot: 21 }] }, B: { actions: [] } },
  ];
  const r1 = E.duelReplay(seed, lenses, drums, history);
  const r2 = E.duelReplay(seed, lenses, drums, history);
  const same = r1.rows.every((v, i) => v === r2.rows[i]) && r1.owner.every((v, i) => v === r2.owner[i]);
  if (!same) {
    console.log('duel replay drift');
    fail++;
  } else {
    console.log(`duel replay             4 pulses  tick ${r1.tick}  A ${E.duelScoreFor(r1, 1).score} / B ${E.duelScoreFor(r1, 2).score}  deterministic`);
  }
  const c = { strain: 'A', round: 0, actions: [{ t: 'arm', d: 0, rot: 3 }], nonce: '0011223344556677' };
  c.seal = E.commitSeal(c.strain, c.round, c.actions, c.nonce);
  if (!E.commitVerify(c)) {
    console.log('seal verify failed');
    fail++;
  } else {
    console.log(`seal                    ${c.seal.slice(0, 16)}…  verified`);
  }
  return fail;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const only = args.includes('--trial') ? Number(args[args.indexOf('--trial') + 1]) : 0;
  const E = load(PAGE);

  console.log('Life Ecologies — certified solver');
  console.log(`engine: ${PAGE}`);
  console.log('');

  const out = {};
  let failures = 0;
  const rows = [];

  for (const spec of E.TRIAL_SPECS) {
    const n = Number(spec.id.replace('trial-', ''));
    if (only && n !== only) {
      if (E.CERTIFIED[spec.id]) out[spec.id] = E.CERTIFIED[spec.id];
      continue;
    }
    const started = performance.now();
    const r = certifyOne(E, spec, { beam: spec.beam || 10 });
    const ms = performance.now() - started;
    if (!r.ok) {
      failures++;
      console.log(`${spec.numeral.padEnd(4)} ${spec.name.padEnd(22)} FAIL  ${r.reason}  (${ms.toFixed(0)} ms)`);
      continue;
    }
    out[spec.id] = r.cert;
    rows.push({ spec, cert: r.cert, ms });
    console.log(
      `${spec.numeral.padEnd(4)} ${spec.name.padEnd(22)} par ${String(r.cert.par.actions).padStart(2)}a ` +
      `/${r.cert.par.pulses}p  score ${String(r.cert.bestScore).padStart(3)}  ` +
      `still ${r.cert.result.still} osc ${r.cert.result.osc} ship ${r.cert.result.ship}  ` +
      `density ${(r.cert.result.density * 100).toFixed(1)}%  ` +
      `null ${r.cert.nullScore}  ${ms.toFixed(0)} ms`
    );
  }

  const extraFail = verifyExtras(E);
  failures += extraFail;

  if (failures) {
    console.error(`\n${failures} trial(s) failed certification.`);
    process.exitCode = 1;
    return;
  }

  if (write) {
    const block = `  /* ==== CERTIFIED START ==== */\n  const CERTIFIED = ${JSON.stringify(out, null, 2)};\n  /* ==== CERTIFIED END ==== */`;
    const html = fs.readFileSync(PAGE, 'utf8');
    const a = html.indexOf('  /* ==== CERTIFIED START ==== */');
    const b = html.indexOf('  /* ==== CERTIFIED END ==== */');
    if (a < 0 || b < 0) throw new Error('certified markers missing');
    const next = html.slice(0, a) + block + html.slice(b + '  /* ==== CERTIFIED END ==== */'.length);
    fs.writeFileSync(PAGE, next);
    console.log(`\nwrote ${Object.keys(out).length} certificates to index.html`);
  } else {
    // Verify that the shipped block matches the freshly solved certificates.
    let drift = 0;
    for (const [id, cert] of Object.entries(out)) {
      const shipped = E.CERTIFIED[id];
      if (!shipped) { console.log(`\n${id}: not shipped (run --write)`); drift++; continue; }
      const shippedJson = JSON.stringify(shipped);
      const freshJson = JSON.stringify(cert);
      if (shippedJson !== freshJson) {
        console.log(`\n${id}: certificate drift — shipped par ${shipped.par?.actions}, fresh par ${cert.par.actions}`);
        drift++;
      }
    }
    if (drift) {
      console.error(`\n${drift} certificate(s) differ. Run: node certify.mjs --write`);
      process.exitCode = 1;
    } else {
      console.log('\nall shipped certificates match a fresh replay');
    }
  }
}

main();
