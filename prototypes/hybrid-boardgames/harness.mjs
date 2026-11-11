#!/usr/bin/env node
/* Headless harness for the three hybrid prototypes.
 *   node harness.mjs            full report (what ARCHITECTURE.md quotes)
 *   node harness.mjs --quick    small samples, for a smoke test
 * Loads src/engine.js, the same file build.mjs inlines into index.html. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const HB = createRequire(import.meta.url)('./src/engine.js')
const { SB, CC, LQ } = HB
LQ.setWords(readFileSync(join(here, 'src/words.txt'), 'utf8').split(/\s+/).filter(Boolean))
const quick = process.argv.includes('--quick')
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)   // --only=sb,cc,lq,rules
const want = (k) => !onlyArg || onlyArg.split(',').includes(k)
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + '%' : '–')
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const f1 = (x) => x.toFixed(1)
let failures = 0
const check = (name, ok) => { console.log((ok ? '  ok   ' : '  FAIL ') + name); if (!ok) failures++ }

/* ───────────── protocol self-checks ───────────── */
console.log('\n# protocol')
for (const msg of ['', 'abc', 'x'.repeat(200)]) check('sha256 matches node:crypto (' + msg.length + 'B)', HB.hex(HB.sha256(HB.enc(msg))) === createHash('sha256').update(msg).digest('hex'))
{
  const matchId = Uint8Array.from(randomBytes(4)), nonce = Uint8Array.from(randomBytes(16))
  const order = { f: 21, t: 16, bid: 3 }
  const st = SB.newGame()
  const hist = []
  const rng = HB.mulberry32(5)
  for (let i = 0; i < 12 && !st.over; i++) {
    const a = SB.bots.greedy.choose(st, 0, rng), b = SB.bots.greedy.choose(st, 1, rng)
    const o = [a, b], coin = i & 1; SB.resolve(st, o, coin)
    hist.push(st.hist[st.hist.length - 1])
  }
  const commit = SB.commitOf(matchId, 12, 0, order, nonce)
  const bytes = SB.encodeLink({ matchId, mode: 'ledger', start: 5, cap: 9, hist, pending: { kind: 'reveal', side: 0, commit, order, nonce } })
  const url = HB.b64u(bytes)
  const back = SB.decodeLink(HB.unb64u(url))
  check('link round-trips (' + hist.length + ' turns, ' + url.length + ' chars)', back.hist.length === hist.length && HB.ctEqual(back.pending.commit, commit))
  const replay = SB.replay(back)
  check('replay reproduces the exact board and treasuries', replay.b.join() === st.b.join() && replay.tr.join() === st.tr.join())
  check('commitment verifies', HB.ctEqual(SB.commitOf(matchId, 12, 0, back.pending.order, back.pending.nonce), back.pending.commit))
  check('wrong bid breaks the seal', !HB.ctEqual(SB.commitOf(matchId, 12, 0, { ...order, bid: 4 }, nonce), commit))
  const sealedLink = SB.encodeLink({ matchId, mode: 'ledger', start: 5, cap: 9, hist, pending: { kind: 'sealed', side: 0, commit } })
  const has = (hay, nd) => { for (let i = 0; i + nd.length <= hay.length; i++) { let ok = true; for (let j = 0; j < nd.length && ok; j++) ok = hay[i + j] === nd[j]; if (ok) return true } return false }
  const sd = SB.decodeLink(sealedLink)
  check('the sealed link carries neither the nonce nor the order', !has(sealedLink, nonce) && sd.pending.order === undefined && sd.pending.nonce === undefined)
  const tampered = bytes.slice(); tampered[12] ^= 1
  let broke = false; try { SB.decodeLink(tampered) } catch { broke = true }
  check('tampering with history breaks the hash chain', broke)
  // coin cannot be ground by the sealer: same nonce, different opener order → different coin stream
  let flips = 0; for (let b = 0; b < 16; b++) flips += SB.coinOf(commit, { f: 1, t: 2, bid: b }, nonce)
  check('tie coin depends on the opener order (' + flips + '/16 ones)', flips > 2 && flips < 14)
}

{ // the link desk: two "devices" that share nothing but pasted URL text, three hops a turn
  console.log('\n# link desk (two devices, URL text only)')
  const base = 'https://example.test/index.html'
  const rng = HB.mulberry32(77), matchId = Uint8Array.from(randomBytes(4))
  const dev = [{ secrets: new Map() }, { secrets: new Map() }]
  const sealers = []
  let text = SB.linkText(SB.deskBegin(matchId), base), turns = 0, agree = true, hops = 0, sharp = 0, bytes = 0, notes = []
  const choose = (st, side) => SB.bots.economist.choose(st, side, rng) || { f: -1, t: -1, bid: 0 }
  let last = null
  while (turns < 40) {
    let link = SB.parseLink(text), r = SB.deskRole(link)
    if (r.kind === 'over') break
    if (r.kind !== 'seal') { notes.push('expected a seal at turn ' + turns + ', got ' + r.kind); break }
    const S = r.side, O = 1 - S; sealers.push(S)
    const nonce = Uint8Array.from(randomBytes(16))
    const o1 = choose(r.st, S), a = SB.deskSeal(link, o1, nonce); dev[S].secrets.set(HB.hex(a.link.pending.commit), a.secret)
    const t1 = SB.linkText(a.link, base)                      // hop 1: sealer → opener
    const l2 = SB.parseLink(t1), r2 = SB.deskRole(l2)
    if (r2.kind !== 'respond' || r2.side !== O) { notes.push('opener role wrong'); break }
    const o2 = choose(r2.st, O), b = SB.deskRespond(l2, o2); dev[O].secrets.set(HB.hex(l2.pending.commit), b.secret)
    const t2 = SB.linkText(b.link, base)                      // hop 2: opener → sealer
    const l3 = SB.parseLink(t2), key = HB.hex(l3.pending.commit)
    const c = SB.deskReveal(l3, dev[S].secrets.get(key))
    const t3 = SB.linkText(c.link, base)                      // hop 3: sealer → opener
    const l4 = SB.parseLink(t3)
    const d = SB.deskVerify(l4, dev[O].secrets.get(key).order)
    hops += 3; bytes += t1.length + t2.length + t3.length; turns++
    if (!d.ok) { notes.push('verify failed: ' + d.why); break }
    if (c.st.b.join() !== d.st.b.join() || c.st.tr.join() !== d.st.tr.join() || c.coin !== d.coin) agree = false
    last = d; text = SB.linkText(d.next, base)               // roles swap: the opener seals next turn
    if (d.st.over) break
  }
  const fin = SB.parseLink(text), rep = SB.replay(fin)
  check('both devices reach the same board, purses and coin on every turn (' + turns + ' turns, ' + hops + ' hops)', agree && notes.length === 0)
  check('the final link replays to the position both devices hold', last && rep.b.join() === last.st.b.join() && rep.tr.join() === last.st.tr.join())
  check('the final link (' + text.length + ' chars) still verifies its hash chain end to end', fin.hist.length === turns)
  check('roles alternate: turn n is sealed by side n mod 2, so the opener of one turn seals the next', sealers.length === turns && sealers.every((x, i) => x === i % 2))
  {
    const l0 = SB.deskBegin(matchId), n = Uint8Array.from(randomBytes(16)), pos = SB.replay(l0)
    const mv = SB.movesFor(pos.b, 0)[0], sealed = SB.deskSeal(l0, { ...mv, bid: 2 }, n)
    const opened = SB.deskRespond(sealed.link, { ...SB.movesFor(pos.b, 1)[0], bid: 1 })
    const key = HB.hex(sealed.link.pending.commit)
    check('a link pasted in the wrong phase is refused (cannot reveal a seal, cannot seal an opened link)', (() => { try { SB.deskReveal(sealed.link, sealed.secret); return false } catch { try { SB.deskSeal(opened.link, mv, n); return false } catch { return true } } })())
    check('a browser without the nonce cannot reveal (the secret lives only where it was made)', (() => { try { SB.deskReveal(opened.link, undefined); return false } catch (e) { return /nonce/.test(e.message) } })())
    const rv = SB.deskReveal(opened.link, sealed.secret)
    const forged = { ...rv.link, pending: { ...rv.link.pending, order: { ...rv.link.pending.order, bid: 5 } } }
    const bad = SB.deskVerify(SB.parseLink(SB.linkText(forged)), opened.secret.order)
    check('a sealer who changes the bid at reveal is caught: SEAL BROKEN', bad.ok === false && /SEAL BROKEN/.test(bad.why))
    const lost = SB.deskVerify(SB.parseLink(SB.linkText(rv.link)), null)
    check('an opener who lost its saved answer is asked for link 2, and link 2 supplies it', lost.ok === false && lost.need === 'opener' && SB.openerOrderFrom(SB.parseLink(SB.linkText(opened.link)), rv.link.pending.commit) !== null)
    const forms = [SB.linkText(opened.link, base), SB.linkText(opened.link), SB.linkText(opened.link).slice(1), SB.linkText(opened.link).slice(5), '  ' + SB.linkText(opened.link, base) + '\n']
    check('paste forms all parse: full URL, #sb1/…, sb1/…, bare payload, stray whitespace', forms.every((f) => { try { return HB.hex(SB.parseLink(f).pending.commit) === key } catch { return false } }))
    const rejects = ['', 'hello world', '#sb1/!!!', 'sb1/AAAA'].map((f) => { try { SB.parseLink(f); return false } catch { return true } })
    check('garbage is refused with a message, never half-parsed', rejects.every(Boolean))
    const tampered = SB.encodeLink(sealed.link); tampered[11] ^= 1
    check('a link with an edited history fails to open', (() => { try { SB.parseLink('#sb1/' + HB.b64u(tampered)); return false } catch (e) { return /chain|version/.test(e.message) } })())
  }
}

/* ───────────── rule self-checks (the rules the critique leans on) ───────────── */
console.log('\n# rules')
{ // SB: second mover's move fizzles when the first mover took its piece
  const st = SB.newGame(); st.b = Array(25).fill(null); st.b[24] = 'K'; st.b[0] = 'k'; st.b[12] = 'R'; st.b[10] = 'r'
  // white rook takes black rook on a3-ish row, black rook takes white rook: bid decides who survives
  const o = [{ f: 12, t: 10, bid: 2 }, { f: 10, t: 12, bid: 1 }]
  const ev = SB.resolve(st, o, 0)
  check('higher bid captures first; the loser’s move fizzles', ev.some((e) => e.kind === 'fizzle' && e.s === 1) && st.b[10] === 'R')
  const st2 = SB.newGame(); st2.b = Array(25).fill(null); st2.b[24] = 'K'; st2.b[0] = 'k'; st2.b[12] = 'R'; st2.b[10] = 'r'
  SB.resolve(st2, [{ f: 12, t: 10, bid: 1 }, { f: 10, t: 12, bid: 1 }], 1)
  check('equal bids: the coin picks the first mover (coin 1 → Black)', st2.b[12] === 'r')
  const st3 = SB.newGame({ mode: 'ledger', start: 5 }); SB.resolve(st3, [{ f: 17, t: 12, bid: 3 }, { f: 7, t: 12, bid: 0 }], 0)
  check('ledger: the first mover’s bid lands in the rival’s purse (5-3+1, 5+3+1 capped 9)', st3.tr[0] === 3 && st3.tr[1] === 9)
  const st4 = SB.newGame({ mode: 'ledger', start: 5 }); SB.resolve(st4, [{ f: 17, t: 12, bid: 9 }, { f: 7, t: 12, bid: 0 }], 0)
  check('a bid above the treasury is clamped to it (5 paid, +1 income → 1 left)', st4.tr[0] === 1)
}
{ // CC: the two labs the page ships
  const mk = (peace) => {
    const st = CC.newGame('lab'); st.tile.fill(-1); st.dir.fill(null); st.reserve.forEach((r) => r.fill(true)); st.score.forEach((r) => r.fill(0))
    ;[[2, 0, 0], [2, 1, 1], [2, 2, 0], [3, 2, 0], [2, 4, 0], [2, 5, 0]].forEach(([r, c, k]) => (st.tile[r * 7 + c] = k))
    st.dir[14] = { p: 0, c: 0, age: 0 }; st.reserve[0][0] = false; st.dir[19] = { p: 1, c: 0, age: 1 }; st.reserve[1][0] = false
    st.score[0][0] = 1; st.score[1][0] = 1; st.hands = [[0, 1], [0, 3], [2, 3]]; st.mover = 0; st.turn = 3
    if (peace) CC.sign(st, [{ from: 0, to: 1, kind: 'nomerge', left: 3 }, { from: 1, to: 0, kind: 'nomerge', left: 3 }])
    return st
  }
  const st = mk(false); const { moves } = CC.legalMoves(st, 0)
  const m = moves.find((x) => x.c === 0 && x.x === 17 && !x.d)
  CC.apply(st, 0, m, false)
  check('merger lab: 3 coal beat 2; P2’s director is unseated; P1 takes the +2 spoil and its own tile', st.dir[19] === null && st.score[0][0] === 1 + st.o.spoil + 1 && st.reserve[1][0] === true)
  const sp = mk(true); const r = CC.legalMoves(sp, 0)
  check('peace lab: the joining square is deleted from the move list and listed as blocked', !r.moves.some((x) => x.x === 17) && r.blocked.some((x) => x.x === 17))
  const dl = CC.newGame('dl'); dl.tile.fill(0); dl.tile[48] = -1; dl.dir[0] = { p: 1, c: 0, age: 0 }; dl.reserve[1][0] = false; dl.hands[0] = [1]
  CC.sign(dl, [{ from: 0, to: 1, kind: 'embargo', left: 2 }, { from: 1, to: 0, kind: 'embargo', left: 2 }])
  const dr = CC.legalMoves(dl, 0)
  check('a covenant can strand every tile placement, but discarding is never blocked (escape costs the tile)', dr.moves.length > 0 && dr.moves.every((x) => x.x < 0) && dr.blocked.length > 0 && !dr.forced)
  const cap = CC.newGame('cap'); CC.sign(cap, [{ from: 0, to: 1, kind: 'nomerge', left: 1 }, { from: 1, to: 0, kind: 'nomerge', left: 1 }]); CC.sign(cap, [{ from: 0, to: 2, kind: 'nomerge', left: 1 }, { from: 2, to: 0, kind: 'nomerge', left: 1 }])
  check('a promiser carries at most two covenants', !CC.canSign(cap, { from: 0, to: 1, kind: 'embargo', left: 1 }))
}
{ // LQ
  const st = LQ.newGame('chk')
  const before = st.ch.join('') + st.own.join('')
  for (let i = 0; i < 4; i++) LQ.rotate(st, 8)
  check('four quarter-turns restore the block', st.ch.join('') + st.own.join('') === before)
  const a = LQ.newGame('chk'); a.own[0] = 1; a.pts[0] = 3; a.score = 3
  LQ.censorApply(a, { k: 'stone', cell: 1 })
  check('a corner ink cell with one breath left is quarantined (floor 1) and its points removed', a.own[0] === 3 && a.score === 0)
  const b = LQ.newGame('chk', { libFloor: 0 }); b.own[0] = 1; b.pts[0] = 3; b.score = 3
  LQ.censorApply(b, { k: 'stone', cell: 1 })
  check('with floor 0 the same cell survives (v1 rules)', b.own[0] === 1)
  const c = LQ.newGame('chk'); c.own[0] = 2; c.own[1] = 1; c.own[7] = 1; c.pts[1] = 1; c.pts[7] = 1
  LQ.censorApply(c, { k: 'stone', cell: 30 })
  check('a stone ringed by ink loses its last breath and is lifted at the next sweep', c.own[0] === 0)
  { // shear: a turn cuts. Four ink cells in a row (0..3); turning the block at 2 tears 3 away from 0,1
    const mk = (opts) => { const x = LQ.newGame('chk', opts); for (const i of [0, 1, 2, 3]) { x.own[i] = 1; x.pts[i] = 2 } x.score = 8; return x }
    const x = mk({}); LQ.censorApply(x, { k: 'rot', cell: 2 })
    check('shear: turning the block at c1 severs 2 cells from the body; they die and take their 4 points', x.own[3] === 3 && x.own[10] === 3 && x.own[0] === 1 && x.own[1] === 1 && x.score === 4 && x.stats.sheared === 2)
    const y = mk({ shear: false }); LQ.censorApply(y, { k: 'rot', cell: 2 })
    check('shear off (the v1 turn): the same turn moves ink and kills nothing', y.own.filter((o) => o === 1).length === 4 && y.score === 8)
    const z = mk({}); z.own[40] = 1; z.pts[40] = 3; z.score += 3; LQ.censorApply(z, { k: 'rot', cell: 39 })
    check('shear "cut": a stray ink cell that was already apart is only moved, not killed', z.own.filter((o) => o === 1).length === 5)
    const w = mk({ shear: 'all' }); w.own[40] = 1; w.pts[40] = 3; w.score += 3; LQ.censorApply(w, { k: 'rot', cell: 39 })
    check('shear "all": that stray cell dies too', w.own.filter((o) => o === 1).length === 4 && w.score === 8)
    const pv = LQ.previewRot(mk({}), 2)
    check('previewRot reports the cells and points a turn would destroy without changing the board', pv.torn.length === 2 && pv.lost === 4)
    const nr = mk({ rotCool: 99 })
    check('rotCool 99 removes rotation entirely (no free first turn)', !LQ.canRotate(nr) && !LQ.censorActs(nr).some((a) => a.k === 'rot'))
    const jam = mk({}); LQ.censorApply(jam, { k: 'rot', cell: 2 })
    jam.round = 1; const j1 = LQ.canRotate(jam); jam.round = 2; const j2 = LQ.canRotate(jam)
    check('a turn jams rotation for exactly one round (round 1 refused, round 2 allowed)', !j1 && j2)
  }
  const d = LQ.newGame('chk')
  check('every word the finder offers is accepted by evalPath', LQ.findWords(d).slice(0, 30).every((x) => LQ.evalPath(d, x.path).ok || !LQ.poetMove(d, x).ok))
}

/* ───────────── 1. Shadow Bidding ───────────── */
function sbGame(botW, botB, seed, opts) {
  const st = SB.newGame(opts), rng = HB.mulberry32(seed)
  const bids = [], tieN = { n: 0 }, fizz = { n: 0 }, firstWins = [0, 0]
  let capTurns = 0, bidTurns = 0, maxTr = 0
  while (!st.over) {
    const o = [botW.choose(st, 0, rng), botB.choose(st, 1, rng)]
    const coin = rng() < 0.5 ? 1 : 0
    const ev = SB.resolve(st, o, coin)
    const a = ev[0]; if (a.tie) tieN.n++; if (a.pay > 0) bidTurns++
    bids.push(a.pay)
    fizz.n += ev.filter((e) => e.kind === 'fizzle').length
    if (ev.some((e) => e.kind === 'move' && e.cap)) capTurns++
    maxTr = Math.max(maxTr, st.tr[0], st.tr[1])
  }
  return { st, turns: st.turn, tie: tieN.n, fizz: fizz.n, bidTurns, capTurns, maxTr, paid: bids.reduce((a, b) => a + b, 0) }
}
function sbMatch(label, aKey, bKey, n, opts) {
  const A = SB.bots[aKey], B = SB.bots[bKey]
  const r = { a: 0, b: 0, d: 0, king: 0, adj: 0, turns: [], fizz: [], bid: [], paid: [], cap: [], tr: [] }
  for (let i = 0; i < n; i++) {
    const flip = i & 1
    const g = flip ? sbGame(B, A, 1000 + i, opts) : sbGame(A, B, 1000 + i, opts)
    const w = g.st.over.winner
    if (w < 0) r.d++; else if ((w === 0) !== !!flip) r.a++; else r.b++
    if (g.st.over.reason === 'king') r.king++; if (g.st.over.reason === 'adjudicated') r.adj++
    r.turns.push(g.turns); r.fizz.push(g.fizz); r.bid.push(g.bidTurns / g.turns); r.paid.push(g.paid); r.cap.push(g.capTurns); r.tr.push(g.maxTr)
  }
  console.log(`  ${label.padEnd(24)} ${aKey} ${pct(r.a, n).padStart(4)} | ${bKey} ${pct(r.b, n).padStart(4)} | draw ${pct(r.d, n).padStart(4)} | king ${pct(r.king, n).padStart(4)} adj ${pct(r.adj, n).padStart(4)} | turns ${f1(avg(r.turns)).padStart(5)} fizzles ${f1(avg(r.fizz)).padStart(4)} paid-turns ${pct(avg(r.bid), 1).padStart(4)} coins-paid ${f1(avg(r.paid)).padStart(5)}`)
  return r
}
if (want('sb')) {
console.log('\n# 1. Shadow Bidding (5×5, ' + (quick ? 40 : 200) + ' games per row, seats alternate)')
const N1 = quick ? 40 : 200
console.log(' ledger mode: bids go to the rival\'s treasury')
sbMatch('baseline chess-ish', 'greedy', 'random', N1)
sbMatch('greedy mirror', 'greedy', 'greedy', N1)
sbMatch('economist vs greedy', 'economist', 'greedy', N1)
sbMatch('economist mirror', 'economist', 'economist', N1)
sbMatch('all-in vs greedy', 'allin', 'greedy', N1)
sbMatch('economist vs all-in', 'economist', 'allin', N1)
console.log(' pot mode: bids go to a centre pot that the next capturer takes')
sbMatch('economist vs greedy', 'economist', 'greedy', N1, { mode: 'pot' })
sbMatch('economist mirror', 'economist', 'economist', N1, { mode: 'pot' })
sbMatch('all-in vs greedy', 'allin', 'greedy', N1, { mode: 'pot' })
console.log(' no-cap ledger (cap 99): does wealth snowball?')
{
  const r = sbMatch('economist mirror, cap 99', 'economist', 'economist', N1, { cap: 99 })
  console.log('    peak treasury, cap 9:  ' + f1(avg(sbMatch('economist mirror (quiet)', 'economist', 'economist', 20).tr)) + '   cap 99: ' + f1(avg(r.tr)))
}
{ // first-move tie coin fairness: how often does a tie go to white, and does the fixed-white bias matter?
  let w0 = 0, tot = 0
  for (let i = 0; i < N1; i++) { const g = sbGame(SB.bots.economist, SB.bots.economist, 5000 + i); g.st.hist.forEach((h) => { if (h.coin >= 0) { tot++; w0 += h.coin === 0 } }) }
  console.log(`  tie turns observed ${tot}; coin → White ${pct(w0, tot)}`)
}

}
/* ───────────── 1b. turn evaluator (fictitious play over a 1-ply payoff matrix) ───────────── */
if (want('sb') || want('rules')) {
  console.log('\n# 1b. Shadow Bidding turn evaluator (fictitious play)')
  const mp = SB.fictitious([[1, -1], [-1, 1]], 3000)
  check('fictitious play: matching pennies → 50/50 (' + f1(100 * mp.row[0]) + '%), value ≈ 0', Math.abs(mp.row[0] - 0.5) < 0.05 && Math.abs(mp.value) < 0.05)
  const dom = SB.fictitious([[3, 1], [2, 0]], 800)
  check('fictitious play: a dominant row is found (row 0 ≥ 95%), value ≈ 1', dom.row[0] > 0.95 && Math.abs(dom.value - 1) < 0.1)
  const rps = SB.fictitious([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], 6000)
  check('fictitious play: rock-paper-scissors → thirds, value bracket straddles 0', rps.row.every((p) => Math.abs(p - 1 / 3) < 0.06) && rps.lo < 0.05 && rps.hi > -0.05)
  const duel = SB.newGame(); duel.b = Array(25).fill(null); duel.b[24] = 'K'; duel.b[2] = 'Q'; duel.b[0] = 'k'; duel.b[20] = 'r'; duel.b[12] = 'P'; duel.b[7] = 'p'
  const dpre = SB.clone(duel), dord = [{ f: 2, t: 0, bid: 3 }, { f: 20, t: 24, bid: 1 }]
  let t0 = Date.now(); const dan = SB.analyseTurn(dpre, dord, 0); const dms = Date.now() - t0
  check('duel: going first is worth the game (a king), and the solver says so', dan.decisive && dan.worth > 50)
  check('duel: equilibrium bid is the whole purse (mean ' + f1(dan.eq.mean) + ' of ' + dpre.tr[0] + ')', dan.eq.mean >= dpre.tr[0] - 0.5)
  check('duel: against a bid of 1, the sharp bid is 2, so a bid of 3 is called overpaid', dan.verdict === 'overpaid' && dan.bestBid === 2)
  const quiet = SB.newGame(); const qan = SB.analyseTurn(SB.clone(quiet), [{ f: 17, t: 12, bid: 0 }, { f: 7, t: 12, bid: 0 }], 0)
  check('opening position, quiet moves: going first is worth 0 and the equilibrium bid is 0', qan.worth === 0 && qan.eq.hi === 0)
  check('solver speed: ' + dan.size.join('×') + ' matrix in ' + dms + ' ms', dms < 1500)
  const sym = SB.analyseTurn(SB.clone(duel), dord, 1)
  check('the report is written for either seat (Black sees the same game, mirrored)', sym.decisive && sym.mine === 1 && sym.theirs === 3 && sym.verdict !== undefined)
  // audit: across real games, is a bid a decision or a ritual?
  function sbAudit(label, aKey, bKey, n, opts) {
    const acc = { turns: 0, collide: 0, decisive: 0, eqMean: [], eqMeanCollide: [], regret: [], verdict: { sharp: 0, overpaid: 0, underbid: 0 }, paidOnQuiet: 0, quiet: 0, ms: [] }
    const per = [{ turns: 0, over: 0, under: 0, sharp: 0, regret: [] }, { turns: 0, over: 0, under: 0, sharp: 0, regret: [] }]
    for (let i = 0; i < n; i++) {
      const flip = i & 1, keys = flip ? [bKey, aKey] : [aKey, bKey]
      const st = SB.newGame(opts), rng = HB.mulberry32(9000 + i)
      let guard = 0
      while (!st.over && guard++ < 40) {
        const o = [SB.bots[keys[0]].choose(st, 0, rng), SB.bots[keys[1]].choose(st, 1, rng)]
        const pre = SB.clone(st), coin = rng() < 0.5 ? 1 : 0
                for (const side of [0, 1]) {
          const an = SB.analyseTurn(pre, o, side), k = flip ? 1 - side : side
          per[k].turns++; if (!an.decisive) per[k].regret.push(an.regret); per[k][an.verdict === 'sharp' ? 'sharp' : an.verdict === 'overpaid' ? 'over' : 'under']++
          if (side === 0) { acc.turns++; const c = Math.abs(an.worth) >= 0.5; if (c) { acc.collide++; acc.eqMeanCollide.push(an.eq.mean) } if (an.decisive) acc.decisive++; acc.eqMean.push(an.eq.mean) }
        }
        SB.resolve(st, o, coin)
      }
    }
    console.log(`  ${label.padEnd(26)} turns ${String(acc.turns).padStart(4)} | going first matters (|worth| ≥ 0.5): ${pct(acc.collide, acc.turns).padStart(4)}, decides the game: ${pct(acc.decisive, acc.turns).padStart(3)} | equilibrium mean bid: all turns ${f1(avg(acc.eqMean))}, collision turns ${f1(avg(acc.eqMeanCollide))}`)
    for (const [k, key] of [[0, aKey], [1, bKey]]) { if (k && aKey === bKey) break; const q = aKey === bKey ? { turns: per[0].turns + per[1].turns, sharp: per[0].sharp + per[1].sharp, over: per[0].over + per[1].over, under: per[0].under + per[1].under, regret: per[0].regret.concat(per[1].regret) } : per[k]; console.log(`      ${(key + (aKey === bKey ? ' (both)' : '')).padEnd(16)} sharp ${pct(q.sharp, q.turns).padStart(4)} overpaid ${pct(q.over, q.turns).padStart(4)} underbid ${pct(q.under, q.turns).padStart(4)} | hindsight regret ${f1(avg(q.regret))} material per turn (king turns excluded)`) }
  }
  const NA = quick ? 3 : 24
  console.log(' audit of real games (' + NA + ' games per row, both seats analysed on every turn):')
  sbAudit('economist mirror', 'economist', 'economist', NA)
  sbAudit('economist vs greedy', 'economist', 'greedy', NA)
  sbAudit('all-in vs economist', 'allin', 'economist', NA)
  console.log(' coin-value sensitivity (the one assumption: how many material one coin is worth), duel-free opening of a typical collision:')
  {
    const col = SB.newGame(); col.b = Array(25).fill(null); col.b[24] = 'K'; col.b[0] = 'k'; col.b[12] = 'R'; col.b[10] = 'r'; col.tr = [6, 6]
    for (const lam of [0.15, 0.5, 1.5]) { const a = SB.analyseTurn(SB.clone(col), [{ f: 12, t: 10, bid: 2 }, { f: 10, t: 12, bid: 1 }], 0, { coinValue: lam }); console.log(`    one coin = ${lam} material: going first worth ${f1(a.worth)}, equilibrium mix [${a.eq.lo}..${a.eq.hi}] mean ${f1(a.eq.mean)}, verdict ${a.verdict}`) }
  }
}

/* ───────────── 2. Cartel of Cartographers ───────────── */
function ccGame(seed, kinds, opts) {
  const st = CC.newGame(seed, opts), rng = HB.mulberry32(seed * 7 + 1)
  const bots = kinds.map((k) => CC.bots[k])
  let guard = 0
  const offered = { n: 0 }
  while (!st.over && guard++ < 400) {
    const s = st.mover
    if (!st.hands[s].length) { CC.skip(st); continue }
    // negotiation round: the mover's bot may table treaties; every named party may accept
    if (st.o.covenants) for (const offer of bots[s].offers(st, s)) {
      offered.n++
      const other = offer.find((c) => c.from !== s).from
      if (bots[other].accepts(st, other, offer)) CC.sign(st, offer)
    }
    if (st.o.covenants) for (const opt of bots[s].buyIns(st, s)) CC.buyIn(st, s, opt)
    const { m, forced } = bots[s].move(st, s, rng)
    if (!m) { CC.skip(st); continue }
    CC.apply(st, s, m, forced)
  }
  return { st, offered: offered.n }
}
function ccMatch(label, kinds, n, opts) {
  const wins = Array(kinds.length).fill(0), seatWins = Array(kinds.length).fill(0); let draws = 0
  const spread = [], merg = [], rem = [], signed = [], fm = [], broken = [], mins = [], best = [], buy = []
  const byKind = kinds.map(() => [])
  for (let i = 0; i < n; i++) {
    // rotate seats so no kind is always first
    const rot = i % kinds.length, ks = kinds.map((_, j) => kinds[(j + rot) % kinds.length])
    const { st } = ccGame(2000 + i, ks, opts)
    const w = CC.winner(st); if (w < 0) draws++; else { wins[(w + rot) % kinds.length]++; seatWins[w]++ }
    const keys = st.score.map((_, s) => CC.final(st, s)); spread.push(Math.max(...keys) - Math.min(...keys)); mins.push(avg(keys)); best.push(Math.max(...keys))
    keys.forEach((k, s) => byKind[(s + rot) % kinds.length].push(k))
    merg.push(st.stats.mergers); rem.push(st.stats.removed); signed.push(st.stats.signed); fm.push(st.stats.forceMajeure); broken.push(st.stats.broken); buy.push(st.stats.buyIns)
  }
  console.log(`  ${label.padEnd(30)} wins [${kinds.join(',')}] ${wins.map((w) => pct(w, n).padStart(4)).join('/')} draw ${pct(draws, n)} | by seat ${seatWins.map((w) => pct(w, n)).join('/')} | final ${f1(avg(mins))} (by kind ${byKind.map((a) => f1(avg(a))).join('/')}) best ${f1(avg(best))} spread ${f1(avg(spread))} | mergers ${f1(avg(merg))} unseated ${f1(avg(rem))} | treaties ${f1(avg(signed))} buy-ins ${f1(avg(buy))} broken ${f1(avg(broken))}`)
  return { wins, avgSigned: avg(signed), fm: avg(fm), final: avg(mins) }
}
const N2 = quick ? 12 : 120
if (want('cc')) {
console.log('\n# 2. Cartel of Cartographers (7×7, 3 seats, ' + N2 + ' games per row, seats rotate; defaults: hand 3, spoil +2, the 3 weakest colours count, buy-in 1 point)')
ccMatch('greedy ×3', ['greedy', 'greedy', 'greedy'], N2)
ccMatch('2 diplomats + greedy', ['diplomat', 'diplomat', 'greedy'], N2)
ccMatch('2 diplomats + joiner (buys in)', ['diplomat', 'diplomat', 'joiner'], N2)
ccMatch('diplomat ×3', ['diplomat', 'diplomat', 'diplomat'], N2)
ccMatch('2 diplomats, no covenants', ['diplomat', 'diplomat', 'greedy'], N2, { covenants: false })
console.log(' ablations, one lever at a time back to the first draft:')
ccMatch('first draft (hand 2, spoil 1, 2 weakest)', ['greedy', 'greedy', 'greedy'], N2, { hand: 2, spoil: 1, count: 2, buyIn: false })
ccMatch('+ hand 3 only', ['greedy', 'greedy', 'greedy'], N2, { hand: 3, spoil: 1, count: 2, buyIn: false })
ccMatch('+ hand 3, spoil 2 (no recount)', ['greedy', 'greedy', 'greedy'], N2, { count: 2 })
ccMatch('shipped, but spoil 1', ['greedy', 'greedy', 'greedy'], N2, { spoil: 1 })
ccMatch('shipped, but hand 2', ['greedy', 'greedy', 'greedy'], N2, { hand: 2 })
ccMatch('2 diplomats + joiner, no buy-in', ['diplomat', 'diplomat', 'joiner'], N2, { buyIn: false })
}

/* ───────────── 3. Lexicon Quarantine ───────────── */
function lqMatch(label, pk, ck, n, opts) {
  const r = { poet: 0, silenced: 0, rounds: 0, cross: 0, score: [], captured: [], lifted: [], rot: [], sheared: [], rounds_: [] }
  for (let i = 0; i < n; i++) {
    const rng = HB.mulberry32(i + 3)
    const st = LQ.play('s' + i, LQ.bots[pk], LQ.bots[ck], opts, rng)
    const w = st.over.winner
    if (w === 'poet') { r.poet++; if (st.over.reason === 'crossing') r.cross++ } else if (st.over.reason === 'silenced') r.silenced++; else r.rounds++
    r.score.push(st.score); r.captured.push(st.stats.captured); r.lifted.push(st.stats.lifted); r.rot.push(st.stats.rotations); r.sheared.push(st.stats.sheared); r.rounds_.push(st.round)
  }
  console.log(`  ${label.padEnd(30)} poet ${pct(r.poet, n).padStart(4)} (crossing ${pct(r.cross, n)}) | censor ${pct(n - r.poet, n).padStart(4)} (silenced ${pct(r.silenced, n)}, clock ${pct(r.rounds, n)}) | score ${f1(avg(r.score)).padStart(4)} rounds ${f1(avg(r.rounds_)).padStart(4)} ink-captured ${f1(avg(r.captured)).padStart(4)} stones-lifted ${f1(avg(r.lifted)).padStart(4)} rotations ${f1(avg(r.rot)).padStart(3)} sheared ${f1(avg(r.sheared)).padStart(3)}`)
  return r
}
const N3 = quick ? 12 : 60
if (want('lq')) {
console.log('\n# 3. Lexicon Quarantine (7×7, ' + N3 + ' seeds per row; defaults: target 60, 7 rounds, 2 actions, ink dies at ≤1 liberty, words must quote the ink, a turn of a 2×2 costs 1 action and severs ink from the body)')
for (const pk of ['poetGreedy', 'poetSafe', 'poetWary']) for (const ck of ['censorRandom', 'censorHunter', 'censorScrambler', 'censorDenier']) lqMatch(pk + ' vs ' + ck, pk, ck, N3)
console.log(' ablations (poetSafe vs censorDenier):')
lqMatch('v1 rules: no anchor, floor 0', 'poetSafe', 'censorDenier', N3, { anchor: false, libFloor: 0, rounds: 6, shear: false })
lqMatch('anchor only (floor 0)', 'poetSafe', 'censorDenier', N3, { libFloor: 0, rounds: 6, shear: false })
lqMatch('floor 2', 'poetSafe', 'censorDenier', N3, { libFloor: 2 })
lqMatch('1 action per turn', 'poetSafe', 'censorDenier', N3, { censorActions: 1 })
lqMatch('6 rounds', 'poetSafe', 'censorDenier', N3, { rounds: 6 })
lqMatch('8 rounds', 'poetSafe', 'censorDenier', N3, { rounds: 8 })
lqMatch('target 50', 'poetSafe', 'censorDenier', N3, { target: 50 })
console.log(' the rotation verb, one switch at a time (poetSafe vs censorDenier):')
lqMatch('stone-only (rotation removed)', 'poetSafe', 'censorDenier', N3, { rotCool: 99 })
lqMatch('turn moves things (v1 turn)', 'poetSafe', 'censorDenier', N3, { shear: false })
lqMatch('turn severs ink (shipped)', 'poetSafe', 'censorDenier', N3, {})
lqMatch('turn kills all stray ink in block', 'poetSafe', 'censorDenier', N3, { shear: 'all' })
lqMatch('shipped, but no jam (cool 1)', 'poetSafe', 'censorDenier', N3, { rotCool: 1 })
console.log(' does rotation earn its place? same Poet, same seeds, rotation on vs removed (95% interval on the gap):')
{
  const NP = quick ? 12 : 120
  const run = (pk, ck, opts) => { let w = 0, rot = 0, sh = 0; for (let i = 0; i < NP; i++) { const st = LQ.play('p' + i, LQ.bots[pk], LQ.bots[ck], opts, HB.mulberry32(i + 11)); if (st.over.winner === 'poet') w++; rot += st.stats.rotations; sh += st.stats.sheared } return { w: w / NP, rot: rot / NP, sh: sh / NP } }
  const row = (label, pk, ck, ck2) => {
    const a = run(pk, ck, {}), b = run(pk, ck2, { rotCool: 99 }), gap = b.w - a.w
    const ci = 1.96 * Math.sqrt((a.w * (1 - a.w) + b.w * (1 - b.w)) / NP)
    console.log(`  ${label.padEnd(36)} Poet wins ${pct(a.w, 1).padStart(4)} with rotation (${f1(a.rot)} turns, ${f1(a.sh)} cells severed/game) vs ${pct(b.w, 1).padStart(4)} without → rotation is worth ${(100 * gap).toFixed(0)} ± ${(100 * ci).toFixed(0)} points to the Censor`)
    return { gap, ci }
  }
  const lows = [
    row('Denier vs Careful Poet', 'poetSafe', 'censorDenier', 'censorDenier'),
    row('Denier vs Wary Poet', 'poetWary', 'censorDenier', 'censorDenier'),
    row('Scrambler vs Careful Poet (no rot = Hunter)', 'poetSafe', 'censorScrambler', 'censorHunter'),
    row('Scrambler vs Wary Poet (no rot = Hunter)', 'poetWary', 'censorScrambler', 'censorHunter'),
  ]
  if (quick) check('rotation helps the Censor in every pairing (sign only; --quick has too few seeds for an interval)', lows.every((x) => x.gap > 0))
  else check('rotation measurably helps the Censor: the lower end of the 95% interval is above zero for every pairing', lows.every((x) => x.gap - x.ci > 0))
}
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall protocol checks passed')
process.exit(failures ? 1 : 0)
