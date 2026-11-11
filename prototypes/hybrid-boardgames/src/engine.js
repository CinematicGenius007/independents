/*
 * Hybrid board games — one engine file, three rule sets.
 *
 * Plain JavaScript, no DOM, no network, no dependencies. The browser prototype
 * and the headless harness both load this exact file (build.mjs inlines it into
 * index.html), so a number the harness prints is a number the page obeys.
 *
 * Everything is a pure function of (seed, ordered moves). Nothing reads a clock
 * or Math.random; every tie-break is spelled out in ARCHITECTURE.md.
 */
const HB = (() => {
  'use strict'

  /* ────────────────────────────── utilities ────────────────────────────── */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function hashSeed(s) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    return h >>> 0
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
  function shuffle(rng, arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    return a
  }

  /* SHA-256, synchronous. WebCrypto is async-only, and a pure engine wants a pure hash.
     Round constants are derived, not typed, so there is no table to mistype. */
  const sha256 = (() => {
    const primes = []
    for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n)
    const frac = (x) => x - Math.floor(x)
    const K = primes.map((p) => Math.floor(frac(Math.cbrt(p)) * 4294967296) >>> 0)
    const H0 = primes.slice(0, 8).map((p) => Math.floor(frac(Math.sqrt(p)) * 4294967296) >>> 0)
    const rotr = (x, n) => (x >>> n) | (x << (32 - n))
    return function sha256(bytes) {
      const len = bytes.length
      const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6)
      padded.set(bytes); padded[len] = 0x80
      const dv = new DataView(padded.buffer)
      dv.setUint32(padded.length - 4, (len * 8) >>> 0); dv.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296))
      const h = H0.slice(); const w = new Uint32Array(64)
      for (let o = 0; o < padded.length; o += 64) {
        for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4)
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
        }
        let [a, b, c, d, e, f, g, hh] = h
        for (let i = 0; i < 64; i++) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
          const ch = (e & f) ^ (~e & g)
          const t1 = (hh + S1 + ch + K[i] + w[i]) | 0
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
          const mj = (a & b) ^ (a & c) ^ (b & c)
          const t2 = (S0 + mj) | 0
          hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0
        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0
      }
      const out = new Uint8Array(32); const odv = new DataView(out.buffer)
      h.forEach((v, i) => odv.setUint32(i * 4, v >>> 0))
      return out
    }
  })()
  const enc = (s) => new TextEncoder().encode(s)
  const cat = (...parts) => { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length } return o }
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('')
  function b64u(u8) { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
  function unb64u(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o }
  function ctEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0 }

  /* ═══════════════════════════════ 1. SHADOW BIDDING ═══════════════════════════════
     Gardner 5×5 minichess. Both sides write a move AND a bid in secret; the higher
     bid resolves first, the loser's move is then re-validated against the changed
     board and fizzles if it no longer exists. Pseudo-legal moves, king capture wins
     (there is no "check" in a simultaneous game — only a race). */
  const SB = {}
  SB.W = 5
  SB.VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
  SB.GLYPH = { P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔', p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
  const sideOf = (ch) => (!ch ? -1 : ch === ch.toUpperCase() ? 0 : 1)
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
  const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  SB.defaults = { mode: 'ledger', start: 5, income: 1, cap: 9, quietLimit: 30, turnLimit: 80, seal: 'every' }

  SB.newGame = (opts = {}) => {
    const o = Object.assign({}, SB.defaults, opts)
    // Gardner layout: black back rank on row 0, pawns on 1; white pawns on 3, back rank on 4.
    const board = Array(25).fill(null)
    'rnbqk'.split('').forEach((ch, i) => { board[i] = ch; board[20 + i] = ch.toUpperCase() })
    for (let i = 0; i < 5; i++) { board[5 + i] = 'p'; board[15 + i] = 'P' }
    return { b: board, tr: [o.start, o.start], pot: 0, turn: 0, quiet: 0, over: null, o, hist: [], bank: 0 }
  }
  SB.clone = (st) => ({ ...st, b: st.b.slice(), tr: st.tr.slice(), hist: st.hist.slice(), o: st.o })

  SB.movesFor = (b, side) => {
    const out = []
    for (let i = 0; i < 25; i++) {
      const ch = b[i]; if (!ch || sideOf(ch) !== side) continue
      const r = (i / 5) | 0, c = i % 5, t = ch.toLowerCase()
      const add = (rr, cc, capOnly, moveOnly) => {
        if (rr < 0 || rr > 4 || cc < 0 || cc > 4) return false
        const tt = b[rr * 5 + cc], ts = sideOf(tt)
        if (ts === side) return false
        if (capOnly && ts !== 1 - side) return false
        if (moveOnly && tt) return false
        out.push({ f: i, t: rr * 5 + cc }); return !tt
      }
      if (t === 'p') {
        const dr = side === 0 ? -1 : 1
        add(r + dr, c, false, true); add(r + dr, c - 1, true); add(r + dr, c + 1, true)
      } else if (t === 'n') KN.forEach(([dr, dc]) => add(r + dr, c + dc))
      else if (t === 'k') KG.forEach(([dr, dc]) => add(r + dr, c + dc))
      else {
        const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH)
        for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc } }
      }
    }
    return out
  }
  const material = (b, side) => { let s = 0; for (const ch of b) if (ch) s += (sideOf(ch) === side ? 1 : -1) * SB.VAL[ch.toLowerCase()]; return s }
  SB.material = material

  function exec(st, m, s) {
    const piece = st.b[m.f], target = st.b[m.t]
    st.b[m.f] = null
    let np = piece
    if (piece.toLowerCase() === 'p' && ((s === 0 && m.t < 5) || (s === 1 && m.t >= 20))) np = s === 0 ? 'Q' : 'q'
    st.b[m.t] = np
    const cap = target ? target.toLowerCase() : null
    if (cap || piece.toLowerCase() === 'p') st.quiet = 0
    return { piece, cap, promo: np !== piece }
  }

  /* One simultaneous turn. `o` = [orderWhite, orderBlack]; an order is {f,t,bid} or null (pass).
     `coin` (0|1) breaks an exact bid tie: 0 → White first, 1 → Black first. */
  SB.resolve = (st, o, coin) => {
    const ev = []
    const bids = [0, 1].map((s) => Math.max(0, Math.min(st.tr[s], Math.floor((o[s] && o[s].bid) || 0))))
    const first = bids[0] > bids[1] ? 0 : bids[1] > bids[0] ? 1 : coin ? 1 : 0
    const tie = bids[0] === bids[1]
    const pay = bids[first]
    st.tr[first] -= pay
    if (st.o.mode === 'ledger') st.tr[1 - first] += pay; else st.pot += pay
    st.quiet++
    ev.push({ kind: 'auction', bids, first, tie, pay })
    for (const s of [first, 1 - first]) {
      if (st.over) break
      const m = o[s]
      if (!m || m.f < 0) { ev.push({ kind: 'pass', s }); continue }
      const legal = SB.movesFor(st.b, s).some((x) => x.f === m.f && x.t === m.t)
      if (!legal) { ev.push({ kind: 'fizzle', s, m, second: s !== first }); continue }
      const r = exec(st, m, s)
      ev.push({ kind: 'move', s, m, ...r })
      if (r.cap && st.o.mode === 'pot' && st.pot) { ev.push({ kind: 'pot', s, amt: st.pot }); st.tr[s] += st.pot; st.pot = 0 }
      if (r.cap === 'k') st.over = { winner: s, reason: 'king' }
    }
    // treasury: income, then a hard vault limit (anti-snowball). Overflow is burned.
    for (let s = 0; s < 2; s++) st.tr[s] = Math.min(st.o.cap, st.tr[s] + st.o.income)
    st.turn++
    st.hist.push({ o: o.map((x) => (x ? { f: x.f, t: x.t, bid: x.bid | 0 } : null)), coin: tie ? coin : -1 })
    if (!st.over) {
      if (st.quiet >= st.o.quietLimit || st.turn >= st.o.turnLimit) {
        const d = material(st.b, 0)
        st.over = Math.abs(d) >= 2 ? { winner: d > 0 ? 0 : 1, reason: 'adjudicated' } : { winner: -1, reason: 'draw' }
      }
    }
    return ev
  }

  /* ---- bots ---- */
  const exposure = (b, to, side) => SB.movesFor(b, 1 - side).some((x) => x.t === to)
  function scoreMove(st, m, side, rng) {
    const b = st.b.slice(); const piece = b[m.f]
    const cap = b[m.t]; b[m.f] = null
    let np = piece
    if (piece.toLowerCase() === 'p' && ((side === 0 && m.t < 5) || (side === 1 && m.t >= 20))) np = side === 0 ? 'Q' : 'q'
    b[m.t] = np
    let sc = (cap ? SB.VAL[cap.toLowerCase()] : 0) + (np !== piece ? 8 : 0)
    if (exposure(b, m.t, side)) sc -= SB.VAL[np.toLowerCase()] * 0.9
    // forward / centre nudge so greedy is not a statue
    const r = (m.t / 5) | 0, c = m.t % 5
    sc += 0.05 * (2 - Math.abs(c - 2)) + (side === 0 ? (4 - r) : r) * 0.03 + rng() * 0.01
    return sc
  }
  SB.bots = {
    random: { name: 'Random', choose(st, side, rng) { const ms = SB.movesFor(st.b, side); return ms.length ? { ...pick(rng, ms), bid: 0 } : null } },
    greedy: {
      name: 'Greedy',
      choose(st, side, rng) {
        let best = null, bs = -1e9
        for (const m of SB.movesFor(st.b, side)) { const s = scoreMove(st, m, side, rng); if (s > bs) { bs = s; best = m } }
        return best && { ...best, bid: 0 }
      },
    },
    allin: {
      name: 'All-in',
      choose(st, side, rng) { const m = SB.bots.greedy.choose(st, side, rng); return m && { ...m, bid: st.tr[side] } },
    },
    economist: {
      name: 'Economist',
      choose(st, side, rng) {
        const ms = SB.movesFor(st.b, side); if (!ms.length) return null
        const opp = SB.bots.greedy.choose(st, 1 - side, () => 0.5)
        const k = st.o.mode === 'ledger' ? 0.5 : 0.8
        const c = st.o.mode === 'ledger' ? 2 : 1 // a ledger bid also enriches the rival
        let best = null, bv = -1e9
        for (const m of ms) {
          const base = scoreMove(st, m, side, rng)
          // value of each order against the opponent's predicted move
          const vOrder = (meFirst) => {
            const s2 = SB.clone(st); s2.over = null
            const seq = meFirst ? [[side, m], [1 - side, opp]] : [[1 - side, opp], [side, m]]
            let v = 0
            for (const [s, mv] of seq) {
              if (!mv || !SB.movesFor(s2.b, s).some((x) => x.f === mv.f && x.t === mv.t)) continue
              const cp = s2.b[mv.t]; if (cp) v += (s === side ? 1 : -1) * SB.VAL[cp.toLowerCase()]
              exec(s2, mv, s)
            }
            return v
          }
          const vF = vOrder(true), vS = vOrder(false)
          // what the rival gains by going first, and so roughly what an economist rival would bid
          const rivalGain = vF - vS // what I lose if they go first = same quantity
          const bo = rivalGain < -0.5 ? Math.min(st.tr[1 - side], Math.ceil(k * -rivalGain)) : 0
          const need = bo + 1
          const fallback = bo > 0 ? vS : 0.5 * (vF + vS)
          const payOpt = need <= st.tr[side] ? vF - c * need : -1e9
          const useBid = payOpt > fallback
          const v = base * 0.15 + (useBid ? payOpt : fallback)
          if (v > bv) { bv = v; best = { ...m, bid: useBid ? need : 0 } }
        }
        return best
      },
    },
  }

  /* ---- turn evaluator: a 1-ply payoff matrix solved by fictitious play ----
     The same technique apps/sealed-orders/src/engine/analysis.ts uses: both sides repeatedly best-respond
     to the other's history, and the empirical frequencies converge on an equilibrium of the zero-sum
     matrix. Rows are White's (move, bid), columns Black's. A cell is the material swing for White when
     that pair of sealed orders is resolved, plus `coinValue` per coin of treasury swing.

     Resolving every cell would be (moves × bids)² resolves. It is not needed: the board outcome depends
     only on (move, move, who goes first), so the board is resolved 2 × moves² times and the bids only
     decide *who* goes first and *what it costs*, which is arithmetic. */
  SB.fictitious = (matrix, rounds = 1500) => {
    const R = matrix.length, C = matrix[0].length
    const rc = new Array(R).fill(0), cc = new Array(C).fill(0), rp = new Array(R).fill(0), cp = new Array(C).fill(0)
    for (let t = 0; t < rounds; t++) {
      let br = 0; for (let i = 1; i < R; i++) if (rp[i] > rp[br]) br = i
      let bc = 0; for (let j = 1; j < C; j++) if (cp[j] < cp[bc]) bc = j
      rc[br]++; cc[bc]++
      for (let i = 0; i < R; i++) rp[i] += matrix[i][bc]
      for (let j = 0; j < C; j++) cp[j] += matrix[br][j]
    }
    const row = rc.map((x) => x / rounds), col = cc.map((x) => x / rounds)
    // value bracket: what the row mix guarantees (worst column) and what the column mix concedes (best row)
    let lo = Infinity, hi = -Infinity
    for (let j = 0; j < C; j++) { let v = 0; for (let i = 0; i < R; i++) v += row[i] * matrix[i][j]; if (v < lo) lo = v }
    for (let i = 0; i < R; i++) { let v = 0; for (let j = 0; j < C; j++) v += col[j] * matrix[i][j]; if (v > hi) hi = v }
    return { row, col, lo, hi, value: (lo + hi) / 2 }
  }
  SB.turnMatrix = (pre, opts = {}) => {
    const lam = opts.coinValue == null ? 0.5 : opts.coinValue
    const o = pre.o, mv = [0, 1].map((s) => [null, ...SB.movesFor(pre.b, s)]) // null = pass
    const mat0 = SB.material(pre.b, 0)
    // out[a][b][first] = { dm: material swing for White, caps: [side that captured, in order] }
    const out = mv[0].map((ma) => mv[1].map((mb) => [0, 1].map((first) => {
      const s2 = SB.clone(pre); s2.over = null; s2.pot = 0
      const ev = SB.resolve(s2, [ma ? { ...ma, bid: 0 } : null, mb ? { ...mb, bid: 0 } : null], first)
      return { dm: SB.material(s2.b, 0) - mat0, caps: ev.filter((e) => e.kind === 'move' && e.cap).map((e) => e.s), over: s2.over }
    })))
    const bidsOf = (s) => Array.from({ length: Math.min(pre.tr[s], 15) + 1 }, (_, b) => b)
    const bw = bidsOf(0), bb = bidsOf(1)
    const cell = (a, b, x, y) => { // White plays move a with bid x, Black move b with bid y
      const w = Math.min(x, pre.tr[0]), k = Math.min(y, pre.tr[1])
      const tie = w === k, firsts = tie ? [0, 1] : [w > k ? 0 : 1]
      let v = 0
      for (const first of firsts) {
        const p = first === 0 ? w : k, r = out[a][b][first], tr = pre.tr.slice()
        tr[first] -= p
        let pot = pre.pot
        if (o.mode === 'ledger') tr[1 - first] += p; else pot += p
        if (o.mode === 'pot' && r.caps.length && pot) { tr[r.caps[0]] += pot; pot = 0 }
        for (let s = 0; s < 2; s++) tr[s] = Math.min(o.cap, tr[s] + o.income)
        v += r.dm + lam * ((tr[0] - tr[1]) - (pre.tr[0] - pre.tr[1]))
      }
      return v / firsts.length
    }
    const rows = [], cols = []
    mv[0].forEach((m, a) => bw.forEach((x) => rows.push({ a, m, bid: x })))
    mv[1].forEach((m, b) => bb.forEach((y) => cols.push({ b, m, bid: y })))
    const matrix = rows.map((r) => cols.map((c) => cell(r.a, c.b, r.bid, c.bid)))
    return { rows, cols, matrix, mv, out, cell, lam }
  }
  /* analyse a resolved turn. `pre` is the position BEFORE it (clone it before SB.resolve), `orders` the
     two sealed orders as played, `side` the player the report is written for. */
  SB.analyseTurn = (pre, orders, side, opts = {}) => {
    const T = SB.turnMatrix(pre, opts), sg = side === 0 ? 1 : -1
    const idx = (s, ord) => T.mv[s].findIndex((m) => (!m && (!ord || ord.f < 0)) || (m && ord && m.f === ord.f && m.t === ord.t))
    const a = idx(0, orders[0]), b = idx(1, orders[1])
    const bidW = Math.min(orders[0] ? orders[0].bid | 0 : 0, pre.tr[0]), bidB = Math.min(orders[1] ? orders[1].bid | 0 : 0, pre.tr[1])
    const mine = side === 0 ? bidW : bidB, theirs = side === 0 ? bidB : bidW
    // what going first was worth for THIS pair of moves (material only, no coins)
    const o2 = T.out[a][b]
    const worth = sg * (o2[side].dm - o2[1 - side].dm)
    // equilibrium mixture over the whole matrix
    const eq = SB.fictitious(T.matrix, opts.rounds || 1500)
    const mixOf = (probs, list, n) => { const m = new Array(n + 1).fill(0); probs.forEach((p, i) => (m[list[i].bid] += p)); return m }
    const myMix = side === 0 ? mixOf(eq.row, T.rows, Math.min(pre.tr[0], 15)) : mixOf(eq.col, T.cols, Math.min(pre.tr[1], 15))
    const support = myMix.map((p, k) => [k, p]).filter(([, p]) => p >= 0.05).map(([k]) => k)
    const mean = myMix.reduce((x, p, k) => x + p * k, 0)
    // hindsight: with the same move, which bid would have been best against what the rival actually did?
    const my = side === 0 ? a : b, their = side === 0 ? b : a
    const mybids = Array.from({ length: Math.min(pre.tr[side], 15) + 1 }, (_, k) => k)
    const val = (k) => sg * (side === 0 ? T.cell(my, their, k, theirs) : T.cell(their, my, theirs, k))
    let bestK = 0, bestV = -1e9
    for (const k of mybids) { const v = val(k); if (v > bestV + 1e-9) { bestV = v; bestK = k } }
    const got = val(mine), regret = bestV - got
    const wentFirst = mine > theirs ? true : mine < theirs ? false : null
    let verdict, text
    const w = Math.abs(worth) < 0.005 ? 0 : worth
    const fw = SB.fmtWorth(w)
    if (regret < 0.05) {
      verdict = 'sharp'
      text = mine === 0 && w <= 0 ? 'No collision, no price: a bid of 0 was right.' : mine > theirs ? `Sharp: you bought the order for ${mine} when ${theirs + 1} would have done${mine === theirs + 1 ? ' (exactly the minimum)' : ''}.` : mine === 0 ? `Sharp: going first was not worth the price, so you did not pay.` : `Sharp read of their ${theirs}.`
    } else if (mine > bestK) {
      verdict = 'overpaid'
      text = w <= 0 ? `Overpaid: going first was worth nothing here, and you paid ${mine}.` : `Overpaid by ${mine - bestK}: ${bestK} was the best bid against their ${theirs}.`
    } else {
      verdict = 'underbid'
      text = `Underbid: against their ${theirs}, ${bestK} would have won an order worth ${fw}.`
    }
    return { side, worth: w, decisive: Math.abs(w) >= 50, mine, theirs, wentFirst, tie: mine === theirs, bestBid: bestK, regret, verdict, text, eq: { mix: myMix, support, lo: support[0], hi: support[support.length - 1], mean, value: sg * eq.value, gap: eq.hi - eq.lo }, size: [T.rows.length, T.cols.length], coinValue: T.lam }
  }
  SB.fmtWorth = (w) => (Math.abs(w) >= 50 ? (w > 0 ? 'the game (a king)' : 'losing the game (a king)') : `${w >= 0 ? '+' : '−'}${Math.abs(w).toFixed(1)} material`)
  SB.explainTurn = (an) => `Going first on this turn was worth ${SB.fmtWorth(an.worth)}; equilibrium bid mix was [${an.eq.lo}..${an.eq.hi}] coins (mean ${an.eq.mean.toFixed(1)}). You bid ${an.mine}, they bid ${an.theirs}. ${an.text}`

  /* ---- stateless link codec ----
     bytes: ver(1) flags(1) matchId(4) start(1) cap(1) n(2) | n×4 history | chain(8) | pending(1+...) */
  SB.packOrder = (o) => (((o && o.f >= 0 ? o.f : 31) & 31) << 9) | (((o && o.t >= 0 ? o.t : 31) & 31) << 4) | (((o && o.bid) || 0) & 15)
  SB.unpackOrder = (v) => { const f = (v >> 9) & 31, t = (v >> 4) & 31, bid = v & 15; return f === 31 ? { f: -1, t: -1, bid } : { f, t, bid } }
  SB.commitOf = (matchId, turn, side, order, nonce) =>
    sha256(cat(enc('sb1|'), matchId, enc('|' + turn + '|' + side + '|'), Uint8Array.of(SB.packOrder(order) >> 8, SB.packOrder(order) & 255), nonce)).slice(0, 16)
  /* The tie coin mixes the sealer's nonce with the opener's *plain* order, so neither
     side can grind it: the sealer cannot know the opener's order when picking a nonce,
     and the opener cannot know the nonce when picking an order. */
  SB.coinOf = (commit, openerOrder, nonce) =>
    sha256(cat(enc('sb1:coin|'), commit, Uint8Array.of(SB.packOrder(openerOrder) >> 8, SB.packOrder(openerOrder) & 255), nonce))[0] & 1
  SB.chainStep = (prev, o, coin) => {
    const a = SB.packOrder(o[0]), b = SB.packOrder(o[1])
    return sha256(cat(prev, Uint8Array.of(a >> 8, a & 255, b >> 8, b & 255, coin < 0 ? 2 : coin))).slice(0, 8)
  }
  SB.chainStart = (matchId) => sha256(cat(enc('sb1:chain|'), matchId)).slice(0, 8)

  SB.encodeLink = ({ matchId, mode, start, cap, hist, pending }) => {
    const n = hist.length
    const head = [1, mode === 'pot' ? 1 : 0, ...matchId, start, cap, n >> 8, n & 255]
    const body = []
    let chain = SB.chainStart(matchId)
    for (const h of hist) {
      const a = SB.packOrder(h.o[0]), b = SB.packOrder(h.o[1])
      body.push(a >> 8, a & 255, b >> 8, b & 255, h.coin < 0 ? 2 : h.coin)
      chain = SB.chainStep(chain, h.o, h.coin)
    }
    const tail = [...chain]
    if (!pending) tail.push(0)
    else if (pending.kind === 'sealed') tail.push(1, pending.side, ...pending.commit)
    else if (pending.kind === 'opened') { const v = SB.packOrder(pending.order); tail.push(2, pending.side, ...pending.commit, v >> 8, v & 255) }
    else if (pending.kind === 'reveal') { const v = SB.packOrder(pending.order); tail.push(3, pending.side, ...pending.commit, v >> 8, v & 255, ...pending.nonce) }
    return Uint8Array.from([...head, ...body, ...tail])
  }
  SB.decodeLink = (u8) => {
    if (u8[0] !== 1) throw new Error('unknown link version')
    const matchId = u8.slice(2, 6), start = u8[6], cap = u8[7], n = (u8[8] << 8) | u8[9]
    let p = 10; const hist = []
    for (let i = 0; i < n; i++) {
      hist.push({ o: [SB.unpackOrder((u8[p] << 8) | u8[p + 1]), SB.unpackOrder((u8[p + 2] << 8) | u8[p + 3])], coin: u8[p + 4] === 2 ? -1 : u8[p + 4] })
      p += 5
    }
    const chain = u8.slice(p, p + 8); p += 8
    let chk = SB.chainStart(matchId); for (const h of hist) chk = SB.chainStep(chk, h.o, h.coin)
    if (!ctEqual(chk, chain)) throw new Error('history chain broken')
    const kind = u8[p++]; let pending = null
    if (kind === 1) pending = { kind: 'sealed', side: u8[p], commit: u8.slice(p + 1, p + 17) }
    if (kind === 2) pending = { kind: 'opened', side: u8[p], commit: u8.slice(p + 1, p + 17), order: SB.unpackOrder((u8[p + 17] << 8) | u8[p + 18]) }
    if (kind === 3) pending = { kind: 'reveal', side: u8[p], commit: u8.slice(p + 1, p + 17), order: SB.unpackOrder((u8[p + 17] << 8) | u8[p + 18]), nonce: u8.slice(p + 19, p + 35) }
    return { matchId, mode: u8[1] & 1 ? 'pot' : 'ledger', start, cap, hist, pending, chain }
  }
  SB.replay = (link) => {
    const st = SB.newGame({ mode: link.mode, start: link.start, cap: link.cap })
    for (const h of link.hist) SB.resolve(st, h.o, h.coin < 0 ? 0 : h.coin)
    return st
  }

  /* ---- the link desk: a pure state machine for playing Shadow Bidding by pasting links ----
     Three hops a turn. The sealer (side = turn mod 2) commits; the opener answers in plain; the sealer
     reveals; the opener verifies and the next turn begins with the roles swapped. Nothing here touches
     the DOM or storage: the caller keeps `secrets` (a Map-like keyed by commit hex) and feeds links back in. */
  SB.LINK_TAG = 'sb1/'
  SB.parseLink = (text) => {
    let t = String(text || '').trim()
    const hash = t.indexOf('#'); if (hash >= 0) t = t.slice(hash + 1)
    if (t.startsWith(SB.LINK_TAG)) t = t.slice(SB.LINK_TAG.length)
    t = t.replace(/\s+/g, '')
    if (!t) throw new Error('nothing to read: paste a link')
    if (!/^[A-Za-z0-9_-]+$/.test(t)) throw new Error('that is not a Shadow Bidding link (it has characters a link never carries)')
    return SB.decodeLink(unb64u(t)) // throws 'history chain broken' / 'unknown link version'
  }
  SB.linkText = (link, base = '') => base + '#' + SB.LINK_TAG + b64u(SB.encodeLink(link))
  SB.deskBegin = (matchId, opts = {}) => ({ matchId, mode: opts.mode || 'ledger', start: opts.start == null ? 5 : opts.start, cap: opts.cap == null ? 9 : opts.cap, hist: [], pending: null })
  /* what the person holding this link must do next */
  SB.deskRole = (link) => {
    const st = SB.replay(link), turn = link.hist.length, p = link.pending
    if (st.over) return { kind: 'over', side: -1, turn, st }
    const sealer = turn % 2
    if (!p) return { kind: 'seal', side: sealer, turn, st }
    if (p.kind === 'sealed') return { kind: 'respond', side: 1 - p.side, turn, st }
    if (p.kind === 'opened') return { kind: 'reveal', side: p.side, turn, st }
    return { kind: 'verify', side: 1 - p.side, turn, st }
  }
  const orderOK = (st, side, o) => !o || o.f < 0 || SB.movesFor(st.b, side).some((m) => m.f === o.f && m.t === o.t)
  const norm = (o) => (o && o.f >= 0 ? { f: o.f, t: o.t, bid: o.bid | 0 } : { f: -1, t: -1, bid: (o && o.bid) | 0 })
  const bidOK = (st, side, o) => (o.bid | 0) >= 0 && (o.bid | 0) <= Math.min(15, st.tr[side])
  SB.deskSeal = (link, order, nonce) => {
    const r = SB.deskRole(link); if (r.kind !== 'seal') throw new Error('this link is not waiting for a seal')
    const o = norm(order)
    if (!orderOK(r.st, r.side, o)) throw new Error('that move is not legal for ' + (r.side ? 'Black' : 'White'))
    if (!bidOK(r.st, r.side, o)) throw new Error('the bid must be between 0 and the purse (' + r.st.tr[r.side] + ')')
    const commit = SB.commitOf(link.matchId, r.turn, r.side, o, nonce)
    return { link: { ...link, pending: { kind: 'sealed', side: r.side, commit } }, secret: { kind: 'seal', turn: r.turn, side: r.side, order: o, nonce: hex(nonce) } }
  }
  SB.deskRespond = (link, order) => {
    const r = SB.deskRole(link); if (r.kind !== 'respond') throw new Error('this link is not waiting for an answer')
    const o = norm(order)
    if (!orderOK(r.st, r.side, o)) throw new Error('that move is not legal for ' + (r.side ? 'Black' : 'White'))
    if (!bidOK(r.st, r.side, o)) throw new Error('the bid must be between 0 and the purse (' + r.st.tr[r.side] + ')')
    const p = link.pending
    return { link: { ...link, pending: { kind: 'opened', side: p.side, commit: p.commit, order: o } }, secret: { kind: 'open', turn: r.turn, side: r.side, order: o } }
  }
  const unhex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))
  const settle = (link, r, sealerOrder, openerOrder, nonce, commit) => {
    const sealerSide = link.pending.side
    const ord = sealerSide === 0 ? [sealerOrder, openerOrder] : [openerOrder, sealerOrder]
    const coin = SB.coinOf(commit, openerOrder, nonce)
    const pre = SB.clone(r.st), st = SB.clone(r.st)
    const ev = SB.resolve(st, ord, coin)
    return { pre, st, ev, orders: ord, coin, next: { matchId: link.matchId, mode: link.mode, start: link.start, cap: link.cap, hist: st.hist.slice(), pending: null } }
  }
  /* sealer, hop 3: needs the secret saved at hop 1. Returns the reveal link and the resolved turn. */
  SB.deskReveal = (link, secret) => {
    const r = SB.deskRole(link); if (r.kind !== 'reveal') throw new Error('this link is not waiting for a reveal')
    if (!secret || secret.kind !== 'seal' || secret.turn !== r.turn || secret.side !== r.side) throw new Error('this browser does not hold the nonce for that seal (it was made somewhere else)')
    const p = link.pending, nonce = unhex(secret.nonce)
    if (!ctEqual(SB.commitOf(link.matchId, r.turn, r.side, secret.order, nonce), p.commit)) throw new Error('the saved order does not match the sealed hash')
    const res = settle(link, r, secret.order, p.order, nonce, p.commit)
    return { ...res, link: { ...link, pending: { kind: 'reveal', side: p.side, commit: p.commit, order: secret.order, nonce } } }
  }
  /* opener, hop 4: checks the seal, then resolves. `openerOrder` is the one it sent at hop 2 (from its own
     saved secret, or read back out of link 2 if the person pastes that). */
  SB.deskVerify = (link, openerOrder) => {
    const r = SB.deskRole(link); if (r.kind !== 'verify') throw new Error('this link is not waiting for a verification')
    const p = link.pending
    const recomputed = SB.commitOf(link.matchId, r.turn, p.side, p.order, p.nonce)
    if (!ctEqual(recomputed, p.commit)) return { ok: false, why: 'SEAL BROKEN: the order in this link does not hash to the commitment sent earlier. The sealer changed their mind.', recomputed }
    if (!openerOrder) return { ok: false, need: 'opener', why: 'the seal is good, but this browser does not remember the answer you sent. Paste link 2 (the one you sent back) to supply it.', recomputed }
    const res = settle(link, r, p.order, norm(openerOrder), p.nonce, p.commit)
    return { ok: true, why: 'seal verified', recomputed, ...res }
  }
  /* read the opener's order back out of a pasted link 2 (the "opened" link carries it in plain) */
  SB.openerOrderFrom = (link2, commit) => (link2.pending && link2.pending.kind === 'opened' && ctEqual(link2.pending.commit, commit) ? link2.pending.order : null)

  /* ═══════════════════════════════ 2. CARTEL OF CARTOGRAPHERS ═══════════════════════════════
     Shared tile map (Carcassonne), directors that score from other people's tiles and
     fight hostile mergers (Tigris & Euphrates), and covenants — binding promises the
     engine enforces by deleting the moves that would break them (Sidereal Confluence). */
  const CC = {}
  CC.N = 7
  CC.COMM = ['Coal', 'Timber', 'Cattle', 'Grain']
  CC.defaults = { seats: 3, perComm: 12, hand: 3, maxCov: 2, maxLeft: 3, covenants: true, spoil: 2, buyIn: true, count: 3 }

  CC.newGame = (seed, opts = {}) => {
    const o = Object.assign({}, CC.defaults, opts)
    const rng = mulberry32(hashSeed('cc|' + seed))
    const bag = []
    for (let c = 0; c < 4; c++) for (let i = 0; i < o.perComm; i++) bag.push(c)
    const st = {
      o, seed, rng, bag: shuffle(rng, bag), tile: Array(49).fill(-1), dir: Array(49).fill(null),
      reserve: Array.from({ length: o.seats }, () => [true, true, true, true]),
      score: Array.from({ length: o.seats }, () => [0, 0, 0, 0]), hands: [], cov: [], covId: 1,
      turn: 0, mover: 0, over: false, log: [], stats: { mergers: 0, removed: 0, forceMajeure: 0, broken: 0, signed: 0, fed: 0, buyIns: 0 },
    }
    for (const x of [22, 23, 24]) st.tile[x] = st.bag.pop()
    for (let s = 0; s < o.seats; s++) st.hands.push([])
    for (let r = 0; r < o.hand; r++) for (let s = 0; s < o.seats; s++) if (st.bag.length) st.hands[s].push(st.bag.pop())
    return st
  }
  // rng cannot survive a deep copy, so clones share it; simulations never draw from it.
  CC.clone = (st) => ({
    ...st, tile: st.tile.slice(), dir: st.dir.map((d) => (d ? { ...d } : null)), reserve: st.reserve.map((r) => r.slice()),
    score: st.score.map((r) => r.slice()), hands: st.hands.map((h) => h.slice()), cov: st.cov.map((c) => ({ ...c })), bag: st.bag.slice(),
    log: [], stats: { ...st.stats },
  })
  const nbr = (i) => { const r = (i / 7) | 0, c = i % 7, o = []; if (r > 0) o.push(i - 7); if (r < 6) o.push(i + 7); if (c > 0) o.push(i - 1); if (c < 6) o.push(i + 1); return o }
  CC.nbr = nbr
  /* regions: array cell → region id, plus members */
  CC.regions = (st) => {
    const id = Array(49).fill(-1), members = []
    for (let i = 0; i < 49; i++) {
      if (st.tile[i] < 0 || id[i] >= 0) continue
      const k = members.length, stack = [i], cells = []; id[i] = k
      while (stack.length) { const x = stack.pop(); cells.push(x); for (const y of nbr(x)) if (st.tile[y] >= 0 && id[y] < 0) { id[y] = k; stack.push(y) } }
      members.push(cells)
    }
    return { id, members }
  }
  const dirIn = (st, cells, c) => { for (const x of cells) { const d = st.dir[x]; if (d && d.c === c) return x } return -1 }

  /* All legal (director?, hand index, cell) moves for `s`, after covenant filtering. */
  CC.rawMoves = (st, s) => {
    const { id, members } = CC.regions(st)
    const dirOpts = [null]
    for (let c = 0; c < 4; c++) {
      if (!st.reserve[s][c]) continue
      for (let x = 0; x < 49; x++) if (st.tile[x] === c && !st.dir[x] && dirIn(st, members[id[x]], c) < 0) dirOpts.push({ cell: x, c })
    }
    const cells = []
    for (let x = 0; x < 49; x++) if (st.tile[x] < 0) cells.push(x) // anywhere: a lone tile founds a new realm
    const out = []
    const seen = new Set()
    for (let h = 0; h < st.hands[s].length; h++) {
      const c = st.hands[s][h]; if (seen.has(c)) continue; seen.add(c)
      for (const d of dirOpts) for (const x of cells) out.push({ d, h, c, x })
      out.push({ d: null, h, c, x: -1 }) // discard
    }
    return out
  }
  /* what a covenant says about one move: 'ok' | 'violates' | 'fulfils' */
  function judge(st, cv, m, regs) {
    const { id, members } = regs
    const hasTo = (cells) => cells.some((x) => st.dir[x] && st.dir[x].p === cv.to)
    const touching = (x) => { const rs = new Set(); for (const y of nbr(x)) if (st.tile[y] >= 0) rs.add(id[y]); return [...rs] }
    if (cv.kind === 'embargo') {
      if (m.x >= 0 && touching(m.x).some((r) => hasTo(members[r]))) return 'violates'
      if (m.d && hasTo(members[id[m.d.cell]])) return 'violates'
      return 'ok'
    }
    if (cv.kind === 'nomerge') {
      if (m.x < 0) return 'ok'
      const rs = touching(m.x); if (rs.length >= 2 && rs.some((r) => hasTo(members[r]))) return 'violates'
      return 'ok'
    }
    if (cv.kind === 'feed') {
      if (m.x < 0 || m.c !== cv.c) return 'ok'
      for (const r of touching(m.x)) { const dx = dirIn(st, members[r], cv.c); if (dx >= 0 && st.dir[dx].p === cv.to) return 'fulfils' }
      return 'ok'
    }
    return 'ok'
  }
  CC.legalMoves = (st, s) => {
    const raw = CC.rawMoves(st, s); const mine = st.cov.filter((c) => c.from === s)
    if (!mine.length || !st.o.covenants) return { moves: raw, blocked: [], forced: false }
    const regs = CC.regions(st)
    let ok = raw.filter((m) => mine.every((cv) => judge(st, cv, m, regs) !== 'violates'))
    // a feed on its last turn must be honoured if any move can honour it
    for (const cv of mine) if (cv.kind === 'feed' && cv.left <= 1) {
      const f = ok.filter((m) => judge(st, cv, m, regs) === 'fulfils'); if (f.length) ok = f
    }
    const blocked = raw.filter((m) => !ok.includes(m))
    if (!ok.length) return { moves: raw, blocked: [], forced: true }
    return { moves: ok, blocked, forced: false }
  }

  /* Tigris & Euphrates counts only your weakest colour. With four colours and ~15 tiles a head
   that is nearly always zero (measured: 0.00), so the rule here counts the two weakest. */
  /* `count` weakest colours count (default 3: you drop only your best). With 2 the measured average final was 1.3. */
  const sortedAsc = (p) => p.slice().sort((x, y) => x - y)
  const weak = (p, n = 3) => { const a = sortedAsc(p); let v = 0; a.forEach((x, i) => (v += i < n ? x : 0.2 * x)); return v }
  const softmin = weak
  CC.value = (st, s) => weak(st.score[s], st.o.count)
  CC.final = (st, s) => sortedAsc(st.score[s]).slice(0, st.o.count).reduce((x, y) => x + y, 0)
  CC.finalKey = (st, s) => { const a = sortedAsc(st.score[s]); return CC.final(st, s) * 1000 + a.slice(st.o.count).reduce((x, y) => x + y, 0) }
  CC.winner = (st) => {
    let best = -1, bk = -1, tie = false
    for (let s = 0; s < st.o.seats; s++) { const k = CC.finalKey(st, s); if (k > bk) { bk = k; best = s; tie = false } else if (k === bk) tie = true }
    return tie ? -1 : best
  }

  /* Apply one move for `s`. Returns events for the UI. */
  CC.apply = (st, s, m, forced) => {
    const ev = []
    const regs0 = CC.regions(st)
    if (forced) {
      st.stats.forceMajeure++
      for (const cv of st.cov.filter((c) => c.from === s)) {
        if (judge(st, cv, m, regs0) === 'violates') {
          const low = st.score[cv.to].indexOf(Math.min(...st.score[cv.to])); st.score[cv.to][low]++
          st.stats.broken++; ev.push({ kind: 'damages', cv, c: low })
        }
      }
    }
    // feed honoured?
    const feedHits = st.cov.filter((cv) => cv.from === s && cv.kind === 'feed' && m.x >= 0 && judge(st, cv, m, regs0) === 'fulfils')
    if (m.d) { st.dir[m.d.cell] = { p: s, c: m.d.c, age: st.turn }; st.reserve[s][m.d.c] = false; ev.push({ kind: 'director', s, ...m.d }) }
    if (m.x < 0) {
      st.hands[s].splice(m.h, 1); ev.push({ kind: 'discard', s, c: m.c })
    } else {
      st.hands[s].splice(m.h, 1)
      const before = CC.regions(st)
      const touched = [...new Set(nbr(m.x).filter((y) => st.tile[y] >= 0).map((y) => before.id[y]))]
      st.tile[m.x] = m.c
      ev.push({ kind: 'tile', s, x: m.x, c: m.c })
      if (touched.length >= 2) {
        st.stats.mergers++
        for (let k = 0; k < 4; k++) {
          const ds = []
          for (const r of touched) { const dx = dirIn(st, before.members[r], k); if (dx >= 0) ds.push({ dx, n: before.members[r].filter((y) => st.tile[y] === k).length, age: st.dir[dx].age }) }
          if (ds.length < 2) continue
          ds.sort((a, b) => b.n - a.n || a.age - b.age) // bigger stock wins; tie → senior charter
          const win = ds[0]
          for (const l of ds.slice(1)) {
            const owner = st.dir[l.dx].p, wo = st.dir[win.dx].p
            st.reserve[owner][k] = true; st.dir[l.dx] = null; st.stats.removed++
            let spoil = false
            if (owner !== wo) { st.score[wo][k] += st.o.spoil; spoil = true }
            ev.push({ kind: 'merger', k, win: win.dx, lose: l.dx, loser: owner, winner: wo, spoil, wn: win.n, ln: l.n })
          }
        }
      }
      const after = CC.regions(st)
      const dx = dirIn(st, after.members[after.id[m.x]], m.c)
      if (dx >= 0) { const owner = st.dir[dx].p; st.score[owner][m.c]++; ev.push({ kind: 'score', owner, c: m.c, x: dx, self: owner === s }) }
    }
    for (const cv of feedHits) { st.cov = st.cov.filter((c) => c.id !== cv.id); st.stats.fed++; ev.push({ kind: 'fed', cv }) }
    // covenants age on the promiser's own turn
    for (const cv of st.cov.filter((c) => c.from === s)) {
      cv.left--
      if (cv.left <= 0) {
        st.cov = st.cov.filter((c) => c.id !== cv.id)
        if (cv.kind === 'feed') { st.score[cv.to][cv.c]++; st.stats.broken++; ev.push({ kind: 'damages', cv, c: cv.c }) } else ev.push({ kind: 'expired', cv })
      }
    }
    if (st.bag.length) st.hands[s].push(st.bag.pop())
    st.turn++; st.mover = (st.mover + 1) % st.o.seats
    if (st.hands.every((h) => !h.length)) st.over = true
    return ev
  }
  CC.skip = (st) => { st.mover = (st.mover + 1) % st.o.seats; st.turn++; if (st.hands.every((h) => !h.length)) st.over = true }

  CC.canSign = (st, cv) => {
    if (!st.o.covenants) return false
    if (cv.from === cv.to || cv.left < 1 || cv.left > st.o.maxLeft) return false
    return st.cov.filter((c) => c.from === cv.from).length < st.o.maxCov
  }
  CC.sign = (st, cvs) => {
    const sim = { cov: st.cov.slice(), o: st.o }
    for (const cv of cvs) { if (!CC.canSign(sim, cv)) return false; sim.cov.push({ ...cv, id: -1 }) }
    for (const cv of cvs) st.cov.push({ ...cv, id: st.covId++ })
    st.stats.signed++
    return true
  }
  /* Buy-in. Two seats have signed a mutual pair of the same kind (nomerge or embargo). A third seat may
     join it: it pays ONE point (taken from its lowest non-empty colour, so it costs a point of final score)
     and the pair becomes a triangle: the buyer and each member promise each other the same thing, for as
     many turns as the pair has left. Nobody can veto it, because the members already carry the same
     promise to each other. The point is burned. Without this, two signers shield each other and the
     third seat is the only one a hostile merger can reach. */
  CC.buyInOptions = (st, s) => {
    if (!st.o.covenants || !st.o.buyIn || st.score[s].every((v) => v <= 0)) return []
    const out = []
    for (const a of st.cov) {
      if (a.kind === 'feed' || a.from === s || a.to === s) continue
      const b = st.cov.find((x) => x.from === a.to && x.to === a.from && x.kind === a.kind)
      if (!b || a.from > a.to) continue // each pair once
      if (st.cov.some((x) => (x.from === s && (x.to === a.from || x.to === a.to)) || (x.to === s && (x.from === a.from || x.from === a.to)))) continue
      const left = Math.min(a.left, b.left)
      const offer = [a.from, a.to].flatMap((m) => [{ from: s, to: m, kind: a.kind, left }, { from: m, to: s, kind: a.kind, left }])
      if (!CC.canSignAll(st, offer)) continue
      out.push({ members: [a.from, a.to], kind: a.kind, left, offer })
    }
    return out
  }
  CC.canSignAll = (st, cvs) => {
    const sim = { cov: st.cov.slice(), o: st.o }
    for (const cv of cvs) { if (!CC.canSign(sim, cv)) return false; sim.cov.push({ ...cv, id: -1 }) }
    return true
  }
  CC.buyIn = (st, s, opt) => {
    if (!CC.buyInOptions(st, s).some((o) => o.members.join() === opt.members.join() && o.kind === opt.kind)) return false
    const low = st.score[s].map((v, k) => [v, k]).filter((x) => x[0] > 0).sort((x, y) => x[0] - y[0] || x[1] - y[1])[0][1]
    st.score[s][low]--
    for (const cv of opt.offer) st.cov.push({ ...cv, id: st.covId++ })
    st.stats.buyIns++; st.stats.signed++
    return true
  }
  CC.describe = (st, cv) => {
    const n = (p) => 'P' + (p + 1)
    if (cv.kind === 'embargo') return `${n(cv.from)} will not build beside ${n(cv.to)}'s kingdoms`
    if (cv.kind === 'nomerge') return `${n(cv.from)} will not merge any realm holding ${n(cv.to)}'s director`
    return `${n(cv.from)} will feed ${CC.COMM[cv.c]} into ${n(cv.to)}'s ${CC.COMM[cv.c]} realm`
  }

  /* conflict potential: do I hold a director that a hostile merger could unseat? */
  function conflictWith(st, s, t) {
    const { id, members } = CC.regions(st)
    for (let k = 0; k < 4; k++) {
      let mine = -1, theirs = -1
      members.forEach((cells, r) => { const dx = dirIn(st, cells, k); if (dx >= 0) { if (st.dir[dx].p === s) mine = r; if (st.dir[dx].p === t) theirs = r } })
      if (mine >= 0 && theirs >= 0 && mine !== theirs) {
        // is there an empty cell touching both?
        for (let x = 0; x < 49; x++) if (st.tile[x] < 0) { const rs = nbr(x).filter((y) => st.tile[y] >= 0).map((y) => id[y]); if (rs.includes(mine) && rs.includes(theirs)) return true }
      }
    }
    return false
  }
  CC.conflictWith = conflictWith

  function evalMove(st, s, m) {
    const sim = CC.clone(st)
    const before = sim.score.map((p) => softmin(p, st.o.count))
    CC.apply(sim, s, m, false)
    let v = softmin(sim.score[s], st.o.count) - before[s]
    let others = 0
    for (let t = 0; t < st.o.seats; t++) if (t !== s) others += softmin(sim.score[t], st.o.count) - before[t]
    v -= 0.55 * (others / (st.o.seats - 1))
    // a director of my weakest colour is worth planting; so is one in a big realm
    if (m.d) { const low = st.score[s].indexOf(Math.min(...st.score[s])); v += m.d.c === low ? 0.5 : 0.25 }
    // blocking: do not leave a hostile-merger square lying next to my directors
    return v
  }
  CC.bots = {
    greedy: {
      name: 'Greedy',
      move(st, s, rng) {
        const { moves, forced } = CC.legalMoves(st, s)
        let best = null, bv = -1e9
        for (const m of moves) { const v = evalMove(st, s, m) + rng() * 0.02 - (m.x < 0 ? 0.4 : 0); if (v > bv) { bv = v; best = m } }
        return { m: best, forced }
      },
      offers: () => [], accepts: () => false, buyIns: () => [],
    },
    diplomat: {
      name: 'Diplomat',
      move(st, s, rng) { return CC.bots.greedy.move(st, s, rng) },
      offers(st, s) {
        const out = []
        if (!st.o.covenants) return out
        for (let t = 0; t < st.o.seats; t++) {
          if (t === s || !conflictWith(st, s, t)) continue
          if (st.cov.some((c) => c.from === s && c.to === t)) continue
          out.push([{ from: s, to: t, kind: 'nomerge', left: 2 }, { from: t, to: s, kind: 'nomerge', left: 2 }])
        }
        return out
      },
      accepts(st, s, offer) { return CC.canSign(st, offer.find((c) => c.from === s)) && conflictWith(st, s, offer.find((c) => c.to === s).from) },
      buyIns: () => [],
    },
    /* the excluded third seat: proposes nothing, signs nothing, but buys into a treaty that could reach it */
    joiner: {
      name: 'Joiner',
      move(st, s, rng) { return CC.bots.greedy.move(st, s, rng) },
      offers: () => [], accepts: () => false,
      buyIns(st, s) { return CC.buyInOptions(st, s).filter((o) => o.members.some((m) => conflictWith(st, s, m)) && CC.final(st, s) >= 1).slice(0, 1) },
    },
    /* a Diplomat that also buys into other people's treaties when a hostile merger could reach it */
    broker: {
      name: 'Broker',
      move(st, s, rng) { return CC.bots.greedy.move(st, s, rng) },
      offers(st, s) { return CC.bots.diplomat.offers(st, s) },
      accepts(st, s, offer) { return CC.bots.diplomat.accepts(st, s, offer) },
      buyIns(st, s) {
        return CC.buyInOptions(st, s).filter((o) => o.members.some((m) => conflictWith(st, s, m)) && CC.final(st, s) >= 1).slice(0, 1)
      },
    },
  }

  /* ═══════════════════════════════ 3. LEXICON QUARANTINE ═══════════════════════════════
     7×7 letters. The Poet traces Boggle chains (8-connected, no cell twice) and inks the
     cells. The Censor plays Go-like stones (4-connected liberties) and may rotate any
     2×2 block. Ink groups with no liberties are quarantined; stones that lose their
     liberties are lifted. */
  const LQ = {}
  LQ.N = 7
  LQ.defaults = { target: 60, rounds: 7, censorActions: 2, rotCool: 2, minLen: 3, anchor: true, libFloor: 1, shear: 'cut' }
  LQ.words = new Set(); LQ.trie = {}
  LQ.setWords = (list) => {
    LQ.words = new Set(list); LQ.trie = {}
    for (const w of list) { let n = LQ.trie; for (const ch of w) n = n[ch] || (n[ch] = {}); n.$ = 1 }
  }
  const LV = (ch) => ('eaiotnrsl'.includes(ch) ? 1 : 'dugcmhpb'.includes(ch) ? 2 : 3)
  LQ.value = LV
  const N8 = []; const N4 = []
  for (let i = 0; i < 49; i++) {
    const r = (i / 7) | 0, c = i % 7; N8[i] = []; N4[i] = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 6 || cc < 0 || cc > 6) continue
      N8[i].push(rr * 7 + cc); if (!dr || !dc) N4[i].push(rr * 7 + cc)
    }
  }
  LQ.N8 = N8; LQ.N4 = N4
  const FILL = 'eeeeeeaaaaaiiiiooooutnnnrrrsssllddgcmhpbfywkvj'
  LQ.newGame = (seed, opts = {}) => {
    const o = Object.assign({}, LQ.defaults, opts)
    for (let bump = 0; bump < 40; bump++) {
      const rng = mulberry32(hashSeed('lq|' + seed + '|' + bump))
      const ch = Array(49).fill(null)
      const list = [...LQ.words].filter((w) => w.length >= 4)
      let planted = 0
      for (let tries = 0; tries < 60 && planted < 6; tries++) {
        const w = pick(rng, list); let path = null
        for (let a = 0; a < 20 && !path; a++) {
          let cur = Math.floor(rng() * 49); if (ch[cur] && ch[cur] !== w[0]) continue
          const p = [cur]
          for (let i = 1; i < w.length; i++) {
            const nx = shuffle(rng, N8[cur]).find((x) => !p.includes(x) && (!ch[x] || ch[x] === w[i])); if (nx === undefined) { p.length = 0; break }
            p.push(nx); cur = nx
          }
          if (p.length === w.length) path = p
        }
        if (path) { path.forEach((x, i) => (ch[x] = w[i])); planted++ }
      }
      for (let i = 0; i < 49; i++) if (!ch[i]) ch[i] = pick(rng, FILL.split(''))
      const st = { o, seed, ch, own: Array(49).fill(0), pts: Array(49).fill(0), used: [], round: 0, score: 0, lastRot: -99, over: null, stats: { captured: 0, lifted: 0, rotations: 0, stones: 0, sheared: 0, shearedPts: 0 } }
      if (LQ.findWords(st).length >= 25) return st
    }
    throw new Error('no playable board for seed ' + seed)
  }
  LQ.clone = (st) => ({ ...st, ch: st.ch.slice(), own: st.own.slice(), pts: st.pts.slice(), used: st.used.slice(), stats: { ...st.stats } })

  LQ.findWords = (st) => {
    const out = [], used = new Set(st.used)
    const anchored = st.o.anchor && st.own.includes(1) // a poem grows from itself: later words must quote the ink
    const walk = (i, node, path, word) => {
      const nx = node[st.ch[i]]; if (!nx) return
      path.push(i); word += st.ch[i]
      if (nx.$ && word.length >= st.o.minLen && !used.has(word)) {
        let gain = 0; for (const x of path) if (st.own[x] === 0) gain += LV(st.ch[x])
        if (gain > 0 && (!anchored || path.some((x) => st.own[x] === 1))) out.push({ word, path: path.slice(), gain: gain + Math.max(0, word.length - 3) * 2 })
      }
      for (const j of N8[i]) if (!path.includes(j) && (st.own[j] === 0 || st.own[j] === 1)) walk(j, nx, path, word)
      path.pop()
    }
    for (let i = 0; i < 49; i++) if (st.own[i] === 0 || st.own[i] === 1) walk(i, LQ.trie, [], '')
    return out
  }
  /* Judge a hand-traced path (the human Poet's move). Returns {ok, why, mv}. */
  LQ.evalPath = (st, path) => {
    if (path.length < st.o.minLen) return { ok: false, why: 'at least ' + st.o.minLen + ' letters' }
    for (let i = 0; i < path.length; i++) {
      if (st.own[path[i]] > 1) return { ok: false, why: 'a blacked-out cell' }
      if (i && !N8[path[i - 1]].includes(path[i])) return { ok: false, why: 'cells must touch' }
    }
    const word = path.map((x) => st.ch[x]).join('')
    if (!LQ.words.has(word)) return { ok: false, why: '"' + word + '" is not in the lexicon' }
    if (st.used.includes(word)) return { ok: false, why: 'already typed' }
    let gain = 0; for (const x of path) if (st.own[x] === 0) gain += LV(st.ch[x])
    if (!gain) return { ok: false, why: 'no fresh cell' }
    if (st.o.anchor && st.own.includes(1) && !path.some((x) => st.own[x] === 1)) return { ok: false, why: 'must pass through your own ink' }
    const mv = { word, path: path.slice(), gain: gain + Math.max(0, word.length - 3) * 2 }
    if (!LQ.poetMove(st, mv).ok) return { ok: false, why: 'would leave your ink without air' }
    return { ok: true, mv }
  }
  /* groups of one owner, 4-connected; liberties = free (own 0) orthogonal neighbours */
  LQ.groups = (st, who) => {
    const seen = Array(49).fill(false), gs = []
    for (let i = 0; i < 49; i++) {
      if (st.own[i] !== who || seen[i]) continue
      const cells = [], libs = new Set(), stack = [i]; seen[i] = true
      while (stack.length) { const x = stack.pop(); cells.push(x); for (const y of N4[x]) { if (st.own[y] === 0) libs.add(y); else if (st.own[y] === who && !seen[y]) { seen[y] = true; stack.push(y) } } }
      gs.push({ cells, libs: libs.size })
    }
    return gs
  }
  function sweep(st, who) { // lift/capture every starved group of `who` (ink dies at libs <= libFloor; stones at 0)
    let n = 0
    const floor = who === 1 ? st.o.libFloor : 0
    for (const g of LQ.groups(st, who)) if (g.libs <= floor) {
      n += g.cells.length
      for (const x of g.cells) { if (who === 1) { st.score -= st.pts[x]; st.pts[x] = 0; st.own[x] = 3 } else st.own[x] = 0 }
    }
    return n
  }
  LQ.crossing = (st) => LQ.groups(st, 1).some((g) => g.cells.some((x) => x % 7 === 0) && g.cells.some((x) => x % 7 === 6))
  LQ.poetMove = (st, mv) => { // mv = a findWords entry; returns {ok, lifted} or {ok:false}
    const nst = LQ.clone(st); const fresh = []
    for (const x of mv.path) if (nst.own[x] === 0) { nst.own[x] = 1; nst.pts[x] = LV(nst.ch[x]); fresh.push(x) }
    nst.score += mv.gain
    const lifted = sweep(nst, 2)
    if (LQ.groups(nst, 1).some((g) => g.libs <= nst.o.libFloor && g.cells.some((x) => fresh.includes(x)))) return { ok: false }
    return { ok: true, st: nst, lifted, fresh }
  }
  LQ.commitPoet = (st, mv) => {
    const r = LQ.poetMove(st, mv); if (!r.ok) return false
    Object.assign(st, r.st); st.used.push(mv.word); st.stats.lifted += r.lifted
    st.lastWord = mv
    if (st.score >= st.o.target) st.over = { winner: 'poet', reason: 'score' }
    else if (LQ.crossing(st)) st.over = { winner: 'poet', reason: 'crossing' }
    return true
  }
  LQ.legalPoet = (st) => LQ.findWords(st).filter((w) => LQ.poetMove(st, w).ok)
  LQ.rotate = (st, tl) => {
    const a = tl, b = tl + 1, c = tl + 8, d = tl + 7 // tl, tr, br, bl
    for (const k of ['ch', 'own', 'pts']) { const t = st[k][d]; st[k][d] = st[k][c]; st[k][c] = st[k][b]; st[k][b] = st[k][a]; st[k][a] = t }
  }
  /* Shear. Ink has a main body: the biggest orthogonal group (ties: more points, then the lowest cell).
     When a block is turned, every inked cell inside that block that is not part of the main body
     afterwards is torn off: it turns to dead ink (own 3) and its points are lost. So a turn is a cut:
     it kills stray ink that sits in the block, and it kills whatever the turn itself severs from the
     body. Without `shear` the turn only moves things (v1 behaviour, which measured as no effect). */
  LQ.mainBody = (st) => {
    let best = null, bk = null
    for (const g of LQ.groups(st, 1)) {
      const pts = g.cells.reduce((a, x) => a + st.pts[x], 0), low = Math.min(...g.cells)
      const k = [g.cells.length, pts, -low]
      if (!bk || k[0] > bk[0] || (k[0] === bk[0] && (k[1] > bk[1] || (k[1] === bk[1] && k[2] > bk[2])))) { bk = k; best = g }
    }
    return new Set(best ? best.cells : [])
  }
  const blockOf = (tl) => [tl, tl + 1, tl + 7, tl + 8]
  /* for shear 'cut': the cells that WERE in the body before the turn, tracked to where they land */
  LQ.bodyAfterTurn = (st, tl) => {
    const body = LQ.mainBody(st), out = new Set(), b = blockOf(tl) // tl, tr, bl(tl+7), br(tl+8)
    const dest = { [tl]: tl + 1, [tl + 1]: tl + 8, [tl + 8]: tl + 7, [tl + 7]: tl } // clockwise
    for (const x of body) out.add(dest[x] !== undefined ? dest[x] : x)
    return out
  }
  LQ.shearBlock = (st, tl, was) => {
    const body = LQ.mainBody(st), torn = []
    for (const x of blockOf(tl)) if (st.own[x] === 1 && !body.has(x) && (st.o.shear !== 'cut' || !was || was.has(x))) { torn.push(x); st.score -= st.pts[x]; st.stats.shearedPts += st.pts[x]; st.pts[x] = 0; st.own[x] = 3 }
    st.stats.sheared += torn.length
    return torn
  }
  /* what a turn at `tl` would do, without doing it (the UI hatches these cells on hover) */
  LQ.previewRot = (st, tl) => {
    const s2 = LQ.clone(st); s2.stats = { ...st.stats }; LQ.rotate(s2, tl)
    if (!st.o.shear) return { torn: [], tornFrom: [], lost: 0 }
    const before = s2.score, torn = LQ.shearBlock(s2, tl, LQ.bodyAfterTurn(st, tl))
    const from = { [tl + 1]: tl, [tl + 8]: tl + 1, [tl + 7]: tl + 8, [tl]: tl + 7 } // where each landing square came from
    return { torn, tornFrom: torn.map((x) => from[x]), lost: before - s2.score }
  }
  LQ.canRotate = (st) => st.o.rotCool < 99 && st.round - st.lastRot >= st.o.rotCool // rotCool 99 = rotation removed (stone-only)
  LQ.censorActs = (st, rotLeft = true) => {
    const acts = []
    for (let i = 0; i < 49; i++) if (st.own[i] === 0) {
      // not suicidal: some liberty remains, or it captures
      acts.push({ k: 'stone', cell: i })
    }
    if (rotLeft && LQ.canRotate(st)) for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) acts.push({ k: 'rot', cell: r * 7 + c })
    return acts
  }
  LQ.censorApply = (st, act) => {
    if (act.k === 'rot') {
      const was = st.o.shear ? LQ.bodyAfterTurn(st, act.cell) : null
      LQ.rotate(st, act.cell); st.lastRot = st.round; st.stats.rotations++
      if (st.o.shear) LQ.shearBlock(st, act.cell, was)
    } else {
      if (st.own[act.cell] !== 0) return false
      st.own[act.cell] = 2; st.stats.stones++
    }
    const cap = sweep(st, 1); st.stats.captured += cap
    // a stone group left without liberties by its own placement is lifted too (no suicide)
    sweep(st, 2)
    return true
  }
  LQ.endRound = (st) => {
    st.round++
    if (!st.over && st.round >= st.o.rounds) st.over = { winner: 'censor', reason: 'rounds' }
  }
  LQ.silenced = (st) => LQ.legalPoet(st).length === 0

  /* bots */
  LQ.bots = {
    poetGreedy: { name: 'Greedy Poet', move(st) { const ws = LQ.legalPoet(st); ws.sort((a, b) => b.gain - a.gain || (a.word < b.word ? -1 : 1)); return ws[0] || null } },
    poetSafe: {
      name: 'Careful Poet',
      move(st) {
        const ws = LQ.legalPoet(st); let best = null, bv = -1e9
        for (const w of ws) {
          const r = LQ.poetMove(st, w); const gs = LQ.groups(r.st, 1)
          const minLib = gs.length ? Math.min(...gs.map((g) => g.libs)) : 9
          const totLib = gs.reduce((a, g) => a + g.libs, 0)
          const cols = r.st.own.map((o, i) => (o === 1 ? i % 7 : -1)).filter((c) => c >= 0)
          const span = cols.length ? Math.max(...cols) - Math.min(...cols) : 0
          const v = w.gain + 1.5 * Math.min(minLib, 4) + 0.15 * totLib + 0.5 * span + (w.word < 'm' ? 0.001 : 0)
          if (v > bv) { bv = v; best = w }
        }
        return best
      },
    },
    /* a Poet that knows a turn is a cut: it counts ink outside the main body as a liability */
    poetWary: {
      name: 'Wary Poet',
      move(st) {
        const ws = LQ.legalPoet(st); let best = null, bv = -1e9
        for (const w of ws) {
          const r = LQ.poetMove(st, w); const gs = LQ.groups(r.st, 1)
          const minLib = gs.length ? Math.min(...gs.map((g) => g.libs)) : 9
          const totLib = gs.reduce((a, g) => a + g.libs, 0)
          const body = LQ.mainBody(r.st); let loose = 0, looseVal = 0
          r.st.own.forEach((o, i) => { if (o === 1 && !body.has(i)) { loose++; looseVal += r.st.pts[i] } })
          const cols = r.st.own.map((o, i) => (o === 1 ? i % 7 : -1)).filter((c) => c >= 0)
          const span = cols.length ? Math.max(...cols) - Math.min(...cols) : 0
          const v = w.gain + 1.5 * Math.min(minLib, 4) + 0.15 * totLib + 0.5 * span - 0.25 * looseVal - 0.1 * loose + (w.word < 'm' ? 0.001 : 0)
          if (v > bv) { bv = v; best = w }
        }
        return best
      },
    },
    censorRandom: { name: 'Random Censor', actions(st, rng) { const out = []; for (let i = 0; i < st.o.censorActions; i++) { const a = LQ.censorActs(st, false); if (a.length) out.push(pick(rng, a)) } return out } },
    censorHunter: {
      name: 'Hunter Censor',
      actions(st, rng) {
        const sim = LQ.clone(st), out = []
        for (let n = 0; n < st.o.censorActions; n++) {
          const gs = LQ.groups(sim, 1).sort((a, b) => a.libs - b.libs)
          let cell = -1
          if (gs.length) { const libs = new Set(); for (const x of gs[0].cells) for (const y of N4[x]) if (sim.own[y] === 0) libs.add(y); cell = pick(rng, [...libs]) }
          if (cell < 0) { // no ink yet: seal off the richest letters
            const free = []; for (let i = 0; i < 49; i++) if (sim.own[i] === 0) free.push(i)
            free.sort((a, b) => LV(sim.ch[b]) - LV(sim.ch[a]) || a - b); cell = free[0]
          }
          const a = { k: 'stone', cell }; out.push(a); LQ.censorApply(sim, a)
        }
        return out
      },
    },
    censorDenier: {
      name: 'Denier Censor',
      /* one-ply denial: take the stone or rotation that most reduces the Poet's best word,
         with a bonus for stones that tighten an ink group's liberties (the Go threat). */
      actions(st, rng) {
        const sim = LQ.clone(st), out = []
        for (let n = 0; n < st.o.censorActions; n++) {
          let best = null, bv = 1e9
          const consider = (a) => {
            const s2 = LQ.clone(sim); if (!LQ.censorApply(s2, a)) return
            const ws = LQ.legalPoet(s2); let v = ws.length ? Math.max(...ws.map((w) => w.gain)) : 0
            const gs = LQ.groups(s2, 1); if (gs.length) v -= 2 * (4 - Math.min(4, Math.min(...gs.map((g) => g.libs))))
            v += (s2.score - sim.score) * 0.8 * -1 * -1 // captured ink lowers the score: reward it
            if (v < bv) { bv = v; best = a }
          }
          for (let i = 0; i < 49; i++) if (sim.own[i] === 0) consider({ k: 'stone', cell: i })
          if (LQ.canRotate(sim) && !out.some((a) => a.k === 'rot')) for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) consider({ k: 'rot', cell: r * 7 + c })
          if (!best) break
          out.push(best); LQ.censorApply(sim, best)
        }
        return out
      },
    },
    censorScrambler: {
      name: 'Scrambler Censor',
      actions(st, rng) {
        const sim = LQ.clone(st), out = []
        if (LQ.canRotate(st)) {
          let best = null, bv = 1e9
          for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
            const s2 = LQ.clone(sim); LQ.censorApply(s2, { k: 'rot', cell: r * 7 + c }) // through censorApply, so a shear counts
            const ws = LQ.findWords(s2); const v = (ws.length ? Math.max(...ws.map((w) => w.gain)) : 0) + (s2.score - sim.score) * 0.8
            if (v < bv) { bv = v; best = r * 7 + c }
          }
          const a = { k: 'rot', cell: best }; out.push(a); LQ.censorApply(sim, a)
        }
        while (out.length < st.o.censorActions) {
          const a = LQ.bots.censorHunter.actions({ ...sim, o: { ...sim.o, censorActions: 1 } }, rng)[0]; out.push(a); LQ.censorApply(sim, a)
        }
        return out
      },
    },
  }
  LQ.play = (seed, poet, censor, opts, rng) => {
    const st = LQ.newGame(seed, opts)
    while (!st.over) {
      const w = poet.move(st); if (!w) { st.over = { winner: 'censor', reason: 'silenced' }; break }
      LQ.commitPoet(st, w); if (st.over) break
      for (const a of censor.actions(st, rng)) LQ.censorApply(st, a)
      LQ.endRound(st)
    }
    return st
  }

  return { mulberry32, hashSeed, pick, shuffle, sha256, enc, cat, hex, b64u, unb64u, ctEqual, SB, CC, LQ }
})()
if (typeof module !== 'undefined') module.exports = HB
