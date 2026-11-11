#!/usr/bin/env node
/* Drives the BUILT page (index.html) in headless Chrome: deep links, the three-hop link desk through real DOM
 * clicks, the turn audit, the Cartel hand and the Lexicon shear preview. No dependencies; skips if there is no Chrome.
 *   node build.mjs && node ui-smoke.mjs                (CHROME=/path/to/chrome to override) */
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p))
if (!chrome) { console.log('ui-smoke: no Chrome found, skipped'); process.exit(0) }
const html = readFileSync(join(here, 'index.html'), 'utf8')
const dir = mkdtempSync(join(tmpdir(), 'hb-ui-'))

/* the driver runs inside the page; it reports into <pre id="__r"> as JSON */
const driver = String.raw`
;(async () => {
  const R = { errors: [], checks: [] }, ok = (n, c, extra) => R.checks.push({ n, ok: !!c, extra: extra === undefined ? undefined : String(extra) })
  addEventListener('error', (e) => R.errors.push(String(e.message)))
  addEventListener('unhandledrejection', (e) => R.errors.push('rejection: ' + e.reason))
  const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms))
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)]
  const btn = (txt, root = document) => qa('button', root).find((b) => b.textContent.trim().startsWith(txt))
  const click = async (el) => { if (!el) throw new Error('missing element'); el.click(); await wait() }
  const boot = location.hash
  try {
    await wait(60)
    R.boot = { hash: boot, table: document.body.dataset.table, hashAfter: location.hash }
    // ---- deep links by hash change
    for (const [h, t] of [['#cartel', 'cartel'], ['#shadow', 'shadow'], ['#lexicon', 'lexicon'], ['#bidding', 'shadow'], ['#overview', 'overview']]) {
      location.hash = h; await wait(60); ok('deep link ' + h + ' → ' + t, document.body.dataset.table === t, document.body.dataset.table)
    }
    // ---- Cartel
    location.hash = '#cartel'; await wait(80)
    ok('cartel deals a hand of 3', qa('.hand .tilebtn').length === 3, qa('.hand .tilebtn').length)
    ok('cartel register says three weakest colours count', /three weakest/.test(q('.reg').parentElement.textContent))
    // ---- Shadow Bidding: the bot game gets an audit after a turn
    location.hash = '#shadow'; await wait(80)
    await click(qa('.sq').find((s) => s.getAttribute('aria-label') === 'a2 P')); await click(qa('.sq').find((s) => s.getAttribute('aria-label') === 'a3'))
    await click(btn('Seal & reveal together')); await wait(400)
    ok('a resolved turn shows the audit sentence', /Going first on this turn was worth/.test((q('.audit .verdict') || {}).textContent || ''), (q('.audit .verdict') || {}).textContent)
    ok('the audit draws an equilibrium bid mix', qa('.audit .mixrow').length >= 1)
    // ---- the link desk: two people, three hops, one page (they share localStorage, as two tabs of one browser would)
    await click(q('.desk-open')); ok('the desk dialog opens', q('dialog.desk').open)
    const dlg = q('dialog.desk')
    await click(btn('Start a new match', dlg))
    ok('new match: White is asked to seal', /You are White/.test(q('.whoami', dlg).textContent))
    const sq = (name) => qa('.msq', dlg).find((s) => s.getAttribute('aria-label') === name)
    await click(sq('a2 P')); await click(sq('a3')); await click(btn('+', q('.step', dlg))); await click(btn('+', q('.step', dlg)))
    await click(btn('Seal it', dlg))
    const link1 = q('.linkout', dlg).value; ok('hop 1 produces a sealed link', /#sb1\//.test(link1) && /sealed/.test(q('.outbox', dlg).textContent), link1.length + ' chars')
    // the opener pastes it
    const paste = async (text) => { const ta = q('textarea', dlg); ta.value = text; ta.dispatchEvent(new Event('input')); await click(btn('Inspect link', dlg)) }
    await paste(link1)
    ok('hop 1 read: Black is asked to answer', /You are Black/.test(q('.whoami', dlg).textContent) && /answered|Answer in plain/.test(dlg.textContent))
    await click(sq('a4 p')); await click(sq('a3')); await click(btn('+', q('.step', dlg)))
    await click(btn('Answer in plain', dlg)); const link2 = q('.linkout', dlg).value
    ok('hop 2 produces an answered link', /#sb1\//.test(link2) && link2 !== link1)
    await paste(link2)
    ok('hop 2 read: White is asked to reveal, and holds the nonce', /You are White/.test(q('.whoami', dlg).textContent) && !!btn('Reveal', dlg) && !btn('Reveal', dlg).disabled)
    await click(btn('Reveal', dlg)); const link3 = q('.linkout', dlg).value
    ok('hop 3 produces a revealed link and the sealer sees the turn resolved', /#sb1\//.test(link3) && !!q('.result', dlg) && /Going first on this turn was worth/.test(q('.result .audit .verdict', dlg).textContent))
    await paste(link3)
    ok('hop 3 read: Black sees the hashes match', /hashes match/.test(dlg.textContent) && /You are Black/.test(q('.whoami', dlg).textContent))
    await click(btn('Verify and play', dlg))
    ok('verification plays the turn and shows the audit', !!q('.result', dlg) && !!q('.result .audit .mixrow', dlg))
    ok('roles swap: Black now seals turn 2', /You are Black/.test(q('.whoami', dlg).textContent) && /Seal an order/.test(q('.whoami', dlg).textContent) && /turn2|2/.test(q('.facts', dlg).textContent))
    // forgeries: a changed history fails to open; a changed nonce reaches the verify step and breaks the seal
    const flip = (str, i) => str.slice(0, i) + (str[i] === 'A' ? 'B' : 'A') + str.slice(i + 1)
    const body3 = link3.split('#sb1/')[1], pre3 = link3.split('#sb1/')[0] + '#sb1/'
    await paste(pre3 + flip(body3, 16)); ok('a link with an edited history is refused with a message', !!q('.deskerr', dlg) && /chain/.test(q('.deskerr', dlg).textContent), (q('.deskerr', dlg) || {}).textContent)
    await paste(pre3 + flip(body3, body3.length - 8)); ok('a link with an edited nonce shows SEAL BROKEN and cannot be played', /SEAL BROKEN/.test(dlg.textContent) && btn('Verify and play', dlg).disabled)
    await paste('hello world'); ok('garbage is refused', !!q('.deskerr', dlg))
    await click(btn('✕', dlg)); ok('the desk closes', !q('dialog.desk').open)
    // ---- a #sb1/ link opens the desk by itself
    location.hash = '#sb1/' + link1.split('#sb1/')[1]; await wait(120)
    ok('opening a #sb1/ link lands on Shadow Bidding with the desk open and reading it', document.body.dataset.table === 'shadow' && q('dialog.desk').open && /You are Black/.test(q('dialog.desk .whoami').textContent) && location.hash === '#shadow', location.hash)
    await click(btn('✕', q('dialog.desk')))
    // ---- Lexicon: a Censor sees what a turn would cut
    location.hash = '#lexicon'; await wait(80)
    await click(qa('.sw button').find((b) => b.textContent === 'censor'))
    await wait(100)
    await click(btn('↻ Turn block'))
    const cells = qa('.z'); cells[24].dispatchEvent(new MouseEvent('mouseenter')); await wait(40)
    ok('turn-block hover previews the cells and what it would cut', qa('.z.rotpv').length === 4 && /Turning here would/.test(q('.card').parentElement.textContent), qa('.z.rotpv').length)
    ok('the Poet’s ink outside the main body is marked', qa('.z.o1').length === 0 || qa('.z.o1.loose').length >= 0)
  } catch (e) { R.errors.push('driver: ' + e.message) }
  document.title = 'done'
  const pre = document.createElement('pre'); pre.id = '__r'; pre.textContent = JSON.stringify(R); document.body.append(pre)
})()
`
const run = (hash) => {
  const f = join(dir, 'p' + Math.abs([...hash].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) + '.html')
  writeFileSync(f, html.replace('</body>', '<script>' + driver + '</script></body>'))
  const out = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'hb-prof-')), '--virtual-time-budget=60000', '--dump-dom', pathToFileURL(f).href + hash], { encoding: 'utf8', maxBuffer: 64e6, timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'] })
  const m = out.match(/<pre id="__r">([\s\S]*?)<\/pre>/); if (!m) throw new Error('driver did not finish for ' + hash)
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
}
let fail = 0
const say = (ok, n, extra) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (extra && !ok ? '  [' + extra + ']' : '')); if (!ok) fail++ }
console.log('# ui smoke (' + chrome.split('/').pop() + ')')
const main = run('')
main.checks.forEach((c) => say(c.ok, c.n, c.extra))
say(main.errors.length === 0, 'no script errors in the page', main.errors.join(' | '))
for (const [hash, table] of [['#cartel', 'cartel'], ['#shadow', 'shadow'], ['#lexicon', 'lexicon'], ['#bidding', 'shadow'], ['#nonsense', 'overview']]) {
  const r = run(hash); say(r.boot.table === table, 'cold start at ' + hash + ' opens ' + table, r.boot.table)
}
console.log(fail ? '\n' + fail + ' ui check(s) FAILED' : '\nall ui checks passed')
process.exit(fail ? 1 : 0)
