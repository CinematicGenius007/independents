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

  it('the grandmaster beats the rookie', () => {
    let gm = 0
    for (let g = 0; g < 4; g++) {
      let state = initialState('X')
      const gmSide = g % 2 === 0 ? 'X' : 'O'
      while (!state.winner) {
        const level: Level = state.current === gmSide ? 'grandmaster' : 'rookie'
        state = applyMove(state, chooseMove(state, level, Math.random, 25))!
      }
      if (state.winner === gmSide) gm++
    }
    expect(gm).toBeGreaterThanOrEqual(3)
  })
})
