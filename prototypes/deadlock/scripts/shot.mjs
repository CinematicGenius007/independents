#!/usr/bin/env node
/* Headless Chrome screenshot driver (CDP over Node's built-in WebSocket).
 *   node scripts/shot.mjs <page.html> <out.png> [--w=1280] [--h=900] [--dpr=1] [--wait=900]
 *        [--eval="js to run before shot"] [--full] [--hash=#dev] [--clip=x,y,w,h]
 * Steps: --steps='[{"eval":"..."},{"wait":400},{"shot":"a.png"}]' for multi-shot runs. */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const args = process.argv.slice(2)
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d }
const pos = args.filter((a) => !a.startsWith('--'))
const [page, out] = pos
const W = +flag('w', 1280), H = +flag('h', 900), DPR = +flag('dpr', 1), WAIT = +flag('wait', 900)
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9300 + Math.floor(Math.random() * 400)
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu-sandbox', '--hide-scrollbars',
  `--window-size=${W},${H}`, '--user-data-dir=' + `/tmp/dl-shot-${port}`, 'about:blank'], { stdio: 'ignore' })
let ws
try {
  let targets
  for (let i = 0; i < 60; i += 1) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch {} await sleep(150) }
  const t = targets.find((x) => x.type === 'page')
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map(); const logs = []
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' '))
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: flag('mobile', '') === '1' })
  const url = page.startsWith('http') ? page : 'file://' + resolve(page) + flag('hash', '')
  await send('Page.navigate', { url })
  await sleep(WAIT)
  const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) logs.push('EVAL-EXC ' + JSON.stringify(r.result.exceptionDetails.exception?.description)); return r.result?.result?.value }
  const shot = async (file, clip) => {
    let params = { format: 'png' }
    if (args.includes('--full')) { const m = await send('Page.getLayoutMetrics'); const c = m.result.cssContentSize; params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: c.width, height: c.height, scale: 1 } } }
    const cl = clip || flag('clip', '') ; if (cl) { const [x, y, w, h] = (Array.isArray(cl) ? cl : cl.split(',').map(Number)); params.clip = { x, y, width: w, height: h, scale: 1 } }
    const r = await send('Page.captureScreenshot', params)
    writeFileSync(file, Buffer.from(r.result.data, 'base64')); console.log('wrote', file)
  }
  const steps = flag('steps', '')
  if (steps) {
    for (const s of JSON.parse(steps)) {
      if (s.eval) { const v = await evalJs(s.eval); if (s.print) console.log('eval →', JSON.stringify(v)) }
      if (s.wait) await sleep(s.wait)
      if (s.shot) await shot(s.shot, s.clip)
      if (s.print && !s.eval) console.log(s.print)
    }
  } else {
    if (flag('eval', '')) { const v = await evalJs(flag('eval', '')); if (v !== undefined) console.log('eval →', JSON.stringify(v)); await sleep(+flag('after', 300)) }
    if (out) await shot(out)
  }
  if (logs.length) console.log('console:\n' + logs.slice(0, 20).join('\n'))
} finally { try { ws?.close() } catch {} proc.kill() }
