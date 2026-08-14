import { initialBelief, isSolved, step, uncertainty, type Belief } from '../engine/belief'
import type { Direction } from '../engine/board'
import type { Level } from '../engine/generate'

/**
 * How many moves a level allows beyond its certified shortest plan.
 *
 * Headless playtests showed random flailing solves an unbudgeted board most of
 * the time — sliding collapses fog on its own, so unlimited moves means the
 * puzzle solves itself. At par + 3 that collapses to nearly zero, which is the
 * whole reason a budget exists.
 */
export const BUDGET_SLACK = 3

export type Status = 'playing' | 'won' | 'stranded'

export interface GameState {
  readonly level: Level
  readonly belief: Belief
  readonly history: readonly Belief[]
  readonly moves: readonly Direction[]
  readonly status: Status
  /** Set when the last input was refused, to explain why. */
  readonly refusal: { direction: Direction; doomedWorlds: number } | null
  /** How many worlds the last accepted move folded together. */
  readonly merged: number
}

export type GameAction =
  | { type: 'move'; direction: Direction }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'load'; level: Level }

export function startGame(level: Level): GameState {
  return {
    level,
    belief: initialBelief(level.board),
    history: [],
    moves: [],
    status: 'playing',
    refusal: null,
    merged: 0,
  }
}

export function budgetFor(level: Level): number {
  return level.solution.length + BUDGET_SLACK
}

export function movesLeft(state: GameState): number {
  return budgetFor(state.level) - state.moves.length
}

function countDoomed(state: GameState, direction: Direction): number {
  let doomed = 0
  for (const position of state.belief) {
    if (step(state.level.board, [position], direction) === 'dead') doomed += 1
  }
  return doomed
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return startGame(action.level)

    case 'reset':
      return startGame(state.level)

    case 'undo': {
      if (state.history.length === 0) return { ...state, refusal: null }
      const previous = state.history[state.history.length - 1]
      return {
        ...state,
        belief: previous,
        history: state.history.slice(0, -1),
        moves: state.moves.slice(0, -1),
        status: 'playing',
        refusal: null,
      }
    }

    case 'move': {
      if (state.status !== 'playing') return state

      const next = step(state.level.board, state.belief, action.direction)

      // A fatal move is refused rather than lost, but the attempt still costs a
      // step. Probing stays informative without being free.
      if (next === 'dead') {
        const spent: GameState = {
          ...state,
          history: [...state.history, state.belief],
          moves: [...state.moves, action.direction],
          merged: 0,
          refusal: { direction: action.direction, doomedWorlds: countDoomed(state, action.direction) },
        }
        return { ...spent, status: movesLeft(spent) <= 0 ? 'stranded' : 'playing' }
      }

      const advanced: GameState = {
        ...state,
        merged: state.belief.length - next.length,
        belief: next,
        history: [...state.history, state.belief],
        moves: [...state.moves, action.direction],
        refusal: null,
      }

      if (isSolved(state.level.board, next, state.level.objective)) return { ...advanced, status: 'won' }
      return { ...advanced, status: movesLeft(advanced) <= 0 ? 'stranded' : 'playing' }
    }

    default:
      return state
  }
}

/** What the player still does not know, in bits. */
export function bitsLeft(state: GameState): number {
  return uncertainty(state.belief)
}

/** Solved without spending a move more than the certified shortest plan. */
export function isCleanWin(state: GameState): boolean {
  return state.status === 'won' && state.moves.length <= state.level.solution.length
}
