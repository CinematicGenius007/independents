/* UI for the three tables. Everything the page does to a game goes through HB.SB / HB.CC / HB.LQ —
   the same functions the harness plays — so what you can click is exactly what the engine allows. */
(() => {
  'use strict'
  const { SB, CC, LQ } = HB

  /* ───────── tiny DOM kit ───────── */
  const NS = 'http://www.w3.org/2000/svg'
  function h(tag, props, ...kids) {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else if (v === true) el.setAttribute(k, '')
      else el.setAttribute(k, v)
    }
    add(el, kids); return el
  }
  function sv(tag, props, ...kids) {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(props || {})) if (v != null) el.setAttribute(k, v)
    add(el, kids); return el
  }
  function add(el, kids) { for (const k of kids.flat(9)) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))) } }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild) }
  let toastT = 0
  function toast(msg) {
    document.querySelectorAll('.toast').forEach((n) => n.remove())
    const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t)
    clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200)
  }
  const rnd16 = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return a }
  const sleep = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms))
  const stage = document.getElementById('stage')

  /* ───────── router ───────── */
  const TABS = [['overview', 'Overview'], ['cartel', 'Cartel of Cartographers'], ['shadow', 'Shadow Bidding'], ['lexicon', 'Lexicon Quarantine']]
  const ALIAS = { bidding: 'shadow', sb: 'shadow', cc: 'cartel', lq: 'lexicon', home: 'overview' } // old and short names still land
  const nav = document.querySelector('.tabs')
  const views = {}
  function go(name, focus) {
    document.body.dataset.table = name
    nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === name)))
    clear(stage); stage.append(views[name]())
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name)
    window.scrollTo(0, 0); if (focus) stage.focus()
  }
  for (const [k, label] of TABS) nav.append(h('button', { role: 'tab', 'data-t': k, 'aria-selected': 'false', onclick: () => go(k, true) }, label))
  /* #cartel · #shadow · #lexicon pick a table. #sb1/… is a sealed link: it opens Shadow Bidding with the link desk
     already reading it. (The fragment is never sent to a server, which is why the protocol lives there.) */
  function route() {
    const raw = location.hash.slice(1)
    if (raw.startsWith(SB.LINK_TAG)) {
      if (document.body.dataset.table !== 'shadow') go('shadow')
      history.replaceState(null, '', '#shadow')
      if (sb.deskOpen) sb.deskOpen('#' + raw)
      return
    }
    const k = ALIAS[raw] || raw
    if (views[k] && document.body.dataset.table !== k) go(k)
    else if (!views[k] && raw && document.body.dataset.table === 'overview') history.replaceState(null, '', '#overview')
  }
  addEventListener('hashchange', route)

  /* ═══════════════════════ OVERVIEW ═══════════════════════ */
  function lineage(parents, child, caption) {
    const W = 372, rowH = 38, H = parents.length * rowH + 14
    const s = sv('svg', { class: 'lineage', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': caption })
    const cy = H / 2
    parents.forEach((p, i) => {
      const y = 7 + i * rowH
      s.append(sv('rect', { class: 'box', x: 2, y, width: 118, height: rowH - 8, rx: 2 }))
      s.append(sv('text', { x: 10, y: y + 15, 'font-size': 12, 'font-weight': 600 }, p.name))
      s.append(sv('text', { class: 'lab', x: 10, y: y + 26 }, p.keeps))
      s.append(sv('path', { class: 'arr', d: `M120 ${y + (rowH - 8) / 2} C 190 ${y + (rowH - 8) / 2}, 180 ${cy}, 228 ${cy}` }))
    })
    s.append(sv('path', { class: 'arr', d: `M222 ${cy - 4} L230 ${cy} L222 ${cy + 4}` }))
    s.append(sv('rect', { class: 'hyb', x: 230, y: cy - 30, width: 140, height: 60, rx: 2 }))
    child.forEach((ln, i) => s.append(sv('text', { class: i ? 'lab hybs' : 'hybt', x: 238, y: cy - 10 + i * 14, 'font-size': i ? 9.5 : 12, style: i ? 'fill:var(--bg);opacity:.8' : '' }, ln)))
    return s
  }
  const MEASURED = {
    cartel: [['average final score, first draft → now', '1.2 → 5.9'], ['hostile mergers per game (greedy ×3)', '7.4'], ['directors unseated, no treaties → all-diplomat table', '7.6 → 0.0'], ['third seat wins vs two diplomats, no buy-in → buy-in', '50 % → 40 %']],
    bidding: [['Economist vs Greedy', '100 – 0'], ['Economist vs All-in', '66 – 35'], ['turns where going first is worth ≥ ½ a pawn', '≈ 35 %'], ['equilibrium bid on those turns (fictitious play)', '4.3 coins']],
    lexicon: [['Poet wins vs the Denier, rotation removed → rotation that cuts', '78 % → 43 %'], ['ink quarantined per game, v1 → final', '0.1 → 3.5'], ['cells a turn severs from the poem per game', '3.9'], ['games won by crossing the page (of 43 % won)', '25 %']],
  }
  views.overview = () => {
    const card = (key, tag, title, body, parents, child, cap, facts, label) =>
      h('article', { class: 'ov-card' }, h('div', { class: 'tag' }, tag), h('h2', {}, title), lineage(parents, child, cap), h('p', { class: 'cap' }, cap), h('p', {}, body),
        h('ul', { class: 'facts' }, facts.map(([a, b]) => h('li', {}, h('span', {}, a), h('b', {}, b)))), h('button', { class: 'go', onclick: () => go(key, true) }, label))
    return h('div', { class: 'ov' },
      h('h1', {}, 'Three games, each built from three old ones'),
      h('p', { class: 'lede' }, 'Every table below runs the real rules engine in this page. There is no server, no account and no database. Shadow Bidding can be played by two people entirely through pasted links whose contents are sealed by a hash (open the link desk on its table); Cartel and Lexicon are specified for WebRTC sync and played here against bots. Open #cartel, #shadow or #lexicon to land on a table.'),
      h('div', { class: 'ov-grid' },
        card('cartel', 'Three to four players · WebRTC', 'Cartel of Cartographers', 'A shared map where other people’s tiles feed your directors, a tile can start a hostile merger, and a promise you sign is enforced by deleting the moves that would break it.',
          [{ name: 'Carcassonne', keeps: 'shared tile map' }, { name: 'Tigris & Euphrates', keeps: 'hostile mergers' }, { name: 'Sidereal Confluence', keeps: 'binding promises' }], ['Covenants', 'a promise deletes moves', ''],
          'Each parent lends one rule. The new part is that the board itself enforces the promise.', MEASURED.cartel, 'Sit at the table'),
        card('shadow', 'Two players · links or WebRTC', 'Shadow Bidding', 'Chess where both sides write a move and a sealed bid at once. The higher bid moves first, so the second move may find its piece gone. Tempo has a price, and the price is hidden.',
          [{ name: 'Chess', keeps: 'no luck, spatial tactics' }, { name: 'Modern Art', keeps: 'closed-fist bids' }, { name: 'Diplomacy', keeps: 'simultaneous orders' }], ['Sealed tempo', 'bid = who moves first', ''],
          'The bid does not buy a move. It buys the order in which two moves collide.', MEASURED.bidding, 'Open the ledger'),
        card('lexicon', 'Two players · history in the link', 'Lexicon Quarantine', 'The Poet traces words through a 7×7 grid of letters and inks them. The Censor places stones and rotates blocks. Ink with one breath left is quarantined; stones with none are lifted; and turning a 2×2 block cuts off any ink it separates from the poem’s body.',
          [{ name: 'Boggle', keeps: 'word-chain tracing' }, { name: 'Go', keeps: 'liberties and capture' }], ['Quarantine', 'a poem needs air', ''],
          'Boggle sets the Poet’s verb, Go sets the Censor’s. They meet on the same 49 cells.', MEASURED.lexicon, 'Pick up the typewriter')),
      h('h3', {}, 'How to read these numbers'),
      h('div', { class: 'rules' },
        h('p', {}, 'Every figure comes from ', h('code', {}, 'node harness.mjs'), ', which plays bots against each other on the same engine file this page uses. Samples are 60 to 200 games, so differences under about eight points are noise.'),
        h('p', {}, 'The bots are not strong players. They are probes: a Greedy bot that never bids and an All-in bot that always does bracket what a human could do, and an Economist that reasons one step about its rival sits between them.'),
        h('p', {}, 'Several first-draft rules failed these probes and were changed before this page was drawn. ', h('a', { href: 'ARCHITECTURE.md' }, 'ARCHITECTURE.md'), ' records what broke and what replaced it.')))
  }

  /* ═══════════════════════ 1. CARTEL ═══════════════════════ */
  const CGLYPH = ['◆', '♣', '♉\uFE0E', '❋']
  const cc = { st: null, sel: null, dirMode: false, dpick: null, log: [], busy: false, fresh: -1, flash: new Set(), unseat: new Set(), offers: [], scenario: null, over: false, draft: { kind: 'nomerge', to: 1, left: 2, c: 0 } }
  function ccBots() { return [null, CC.bots.greedy, CC.bots.diplomat] }
  function ccNew(seed, scenario) {
    cc.seed = seed || 'cartel-' + (Math.random() * 1e6 | 0); cc.st = CC.newGame(cc.seed); cc.sel = null; cc.dirMode = false; cc.dpick = null; cc.log = []; cc.offers = []; cc.scenario = scenario || null; cc.fresh = -1; cc.flash = new Set(); cc.unseat = new Set(); cc.over = false
    if (!scenario) cc.log.push('Three tiles lie on the map. Seat a director, then lay a tile. Your directors score from anyone’s tiles.')
    if (scenario === 'merger' || scenario === 'peace') {
      const st = cc.st
      st.tile.fill(-1); st.dir.fill(null); st.reserve.forEach((r) => r.fill(true)); st.score.forEach((r) => r.fill(0))
      const put = (r, c, k) => (st.tile[r * 7 + c] = k)
      put(2, 0, 0); put(2, 1, 1); put(2, 2, 0)            // Rail P1: coal, timber, coal  (two coal)
      put(3, 2, 0)                                           // third coal, down the spur
      put(2, 4, 0); put(2, 5, 0)                            // Rail P2: two coal
      put(5, 5, 2); put(5, 6, 3)                            // a bystander realm
      st.dir[2 * 7 + 0] = { p: 0, c: 0, age: 0 }; st.reserve[0][0] = false
      st.dir[2 * 7 + 5] = { p: 1, c: 0, age: 1 }; st.reserve[1][0] = false
      st.dir[5 * 7 + 5] = { p: 2, c: 2, age: 2 }; st.reserve[2][2] = false
      st.score[0][0] = 1; st.score[1][0] = 1
      st.hands = [[0, 1], [0, 3], [2, 3]]; st.turn = 3; st.mover = 0
      if (scenario === 'peace') { CC.sign(st, [{ from: 0, to: 1, kind: 'nomerge', left: 3 }, { from: 1, to: 0, kind: 'nomerge', left: 3 }]); st.stats.signed = 0 }
      cc.log.push(scenario === 'merger'
        ? 'Lab: your Coal realm holds 3 coal tiles, P2’s holds 2. Square d3 joins them. Drop a Coal tile there.'
        : 'Lab: the same board, but both sides have signed a no-merge covenant. The joining square is now struck out.')
    }
  }
  function ccEnd() {
    if (cc.over) return
    const st = cc.st; cc.over = true
    const w = CC.winner(st); cc.log.push(w < 0 ? 'Register closed: a tie.' : `Register closed: P${w + 1} holds the senior certificate.`)
  }
  async function ccBotsTurn() {
    if (cc.busy) return; cc.busy = true
    const st = cc.st, bots = ccBots()
    while (!st.over && st.mover !== 0) {
      const s = st.mover; render()
      await sleep(600)
      if (!st.hands[s].length) { CC.skip(st); continue }
      // bots table treaties: ones that name the human wait for an answer, bot↔bot ones sign themselves
      for (const offer of bots[s].offers(st, s)) {
        const other = offer.find((c) => c.from !== s).from
        if (other === 0) { if (!cc.offers.some((o) => o.by === s)) cc.offers.push({ by: s, offer }) }
        else if (bots[other].accepts(st, other, offer)) { if (CC.sign(st, offer)) cc.log.push(`P${s + 1} & P${other + 1} sign: ${CC.describe(st, offer[0])}; ${CC.describe(st, offer[1])}.`) }
      }
      for (const opt of bots[s].buyIns(st, s)) if (CC.buyIn(st, s, opt)) cc.log.push(`P${s + 1} buys into the treaty of P${opt.members[0] + 1} & P${opt.members[1] + 1} for one point.`)
      const { m, forced } = bots[s].move(st, s, HB.mulberry32(st.turn * 31 + 7))
      if (!m) { CC.skip(st); continue }
      ccPlay(s, m, forced)
    }
    cc.busy = false
    if (st.over) ccEnd()
    cc.offers = cc.offers.filter((o) => o.by !== 0)
    render()
  }
  function ccPlay(s, m, forced) {
    const st = cc.st
    const ev = CC.apply(st, s, m, forced)
    cc.flash = new Set(); cc.unseat = new Set(); cc.fresh = m.x
    for (const e of ev) {
      const c = CC.COMM
      if (e.kind === 'tile') cc.log.push(`P${e.s + 1} lays ${c[e.c]} at ${'abcdefg'[e.x % 7]}${(e.x / 7 | 0) + 1}.`)
      if (e.kind === 'director') { cc.log.push(`P${e.s + 1} seats a ${c[e.c]} director.`); cc.flash.add(e.cell) }
      if (e.kind === 'score') cc.log.push(`  ${e.self ? 'P' + (e.owner + 1) + ' banks' : 'P' + (e.owner + 1) + ' is fed'} +1 ${c[e.c]}.`)
      if (e.kind === 'merger') { cc.log.push(`MERGER (${c[e.k]}): realm of ${e.wn} beats ${e.ln}. P${e.loser + 1}'s director is unseated${e.spoil ? `, P${e.winner + 1} takes +${st.o.spoil}.` : '.'}`); cc.unseat.add(e.lose) }
      if (e.kind === 'damages') cc.log.push('COVENANT BROKEN under duress: damages paid.')
      if (e.kind === 'fed') cc.log.push('Feed covenant honoured.')
      if (e.kind === 'expired') cc.log.push('A covenant expires.')
      if (e.kind === 'discard') cc.log.push(`P${e.s + 1} discards ${c[e.c]}.`)
    }
    if (st.over) ccEnd()
    return ev
  }
  function ccView(st) {
    const R = CC.regions(st), N = CC.N
    const cells = []
    const { moves, blocked, forced } = CC.legalMoves(st, 0)
    const mine = st.mover === 0 && !st.over && !cc.busy
    const sel = cc.sel != null ? st.hands[0][cc.sel] : null
    const dsel = cc.dpick
    const legal = new Set(), block = new Set(), dcells = new Set()
    if (mine) {
      const same = (m) => (dsel ? m.d && m.d.cell === dsel.cell : !m.d)
      if (cc.dirMode && !dsel) { moves.forEach((m) => m.d && dcells.add(m.d.cell)) }
      else if (sel != null) {
        moves.filter((m) => m.c === sel && m.x >= 0 && same(m)).forEach((m) => legal.add(m.x))
        blocked.filter((m) => m.c === sel && m.x >= 0 && same(m)).forEach((m) => block.add(m.x))
      }
    }
    for (let i = 0; i < 49; i++) {
      const k = st.tile[i], reg = R.id[i], d = st.dir[i]
      const cls = ['cell']
      if (legal.has(i)) cls.push('legal'); if (block.has(i)) cls.push('blocked'); if (dcells.has(i) || (dsel && dsel.cell === i)) cls.push('dpick')
      const kids = []
      if (k >= 0) {
        const nb = (j, ok) => (ok && st.tile[j] >= 0 && R.id[j] === reg)
        const r = i / N | 0, c = i % N
        const t = ['tile', 'c' + k]
        if (!nb(i - N, r > 0)) t.push('eT'); if (!nb(i + N, r < N - 1)) t.push('eB'); if (!nb(i - 1, c > 0)) t.push('eL'); if (!nb(i + 1, c < N - 1)) t.push('eR')
        if (cc.fresh === i) t.push('fresh')
        kids.push(h('span', { class: t.join(' ') }, h('span', { class: 'g' }, CGLYPH[k])))
        if (d) kids.push(h('span', { class: 'dir p' + d.p + (cc.flash.has(i) ? ' flash' : ''), title: `P${d.p + 1} · ${CC.COMM[d.c]} director` }, 'P' + (d.p + 1)))
      }
      if (cc.unseat.has(i)) kids.push(h('span', { class: 'unseat', 'aria-hidden': 'true' }, '✕'))
      const name = `${'abcdefg'[i % 7]}${(i / 7 | 0) + 1}`
      let title = name
      if (k >= 0) { const cnt = [0, 0, 0, 0]; R.members[reg].forEach((x) => cnt[st.tile[x]]++); title += ` · realm of ${R.members[reg].length}: ${cnt.map((n, q) => n + ' ' + CC.COMM[q]).join(', ')}` }
      if (block.has(i)) title += ' · struck out by a covenant'
      cells.push(h('button', { class: cls.join(' '), 'aria-label': title, title, onclick: () => ccClick(i) }, kids))
    }
    return { cells, forced, mine, moves }
  }
  function ccClick(i) {
    const st = cc.st; if (st.over || st.mover !== 0 || cc.busy) return
    const { moves, blocked, forced } = CC.legalMoves(st, 0)
    if (cc.dirMode && !cc.dpick) {
      const m = moves.find((m) => m.d && m.d.cell === i)
      if (m) { cc.dpick = m.d; render() } else toast('A director sits on a tile of its own colour, in a realm that has none of that colour yet.')
      return
    }
    if (cc.sel == null) return toast('Choose one of your tiles first.')
    const c = st.hands[0][cc.sel], same = (m) => (cc.dpick ? m.d && m.d.cell === cc.dpick.cell && m.d.c === cc.dpick.c : !m.d)
    let m = moves.find((m) => m.c === c && m.x === i && same(m))
    if (!m && blocked.some((b) => b.c === c && b.x === i && same(b))) return toast('A covenant you signed forbids that square. That is the point.')
    if (!m) return toast(st.tile[i] >= 0 ? 'That square is taken.' : 'Not a legal square for that choice.')
    ccPlay(0, m, forced); cc.sel = null; cc.dirMode = false; cc.dpick = null
    ccBotsTurn(); render()
  }
  function ccRegister(st) {
    const rows = [h('tr', {}, h('th', {}, 'Holder'), CC.COMM.map((n, k) => h('th', {}, h('span', { 'aria-hidden': 'true' }, CGLYPH[k] + ' '), n)), h('th', {}, 'Counts'))]
    for (let s = 0; s < 3; s++) {
      const weak = st.score[s].map((v, k) => [v, k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, st.o.count).map((x) => x[1])
      rows.push(h('tr', { class: s === 0 ? 'me' : '' }, h('td', {}, h('span', { class: 'who p' + s }), s === 0 ? 'You' : s === 1 ? 'P2 · greedy' : 'P3 · diplomat'),
        st.score[s].map((v, k) => h('td', { class: weak.includes(k) ? 'weak' : '' }, v)), h('td', { class: 'tot' }, CC.final(st, s))))
    }
    return h('table', { class: 'reg' }, rows)
  }
  views.cartel = () => {
    if (!cc.st) ccNew(null)
    const root = h('div', { class: 'table t-cartel' }); const wrap = h('div', { class: 'wrap' }); root.append(wrap)
    cc.render = () => {
      const st = cc.st, v = ccView(st); clear(wrap)
      const sel = cc.sel != null ? st.hands[0][cc.sel] : null
      const status = st.over ? 'The register is closed.' : cc.busy ? 'The other holders are laying their tiles…' : st.mover === 0 ? (cc.dirMode && !cc.dpick ? 'Choose a tile to seat your director on.' : sel == null ? 'Your turn. Pick a tile from your hand.' : 'Choose a square. Green is lawful, hatched is forbidden by your own covenants.') : '…'
      const myCov = st.cov.filter((c) => c.from === 0 || c.to === 0)
      wrap.append(
        h('div', { class: 'cert' }, h('div', { class: 'guil' }), ...['tl', 'tr', 'bl', 'br'].map((p) => rose(p)),
          h('div', { class: 'head' }, h('div', { class: 'no' }, 'Nº 000417 · SERIES OF 1873 · COMMON & PREFERRED'),
            h('h2', {}, 'Cartographers’ Pacific & Western Railway'), h('div', { class: 'sub' }, 'This certifies that the holder is entitled to such shares of the realms below as his directors can defend.'), h('div', { class: 'rule' })),
          cc.over && h('div', { class: 'stamp' }, CC.winner(st) === 0 ? 'Paid in full' : CC.winner(st) < 0 ? 'Deferred' : 'Cancelled'),
          h('div', { class: 'layout' },
            h('div', { class: 'board-wrap' }, h('div', { class: 'board', role: 'grid', 'aria-label': 'Seven by seven map' }, v.cells),
              h('div', { class: 'scn' }, h('button', { class: 'btn', onclick: () => { ccNew(null); render() } }, 'New map'),
                h('button', { class: 'btn' + (cc.scenario === 'merger' ? ' on' : ''), onclick: () => { ccNew('lab', 'merger'); render() } }, 'Lab · hostile merger'),
                h('button', { class: 'btn' + (cc.scenario === 'peace' ? ' on' : ''), onclick: () => { ccNew('lab', 'peace'); render() } }, 'Lab · same board, with a covenant')),
              h('p', { class: 'hint' }, status)),
            h('div', { class: 'side' },
              h('section', { class: 'panel' }, h('h3', {}, 'Share register'), ccRegister(st), h('p', { class: 'hint' }, 'Your ', h('b', {}, st.o.count === 3 ? 'three weakest' : 'two weakest'), ' colours count (shaded): you drop only your best. A director scores for its owner whenever ', h('b', {}, 'anyone'), ' lays its colour in the realm.')),
              h('section', { class: 'panel' }, h('h3', {}, 'Your hand'),
                h('div', { class: 'hand' }, st.hands[0].map((c, i) => h('button', { class: 'tilebtn c' + c, 'aria-pressed': String(cc.sel === i), 'aria-label': CC.COMM[c] + ' tile', title: CC.COMM[c], disabled: !v.mine, onclick: () => { cc.sel = cc.sel === i ? null : i; render() } }, CGLYPH[c])),
                  h('span', { class: 'hint' }, `bag ${st.bag.length}`)),
                h('div', { class: 'row' },
                  h('button', { class: 'btn' + (cc.dirMode ? ' on' : ''), disabled: !v.mine, onclick: () => { cc.dirMode = !cc.dirMode; cc.dpick = null; render() } }, cc.dpick ? 'Director chosen ✓' : cc.dirMode ? 'Cancel director' : 'Seat a director'),
                  h('button', { class: 'btn', disabled: !v.mine || cc.sel == null, onclick: () => { const c = st.hands[0][cc.sel]; ccPlay(0, { d: null, h: cc.sel, c, x: -1 }, false); cc.sel = null; ccBotsTurn(); render() } }, 'Discard')),
                v.forced && h('p', { class: 'hint' }, h('b', {}, 'Deadlock. '), 'Every move breaks a covenant, so the engine lets you through and pays damages.'),
                h('p', { class: 'hint' }, 'Directors: ', [0, 1, 2, 3].map((k) => h('span', { style: { opacity: st.reserve[0][k] ? 1 : .3, marginRight: '6px' } }, CGLYPH[k] + ' ' + CC.COMM[k][0])))),
              ccCovenants(st),
              h('section', { class: 'panel' }, h('h3', {}, 'Ledger tape'), h('div', { class: 'tape', role: 'log' }, cc.log.slice(-40).reverse().map((l) => h('div', { class: /MERGER|BROKEN/.test(l) ? 'war' : '' }, l)))))),
          h('div', { class: 'lessons' },
            h('div', { class: 'less' }, h('b', {}, 'Carcassonne'), 'One shared map. Tiles that touch form a realm, and a lone tile founds a new one.'),
            h('div', { class: 'less' }, h('b', {}, 'Tigris & Euphrates'), 'A tile that joins two realms holding the same colour of director starts a war. The bigger stock of that colour wins; the loser is unseated and the winner takes +2.'),
            h('div', { class: 'less' }, h('b', {}, 'Sidereal Confluence'), 'A covenant is a signed promise the engine enforces. Break it? You cannot. The hatched squares are the promise. A third seat can buy into a treaty between two others for one point.'))))
    }
    function render() { cc.render() }
    render()
    if (cc.st.mover !== 0 && !cc.busy && !cc.st.over) ccBotsTurn()
    return root
  }
  function render() { cc.render && cc.render() }
  function rose(pos) {
    const s = sv('svg', { class: 'rose ' + pos, viewBox: '-50 -50 100 100', 'aria-hidden': 'true' })
    for (let i = 0; i < 12; i++) s.append(sv('ellipse', { rx: 40, ry: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': .8, transform: `rotate(${i * 15})` }))
    for (const r of [44, 30, 18]) s.append(sv('circle', { r, fill: 'none', stroke: 'currentColor', 'stroke-width': .9, 'stroke-dasharray': r === 44 ? '1 2.2' : null }))
    return s
  }
  function ccCovenants(st) {
    const d = cc.draft
    const wrap = h('section', { class: 'panel' }, h('h3', {}, 'Covenants'))
    for (const o of cc.offers) {
      wrap.append(h('div', { class: 'cov' }, h('span', {}, `P${o.by + 1} proposes: ${CC.describe(st, o.offer[0])}; and ${CC.describe(st, o.offer[1])}.`),
        h('span', {}, h('button', { class: 'btn seal', onclick: () => { if (CC.sign(st, o.offer)) { cc.log.push('You sign: ' + CC.describe(st, o.offer[0]) + '.'); toast('Signed. It cannot be unsigned.') } else toast('Cap reached: two covenants per promiser.'); cc.offers = cc.offers.filter((x) => x !== o); render() } }, 'Sign'), ' ',
          h('button', { class: 'btn', onclick: () => { cc.offers = cc.offers.filter((x) => x !== o); render() } }, 'Decline'))))
    }
    if (!st.cov.length && !cc.offers.length) wrap.append(h('p', { class: 'hint' }, 'None in force.'))
    st.cov.forEach((cv) => wrap.append(h('div', { class: 'cov' }, h('span', {}, CC.describe(st, cv)), h('i', {}, cv.left + (cv.left === 1 ? ' turn' : ' turns') + ' left'))))
    // a treaty between two OTHER seats can be joined for one point: you promise each of them what they promised each other
    const buy = st.mover === 0 && !st.over && !cc.busy ? CC.buyInOptions(st, 0) : []
    for (const opt of buy) {
      const kind = { nomerge: 'no-merge', embargo: 'embargo' }[opt.kind]
      wrap.append(h('div', { class: 'cov buyin' }, h('span', {}, `P${opt.members[0] + 1} and P${opt.members[1] + 1} hold a ${kind} treaty for ${opt.left} more turn${opt.left === 1 ? '' : 's'}. Join it: they keep their word to you, you keep yours to them.`),
        h('span', {}, h('button', { class: 'btn seal', onclick: () => { if (CC.buyIn(st, 0, opt)) { cc.log.push(`You buy into the treaty of P${opt.members[0] + 1} & P${opt.members[1] + 1} for one point.`); toast('Bought in. One point paid from your weakest colour.') } else toast('You cannot buy in now.'); render() } }, 'Buy in · 1 point'))))
    }
    if (!buy.length && st.cov.some((c) => c.from !== 0 && c.to !== 0) && st.o.buyIn) wrap.append(h('p', { class: 'hint' }, 'Treaty between the others: you can buy in for one point once you hold a point and both of them have room for another covenant.'))
    const sel = (opts, val, on) => h('select', { onchange: (e) => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)))
    wrap.append(h('div', { class: 'row' },
      sel([['nomerge', 'will not merge'], ['embargo', 'will not build beside'], ['feed', 'will feed']], d.kind, (v) => { d.kind = v; render() }),
      sel([[1, 'P2'], [2, 'P3']], d.to, (v) => { d.to = +v; render() }),
      d.kind === 'feed' && sel(CC.COMM.map((n, i) => [i, n]), d.c, (v) => { d.c = +v }),
      sel([[1, '1 turn'], [2, '2 turns'], [3, '3 turns']], d.left, (v) => { d.left = +v })))
    wrap.append(h('div', { class: 'row' }, h('button', { class: 'btn', disabled: cc.busy || st.mover !== 0 || st.over, onclick: () => ccPropose() }, 'Propose mutual treaty')))
    wrap.append(h('p', { class: 'hint' }, 'A treaty binds both sides the same way. Only the diplomat (P3) will sign; the greedy bot never does.'))
    return wrap
  }
  function ccPropose() {
    const st = cc.st, d = cc.draft, bots = ccBots()
    const offer = [{ from: 0, to: d.to, kind: d.kind, c: d.c, left: d.left }, { from: d.to, to: 0, kind: d.kind === 'feed' ? 'nomerge' : d.kind, c: d.c, left: d.left }]
    if (!CC.canSign(st, offer[0])) return toast('You already carry two covenants.')
    if (bots[d.to].accepts(st, d.to, offer)) { CC.sign(st, offer); cc.log.push('Treaty signed with P' + (d.to + 1) + ': ' + CC.describe(st, offer[0]) + '; ' + CC.describe(st, offer[1]) + '.'); toast('P' + (d.to + 1) + ' signs.') }
    else toast(d.to === 1 ? 'P2 (greedy) never signs anything.' : 'P3 sees no conflict worth a treaty and declines.')
    render()
  }

  /* ═══════════════════════ 2. SHADOW BIDDING ═══════════════════════ */
  const sb = { st: null, bot: 'economist', mode: 'ledger', from: null, to: null, bid: 0, log: [], last: null, lab: null, seed: 1, matchId: null, busy: false, scenario: null, auction: null, audit: null }
  const sqn = (i) => 'abcde'[i % 5] + (5 - ((i / 5) | 0))
  function sbNew(scenario) {
    sb.st = SB.newGame({ mode: sb.mode }); sb.from = sb.to = null; sb.bid = 0; sb.log = []; sb.last = null; sb.lab = null; sb.auction = null; sb.audit = null; sb.scenario = scenario || null
    sb.matchId = rnd16().slice(0, 4); sb.seed = (Math.random() * 1e9) | 0
    if (scenario === 'duel') {
      const b = Array(25).fill(null)
      b[24] = 'K'; b[2] = 'Q'; b[0] = 'k'; b[20] = 'r'; b[12] = 'P'; b[7] = 'p'
      sb.st.b = b
      sb.log.push({ n: '', text: 'Sudden death. Your queen on c5 attacks their king on a5, and their rook on a1 attacks your king on e1. Whoever strikes first wins. The bid is the only argument.' })
    }
  }
  const isCap = (st, m) => !!st.b[m.t]
  function sbMyMoves() { return SB.movesFor(sb.st.b, 0) }
  views.shadow = () => {
    if (!sb.st) sbNew()
    const root = h('div', { class: 'table t-bid' }), wrap = h('div', { class: 'wrap' }); root.append(wrap)
    sb.render = () => {
      clear(wrap); const st = sb.st
      const moves = sbMyMoves(), targets = sb.from != null ? moves.filter((m) => m.f === sb.from) : []
      const board = h('div', { class: 'board', role: 'grid', 'aria-label': 'Five by five board' })
      for (let r = 0; r < 5; r++) {
        board.append(h('div', { class: 'coord' }, 5 - r))
        for (let c = 0; c < 5; c++) {
          const i = r * 5 + c, pc = st.b[i]; const cls = ['sq']; if ((r + c) % 2) cls.push('dk')
          const t = targets.find((m) => m.t === i)
          if (sb.from === i) cls.push('sel'); if (t) cls.push('tgt'); if (t && pc) cls.push('cap')
          if (sb.to === i && sb.from != null) cls.push('chosen')
          if (sb.last && (sb.last.includes(i))) cls.push('last')
          board.append(h('button', { class: cls.join(' '), 'aria-label': sqn(i) + (pc ? ' ' + pc : ''), onclick: () => sbClick(i, moves) }, pc && h('span', { class: 'pc ' + (pc === pc.toUpperCase() ? 'w' : 'b') }, SB.GLYPH[pc])))
        }
      }
      board.append(h('div', { class: 'coord' }), ...'abcde'.split('').map((f) => h('div', { class: 'coord' }, f)))
      const me = st.tr[0], foe = st.tr[1], maxBid = Math.min(me, 15)
      const bot = SB.bots[sb.bot]
      wrap.append(h('div', { class: 'folio' },
        st.over && h('div', { class: 'over' }, st.over.winner === 0 ? 'Settled in your favour' : st.over.winner === 1 ? 'The house takes the table' : 'Books balanced · no decision'),
        h('h2', {}, 'Shadow Bidding'), h('p', { class: 'sub' }, 'Libro Mastro of the Counting-House · every turn, one sealed move and one sealed sum'),
        h('div', { class: 'layout' },
          h('div', {}, board,
            h('div', { class: 'scn', style: { marginLeft: 0 } },
              h('button', { class: 'tbtn', onclick: () => { sbNew(); sb.render() } }, 'New game'),
              h('button', { class: 'tbtn' + (sb.scenario === 'duel' ? ' on' : ''), onclick: () => { sbNew('duel'); sb.render() } }, 'Sudden death'),
              h('button', { class: 'tbtn desk-open', onclick: () => sb.deskOpen() }, '✉ Paste / inspect a sealed link'),
              h('span', { class: 'sub', style: { margin: 0 } }, 'Opponent:'),
              ['greedy', 'economist', 'allin'].map((k) => h('button', { class: 'tbtn' + (sb.bot === k ? ' on' : ''), onclick: () => { sb.bot = k; sb.render() } }, SB.bots[k].name)),
              h('span', { class: 'sub', style: { margin: 0 } }, 'Bids go to:'),
              [['ledger', 'rival’s purse'], ['pot', 'centre pot']].map(([k, l]) => h('button', { class: 'tbtn' + (sb.mode === k ? ' on' : ''), onclick: () => { sb.mode = k; sbNew(sb.scenario); sb.render() } }, l)))),
          h('div', { class: 'col' },
            h('div', {}, h('div', { class: 'lh' }, h('span', {}, 'Conto · treasuries'), h('span', {}, `turn ${st.turn + 1}`)),
              h('div', { class: 'acct' },
                h('div', {}, h('span', { class: 'hd' }, 'Avere · you (white)'), h('span', { class: 'big' }, me), purse(me, st.o.cap)),
                h('div', {}, h('span', { class: 'hd' }, `Dare · ${bot.name} (black)`), h('span', { class: 'big' }, foe), purse(foe, st.o.cap))),
              st.o.mode === 'pot' && h('p', { class: 'verdict' }, `Centre pot: ${st.pot} ducats, to whoever next captures.`)),
            sb.auction ? auctionView(sb.auction) : null,
            sb.audit ? auditView(sb.audit) : null,
            !st.over && h('div', { class: 'order' },
              h('div', { class: 'lh' }, h('span', {}, 'Your sealed order'), h('span', {}, `vault limit ${st.o.cap}`)),
              h('div', { class: 'line' }, 'Move: ', h('b', {}, sb.from != null && sb.to != null ? `${st.b[sb.from] ? SB.GLYPH[st.b[sb.from]] : ''} ${sqn(sb.from)} → ${sqn(sb.to)}` : sb.from != null ? `${sqn(sb.from)} → pick a square` : 'pick a piece, then a square')),
              h('div', { class: 'line' }, 'Bid: ', h('span', { class: 'step' }, h('button', { 'aria-label': 'lower bid', disabled: sb.bid <= 0, onclick: () => { sb.bid--; sb.render() } }, '−'), h('output', {}, sb.bid), h('button', { 'aria-label': 'raise bid', disabled: sb.bid >= maxBid, onclick: () => { sb.bid++; sb.render() } }, '+')), h('span', { class: 'sub', style: { margin: 0, fontSize: '13px' } }, st.o.mode === 'ledger' ? 'paid to your rival if you move first' : 'paid to the pot if you move first')),
              h('button', { class: 'wax', disabled: sb.busy || sb.to == null, onclick: () => sbSeal(false) }, 'Seal & reveal together'),
              h('div', { class: 'line' }, h('button', { class: 'tbtn', disabled: sb.busy, onclick: () => sbSeal(true) }, 'Pass the turn instead'))),
            h('div', {}, h('div', { class: 'lh' }, h('span', {}, 'Giornale · journal'), h('span', {}, 'move · dare · avere')),
              h('div', { class: 'entries', role: 'log' }, sb.log.slice().reverse().map((e) => e.n === '' ? h('div', { class: 'entry' }, h('span', { class: 'n' }, '·'), h('span', { style: { gridColumn: '2 / 5' } }, e.text)) : h('div', { class: 'entry' }, h('span', { class: 'n' }, e.n), h('span', { class: e.fz ? 'fz' : '' }, e.text), h('span', { class: 'd' }, e.d || ''), h('span', { class: 'a' }, e.a || ''))))),
            linkLab())),
        h('div', { class: 'lessons' },
          h('div', {}, h('b', {}, 'Chess'), 'Nothing is random. Two moves are chosen from the same position, so the second often no longer exists. A fizzled move is information, not bad luck.'),
          h('div', {}, h('b', {}, 'Modern Art'), 'The bid is a closed fist: you only learn what your rival paid after you paid yours. Coins are public; intent is not.'),
          h('div', {}, h('b', {}, 'Diplomacy'), 'Both orders are written before either is read, then resolved in a fixed order. The link protocol in this folio is what makes “before” checkable without a referee.'))))
    }
    sb.dlg = deskDialog(); root.append(sb.dlg)
    sb.render()
    return root
  }
  function purse(n, cap) { return h('div', { class: 'stack', 'aria-hidden': 'true' }, Array.from({ length: cap }, (_, i) => h('span', { class: 'duc' + (i < n ? '' : ' ghost') }))) }
  function auctionView(a) {
    return h('div', {}, h('div', { class: 'lh' }, h('span', {}, 'Asta · the opening of seals'), h('span', {}, a.tie ? 'tie → coin' : '')),
      h('div', { class: 'auction' }, h('div', { class: 'who' }, h('div', { class: 'seal broken' }, a.bids[0]), 'you'), h('div', { class: 'vs' }, 'vs'), h('div', { class: 'who' }, h('div', { class: 'seal broken' }, a.bids[1]), SB.bots[sb.bot].name)),
      h('p', { class: 'verdict' }, a.text))
  }
  function sbClick(i, moves) {
    const st = sb.st; if (st.over || sb.busy) return
    const pc = st.b[i]
    if (sb.from != null && moves.some((m) => m.f === sb.from && m.t === i)) { sb.to = i; sb.render(); return }
    if (pc && pc === pc.toUpperCase()) { sb.from = sb.from === i ? null : i; sb.to = null; sb.render() } else if (sb.from != null) toast('That piece cannot move there.')
  }
  const hx = (u8) => HB.hex(u8)
  async function sbSeal(pass) {
    const st = sb.st; if (st.over || sb.busy) return; sb.busy = true
    const mine = pass ? null : { f: sb.from, t: sb.to, bid: Math.min(sb.bid, st.tr[0]) }
    const rng = HB.mulberry32(sb.seed + st.turn * 977)
    const theirs = SB.bots[sb.bot].choose(st, 1, rng)
    if (theirs) theirs.bid = Math.min(theirs.bid, st.tr[1])
    const order = [mine || { f: -1, t: -1, bid: 0 }, theirs || { f: -1, t: -1, bid: 0 }]
    // who seals this turn alternates; the opener's order is plain, the sealer's is hashed
    const turnNo = st.turn, sealer = turnNo % 2, nonce = rnd16()
    const commit = SB.commitOf(sb.matchId, turnNo, sealer, order[sealer], nonce)
    const coin = SB.coinOf(commit, order[1 - sealer], nonce)
    const hist = st.hist.slice()
    const links = {
      seal: HB.b64u(SB.encodeLink({ matchId: sb.matchId, mode: st.o.mode, start: st.o.start, cap: st.o.cap, hist, pending: { kind: 'sealed', side: sealer, commit } })),
      open: HB.b64u(SB.encodeLink({ matchId: sb.matchId, mode: st.o.mode, start: st.o.start, cap: st.o.cap, hist, pending: { kind: 'opened', side: sealer, commit, order: order[1 - sealer] } })),
    }
    const preBoard = st.b.slice(), pre = SB.clone(st)
    sb.auction = null; sb.render(); await sleep(150)
    const ev = SB.resolve(st, order, coin)
    links.reveal = HB.b64u(SB.encodeLink({ matchId: sb.matchId, mode: st.o.mode, start: st.o.start, cap: st.o.cap, hist: st.hist.slice(0, -1), pending: { kind: 'reveal', side: sealer, commit, order: order[sealer], nonce } }))
    sb.lab = { turn: turnNo, sealer, commit, nonce, sealerOrder: order[sealer], opener: order[1 - sealer], links, ok: true, tampered: false, matchId: sb.matchId }
    const a = ev[0]; const first = a.first
    const pieces = []
    const lines = []
    ev.slice(1).forEach((e) => {
      const who = e.s === 0 ? 'You' : SB.bots[sb.bot].name
      if (e.kind === 'move') { lines.push({ n: '', text: `${who}: ${SB.GLYPH[e.piece]} ${sqn(e.m.f)}${e.cap ? '×' : '–'}${sqn(e.m.t)}${e.promo ? '=Q' : ''}` }); pieces.push(e.m.f, e.m.t) }
      if (e.kind === 'fizzle') lines.push({ n: '', fz: true, text: `${who}: ${sqn(e.m.f)}→${sqn(e.m.t)} fizzled, no longer possible` })
      if (e.kind === 'pot') lines.push({ n: '', text: `${who} takes the pot, ${e.amt}` })
    })
    lines.reverse().forEach((l) => sb.log.push(l)) // the journal is shown newest-first, so push in reverse
    sb.log.push({ n: turnNo + 1, text: `bids ${a.bids[0]}–${a.bids[1]}${a.tie ? ' (coin)' : ''}`, d: '', a: '' })
    sb.last = pieces
    sb.audit = SB.analyseTurn(pre, order, 0) // a 1-ply payoff matrix solved by fictitious play: was the bid a read or a leak?
    const mover = first === 0 ? 'You' : SB.bots[sb.bot].name
    const fz = ev.filter((e) => e.kind === 'fizzle')
    sb.auction = { bids: a.bids, tie: a.tie, text: `${mover} move${first === 0 ? '' : 's'} first${a.pay ? `, paying ${a.pay}${st.o.mode === 'ledger' ? ' to the rival' : ' into the pot'}` : ''}.${fz.length ? ` ${fz[0].s === 0 ? 'Your' : 'Their'} move fizzled: the board had already changed.` : ''}` }
    sb.from = sb.to = null; sb.bid = 0; sb.busy = false
    sb.render()
  }
  function linkLab() {
    const L = sb.lab
    const box = h('div', { class: 'lab' }, h('div', { class: 'lh' }, h('span', {}, 'Link protocol'), h('span', {}, L ? `this turn · ${L.turn + 1}` : '')))
    if (!L) { box.append(h('p', {}, 'Seal an order and this panel shows the three links that would carry it between two people with no server: ', h('i', {}, 'sealed'), ', ', h('i', {}, 'opened'), ', ', h('i', {}, 'revealed'), '.')); return box }
    const sName = L.sealer === 0 ? 'you' : SB.bots[sb.bot].name, oName = L.sealer === 0 ? SB.bots[sb.bot].name : 'you'
    const rev = L.tampered ? { ...L.sealerOrder, bid: (L.sealerOrder.bid + 1) & 15 } : L.sealerOrder
    const recomputed = SB.commitOf(L.matchId, L.turn, L.sealer, rev, L.nonce)
    const ok = HB.ctEqual(recomputed, L.commit)
    const short = (s) => (s.length > 70 ? s.slice(0, 54) + '…' + s.slice(-10) : s)
    box.append(
      h('p', {}, h('span', { class: 'k' }, '1 · sealed by ' + sName), ` ${L.links.seal.length} chars. Carries only a hash:`, ' ', h('button', { class: 'tbtn mini', onclick: () => sb.deskOpen(L.links.seal) }, 'read in the desk')), h('code', {}, hx(L.commit)),
      h('p', {}, h('span', { class: 'k' }, '2 · opened by ' + oName), ` ${L.links.open.length} chars. Their order is plain: ${L.opener.f < 0 ? 'pass' : sqn(L.opener.f) + '→' + sqn(L.opener.t)}, bid ${L.opener.bid}.`, ' ', h('button', { class: 'tbtn mini', onclick: () => sb.deskOpen(L.links.open) }, 'read in the desk')),
      h('p', {}, h('span', { class: 'k' }, '3 · revealed by ' + sName), ` ${L.links.reveal.length} chars. Adds the nonce:`, ' ', h('button', { class: 'tbtn mini', onclick: () => sb.deskOpen(L.links.reveal) }, 'read in the desk')), h('code', {}, short(hx(L.nonce)) + ' → ' + short(L.links.reveal)),
      h('p', {}, h('span', { class: 'k' }, 'Check: '), `hash(match, turn, side, order${L.tampered ? ' with bid +1' : ''}, nonce) `, ok ? h('span', { class: 'good' }, '= the sealed hash ✓') : h('span', { class: 'bad' }, '≠ the sealed hash. SEAL BROKEN ✗')),
      h('div', { class: 'line' }, h('button', { class: 'tbtn', onclick: () => { L.tampered = !L.tampered; sb.render() } }, L.tampered ? 'Restore the bid' : 'Try to change the bid after sealing')))
    return box
  }


  /* ───────── audit: was the bid a sharp read or a leak? ───────── */
  function auditView(an, title) {
    const rows = []
    an.eq.mix.forEach((p, k) => { if (p >= 0.01) rows.push(h('div', { class: 'mixrow' + (k === an.mine ? ' mine' : '') }, h('span', { class: 'k' }, k), h('span', { class: 'bar' }, h('i', { style: { width: Math.max(2, p * 100) + '%' } })), h('span', { class: 'p' }, Math.round(p * 100) + '%'), k === an.mine ? h('span', { class: 'you' }, '◂ your bid') : null)) })
    const out = !(an.eq.mix[an.mine] >= 0.01)
    return h('div', { class: 'audit ' + an.verdict },
      h('div', { class: 'lh' }, h('span', {}, title || 'Audit · fictitious play'), h('span', {}, an.verdict)),
      h('p', { class: 'verdict' }, SB.explainTurn(an)),
      h('div', { class: 'mix', role: 'img', 'aria-label': 'Equilibrium bid mix: ' + an.eq.mix.map((p, k) => k + ' coins ' + Math.round(p * 100) + '%').filter((x, k) => an.eq.mix[k] >= 0.01).join(', ') },
        h('div', { class: 'mixhead' }, 'equilibrium bid (coins) · share of the time'), rows, out && h('div', { class: 'mixrow mine' }, h('span', { class: 'k' }, an.mine), h('span', { class: 'bar' }), h('span', { class: 'p' }, '0%'), h('span', { class: 'you' }, '◂ your bid, outside the mix'))),
      h('p', { class: 'fine' }, `Solved on a ${an.size[0]}×${an.size[1]} matrix of every move-and-bid pair, 1,500 rounds of fictitious play (the Sealed Orders technique). One coin is counted as ${an.coinValue} material: an assumption, not a measurement.`))
  }

  /* ───────── the sealed-link desk: paste a link, do the one thing it is waiting for ───────── */
  const SECRETS = 'hb-sb1-secrets'
  const vault = {
    mem: {},
    get(k) { try { const o = JSON.parse(localStorage.getItem(SECRETS) || '{}'); if (o[k]) return o[k] } catch (e) { /* storage may be blocked */ } return this.mem[k] },
    set(k, v) { this.mem[k] = v; try { const o = JSON.parse(localStorage.getItem(SECRETS) || '{}'); o[k] = v; localStorage.setItem(SECRETS, JSON.stringify(o)) } catch (e) { /* kept in memory only */ } },
  }
  const dk = { text: '', link: null, role: null, err: '', pick: { from: null, to: null, bid: 0, pass: false }, out: null, done: null, openerText: '', openerOrder: null, body: null }
  const baseUrl = () => location.href.split('#')[0]
  const SIDE = ['White', 'Black']
  const ROLE_TEXT = {
    seal: 'Seal an order. You write a move and a bid, and send only a hash of them.',
    respond: 'Answer in plain. The other side has sealed. You write your move and bid openly, and send them back.',
    reveal: 'Reveal. They have answered. Open your seal by sending the order and the nonce you kept.',
    verify: 'Verify. They opened their seal. Check the hash, then the turn plays.',
    over: 'This match is over.',
  }
  function dkReset(keepText) { dk.link = null; dk.role = null; dk.err = ''; dk.out = null; dk.done = null; dk.openerText = ''; dk.openerOrder = null; dk.pick = { from: null, to: null, bid: 0, pass: false }; if (!keepText) dk.text = '' }
  function dkRead(text) {
    dkReset(true)
    try { dk.link = SB.parseLink(text); dk.role = SB.deskRole(dk.link) } catch (e) { dk.err = e.message; dk.link = null }
  }
  function deskDialog() {
    const dlg = h('dialog', { class: 'desk', 'aria-labelledby': 'desk-title' })
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close() })
    dk.body = h('div', { class: 'deskbody' }); dlg.append(dk.body)
    sb.deskOpen = (text) => {
      if (text != null) { dk.text = text; dkRead(text) }
      deskRender()
      if (!dlg.open) { try { dlg.showModal() } catch (e) { dlg.setAttribute('open', '') } }
    }
    sb.deskClose = () => { try { dlg.close() } catch (e) { dlg.removeAttribute('open') } }
    return dlg
  }
  function miniBoard(b, side, pick, onSquare) {
    const order = [0, 1, 2, 3, 4]; if (side === 1) order.reverse()
    const targets = pick && pick.from != null ? SB.movesFor(b, side).filter((m) => m.f === pick.from).map((m) => m.t) : []
    const el = h('div', { class: 'mboard', role: onSquare ? 'grid' : 'img', 'aria-label': 'Board seen from ' + SIDE[side] })
    for (const r of order) for (const c of order) {
      const i = r * 5 + c, pc = b[i], cls = ['msq']
      if ((r + c) % 2) cls.push('dk')
      if (pick && pick.from === i) cls.push('sel'); if (pick && pick.to === i) cls.push('chosen'); if (targets.includes(i)) cls.push('tgt')
      el.append(h(onSquare ? 'button' : 'div', { class: cls.join(' '), 'aria-label': sqn(i) + (pc ? ' ' + pc : ''), onclick: onSquare ? () => onSquare(i) : null }, pc && h('span', { class: 'pc ' + (pc === pc.toUpperCase() ? 'w' : 'b') }, SB.GLYPH[pc])))
    }
    return el
  }
  function orderPicker(st, side) {
    const pk = dk.pick, max = Math.min(15, st.tr[side]), moves = SB.movesFor(st.b, side)
    pk.bid = Math.min(pk.bid, max)
    const click = (i) => {
      const pc = st.b[i], mine = pc && (pc === pc.toUpperCase()) === (side === 0)
      if (pk.from != null && moves.some((m) => m.f === pk.from && m.t === i)) { pk.to = i; pk.pass = false } else if (mine) { pk.from = pk.from === i ? null : i; pk.to = null } else toast('Pick one of your pieces, then a square it can reach.')
      deskRender()
    }
    return {
      ready: pk.pass || pk.to != null,
      el: h('div', { class: 'picker' },
        miniBoard(st.b, side, pk.pass ? null : pk, click),
        h('div', { class: 'pickside' },
          h('div', { class: 'line' }, 'Move: ', h('b', {}, pk.pass ? 'pass' : pk.from != null && pk.to != null ? `${SB.GLYPH[st.b[pk.from]]} ${sqn(pk.from)} → ${sqn(pk.to)}` : pk.from != null ? `${sqn(pk.from)} → pick a square` : 'pick a piece')),
          h('div', { class: 'line' }, 'Bid: ', h('span', { class: 'step' }, h('button', { 'aria-label': 'lower bid', disabled: pk.bid <= 0, onclick: () => { pk.bid--; deskRender() } }, '−'), h('output', {}, pk.bid), h('button', { 'aria-label': 'raise bid', disabled: pk.bid >= max, onclick: () => { pk.bid++; deskRender() } }, '+')), h('span', { class: 'sub' }, `purse ${st.tr[side]} · only the first mover pays`)),
          h('label', { class: 'line passbox' }, h('input', { type: 'checkbox', checked: pk.pass, onchange: (e) => { pk.pass = e.target.checked; deskRender() } }), ' pass instead of moving'))),
      order: () => (pk.pass ? { f: -1, t: -1, bid: pk.bid } : { f: pk.from, t: pk.to, bid: pk.bid }),
    }
  }
  function linkBox(out) {
    const inp = h('input', { class: 'linkout', readonly: true, value: out.text, 'aria-label': out.label, onfocus: (e) => e.target.select() })
    return h('div', { class: 'outbox' }, h('div', { class: 'lh' }, h('span', {}, out.label), h('span', {}, out.text.length + ' chars')), inp,
      h('div', { class: 'row' }, h('button', { class: 'tbtn', onclick: async () => { try { await navigator.clipboard.writeText(out.text); toast('Copied. Send it to ' + out.to + '.') } catch (e) { inp.focus(); inp.select(); toast('Select and copy the link.') } } }, 'Copy link'),
        h('span', { class: 'sub' }, out.tip)))
  }
  function turnResult(res, side) {
    const a = res.ev[0], who = (s) => (s === side ? 'You' : SIDE[s])
    const lines = [h('p', {}, h('b', {}, 'Auction: '), `bids ${a.bids[0]}–${a.bids[1]}${a.tie ? ` (tie, the coin chose ${SIDE[a.first]})` : ''}. ${SIDE[a.first]} moves first${a.pay ? `, paying ${a.pay}` : ''}.`)]
    res.ev.slice(1).forEach((e) => {
      if (e.kind === 'move') lines.push(h('p', { class: 'ev' }, `${who(e.s)}: ${SB.GLYPH[e.piece]} ${sqn(e.m.f)}${e.cap ? '×' : '–'}${sqn(e.m.t)}${e.promo ? '=Q' : ''}`))
      if (e.kind === 'fizzle') lines.push(h('p', { class: 'ev fz' }, `${who(e.s)}: ${sqn(e.m.f)}→${sqn(e.m.t)} fizzled, the board had already changed`))
      if (e.kind === 'pass') lines.push(h('p', { class: 'ev' }, `${who(e.s)}: passed`))
      if (e.kind === 'pot') lines.push(h('p', { class: 'ev' }, `${who(e.s)} take${e.s === side ? '' : 's'} the pot, ${e.amt}`))
    })
    if (res.st.over) lines.push(h('p', { class: 'ev', style: { color: 'var(--wax)', fontWeight: 700 } }, res.st.over.winner < 0 ? 'Drawn.' : `${SIDE[res.st.over.winner]} takes the match (${res.st.over.reason}).`))
    return h('div', { class: 'result' }, h('div', { class: 'lh' }, h('span', {}, 'Turn ' + (res.pre.turn + 1) + ' resolved'), h('span', {}, 'purses ' + res.st.tr.join(' · '))),
      h('div', { class: 'resrow' }, miniBoard(res.st.b, side, null, null), h('div', {}, lines)),
      auditView(SB.analyseTurn(res.pre, res.orders, side), 'Audit · this turn, for ' + SIDE[side]))
  }
  function deskRender() {
    const body = dk.body; clear(body)
    const L = dk.link, R = dk.role
    const ta = h('textarea', { rows: 3, placeholder: 'Paste a link here: the whole address, the part after #sb1/, or just the code', 'aria-label': 'Sealed link', spellcheck: 'false', oninput: (e) => { dk.text = e.target.value } }, dk.text)
    add(body, [
      h('div', { class: 'deskhead' }, h('h3', { id: 'desk-title' }, 'Sealed-link desk'), h('button', { class: 'tbtn', 'aria-label': 'Close', onclick: () => sb.deskClose() }, '✕')),
      h('p', { class: 'sub' }, 'Three links settle a turn, with no server between you: ', h('b', {}, '1 sealed'), ' (a hash of a move and a bid) → ', h('b', {}, '2 answered'), ' (the other side plays in plain) → ', h('b', {}, '3 revealed'), ' (the seal opens, the hash is checked, the turn plays). Paste whichever link you were sent and the desk does the next step.'),
      ta,
      h('div', { class: 'row' },
        h('button', { class: 'wax small', onclick: () => { dkRead(ta.value); dk.text = ta.value; deskRender() } }, 'Inspect link'),
        h('button', { class: 'tbtn', onclick: () => { dkReset(false); const l = SB.deskBegin(rnd16().slice(0, 4), { mode: sb.mode }); dk.link = l; dk.role = SB.deskRole(l); deskRender() } }, 'Start a new match as White'),
        h('button', { class: 'tbtn', onclick: () => { dkReset(false); deskRender() } }, 'Clear')),
      dk.err && h('p', { class: 'deskerr', role: 'alert' }, dk.err),
    ])
    if (!L) return
    const st = R.st, mySide = R.side, p = L.pending
    const pendingName = !p ? 'none (start of a turn)' : { sealed: 'link 1 · sealed', opened: 'link 2 · answered', reveal: 'link 3 · revealed' }[p.kind]
    add(body, [
      h('div', { class: 'facts' },
        h('div', {}, h('span', {}, 'match'), h('b', {}, HB.hex(L.matchId))), h('div', {}, h('span', {}, 'turn'), h('b', {}, R.kind === 'over' ? 'over' : R.turn + 1)),
        h('div', {}, h('span', {}, 'bids go to'), h('b', {}, L.mode === 'pot' ? 'centre pot' : 'rival’s purse')),
        h('div', {}, h('span', {}, 'purses W · B'), h('b', {}, st.tr.join(' · '))),
        h('div', {}, h('span', {}, 'history'), h('b', {}, L.hist.length + ' turns · chain ✓')),
        h('div', {}, h('span', {}, 'this link'), h('b', {}, pendingName))),
    ])
    if (R.kind === 'over') {
      add(body, [h('p', { class: 'verdict' }, st.over.winner < 0 ? 'Drawn.' : `${SIDE[st.over.winner]} took the match (${st.over.reason}).`), miniBoard(st.b, 0, null, null)]); return
    }
    add(body, [h('div', { class: 'whoami' }, h('b', {}, `You are ${SIDE[mySide]}. `), ROLE_TEXT[R.kind])])
    const seeBoard = () => h('div', { class: 'resrow' }, miniBoard(st.b, mySide, null, null), h('div', { class: 'hist' }, L.hist.slice(-5).map((x, n) => h('p', {}, `${L.hist.length - Math.min(5, L.hist.length) + n + 1}. ${x.o.map((o) => (o && o.f >= 0 ? sqn(o.f) + '→' + sqn(o.t) : 'pass') + ' (' + ((o && o.bid) | 0) + ')').join(' · ')}`)), !L.hist.length && h('p', {}, 'No turns yet.')))
    if (dk.done && R.kind === 'seal') add(body, [turnResult(dk.done.res, dk.done.side)])
    if (R.kind === 'seal' || R.kind === 'respond') {
      if (dk.out) { add(body, [linkBox(dk.out), h('p', { class: 'sub' }, R.kind === 'seal' ? 'Keep this tab or browser: the nonce that opens your seal is saved here. When they answer, paste link 2 above.' : 'Now wait for link 3 and paste it here.')]); return }
      const pk = orderPicker(st, mySide)
      add(body, [pk.el,
        h('div', { class: 'row' }, h('button', { class: 'wax', disabled: !pk.ready, onclick: () => {
          try {
            if (R.kind === 'seal') {
              const r = SB.deskSeal(L, pk.order(), rnd16()); vault.set('seal:' + HB.hex(r.link.pending.commit), r.secret)
              dk.out = { text: SB.linkText(r.link, baseUrl()), label: 'Link 1 · sealed', to: SIDE[1 - mySide], tip: 'Carries a hash of your move and bid. It cannot be read, and it cannot be changed later.' }
            } else {
              const r = SB.deskRespond(L, pk.order()); vault.set('open:' + HB.hex(L.pending.commit), r.secret)
              dk.out = { text: SB.linkText(r.link, baseUrl()), label: 'Link 2 · answered', to: SIDE[1 - mySide], tip: 'Your move and bid, in plain. Their reveal will be checked against the hash they sent.' }
            }
            dk.err = ''
          } catch (e) { dk.err = e.message }
          deskRender() } }, R.kind === 'seal' ? 'Seal it →' : 'Answer in plain →')),
        seeBoard()])
      return
    }
    if (R.kind === 'reveal') {
      if (dk.out) { add(body, [linkBox(dk.out), dk.done && turnResult(dk.done.res, mySide), h('p', { class: 'sub' }, 'The turn has played on your side too. Wait for their link 1 of the next turn.')]); return }
      const sec = vault.get('seal:' + HB.hex(L.pending.commit))
      add(body, [
        h('p', { class: 'line' }, sec ? ['Your sealed order, kept in this browser: ', h('b', {}, sec.order.f < 0 ? 'pass' : `${sqn(sec.order.f)} → ${sqn(sec.order.t)}`), `, bid ${sec.order.bid}.`] : h('span', { class: 'deskerr' }, 'This browser does not hold the nonce for that seal. It was made in another browser, or the saved data was cleared. Open this link where you sealed it.')),
        h('p', { class: 'line' }, `Their answer, in plain: ${L.pending.order.f < 0 ? 'pass' : sqn(L.pending.order.f) + ' → ' + sqn(L.pending.order.t)}, bid ${L.pending.order.bid}.`),
        h('div', { class: 'row' }, h('button', { class: 'wax', disabled: !sec, onclick: () => {
          try { const r = SB.deskReveal(L, sec); dk.done = { res: r }; dk.out = { text: SB.linkText(r.link, baseUrl()), label: 'Link 3 · revealed', to: SIDE[1 - mySide], tip: 'Adds your order and nonce. They recompute the hash; if it differs, the seal is broken.' }; dk.err = '' } catch (e) { dk.err = e.message }
          deskRender() } }, 'Reveal →')),
        seeBoard()])
      return
    }
    if (R.kind === 'verify') {
      const saved = vault.get('open:' + HB.hex(L.pending.commit)), openerOrder = (saved && saved.order) || dk.openerOrder
      const re = HB.hex(SB.commitOf(L.matchId, R.turn, L.pending.side, L.pending.order, L.pending.nonce)), sealed = HB.hex(L.pending.commit)
      const good = re === sealed
      add(body, [
        h('p', { class: 'line' }, `They reveal: ${L.pending.order.f < 0 ? 'pass' : sqn(L.pending.order.f) + ' → ' + sqn(L.pending.order.t)}, bid ${L.pending.order.bid}.`),
        h('div', { class: 'hashes' }, h('div', {}, h('span', {}, 'sealed hash they sent first'), h('code', {}, sealed)), h('div', {}, h('span', {}, 'hash recomputed from what they revealed'), h('code', {}, re)),
          h('p', { class: good ? 'good' : 'bad' }, good ? 'The hashes match. The order is the one they sealed.' : 'SEAL BROKEN. The order does not match the hash. They changed their move or bid after seeing yours.')),
        !openerOrder && good && h('div', {}, h('p', { class: 'sub' }, 'This browser does not remember the answer you sent. Paste link 2 (the one you sent) to supply it.'),
          h('textarea', { rows: 2, 'aria-label': 'Link 2', placeholder: 'Paste link 2 here', oninput: (e) => { dk.openerText = e.target.value } }, dk.openerText),
          h('div', { class: 'row' }, h('button', { class: 'tbtn', onclick: () => { try { const o = SB.openerOrderFrom(SB.parseLink(dk.openerText), L.pending.commit); if (!o) throw new Error('that link does not match this seal'); dk.openerOrder = o; dk.err = '' } catch (e) { dk.err = e.message } deskRender() } }, 'Use link 2'))),
        h('div', { class: 'row' }, h('button', { class: 'wax', disabled: !good || !openerOrder, onclick: () => {
          const d = SB.deskVerify(L, openerOrder)
          if (!d.ok) dk.err = d.why
          else { dk.done = { res: d, side: mySide }; dk.link = d.next; dk.role = SB.deskRole(d.next); dk.out = null; dk.pick = { from: null, to: null, bid: 0, pass: false }; dk.err = ''; dk.text = SB.linkText(d.next, baseUrl()) }
          deskRender() } }, 'Verify and play the turn →')),
        seeBoard()])
      return
    }
  }

  /* ═══════════════════════ 3. LEXICON QUARANTINE ═══════════════════════ */
  const lq = { st: null, role: 'poet', path: [], acts: [], mode: 'stone', log: [], busy: false, showAir: true, hover: -1, fresh: new Set(), seed: 'zine-1', hints: [] }
  function lqNew(seed) {
    lq.seed = seed || 'zine-' + ((Math.random() * 9999) | 0); lq.st = LQ.newGame(lq.seed); lq.path = []; lq.acts = []; lq.log = []; lq.fresh = new Set(); lq.hints = []; lq.busy = false; lq.mode = 'stone'
    lq.log.push({ t: `Seed ${lq.seed}. The Poet needs ${lq.st.o.target} points inside ${lq.st.o.rounds} rounds, or a poem that crosses the page.` })
    if (lq.role === 'censor') lqBotPoet()
  }
  function lqBotPoet() {
    const st = lq.st; const w = LQ.bots.poetSafe.move(st)
    if (!w) { st.over = { winner: 'censor', reason: 'silenced' }; return }
    LQ.commitPoet(st, w); lq.fresh = new Set(w.path); lq.log.push({ t: `Poet types ${w.word.toUpperCase()} (+${w.gain}).`, r: false })
  }
  async function lqBotCensor() {
    lq.busy = true; const st = lq.st; lq.render()
    await sleep(500)
    const acts = LQ.bots.censorDenier.actions(st, HB.mulberry32(st.round * 13 + 5))
    for (const a of acts) { lqAct(a); lq.render(); await sleep(520) }
    lqRoundEnd(); lq.busy = false; lq.render()
  }
  function lqAct(a) {
    const st = lq.st, before = st.stats.captured, shBefore = st.stats.sheared
    LQ.censorApply(st, a)
    lq.fresh = new Set([a.cell])
    if (a.k === 'rot') { const c = a.cell; lq.fresh = new Set([c, c + 1, c + 7, c + 8]) }
    lq.log.push({ t: a.k === 'rot' ? `Censor rotates the block at ${'abcdefg'[a.cell % 7]}${(a.cell / 7 | 0) + 1}.` : `Censor strikes ${'abcdefg'[a.cell % 7]}${(a.cell / 7 | 0) + 1}.`, r: false })
    if (st.stats.sheared > shBefore) lq.log.push({ t: `SHEARED: ${st.stats.sheared - shBefore} cell(s) of ink were cut from the poem’s body by the turn and die.`, r: true })
    if (st.stats.captured > before) lq.log.push({ t: `QUARANTINE: ${st.stats.captured - before} cell(s) of ink lose their air and die.`, r: true })
  }
  function lqRoundEnd() {
    const st = lq.st; LQ.endRound(st)
    if (st.over) return
    if (lq.role === 'censor') { lqBotPoet() ; if (st.over) return }
    if (lq.role === 'poet' && LQ.silenced(st)) st.over = { winner: 'censor', reason: 'silenced' }
  }
  function lqKey(i) { return 'abcdefg'[i % 7] + ((i / 7 | 0) + 1) }
  views.lexicon = () => {
    if (!lq.st) lqNew(lq.seed)
    const root = h('div', { class: 'table t-zine' }); const sheet = h('div', { class: 'sheet' }); root.append(h('div', { class: 'wrap' }, sheet))
    lq.render = () => {
      clear(sheet); const st = lq.st, N = 7
      const groups = LQ.groups(st, 1); const air = new Map()
      for (const g of groups) { const first = Math.min(...g.cells); air.set(first, g.libs) }
      const myTurnPoet = lq.role === 'poet' && !st.over && !lq.busy
      const myTurnCen = lq.role === 'censor' && !st.over && !lq.busy
      const path = lq.path, ev = path.length ? LQ.evalPath(st, path) : null
      const pv = new Set(), tear = new Set(); let prev = null
      if (myTurnCen && lq.mode === 'rot' && lq.hover >= 0) { const r = (lq.hover / 7) | 0, c = lq.hover % 7, tl = Math.min(r, 5) * 7 + Math.min(c, 5); [tl, tl + 1, tl + 7, tl + 8].forEach((x) => pv.add(x)); prev = LQ.previewRot(st, tl); prev.tornFrom.forEach((x) => tear.add(x)) }
      const body = st.o.shear ? LQ.mainBody(st) : null // ink outside it can be cut off by a turn
      const cells = []
      for (let i = 0; i < 49; i++) {
        const o = st.own[i], cls = ['z', 'o' + o]; if (path.includes(i)) cls.push('path'); if (pv.has(i)) cls.push('rotpv'); if (tear.has(i)) cls.push('tear'); if (body && o === 1 && !body.has(i)) cls.push('loose'); if (lq.fresh.has(i) && o === 2) cls.push('newbar'); if (lq.fresh.has(i) && lq.mode === 'rot') cls.push('flip')
        if ((myTurnPoet && o < 2) || (myTurnCen && (lq.mode === 'rot' || o === 0))) cls.push('tgt')
        const kids = [st.ch[i]]
        if (o === 1) kids.push(h('small', {}, LQ.value(st.ch[i])))
        if (path.includes(i)) kids.push(h('span', { class: 'ord' }, path.indexOf(i) + 1))
        if (lq.showAir && air.has(i)) { const libs = air.get(i); kids.push(h('span', { class: 'breath' + (libs <= st.o.libFloor + 1 ? ' low' : ''), title: `This ink has ${libs} breath${libs === 1 ? '' : 's'} left` }, libs)) }
        cells.push(h('button', { class: cls.join(' '), 'aria-label': `${lqKey(i)} ${o === 2 ? 'blacked out' : o === 3 ? 'dead' : st.ch[i]}${o === 1 ? ' inked' : ''}`, onmouseenter: () => { if (lq.mode === 'rot') { lq.hover = i; lq.render() } }, onclick: () => lqClick(i) }, kids))
      }
      const poetDone = st.over && st.over.winner === 'poet'
      lq.prev = prev
      add(sheet, [
        h('h2', {}, 'Lexicon ', h('s', {}, 'Quarantine')), h('p', { class: 'sub' }, 'A zine for two readers. One of you ', h('em', {}, 'writes'), ', one of you ', h('em', {}, 'redacts'), '. Ink needs air to live; stones need none; a block of letters can be turned a quarter-turn while nobody is looking.'),
        st.over && h('div', { class: 'verdict' }, poetDone ? (st.over.reason === 'crossing' ? 'The page is crossed' : 'Published') : st.over.reason === 'silenced' ? 'Silenced' : 'Suppressed'),
        h('div', { class: 'layout' },
          h('div', {}, h('div', { class: 'board', role: 'grid', 'aria-label': 'Seven by seven letters', onmouseleave: () => { if (lq.hover >= 0) { lq.hover = -1; lq.render() } } }, cells),
            h('div', { class: 'row' }, h('span', { style: { fontSize: '13px' } }, 'You play:'), h('div', { class: 'sw' }, ['poet', 'censor'].map((r) => h('button', { 'aria-pressed': String(lq.role === r), onclick: () => { lq.role = r; lqNew(lq.seed); lq.render() } }, r))),
              h('button', { class: 'bt', onclick: () => { lqNew(); lq.render() } }, 'New page'), h('button', { class: 'bt' + (lq.showAir ? ' on' : ''), 'aria-pressed': String(lq.showAir), onclick: () => { lq.showAir = !lq.showAir; lq.render() } }, 'Show air'))),
          h('div', { class: 'col' },
            h('section', { class: 'card' }, h('h3', {}, 'Progress'), h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': st.o.target, 'aria-valuenow': Math.max(0, st.score) }, h('i', { style: { width: Math.min(100, Math.max(0, st.score) / st.o.target * 100) + '%' } })),
              h('div', { class: 'nums' }, h('span', {}, `${st.score} pts`), h('span', {}, `target ${st.o.target} · or cross the page`)),
              h('div', { class: 'rounds', 'aria-label': 'rounds' }, Array.from({ length: st.o.rounds }, (_, i) => h('span', { class: i < st.round ? 'done' : i === st.round && !st.over ? 'now' : '' }, i + 1))),
              h('div', { class: 'nums' }, h('span', {}, lq.role === 'censor' ? (LQ.canRotate(st) ? 'rotation ready' : 'rotation jammed one more round') : ''), body && h('span', { class: 'legend' }, h('i', { class: 'loose-key' }), ' dashed = not joined to the main body')),
              prev && h('div', { class: 'why' + (prev.torn.length ? ' bad' : '') }, prev.torn.length ? `Turning here would cut ${prev.torn.length} cell${prev.torn.length === 1 ? '' : 's'} off the body: they die, −${prev.lost} points.` : 'Turning here would cut nothing.')),
            lq.role === 'poet' ? poetCard(st, ev, myTurnPoet) : censorCard(st, myTurnCen),
            h('section', { class: 'card' }, h('h3', {}, 'Minutes'), h('div', { class: 'log', role: 'log' }, lq.log.slice(-30).reverse().map((l) => h('div', { class: l.r ? 'r' : '' }, l.t)))))),
        h('div', { class: 'lessons' },
          h('div', {}, h('b', {}, 'Boggle'), 'Words run through touching cells, diagonals included, no cell twice in a word. Later words must pass through your own ink: a poem grows from itself.'),
          h('div', {}, h('b', {}, 'Go'), 'Ink groups connect only orthogonally. The number in red is a group’s air. At one, it is quarantined: the Censor does not need to surround, only to threaten.'),
          h('div', {}, h('b', {}, 'Rotation'), 'A 2×2 block turns a quarter-turn for one of your two actions, then jams for a round. Ink that the turn cuts away from the poem’s main body dies. Keep your ink joined, or keep it out of the Censor’s 2×2s.'))
      ])
    }
    lq.render()
    return root
  }
  function poetCard(st, ev, mine) {
    const word = lq.path.map((x) => st.ch[x]).join('')
    return h('section', { class: 'card' }, h('h3', {}, 'Your line'),
      h('div', { class: 'typed' + (ev && ev.ok ? ' ok' : '') }, word || '…'),
      h('div', { class: 'why' + (ev && !ev.ok ? ' bad' : '') }, !mine ? (st.over ? '' : 'The Censor is working…') : !lq.path.length ? 'Tap letters that touch, in order. Tap the last one again to undo.' : ev.ok ? `Valid: +${ev.mv.gain} points.` : ev.why + '.'),
      h('div', { class: 'row' }, h('button', { class: 'bt red', disabled: !mine || !ev || !ev.ok, onclick: lqType }, 'Type it'), h('button', { class: 'bt', disabled: !mine || !lq.path.length, onclick: () => { lq.path = []; lq.render() } }, 'Clear'),
        h('button', { class: 'bt', disabled: !mine, onclick: () => { const ws = LQ.legalPoet(st).sort((a, b) => b.gain - a.gain).slice(0, 4); lq.hints = ws; lq.log.push({ t: 'Hint: ' + ws.map((w) => w.word.toUpperCase() + ' +' + w.gain).join(', ') + '.' }); lq.render() } }, 'Hint')))
  }
  function censorCard(st, mine) {
    const left = st.o.censorActions - lq.acts.length
    return h('section', { class: 'card' }, h('h3', {}, 'Your bars'),
      h('div', { class: 'why' }, !mine ? (st.over ? '' : 'The Poet is typing…') : `${left} action${left === 1 ? '' : 's'} left. Black out a letter, or turn a 2×2 block (one action; it cuts ink loose from the main body). Watch the red numbers: strike the last breaths of a group.`),
      h('div', { class: 'row' }, h('button', { class: 'bt' + (lq.mode === 'stone' ? ' on' : ''), disabled: !mine, onclick: () => { lq.mode = 'stone'; lq.render() } }, '█ Bar'),
        h('button', { class: 'bt' + (lq.mode === 'rot' ? ' on' : ''), disabled: !mine || !LQ.canRotate(st) || lq.acts.some((a) => a.k === 'rot'), onclick: () => { lq.mode = 'rot'; lq.render() } }, '↻ Turn block'),
        h('button', { class: 'bt', disabled: !mine || !lq.acts.length, onclick: lqEndCensor }, 'End turn')))
  }
  function lqClick(i) {
    const st = lq.st; if (st.over || lq.busy) return
    if (lq.role === 'poet') {
      const p = lq.path
      if (p[p.length - 1] === i) { p.pop(); return lq.render() }
      if (st.own[i] > 1) return toast('That cell is blacked out or dead.')
      if (p.includes(i)) return toast('A word cannot use a cell twice.')
      if (p.length && !LQ.N8[p[p.length - 1]].includes(i)) return toast('Cells in a word must touch, diagonals included.')
      p.push(i); lq.render()
    } else {
      if (lq.acts.length >= st.o.censorActions) return
      if (lq.mode === 'rot') {
        const r = Math.min((i / 7) | 0, 5), c = Math.min(i % 7, 5), tl = r * 7 + c
        if (!LQ.canRotate(st)) return toast('Rotation is jammed this round.')
        const a = { k: 'rot', cell: tl }; lqAct(a); lq.acts.push(a); lq.mode = 'stone'
      } else {
        if (st.own[i] !== 0) return toast('Only an empty, un-inked letter can be barred.')
        const a = { k: 'stone', cell: i }; lqAct(a); lq.acts.push(a)
      }
      if (lq.acts.length >= st.o.censorActions) return lqEndCensor()
      lq.render()
    }
  }
  function lqType() {
    const st = lq.st, ev = LQ.evalPath(st, lq.path); if (!ev.ok) return
    const before = st.stats.lifted
    LQ.commitPoet(st, ev.mv); lq.fresh = new Set(ev.mv.path)
    lq.log.push({ t: `You type ${ev.mv.word.toUpperCase()} (+${ev.mv.gain}).` })
    if (st.stats.lifted > before) lq.log.push({ t: 'Bars are lifted: you surrounded them.', r: true })
    lq.path = []; lq.hints = []
    if (st.over) return lq.render()
    lqBotCensor()
  }
  function lqEndCensor() {
    const st = lq.st; lq.acts = []; lq.busy = true
    lqRoundEnd(); lq.busy = false; lq.render()
  }

  /* ───────── boot ───────── */
  const start = location.hash.slice(1)
  if (start.startsWith(SB.LINK_TAG)) { go('shadow'); route() } else go(views[ALIAS[start] || start] ? ALIAS[start] || start : 'overview')
})()
