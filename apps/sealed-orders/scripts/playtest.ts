/**
 * Headless playtest.
 *
 * Two questions decide whether this game is worth playing. Does sealing first
 * cost you anything — if it does, the protocol that makes serverless play
 * possible has quietly broken the game. And does thinking about the other player
 * pay, or is dashing at the nearest well always right?
 *
 * Run with: pnpm tsx scripts/playtest.ts [matches]
 */
import { generateBoard } from '../src/engine/board'
import { botOrders, type Personality } from '../src/engine/bot'
import { createRng } from '../src/engine/rng'
import { resolveTurn, startPosition, TURN_LIMIT, verdict, type Orders, type Side } from '../src/engine/rules'

const matches = Number(process.argv[2] ?? 200)

interface Report {
  firstWins: number
  secondWins: number
  draws: number
  turns: number
  contested: number
  blocked: number
}

function playMatch(seed: string, sides: [Personality, Personality], rngSeed: number): Report {
  const board = generateBoard(seed)
  const rng = createRng(rngSeed)
  let position = startPosition(board)
  const report: Report = { firstWins: 0, secondWins: 0, draws: 0, turns: 0, contested: 0, blocked: 0 }

  for (let turn = 1; turn <= TURN_LIMIT; turn += 1) {
    const orders: [Orders, Orders] = [
      botOrders(board, position, 0, sides[0], rng),
      botOrders(board, position, 1, sides[1], rng),
    ]
    const result = resolveTurn(board, position, orders)
    report.contested += result.contested.length
    report.blocked += result.claimed.length
    position = result.position
    report.turns = turn

    const call = verdict(board, position)
    if (call.over) {
      if (call.winner === 0) report.firstWins = 1
      else if (call.winner === 1) report.secondWins = 1
      else report.draws = 1
      return report
    }
  }

  report.draws = 1
  return report
}

function run(label: string, sides: [Personality, Personality]) {
  const total: Report = { firstWins: 0, secondWins: 0, draws: 0, turns: 0, contested: 0, blocked: 0 }

  for (let i = 0; i < matches; i += 1) {
    const report = playMatch(`PLAYTEST-${i}`, sides, i + 1)
    total.firstWins += report.firstWins
    total.secondWins += report.secondWins
    total.draws += report.draws
    total.turns += report.turns
    total.contested += report.contested
    total.blocked += report.blocked
  }

  const pct = (count: number) => `${Math.round((count / matches) * 100)}%`
  console.log(
    [
      label.padEnd(22),
      `first ${pct(total.firstWins)}`.padStart(11),
      `second ${pct(total.secondWins)}`.padStart(12),
      `draw ${pct(total.draws)}`.padStart(10),
      `turns ${(total.turns / matches).toFixed(1)}`.padStart(11),
      `contests/match ${(total.contested / matches).toFixed(2)}`,
      `claims/match ${(total.blocked / matches).toFixed(2)}`,
    ].join('  '),
  )
}

console.log(`${matches} matches per pairing\n`)
run('rush vs rush', ['rush', 'rush'])
run('ghost vs ghost', ['ghost', 'ghost'])
run('ghost vs rush', ['ghost', 'rush'])
run('rush vs ghost', ['rush', 'ghost'])
run('reader vs rush', ['reader', 'rush'])
run('rush vs reader', ['rush', 'reader'])
run('reader vs ghost', ['reader', 'ghost'])
run('reader vs reader', ['reader', 'reader'])
