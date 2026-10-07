import { describe, expect, it } from 'vitest'
import { emptyTable, reduceTable, rematchMessage, replay, sideOf } from './table'

const A = 'alice-client-01'
const B = 'bob-client-0002'
const C = 'cy-spectator-03'

describe('an online table', () => {
  it('seats the first claimant on each side, and settles races by order', () => {
    const t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'X' } }, // too late
      { from: B, data: { k: 'claim', side: 'O' } },
      { from: C, data: { k: 'claim', side: 'O' } }, // too late
    ])
    expect(t.seats).toEqual({ X: A, O: B })
    expect(sideOf(t, C)).toBeNull()
  })

  it('will not seat one client on both sides', () => {
    const t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: A, data: { k: 'claim', side: 'O' } },
    ])
    expect(t.seats).toEqual({ X: A, O: null })
  })

  it('accepts moves only from the side to play, and only once both are seated', () => {
    let t = replay([{ from: A, data: { k: 'claim', side: 'X' } }])
    t = reduceTable(t, A, { k: 'move', board: 4, cell: 4 })
    expect(t.game.moveCount).toBe(0) // nobody to play against yet

    t = reduceTable(t, B, { k: 'claim', side: 'O' })
    t = reduceTable(t, B, { k: 'move', board: 4, cell: 4 }) // not O's turn
    expect(t.game.moveCount).toBe(0)
    t = reduceTable(t, C, { k: 'move', board: 4, cell: 4 }) // a spectator
    expect(t.game.moveCount).toBe(0)
    t = reduceTable(t, A, { k: 'move', board: 4, cell: 4 })
    expect(t.game.moveCount).toBe(1)
    t = reduceTable(t, B, { k: 'move', board: 0, cell: 0 }) // wrong board
    expect(t.game.moveCount).toBe(1)
  })

  it('ignores garbage without throwing', () => {
    const t = emptyTable()
    for (const junk of [null, 1, 'x', {}, { k: 'move' }, { k: 'claim', side: 'Z' }, { k: 'rematch' }]) {
      // (a rematch is well-formed but not allowed before the game ends)
      expect(reduceTable(t, A, junk)).toBe(t)
    }
  })

  it('swaps sides on a rematch, and the full log rebuilds the same table', () => {
    const log = [
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
    ]
    let t = replay(log)
    t = { ...t, game: { ...t.game, winner: 'X' } } // pretend the game ended
    const after = reduceTable(t, B, rematchMessage())
    expect(after.seats).toEqual({ X: B, O: A })
    expect(after.game.moveCount).toBe(0)
    expect(after.round).toBe(2)
  })

  it('refuses a rematch from a spectator', () => {
    const t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
    ])
    const over = { ...t, game: { ...t.game, winner: 'X' as const } }
    expect(reduceTable(over, C, { k: 'rematch' })).toBe(over)
  })

  it('ignores a rematch while the game is still being played', () => {
    const t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
      { from: A, data: { k: 'move', board: 4, cell: 4 } },
    ])
    expect(reduceTable(t, B, rematchMessage())).toBe(t)
  })

  it('derives the new seats itself, whatever the rematch message claims', () => {
    let t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
    ])
    t = { ...t, game: { ...t.game, winner: 'O' } }
    // Extra fields claiming other seats are simply ignored.
    const hijack = reduceTable(t, B, { k: 'rematch', seats: { X: B, O: C } })
    expect(hijack.seats).toEqual({ X: B, O: A })
  })
})
