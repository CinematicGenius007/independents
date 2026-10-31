import { describe, expect, it } from 'vitest'
import { applyMove, initialState, legalMoves } from './game'
import type { Move } from './game'
import { decodeRecord, encodeRecord, matchNumber, parseReplayHash, replayHash, stateAt } from './record'
import type { MatchRecord } from './record'

/** A deterministic game: always the first legal move, until it ends or `limit` moves. */
function game(limit = 81, pick = (n: number) => n): MatchRecord {
  let state = initialState('X')
  const moves: Move[] = []
  while (!state.winner && moves.length < limit) {
    const legal = legalMoves(state)
    const move = legal[pick(moves.length) % legal.length]
    moves.push(move)
    state = applyMove(state, move)!
  }
  return { starter: 'X', moves }
}

describe('record', () => {
  it('round-trips games of every shape', () => {
    for (const record of [game(0), game(1), game(30), game(81), game(81, n => n * 7 + 3), game(81, n => n * 13 + 1)]) {
      expect(decodeRecord(encodeRecord(record))).toEqual(record)
    }
  })

  it('keeps a whole game small', () => {
    expect(encodeRecord(game(81, n => n * 7 + 3)).length).toBeLessThan(90)
  })

  it('round-trips the O starter', () => {
    const record: MatchRecord = { starter: 'O', moves: [{ board: 4, cell: 4 }] }
    expect(decodeRecord(encodeRecord(record))).toEqual(record)
  })

  it('rejects text that is not a record', () => {
    expect(decodeRecord('')).toBeNull()
    expect(decodeRecord('not base64!')).toBeNull()
    expect(decodeRecord('AAAA')).toBeNull()
  })

  it('rejects truncated and padded records', () => {
    const text = encodeRecord(game(40))
    expect(decodeRecord(text.slice(0, text.length - 6))).toBeNull()
    expect(decodeRecord(text + 'AAAA')).toBeNull()
  })

  it('refuses to encode an illegal game', () => {
    expect(() => encodeRecord({ starter: 'X', moves: [{ board: 0, cell: 0 }, { board: 5, cell: 0 }] })).toThrow()
  })

  it('numbers a game the same way every time, and different games differently', async () => {
    const a = game(40)
    const b = game(40, n => n * 5 + 2)
    expect(await matchNumber(a)).toBe(await matchNumber(a))
    expect(await matchNumber(a)).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/)
    expect(await matchNumber(a)).not.toBe(await matchNumber(b))
  })

  it('reads a replay hash back, with and without its number', async () => {
    const record = game(25)
    const code = encodeRecord(record)
    const n = await matchNumber(record)
    expect(parseReplayHash(replayHash(code, n))).toEqual({ record, claimed: n })
    expect(parseReplayHash(`#m=${code}`)).toEqual({ record, claimed: null })
    expect(parseReplayHash('#room=ABCDE')).toBeNull()
  })

  it('rebuilds the position at any move', () => {
    const record = game(12)
    expect(stateAt(record, 0)).toEqual(initialState('X'))
    expect(stateAt(record, 5).moveCount).toBe(5)
    expect(stateAt(record, 999).moveCount).toBe(12)
  })
})
