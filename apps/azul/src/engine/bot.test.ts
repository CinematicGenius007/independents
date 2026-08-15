import { describe, expect, it } from 'vitest'
import { chooseMove } from './bot'
import { Game } from './game'
import { applyMove, createGame, legalMoves, moveError, startRound } from './rules'
import { createRng } from './rng'
import { assertTileConservation, playGame, randomMove } from './selfplay'
import type { GameState } from './types'
import { FLOOR, wallColumn } from './types'

describe('the bot', () => {
  it('only ever plays legal moves, over a whole game', () => {
    const game = Game.create([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ], 42)
    const rng = createRng(7)
    let guard = 0
    while (game.state.phase !== 'over' && guard++ < 400) {
      if (game.needsDeal()) {
        game.deal()
        if (game.needsDeal()) break
        continue
      }
      if (game.state.phase === 'tiling') {
        game.tile()
        continue
      }
      const move = chooseMove(game.state, rng, 'master')
      expect(move).not.toBeNull()
      expect(moveError(game.state, move!)).toBeNull()
      game.play(move!)
      assertTileConservation(game.state)
    }
    expect(game.state.phase).toBe('over')
  })

  it('takes the one tile that can still reach its wall, not the ones that cannot', () => {
    const state: GameState = startRound(
      createGame([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
      [['cobalt', 'saffron', 'crimson', 'basalt']],
    )
    // The wall is finished but for one cobalt space, so every other colour on
    // that display is floor sweepings.
    state.players[0].wall = state.players[0].wall.map(row => row.map(() => true))
    state.players[0].wall[0][wallColumn(0, 'cobalt')] = false
    const move = chooseMove(state, createRng(1), 'master')
    expect(move).toMatchObject({ source: 0, color: 'cobalt', line: 0 })
  })

  it('prefers the line that swallows the whole handful', () => {
    const state: GameState = startRound(
      createGame([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
      [['crimson', 'crimson', 'crimson', 'crimson']],
    )
    const move = chooseMove(state, createRng(2), 'master')
    expect(move?.color).toBe('crimson')
    expect(move?.line).toBeGreaterThanOrEqual(3)
    const { state: after } = applyMove(state, move!)
    expect(after.players[0].floor).toEqual([])
  })

  it('would rather eat a small floor penalty than a large one', () => {
    const state: GameState = startRound(
      createGame([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
      [
        ['cobalt', 'cobalt', 'cobalt', 'cobalt'],
        ['saffron', 'crimson', 'basalt', 'verdigris'],
      ],
    )
    // Every row on the wall already holds cobalt, so cobalt can only go to the
    // floor — four penalties. The mixed display offers single tiles instead.
    for (let row = 0; row < 5; row++) {
      state.players[0].wall[row][wallColumn(row, 'cobalt')] = true
    }
    const move = chooseMove(state, createRng(3), 'master')
    expect(move?.color).not.toBe('cobalt')
  })

  it('beats random play convincingly', () => {
    let botWins = 0
    let games = 0
    for (let seed = 0; seed < 24; seed++) {
      const game = Game.create([
        { id: 'bot', name: 'Bot' },
        { id: 'rnd', name: 'Random' },
      ], seed)
      const rng = createRng(seed + 1000)
      let guard = 0
      while (game.state.phase !== 'over' && guard++ < 400) {
        if (game.needsDeal()) {
          game.deal()
          if (game.needsDeal()) break
          continue
        }
        if (game.state.phase === 'tiling') {
          game.tile()
          continue
        }
        const move =
          game.state.current === 0
            ? chooseMove(game.state, rng, 'master')
            : randomMove(game.state, rng)
        if (!move) break
        game.play(move)
      }
      games++
      if (game.state.players[0].score > game.state.players[1].score) botWins++
    }
    expect(games).toBe(24)
    expect(botWins).toBeGreaterThanOrEqual(22)
  })

  it('plays out four seats without stalling', () => {
    const { state, rounds } = playGame({
      styles: ['master', 'artisan', 'apprentice', 'master'],
      seed: 99,
    })
    expect(state.phase).toBe('over')
    expect(state.winners?.length).toBeGreaterThan(0)
    expect(rounds).toBeGreaterThan(3)
    assertTileConservation(state)
  })

  it('has something to play even when the board is hostile', () => {
    const state = startRound(
      createGame([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
      [['cobalt', 'cobalt', 'cobalt', 'cobalt'], []],
    )
    state.players[0].wall = state.players[0].wall.map(row => row.map(() => true))
    const move = chooseMove(state, createRng(5), 'master')
    expect(move?.line).toBe(FLOOR)
    expect(() => applyMove(state, move!)).not.toThrow()
    expect(legalMoves(state).length).toBeGreaterThan(0)
  })
})
