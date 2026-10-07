import { playGame } from '../src/engine/selfplay'
import type { BotStyle } from '../src/engine/bot'
const [a, b, n = '40'] = process.argv.slice(2) as [BotStyle, BotStyle, string]
let aw = 0, bw = 0, ties = 0
const t0 = Date.now()
for (let i = 0; i < Number(n); i++) {
  const seats: BotStyle[] = i % 2 ? [a, b] : [b, a]
  const { state } = playGame({ styles: seats, seed: 1000 + i })
  const scores = state.players.map(p => p.score)
  const ai = i % 2 ? 0 : 1
  if (scores[ai] > scores[1 - ai]) aw++
  else if (scores[ai] < scores[1 - ai]) bw++
  else ties++
}
console.log(`${a} ${aw} - ${b} ${bw} (ties ${ties}) in ${Date.now() - t0}ms`)
