import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  describePlacement,
  finalScore,
  floorPenalty,
  legalMoves,
  moveError,
  needsDeal,
  startRound,
  tileWall,
} from './rules'
import type { Color, GameState } from './types'
import { CENTER, COLORS, FLOOR, WALL_SIZE, wallColor, wallColumn } from './types'

function game(factories: Color[][], seats = 2): GameState {
  return startRound(
    createGame(
      Array.from({ length: seats }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` })),
    ),
    factories,
  )
}

function emptyWall(): boolean[][] {
  return Array.from({ length: WALL_SIZE }, () => Array.from({ length: WALL_SIZE }, () => false))
}

describe('the wall pattern', () => {
  it('holds each colour once per row and once per column', () => {
    for (let r = 0; r < WALL_SIZE; r++) {
      const row = COLORS.map((_, c) => wallColor(r, c))
      expect(new Set(row).size).toBe(WALL_SIZE)
    }
    for (let c = 0; c < WALL_SIZE; c++) {
      const col = COLORS.map((_, r) => wallColor(r, c))
      expect(new Set(col).size).toBe(WALL_SIZE)
    }
  })

  it('agrees with its own inverse', () => {
    for (let r = 0; r < WALL_SIZE; r++) {
      for (const color of COLORS) {
        expect(wallColor(r, wallColumn(r, color))).toBe(color)
      }
    }
  })
})

describe('taking tiles', () => {
  it('moves the rest of a display to the centre', () => {
    const state = game([['cobalt', 'cobalt', 'saffron', 'crimson'], []])
    const { state: next } = applyMove(state, { source: 0, color: 'cobalt', line: 1 })
    expect(next.factories[0]).toEqual([])
    expect(next.center.sort()).toEqual(['crimson', 'saffron'])
    expect(next.players[0].lines[1]).toEqual({ color: 'cobalt', count: 2 })
  })

  it('leaves the centre alone when taking from the centre', () => {
    let state = game([['cobalt', 'cobalt', 'saffron', 'crimson'], ['basalt', 'basalt', 'basalt', 'basalt']])
    state = applyMove(state, { source: 0, color: 'cobalt', line: 1 }).state
    const { state: next } = applyMove(state, { source: CENTER, color: 'saffron', line: 0 })
    expect(next.center).toEqual(['crimson'])
    expect(next.players[1].lines[0]).toEqual({ color: 'saffron', count: 1 })
  })

  it('spills tiles a line cannot hold onto the floor', () => {
    const state = game([['cobalt', 'cobalt', 'cobalt', 'cobalt'], []])
    const { state: next } = applyMove(state, { source: 0, color: 'cobalt', line: 0 })
    expect(next.players[0].lines[0]).toEqual({ color: 'cobalt', count: 1 })
    expect(next.players[0].floor).toEqual(['cobalt', 'cobalt', 'cobalt'])
  })

  it('lets a player dump a whole handful on the floor on purpose', () => {
    const state = game([['crimson', 'crimson', 'crimson', 'crimson'], []])
    const { state: next } = applyMove(state, { source: 0, color: 'crimson', line: FLOOR })
    expect(next.players[0].floor).toEqual(['crimson', 'crimson', 'crimson', 'crimson'])
    expect(next.players[0].lines.every(l => l.count === 0)).toBe(true)
  })

  it('discards floor tiles past the seventh slot', () => {
    let state = game([
      ['cobalt', 'cobalt', 'cobalt', 'cobalt'],
      ['saffron', 'saffron', 'saffron', 'saffron'],
      ['crimson', 'crimson', 'crimson', 'crimson'],
      ['basalt', 'basalt', 'basalt', 'basalt'],
      ['verdigris', 'verdigris', 'verdigris', 'verdigris'],
    ])
    state = applyMove(state, { source: 0, color: 'cobalt', line: FLOOR }).state
    state = applyMove(state, { source: 1, color: 'saffron', line: FLOOR }).state
    const { state: next, discarded } = applyMove(state, { source: 2, color: 'crimson', line: FLOOR })
    expect(next.players[0].floor).toHaveLength(7)
    expect(discarded).toEqual(['crimson'])
  })
})

describe('the starting player marker', () => {
  it('goes to the first player to take from the centre', () => {
    let state = game([['cobalt', 'cobalt', 'saffron', 'crimson'], ['basalt', 'basalt', 'basalt', 'basalt']])
    state = applyMove(state, { source: 0, color: 'cobalt', line: 1 }).state
    expect(state.centerHasFirst).toBe(true)
    state = applyMove(state, { source: CENTER, color: 'saffron', line: 0 }).state
    expect(state.centerHasFirst).toBe(false)
    expect(state.nextStarter).toBe(1)
    expect(state.players[1].floor).toEqual(['first'])
    expect(state.players[1].lines[0]).toEqual({ color: 'saffron', count: 1 })
  })

  it('is only claimed once in a round', () => {
    let state = game([
      ['cobalt', 'cobalt', 'saffron', 'crimson'],
      ['basalt', 'basalt', 'verdigris', 'verdigris'],
    ])
    state = applyMove(state, { source: 0, color: 'cobalt', line: 1 }).state
    state = applyMove(state, { source: CENTER, color: 'saffron', line: 0 }).state
    state = applyMove(state, { source: 1, color: 'basalt', line: 3 }).state
    state = applyMove(state, { source: CENTER, color: 'crimson', line: 2 }).state
    expect(state.players[1].floor.filter(t => t === 'first')).toHaveLength(1)
    expect(state.nextStarter).toBe(1)
  })
})

describe('legality', () => {
  it('refuses a colour already on the wall in that row', () => {
    const state = game([['cobalt', 'cobalt', 'saffron', 'crimson'], []])
    state.players[0].wall[1][wallColumn(1, 'cobalt')] = true
    expect(moveError(state, { source: 0, color: 'cobalt', line: 1 })).toMatch(/already on the wall/)
    expect(moveError(state, { source: 0, color: 'cobalt', line: 2 })).toBeNull()
  })

  it('refuses a line already holding another colour', () => {
    let state = game([['cobalt', 'saffron', 'saffron', 'crimson'], ['cobalt', 'cobalt', 'cobalt', 'cobalt']])
    state = applyMove(state, { source: 0, color: 'saffron', line: 2 }).state
    state = applyMove(state, { source: 1, color: 'cobalt', line: 3 }).state
    expect(moveError(state, { source: CENTER, color: 'cobalt', line: 2 })).toMatch(/another colour/)
  })

  it('refuses a full line, and offers the floor instead', () => {
    let state = game([['cobalt', 'cobalt', 'crimson', 'crimson'], ['saffron', 'saffron', 'saffron', 'saffron']])
    state = applyMove(state, { source: 0, color: 'cobalt', line: 1 }).state
    state = applyMove(state, { source: 1, color: 'saffron', line: 0 }).state
    expect(moveError(state, { source: CENTER, color: 'crimson', line: 1 })).toMatch(/another colour/)
    expect(moveError(state, { source: CENTER, color: 'crimson', line: FLOOR })).toBeNull()
    state = applyMove(state, { source: CENTER, color: 'crimson', line: 2 }).state
    expect(state.players[0].lines[2].count).toBe(2)
  })

  it('always leaves the player at least one legal move while tiles are out', () => {
    const state = game([['cobalt', 'cobalt', 'saffron', 'crimson'], ['basalt', 'basalt', 'verdigris', 'verdigris']])
    for (const p of state.players) {
      p.wall = p.wall.map(row => row.map(() => true))
    }
    const moves = legalMoves(state)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every(m => m.line === FLOOR)).toBe(true)
  })
})

describe('scoring a placement', () => {
  it('gives one point to a tile touching nothing', () => {
    const wall = emptyWall()
    wall[2][2] = true
    expect(describePlacement(wall, 2, 2)).toEqual({ points: 1, horizontal: 1, vertical: 1 })
  })

  it('counts the whole horizontal run', () => {
    const wall = emptyWall()
    wall[0][0] = wall[0][1] = wall[0][2] = true
    expect(describePlacement(wall, 0, 2).points).toBe(3)
  })

  it('counts both runs when a tile joins a row and a column', () => {
    const wall = emptyWall()
    wall[1][1] = wall[1][2] = true
    wall[0][3] = wall[1][3] = wall[2][3] = true
    expect(describePlacement(wall, 1, 3)).toEqual({ points: 6, horizontal: 3, vertical: 3 })
  })

  it('counts runs on both sides of the new tile', () => {
    const wall = emptyWall()
    wall[3][0] = wall[3][1] = wall[3][2] = wall[3][3] = wall[3][4] = true
    expect(describePlacement(wall, 3, 2).points).toBe(5)
  })
})

describe('the floor line', () => {
  it('charges -1 -1 -2 -2 -2 -3 -3', () => {
    expect(floorPenalty([])).toBe(0)
    expect(floorPenalty(['cobalt'])).toBe(-1)
    expect(floorPenalty(['cobalt', 'cobalt'])).toBe(-2)
    expect(floorPenalty(['cobalt', 'cobalt', 'cobalt'])).toBe(-4)
    expect(floorPenalty(Array(7).fill('cobalt'))).toBe(-14)
  })

  it('charges the starting player marker like any other tile', () => {
    expect(floorPenalty(['first'])).toBe(-1)
  })
})

describe('wall tiling', () => {
  it('moves complete lines only, and leaves the rest', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    state.players[0].lines[0] = { color: 'cobalt', count: 1 }
    state.players[0].lines[2] = { color: 'crimson', count: 2 }
    const { state: next, discarded } = tileWall(state)
    expect(next.players[0].wall[0][wallColumn(0, 'cobalt')]).toBe(true)
    expect(next.players[0].lines[0]).toEqual({ color: null, count: 0 })
    expect(next.players[0].lines[2]).toEqual({ color: 'crimson', count: 2 })
    expect(discarded).toEqual([])
  })

  it('sends the surplus of a completed line to the lid', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    state.players[0].lines[3] = { color: 'saffron', count: 4 }
    const { discarded } = tileWall(state)
    expect(discarded).toEqual(['saffron', 'saffron', 'saffron'])
  })

  it('never drops a score below zero', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    state.players[0].score = 1
    state.players[0].floor = ['cobalt', 'cobalt', 'cobalt', 'cobalt']
    const { state: next } = tileWall(state)
    expect(next.players[0].score).toBe(0)
  })

  it('sweeps the floor and puts the marker back on the table', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    state.players[1].floor = ['first', 'cobalt']
    state.centerHasFirst = false
    state.nextStarter = 1
    const { state: next, discarded } = tileWall(state)
    expect(next.players[1].floor).toEqual([])
    expect(next.centerHasFirst).toBe(true)
    expect(next.current).toBe(1)
    expect(discarded).toEqual(['cobalt'])
  })

  it('hands the next round to whoever took the marker', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    state.nextStarter = 1
    const { state: next } = tileWall(state)
    expect(next.current).toBe(1)
    expect(next.round).toBe(2)
    expect(needsDeal(next)).toBe(true)
  })
})

describe('the end of the game', () => {
  it('ends the moment a horizontal line is finished', () => {
    const state = game([[], []])
    state.phase = 'tiling'
    for (let c = 0; c < 4; c++) state.players[0].wall[0][c] = true
    state.players[0].lines[0] = { color: wallColor(0, 4), count: 1 }
    const { state: next } = tileWall(state)
    expect(next.phase).toBe('over')
    expect(next.winners).toEqual([0])
  })

  it('pays 2 a row, 7 a column, 10 a colour', () => {
    const state = game([[], []])
    state.players[0].wall[0] = [true, true, true, true, true]
    state.players[0].score = 10
    const scored = finalScore(state)
    expect(scored.finalReports?.[0]).toMatchObject({ rows: 1, columns: 0, colors: 0, bonus: 2 })

    const full = game([[], []])
    full.players[0].wall = full.players[0].wall.map(row => row.map(() => true))
    const perfect = finalScore(full)
    expect(perfect.finalReports?.[0].bonus).toBe(5 * 2 + 5 * 7 + 5 * 10)
  })

  it('breaks a tie on complete rows, and shares the win otherwise', () => {
    const tied = game([[], []])
    tied.players[0].score = 20
    tied.players[1].score = 20
    expect(finalScore(tied).winners).toEqual([0, 1])

    const broken = game([[], []])
    broken.players[0].score = 18
    broken.players[0].wall[0] = [true, true, true, true, true]
    broken.players[1].score = 20
    expect(finalScore(broken).winners).toEqual([0])
  })
})

describe('a whole round', () => {
  it('passes the turn in seating order and stops when the table is bare', () => {
    let state = game(
      [
        ['cobalt', 'cobalt', 'cobalt', 'cobalt'],
        ['saffron', 'saffron', 'saffron', 'saffron'],
        ['crimson', 'crimson', 'crimson', 'crimson'],
      ],
      3,
    )
    expect(state.current).toBe(0)
    state = applyMove(state, { source: 0, color: 'cobalt', line: 3 }).state
    expect(state.current).toBe(1)
    state = applyMove(state, { source: 1, color: 'saffron', line: 3 }).state
    expect(state.current).toBe(2)
    state = applyMove(state, { source: 2, color: 'crimson', line: 3 }).state
    expect(state.phase).toBe('tiling')
  })
})
