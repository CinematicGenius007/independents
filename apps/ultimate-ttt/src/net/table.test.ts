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
      expect(reduceTable(t, A, junk)).toBe(t)
    }
  })

  it('swaps sides on a rematch, and a rebased log alone rebuilds the table', () => {
    let t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
      { from: A, data: { k: 'move', board: 4, cell: 4 } },
    ])
    const rematch = rematchMessage(t)
    t = reduceTable(t, B, rematch)
    expect(t.seats).toEqual({ X: B, O: A })
    expect(t.game.moveCount).toBe(0)
    expect(t.round).toBe(2)

    // What a late joiner sees after the service dropped the old log.
    const fromRebased = replay([{ from: B, data: rematch }])
    expect(fromRebased.seats).toEqual(t.seats)
    expect(fromRebased.game).toEqual(t.game)
  })

  it('refuses a rematch from a spectator', () => {
    const t = replay([
      { from: A, data: { k: 'claim', side: 'X' } },
      { from: B, data: { k: 'claim', side: 'O' } },
    ])
    expect(reduceTable(t, C, { k: 'rematch', seats: { X: C, O: A } })).toBe(t)
  })
})
