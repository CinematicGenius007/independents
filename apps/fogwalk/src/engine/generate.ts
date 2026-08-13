import { initialBelief } from './belief'
import type { Board, Cell } from './board'
import { createRng, hashSeed, type Rng } from './rng'
import { solve } from './solver'

export type Tier = 'calm' | 'brisk' | 'severe'

export interface TierSpec {
  readonly label: string
  readonly blurb: string
  readonly size: number
  readonly wallChance: number
  readonly mudChance: number
  readonly hazardChance: number
  readonly minPlan: number
  readonly maxPlan: number
}

export const TIERS: Record<Tier, TierSpec> = {
  calm: {
    label: 'Calm',
    blurb: 'Open ground, no hazards. Learn how walls fold possibilities together.',
    size: 6,
    wallChance: 0.16,
    mudChance: 0.06,
    hazardChance: 0,
    minPlan: 4,
    maxPlan: 8,
  },
  brisk: {
    label: 'Brisk',
    blurb: 'Tighter corridors and the first pits. One bad world is still a loss.',
    size: 7,
    wallChance: 0.2,
    mudChance: 0.08,
    hazardChance: 0.05,
    minPlan: 7,
    maxPlan: 13,
  },
  severe: {
    label: 'Severe',
    blurb: 'Long plans, real pits, and merges that only happen in one order.',
    size: 8,
    wallChance: 0.22,
    mudChance: 0.09,
    hazardChance: 0.07,
    minPlan: 11,
    maxPlan: 22,
  },
}

export interface Level {
  readonly board: Board
  readonly seed: string
  readonly tier: Tier
  /** A certified shortest solution. Every generated level ships with one. */
  readonly solution: readonly ('up' | 'down' | 'left' | 'right')[]
  readonly startingWorlds: number
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

    const { plan } = solve(board, { maxStates: 120_000 })
    if (!plan || plan.length < 3) continue

    const level: Level = {
      board,
      seed: seedText,
      tier,
      solution: plan,
      startingWorlds: worlds,
    }
    if (plan.length >= spec.minPlan && plan.length <= spec.maxPlan) return level
    if (!fallback || Math.abs(plan.length - spec.minPlan) < Math.abs(fallback.solution.length - spec.minPlan)) {
      fallback = level
    }
  }

  if (fallback) return fallback
  throw new Error(`could not generate a ${tier} level for seed ${seedText}`)
}

function sampleBoard(rng: Rng, spec: TierSpec): Board {
  const { size } = spec
  const cells: Cell[] = []

  for (let i = 0; i < size * size; i += 1) {
    if (rng.chance(spec.wallChance)) cells.push('wall')
    else if (rng.chance(spec.hazardChance)) cells.push('hazard')
    else if (rng.chance(spec.mudChance)) cells.push('mud')
    else cells.push('floor')
  }

  const standable: number[] = []
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] !== 'wall' && cells[i] !== 'hazard') standable.push(i)
  }
  if (standable.length === 0) {
    cells[0] = 'floor'
    standable.push(0)
  }

  return { width: size, height: size, cells, goal: rng.pick(standable) }
}

/** The seed everybody gets on a given day, so scores are comparable. */
export function dailySeed(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `DAILY-${year}${month}${day}`
}
