import { initialBelief, step, type Belief, type Objective } from './belief'
import { DIRECTIONS, type Board, type Cell, type Direction } from './board'
import { createRng, hashSeed, type Rng } from './rng'
import { solve } from './solver'

export type Tier = 'calm' | 'brisk' | 'severe' | 'reset'

export interface TierSpec {
  readonly label: string
  readonly blurb: string
  readonly size: number
  readonly wallChance: number
  readonly mudChance: number
  readonly hazardChance: number
  readonly ratchetChance: number
  readonly gatePairs: number
  readonly minPlan: number
  readonly maxPlan: number
  readonly objective: Objective
}

export const TIERS: Record<Tier, TierSpec> = {
  calm: {
    label: 'Calm',
    blurb: 'Open ground, no pits. Learn how walls fold possibilities together.',
    size: 6,
    wallChance: 0.16,
    mudChance: 0.06,
    hazardChance: 0,
    ratchetChance: 0,
    gatePairs: 0,
    minPlan: 4,
    maxPlan: 8,
    objective: 'mark',
  },
  brisk: {
    label: 'Brisk',
    blurb: 'Tighter corridors, the first pits, and ratchets that only open one way.',
    size: 7,
    wallChance: 0.18,
    mudChance: 0.08,
    hazardChance: 0.05,
    ratchetChance: 0.07,
    gatePairs: 0,
    minPlan: 7,
    maxPlan: 13,
    objective: 'mark',
  },
  severe: {
    label: 'Severe',
    blurb: 'Gates throw you across the board, so distant worlds can merge at last.',
    size: 8,
    wallChance: 0.2,
    mudChance: 0.08,
    hazardChance: 0.06,
    ratchetChance: 0.08,
    gatePairs: 1,
    minPlan: 11,
    maxPlan: 22,
    objective: 'mark',
  },
  reset: {
    label: 'Reset',
    blurb: 'No mark. Collapse the fog anywhere at all — the bare synchronizing word.',
    size: 8,
    wallChance: 0.17,
    mudChance: 0.05,
    hazardChance: 0,
    ratchetChance: 0.1,
    gatePairs: 1,
    minPlan: 8,
    maxPlan: 20,
    objective: 'reset',
  },
}

export interface Level {
  readonly board: Board
  readonly seed: string
  readonly tier: Tier
  readonly objective: Objective
  /** A certified shortest solution. Every generated level ships with one. */
  readonly solution: readonly Direction[]
  readonly startingWorlds: number
  /**
   * Černý's bound on the shortest synchronizing word for an n-state automaton,
   * (n-1)², shown next to par so the number means something.
   */
  readonly cernyBound: number
}

const MAX_ATTEMPTS = 600

/**
 * Generate a certified level.
 *
 * Nothing is published without being solved first, so difficulty is a measured
 * quantity (the length of the shortest synchronizing plan) rather than a guess.
 * Late attempts relax the length window instead of failing, which keeps a typed
 * seed from ever landing on an empty screen.
 */
export function generateLevel(seedText: string, tier: Tier): Level {
  const spec = TIERS[tier]
  const rng = createRng(hashSeed(`${seedText}:${tier}`))

  let fallback: Level | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const board = sampleBoard(rng, spec)
    const worlds = initialBelief(board).length
    if (worlds < spec.size * 2) continue

    const { plan } = solve(board, { maxStates: 120_000, objective: spec.objective })
    if (!plan || plan.length < 3) continue
    if (!usesItsFurniture(board, plan, spec)) continue

    const level: Level = {
      board,
      seed: seedText,
      tier,
      objective: spec.objective,
      solution: plan,
      startingWorlds: worlds,
      cernyBound: (worlds - 1) ** 2,
    }
    if (plan.length >= spec.minPlan && plan.length <= spec.maxPlan) return level
    if (
      !fallback ||
      Math.abs(plan.length - spec.minPlan) < Math.abs(fallback.solution.length - spec.minPlan)
    ) {
      fallback = level
    }
  }

  if (fallback) return fallback
  throw new Error(`could not generate a ${tier} level for seed ${seedText}`)
}

/**
 * A gate nobody ever falls through is just decoration.
 *
 * Levels that advertise a mechanic have to make the certified solution actually
 * use it, or the tier teaches nothing and plays like the tier below it.
 */
function usesItsFurniture(board: Board, plan: readonly Direction[], spec: TierSpec): boolean {
  if (spec.gatePairs === 0) return true

  const gates = new Set(Object.keys(board.gates).map(Number))
  let belief = initialBelief(board)
  for (const move of plan) {
    const before = belief
    const next = step(board, belief, move)
    if (next === 'dead') return false
    if (before.some((cell) => touchesGate(board, cell, move, gates))) return true
    belief = next
  }
  return false
}

function touchesGate(board: Board, from: number, direction: Direction, gates: Set<number>): boolean {
  const landed = step(board, [from], direction)
  if (landed === 'dead') return false
  return gates.has(landed[0]) || [...gates].some((gate) => board.gates[gate] === landed[0])
}

function sampleBoard(rng: Rng, spec: TierSpec): Board {
  const { size } = spec
  const cells: Cell[] = []

  for (let i = 0; i < size * size; i += 1) {
    if (rng.chance(spec.wallChance)) cells.push('wall')
    else if (rng.chance(spec.hazardChance)) cells.push('hazard')
    else if (rng.chance(spec.mudChance)) cells.push('mud')
    else if (rng.chance(spec.ratchetChance)) cells.push(`ratchet-${rng.pick(DIRECTIONS)}` as Cell)
    else cells.push('floor')
  }

  const gates: Record<number, number> = {}
  for (let pair = 0; pair < spec.gatePairs; pair += 1) {
    const first = pickPlain(cells, rng)
    const second = pickPlain(cells, rng, first)
    if (first === null || second === null) break
    cells[first] = 'gate'
    cells[second] = 'gate'
    gates[first] = second
    gates[second] = first
  }

  const standable: number[] = []
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== 'wall' && cells[i] !== 'hazard') standable.push(i)
  }
  if (standable.length === 0) {
    cells[0] = 'floor'
    standable.push(0)
  }

  return { width: size, height: size, cells, gates, goal: rng.pick(standable) }
}

function pickPlain(cells: readonly Cell[], rng: Rng, avoid?: number | null): number | null {
  const options: number[] = []
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] === 'floor' && i !== avoid) options.push(i)
  }
  return options.length === 0 ? null : rng.pick(options)
}

/** How many worlds the last move folded together. */
export function mergeCount(before: Belief, after: Belief): number {
  return Math.max(0, before.length - after.length)
}

/** The seed everybody gets on a given day, so scores are comparable. */
export function dailySeed(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `DAILY-${year}${month}${day}`
}
