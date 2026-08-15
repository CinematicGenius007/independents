/**
 * Headless tournament.
 *
 * Runs the three bot levels against each other over many seeded games and
 * prints what came out: win rates, score spreads, how long a game runs, and
 * how often the wall actually gets finished. The point is not the leaderboard
 * — it is that the numbers are the only honest way to tell whether a change to
 * the rules or to the bot made the game better or merely different.
 *
 *   pnpm playtest            # 200 games, four seats
 *   pnpm playtest 500 2      # 500 games, two seats
 */

import type { BotStyle } from '../src/engine/bot'
import { BOT_STYLES } from '../src/engine/bot'
import { assertTileConservation, playGame } from '../src/engine/selfplay'
import { WALL_SIZE } from '../src/engine/types'

const games = Number(process.argv[2] ?? 200)
const seats = Number(process.argv[3] ?? 4)

if (!Number.isInteger(games) || games < 1) throw new Error('game count must be a positive integer')
if (!Number.isInteger(seats) || seats < 2 || seats > 4) throw new Error('seats must be 2, 3 or 4')

interface Tally {
  games: number
  wins: number
  scores: number[]
}

const tallies = new Map<BotStyle, Tally>(
  BOT_STYLES.map(style => [style, { games: 0, wins: 0, scores: [] }]),
)

const roundCounts: number[] = []
let completedRows = 0
let sharedWins = 0

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const started = Date.now()

for (let seed = 1; seed <= games; seed++) {
  // Rotate the seating so no style is permanently the starting player.
  const styles: BotStyle[] = Array.from(
    { length: seats },
    (_, i) => BOT_STYLES[(i + seed) % BOT_STYLES.length],
  )

  let result
  try {
    result = playGame({ styles, seed })
  } catch (error) {
    console.error(`seed ${seed} failed: ${(error as Error).message}`)
    process.exit(1)
  }

  assertTileConservation(result.state)
  roundCounts.push(result.state.round)
  if ((result.state.winners?.length ?? 0) > 1) sharedWins++

  result.state.players.forEach((player, i) => {
    const tally = tallies.get(styles[i])!
    tally.games++
    tally.scores.push(player.score)
    if (result.state.winners?.includes(i)) tally.wins++
    completedRows += player.wall.filter(row => row.every(Boolean)).length
  })
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1)
const seatsPlayed = games * seats

console.log(`\n  ${games} games, ${seats} seats, ${elapsed}s\n`)
console.log('  style        games   win rate   mean score   median   best')
console.log('  ' + '-'.repeat(60))
for (const style of BOT_STYLES) {
  const tally = tallies.get(style)!
  if (tally.games === 0) continue
  const winRate = `${((tally.wins / tally.games) * 100).toFixed(1)}%`
  console.log(
    '  ' +
      style.padEnd(13) +
      String(tally.games).padStart(5) +
      winRate.padStart(11) +
      mean(tally.scores).toFixed(1).padStart(13) +
      String(median(tally.scores)).padStart(9) +
      String(Math.max(...tally.scores)).padStart(7),
  )
}

console.log(`\n  rounds per game    ${mean(roundCounts).toFixed(1)} mean, ${Math.max(...roundCounts)} longest`)
console.log(`  finished rows      ${(completedRows / seatsPlayed).toFixed(2)} per board`)
console.log(`  shared victories   ${((sharedWins / games) * 100).toFixed(1)}%`)
console.log(`  wall size          ${WALL_SIZE}x${WALL_SIZE}\n`)
