import { slide, standableCells, type Board, type Direction } from './board'

/** A belief is the sorted set of cells the walker could be standing on. */
export type Belief = readonly number[]

export function initialBelief(board: Board): Belief {
  return standableCells(board)
}

export function beliefKey(belief: Belief): string {
  return belief.join(',')
}

export function isSolved(board: Board, belief: Belief): boolean {
  return belief.length === 1 && belief[0] === board.goal
}

/**
 * Move every possible walker at once.
 *
 * Returns `'dead'` when any world would be killed, because a plan that works in
 * seven worlds and kills you in the eighth is not a plan. Worlds that land on the
 * same cell merge, and that merging is the only way a belief ever shrinks.
 */
export function step(board: Board, belief: Belief, direction: Direction): Belief | 'dead' {
  const next = new Set<number>()
  for (const position of belief) {
    const landed = slide(board, position, direction)
    if (landed === 'dead') return 'dead'
    next.add(landed)
  }
  return [...next].sort((a, b) => a - b)
}

export function isNoop(before: Belief, after: Belief): boolean {
  if (before.length !== after.length) return false
  return before.every((value, index) => value === after[index])
}

/** Run a whole plan, stopping at the first fatal move. */
export function runPlan(
  board: Board,
  plan: readonly Direction[],
): { belief: Belief; died: boolean; movesTaken: number } {
  let belief = initialBelief(board)
  for (let i = 0; i < plan.length; i += 1) {
    const next = step(board, belief, plan[i])
    if (next === 'dead') return { belief, died: true, movesTaken: i }
    belief = next
  }
  return { belief, died: false, movesTaken: plan.length }
}
