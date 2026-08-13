/**
 * Headless playtest.
 *
 * Generates a batch of levels per tier and plays each one three ways: optimally
 * (the certified plan), greedily (always shrink the fog the most), and randomly.
 * Greedy is the interesting one. A tier where greedy wins often is a tier that
 * does not need thinking, and a tier where greedy always dies is a tier that
 * punishes the obvious move without teaching anything.
 *
 * Run with: pnpm tsx scripts/playtest.ts [levelsPerTier]
 */
import { initialBelief, isSolved, step, type Belief } from '../src/engine/belief'
import { DIRECTIONS, type Board, type Direction } from '../src/engine/board'
import { generateLevel, TIERS, type Tier } from '../src/engine/generate'
import { createRng } from '../src/engine/rng'

const perTier = Number(process.argv[2] ?? 40)
const tiers: Tier[] = ['calm', 'brisk', 'severe']

function playGreedy(board: Board, budget: number): 'won' | 'stuck' | 'died' {
  let belief = initialBelief(board)
  const seen = new Set<string>()
  for (let i = 0; i < budget; i += 1) {
    let best: { belief: Belief; move: Direction } | null = null
    let died = false
    for (const move of DIRECTIONS) {
      const next = step(board, belief, move)
      if (next === 'dead') {
        died = true
        continue
      }
      const key = next.join(',')
      if (seen.has(key)) continue
      if (!best || next.length < best.belief.length) best = { belief: next, move }
    }
    if (!best) return died ? 'died' : 'stuck'
    belief = best.belief
    seen.add(belief.join(','))
    if (isSolved(board, belief)) return 'won'
  }
  return 'stuck'
}

function playRandom(board: Board, budget: number, seed: number): 'won' | 'lost' {
  const rng = createRng(seed)
  let belief = initialBelief(board)
  for (let i = 0; i < budget; i += 1) {
    const next = step(board, belief, rng.pick(DIRECTIONS))
    if (next === 'dead') return 'lost'
    belief = next
    if (isSolved(board, belief)) return 'won'
  }
  return 'lost'
}

for (const tier of tiers) {
  const spec = TIERS[tier]
  const started = Date.now()
  const lengths: number[] = []
  const worlds: number[] = []
  let greedyWins = 0
  let greedyDeaths = 0
  let randomWins = 0
  let randomWinsAtPar = 0
  let outsideWindow = 0

  for (let i = 0; i < perTier; i += 1) {
    const level = generateLevel(`PLAYTEST-${i}`, tier)
    lengths.push(level.solution.length)
    worlds.push(level.startingWorlds)
    if (level.solution.length < spec.minPlan || level.solution.length > spec.maxPlan) outsideWindow += 1

    const budget = level.solution.length * 3 + 10
    const greedy = playGreedy(level.board, budget)
    if (greedy === 'won') greedyWins += 1
    if (greedy === 'died') greedyDeaths += 1

    for (let run = 0; run < 25; run += 1) {
      if (playRandom(level.board, budget, i * 1000 + run) === 'won') {
        randomWins += 1
        break
      }
    }

    for (let run = 0; run < 25; run += 1) {
      if (playRandom(level.board, level.solution.length + 2, i * 7919 + run) === 'won') {
        randomWinsAtPar += 1
        break
      }
    }
  }

  const mean = (values: number[]) => (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  const pct = (count: number) => `${Math.round((count / perTier) * 100)}%`

  console.log(
    [
      `${spec.label.padEnd(7)}`,
      `plan ${mean(lengths)} (${Math.min(...lengths)}-${Math.max(...lengths)})`,
      `worlds ${mean(worlds)}`,
      `off-window ${pct(outsideWindow)}`,
      `greedy solves ${pct(greedyWins)}`,
      `greedy dies ${pct(greedyDeaths)}`,
      `random solves ${pct(randomWins)}`,
      `random at par+2 ${pct(randomWinsAtPar)}`,
      `${Date.now() - started}ms/${perTier}`,
    ].join('  '),
  )
}
