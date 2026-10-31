import { describe, expect, it } from 'vitest'
import { applyMove, initialState, legalMoves, moveError } from './game'
import type { GameState } from './game'
import { chooseMove } from './ai'
import type { Level } from './ai'

/** X holds boards 0 and 1 and two cells of board 2: playing 2/2 wins the game. */
function winInOne(): GameState {
  const s = initialState('X')
  s.boardWinners[0] = 'X'
  s.boardWinners[1] = 'X'
  s.boards[2][0] = 'X'
  s.boards[2][1] = 'X'
  s.boards[2][3] = 'O'
  s.boards[2][4] = 'O'
  s.activeBoard = 2
  return s
}

const levels: Level[] = ['rookie', 'tactician', 'grandmaster']

describe('ai', () => {
  for (const level of levels) {
    it(`${level} takes a win when one is there`, () => {
      expect(chooseMove(winInOne(), level, Math.random, 100)).toEqual({ board: 2, cell: 2 })
    })

    it(`${level} always plays a legal move, start to finish`, () => {
      let state = initialState('X')
      while (!state.winner) {
        const move = chooseMove(state, level, Math.random, 20)
        expect(moveError(state, move)).toBeNull()
        state = applyMove(state, move)!
      }
      expect(legalMoves(state)).toEqual([])
    })
  }

  it('the tactician beats the rookie', () => {
    // Seeded, and depth-limited rather than timed, so the result is the same on every machine.
    let seed = 12345
    const rng = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    let wins = 0
    for (let g = 0; g < 6; g++) {
      let state = initialState('X')
      const strong = g % 2 === 0 ? 'X' : 'O'
      while (!state.winner) {
        const level: Level = state.current === strong ? 'tactician' : 'rookie'
        state = applyMove(state, chooseMove(state, level, rng))!
      }
      if (state.winner === strong) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(4)
  })
})
