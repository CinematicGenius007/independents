import {
  beliefKey,
  initialBelief,
  isNoop,
  isSolved,
  step,
  type Belief,
  type Objective,
} from './belief'
import { DIRECTIONS, type Board, type Direction } from './board'

export interface SolveOptions {
  /** Safety valve so a pathological board cannot hang the tab. */
  maxStates?: number
  objective?: Objective
}

export interface SolveResult {
  plan: Direction[] | null
  statesExplored: number
  exhausted: boolean
}

/**
 * Breadth-first search over belief states.
 *
 * The search space is the set of images of the starting belief under move
 * sequences. It stays small because moves only ever merge worlds, never split
 * them, so the frontier contracts as the puzzle progresses.
 */
export function solveFrom(board: Board, start: Belief, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? 200_000
  const objective = options.objective ?? 'mark'

  if (isSolved(board, start, objective)) return { plan: [], statesExplored: 0, exhausted: false }

  const seen = new Map<string, { belief: Belief; from: string | null; move: Direction | null }>()
  const startKey = beliefKey(start)
  seen.set(startKey, { belief: start, from: null, move: null })

  let frontier: string[] = [startKey]
  let explored = 0

  while (frontier.length > 0) {
    const next: string[] = []
    for (const key of frontier) {
      const node = seen.get(key)!
      explored += 1
      if (explored > maxStates) return { plan: null, statesExplored: explored, exhausted: true }

      for (const move of DIRECTIONS) {
        const moved = step(board, node.belief, move)
        if (moved === 'dead') continue
        if (isNoop(node.belief, moved)) continue

        const movedKey = beliefKey(moved)
        if (seen.has(movedKey)) continue
        seen.set(movedKey, { belief: moved, from: key, move })

        if (isSolved(board, moved, objective)) {
          return { plan: reconstruct(seen, movedKey), statesExplored: explored, exhausted: false }
        }
        next.push(movedKey)
      }
    }
    frontier = next
  }

  return { plan: null, statesExplored: explored, exhausted: false }
}

export function solve(board: Board, options: SolveOptions = {}): SolveResult {
  return solveFrom(board, initialBelief(board), options)
}

/** The move an optimal player would make next, or null when the position is lost. */
export function hintFrom(board: Board, belief: Belief, objective: Objective = 'mark'): Direction | null {
  const result = solveFrom(board, belief, { maxStates: 60_000, objective })
  if (!result.plan || result.plan.length === 0) return null
  return result.plan[0]
}

function reconstruct(
  seen: Map<string, { from: string | null; move: Direction | null }>,
  endKey: string,
): Direction[] {
  const moves: Direction[] = []
  let cursor: string | null = endKey
  while (cursor) {
    const node: { from: string | null; move: Direction | null } = seen.get(cursor)!
    if (node.move) moves.push(node.move)
    cursor = node.from
  }
  return moves.reverse()
}
