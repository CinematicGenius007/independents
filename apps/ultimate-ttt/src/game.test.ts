import { describe, expect, it } from 'vitest'
import { applyMove, initialState, legalMoves, moveError } from './game'
import type { GameState, Move } from './game'

function play(moves: Move[], state = initialState()): GameState {
  return moves.reduce((s, m) => {
    const next = applyMove(s, m)
    if (!next) throw new Error(`illegal: ${JSON.stringify(m)} — ${moveError(s, m)}`)
    return next
  }, state)
}

describe('the rules', () => {
  it('sends the opponent to the board matching the cell just played', () => {
    const s = play([{ board: 4, cell: 2 }])
    expect(s.current).toBe('O')
    expect(s.activeBoard).toBe(2)
    expect(moveError(s, { board: 5, cell: 0 })).toMatch(/highlighted/)
  })

  it('awards a small board on three in a row', () => {
    // O is always sent back to board 0 and completes 6-7-8 there.
    const s = play([
      { board: 0, cell: 0 }, { board: 0, cell: 3 },
      { board: 3, cell: 0 }, { board: 0, cell: 4 },
      { board: 4, cell: 0 }, { board: 0, cell: 8 },
      { board: 8, cell: 0 }, { board: 0, cell: 6 },
      { board: 6, cell: 0 }, { board: 0, cell: 7 },
    ])
    expect(s.boardWinners[0]).toBe('O')
    expect(s.winner).toBeNull()
  })

  it('frees the next player when sent to a decided board', () => {
    let s = initialState()
    s = { ...s, boardWinners: ['X', null, null, null, null, null, null, null, null] }
    s = applyMove(s, { board: 4, cell: 0 })!
    expect(s.activeBoard).toBeNull()
  })

  it('refuses taken cells, decided boards, and finished games', () => {
    const s = play([{ board: 4, cell: 4 }])
    expect(applyMove(s, { board: 4, cell: 4 })).toBeNull()
    expect(applyMove({ ...s, winner: 'X' }, { board: 4, cell: 0 })).toBeNull()
    expect(applyMove(s, { board: 9, cell: 0 })).toBeNull()
    expect(applyMove(s, { board: 4.5, cell: 0 })).toBeNull()
  })

  it('declares a draw when every board is decided and nobody has three', () => {
    // Board winners laid out with no line for either side, last board open.
    const layout: GameState['boardWinners'] = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null]
    let s: GameState = { ...initialState(), boardWinners: layout, activeBoard: 8 }
    // Fill board 8 to a tie without anyone winning it.
    const fill: Move[] = [0, 1, 2, 4, 3, 5, 7, 6, 8].map(cell => ({ board: 8, cell }))
    for (const m of fill) {
      s = { ...applyMove(s, m)!, activeBoard: s.boardWinners[8] ? null : 8 }
      if (s.winner) break
    }
    expect(s.boardWinners[8]).toBe('tie')
    expect(s.winner).toBe('tie')
    expect(legalMoves(s)).toEqual([])
  })

  it('always has a legal move until the game is decided', () => {
    let s = initialState()
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 81 && !s.winner; i++) {
      const moves = legalMoves(s)
      expect(moves.length).toBeGreaterThan(0)
      s = applyMove(s, moves[Math.floor(rand() * moves.length)])!
    }
  })
})
