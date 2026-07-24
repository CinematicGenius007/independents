import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { initialState, reduce } from './reducer'
import { drawerPoints, guesserPoints } from './scoring'
import type { EngineAction, GameState } from './types'
import type { GameConfig, Player } from '../shared/types'

const CONFIG: GameConfig = {
  turnSeconds: 80,
  rounds: 2,
  categories: ['general'],
  customWordsOnly: false,
  customWords: [],
  hintsEnabled: true,
}

function player(id: string, joinedAt: number): Player {
  return { id, nickname: id, color: '#F5D311', avatar: 0, connection: 'connected', joinedAt }
}

/**
 * Generates a plausible, but essentially random, replicated action log from
 * a seed. Every random choice flows through a single seeded `mulberry32`
 * instance, so the same seed always yields the same log. This deliberately
 * covers a mix of valid game-flow actions and "weird" out-of-order ones
 * (e.g. a GUESS_CORRECT with no active turn) to exercise the reducer's
 * no-op guards, since the reducer must never throw regardless of ordering.
 */
function genSharedActions(seed: number, length: number): EngineAction[] {
  const rand = mulberry32(seed)
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length) % arr.length]
  const ids = ['p1', 'p2', 'p3', 'p4']
  const actions: EngineAction[] = []
  let at = 0
  let turnIndex = 0

  for (let i = 0; i < length; i++) {
    at += 1 + Math.floor(rand() * 500)
    const kind = Math.floor(rand() * 14)
    switch (kind) {
      case 0:
        actions.push({ type: 'PLAYER_JOINED', player: player(pick(ids), at) })
        break
      case 1:
        actions.push({ type: 'PLAYER_LEFT', playerId: pick(ids) })
        break
      case 2:
        actions.push({
          type: 'PLAYER_CONNECTION',
          playerId: pick(ids),
          connection: pick(['connected', 'unstable', 'disconnected'] as const),
        })
        break
      case 3:
        actions.push({ type: 'HOST_CHANGED', hostId: pick(ids) })
        break
      case 4:
        actions.push({
          type: 'GAME_STARTED',
          gameNonce: `nonce-${seed}-${i}`,
          order: ids.slice(),
          config: CONFIG,
          at,
        })
        break
      case 5:
        actions.push({
          type: 'TURN_STARTED',
          index: turnIndex++,
          round: 1 + Math.floor(turnIndex / ids.length),
          drawerId: pick(ids),
          wordShape: [3, 5],
          category: 'general',
          startedAt: at,
          endsAt: at + CONFIG.turnSeconds * 1000,
        })
        break
      case 6: {
        const reveals: Record<number, string> = { 0: 'a' }
        reveals[Math.floor(rand() * 8)] = pick(['b', 'c', 'd', 'e'])
        actions.push({ type: 'HINT_REVEALED', reveals })
        break
      }
      case 7:
        actions.push({ type: 'GUESS_POSTED', playerId: pick(ids), text: `guess-${i}`, at })
        break
      case 8:
        actions.push({
          type: 'GUESS_CORRECT',
          playerId: pick(ids),
          elapsedMs: Math.floor(rand() * 80_000),
          points: guesserPoints(Math.floor(rand() * 80_000)),
          place: 1 + Math.floor(rand() * 4),
          at,
        })
        break
      case 9:
        actions.push({
          type: 'TURN_ENDED',
          word: 'someword',
          reason: pick(['timeout', 'all_guessed', 'skipped'] as const),
          drawerPoints: drawerPoints(Math.floor(rand() * 4)),
          at,
        })
        break
      case 10:
        actions.push({ type: 'ROUND_ENDED', round: 1 + Math.floor(rand() * 3), at })
        break
      case 11:
        actions.push({ type: 'GAME_ENDED', at })
        break
      case 12:
        actions.push({ type: 'INTERMISSION', nextTurnAt: at + 5000 })
        break
      case 13:
        actions.push({
          type: 'SYSTEM_MESSAGE',
          text: `sys-${i}`,
          at,
          audience: pick(['all', 'solved', pick(ids)] as const),
        })
        break
    }
  }
  return actions
}

function run(actions: EngineAction[]): GameState {
  let state = initialState('room-determinism', 'p1', CONFIG)
  for (const action of actions) {
    state = reduce(state, action)
  }
  return state
}

describe('determinism property test', () => {
  it('two independent engines fed the same action log land on byte-identical state (many seeds)', () => {
    for (let seed = 0; seed < 25; seed++) {
      const actions = genSharedActions(seed * 7919 + 1, 60)
      const stateA = run(actions)
      const stateB = run(actions)
      expect(JSON.stringify(stateA)).toBe(JSON.stringify(stateB))
    }
  })

  it('stays identical step-by-step, not just at the end (stronger than a final-state check)', () => {
    for (let seed = 0; seed < 5; seed++) {
      const actions = genSharedActions(seed * 104729 + 3, 40)
      let a = initialState('room', 'p1', CONFIG)
      let b = initialState('room', 'p1', CONFIG)
      for (const action of actions) {
        a = reduce(a, action)
        b = reduce(b, action)
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
      }
    }
  })

  it('never throws regardless of action ordering', () => {
    for (let seed = 0; seed < 25; seed++) {
      const actions = genSharedActions(seed * 65537 + 11, 80)
      expect(() => run(actions)).not.toThrow()
    }
  })
})

describe('full game simulation', () => {
  it('3 players x 2 rounds ends in game_over with correct cumulative scores', () => {
    let state = initialState('room-full-game', 'p1', CONFIG)
    state = reduce(state, { type: 'PLAYER_JOINED', player: player('p1', 0) })
    state = reduce(state, { type: 'PLAYER_JOINED', player: player('p2', 1) })
    state = reduce(state, { type: 'PLAYER_JOINED', player: player('p3', 2) })

    const order = ['p1', 'p2', 'p3']
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'full-game-nonce',
      order,
      config: { ...state.config, rounds: 2 },
      at: 0,
    })

    let clock = 0
    let turnIndex = 0
    for (let round = 1; round <= 2; round++) {
      for (let seat = 0; seat < order.length; seat++) {
        const drawerId = order[seat]
        const guessers = order.filter((id) => id !== drawerId)
        const startedAt = clock
        const endsAt = startedAt + CONFIG.turnSeconds * 1000

        state = reduce(state, {
          type: 'TURN_STARTED',
          index: turnIndex,
          round,
          drawerId,
          wordShape: [4],
          category: 'general',
          startedAt,
          endsAt,
        })

        // First guesser answers at 1s, second at 3s elapsed.
        const elapsedTimes = [1000, 3000]
        guessers.forEach((guesserId, place) => {
          const elapsedMs = elapsedTimes[place]
          state = reduce(state, {
            type: 'GUESS_CORRECT',
            playerId: guesserId,
            elapsedMs,
            points: guesserPoints(elapsedMs),
            place: place + 1,
            at: startedAt + elapsedMs,
          })
        })

        const correctCount = Object.keys(state.turn?.correct ?? {}).length
        state = reduce(state, {
          type: 'TURN_ENDED',
          word: 'word',
          reason: 'all_guessed',
          drawerPoints: drawerPoints(correctCount),
          at: startedAt + 3500,
        })

        clock = endsAt + 5000
        turnIndex++

        const isLastTurnOfGame = round === 2 && seat === order.length - 1
        const isLastTurnOfRound = seat === order.length - 1

        if (isLastTurnOfGame) {
          state = reduce(state, { type: 'ROUND_ENDED', round, at: clock })
          state = reduce(state, { type: 'GAME_ENDED', at: clock })
        } else if (isLastTurnOfRound) {
          state = reduce(state, { type: 'ROUND_ENDED', round, at: clock })
          state = reduce(state, { type: 'INTERMISSION', nextTurnAt: clock + 5000 })
        } else {
          state = reduce(state, { type: 'INTERMISSION', nextTurnAt: clock + 5000 })
        }
      }
    }

    expect(state.phase).toBe('game_over')
    expect(turnIndex).toBe(6)

    // Each turn: drawer earns drawerPoints(2) = 20; guessers earn
    // guesserPoints(1000) = 98 (place 1) and guesserPoints(3000) = 94 (place 2).
    // Each player draws exactly twice (once per round) and is a guesser the
    // other four turns, alternating between place 1 and place 2.
    expect(state.scores.p1).toBe(432)
    expect(state.scores.p2).toBe(424)
    expect(state.scores.p3).toBe(416)
    expect(state.scores.p1 + state.scores.p2 + state.scores.p3).toBe(6 * (20 + 98 + 94))
  })
})
