import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialState, reduce, type GameState } from '../engine'
import { createMesh as createMemoryMesh } from '../net/memory-transport'
import { createMesh } from '../net/mesh'
import { DEFAULT_CONFIG, type Player } from '../shared/types'
import { createGameController } from './controller'
import { createHostSequencer } from './hostSequencer'

const players: Player[] = [
  { id: 'peer-0', nickname: 'Host', color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 1 },
  { id: 'peer-1', nickname: 'Guest', color: '#F2603C', avatar: 1, connection: 'connected', joinedAt: 2 },
]

function lobbyState(selfId: string): GameState {
  let state = initialState('TEST00', selfId, { ...DEFAULT_CONFIG, turnSeconds: 30, rounds: 1 })
  for (const player of players) state = reduce(state, { type: 'PLAYER_JOINED', player })
  return reduce(state, { type: 'HOST_CHANGED', hostId: 'peer-0' })
}

afterEach(() => vi.useRealTimers())

describe('host sequencer', () => {
  it('starts a replicated turn and gives the word only to its drawer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { transports } = createMemoryMesh(2)
    const hostMesh = createMesh(transports[0])
    const guestMesh = createMesh(transports[1])
    const host = createGameController({ initialState: lobbyState('peer-0'), mesh: hostMesh })
    const guest = createGameController({ initialState: lobbyState('peer-1'), mesh: guestMesh })
    const sequencer = createHostSequencer({
      controller: host,
      mesh: hostMesh,
      words: [{ word: 'zebra', category: 'animals' }],
    })

    expect(sequencer.startGame()).toBe(true)
    expect(host.state().phase).toBe('drawing')
    expect(guest.state().turn).toMatchObject({ index: 0, wordShape: [5], category: 'animals' })
    const drawer = host.state().turn?.drawerId
    expect(drawer === 'peer-0' ? host.state().turn?.word : guest.state().turn?.word).toBe('zebra')
    expect(drawer === 'peer-0' ? guest.state().turn?.word : host.state().turn?.word).toBeNull()

    sequencer.stop()
    host.stop()
    guest.stop()
  })

  it('ends a turn once and reaches game over after intermission', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { transports } = createMemoryMesh(2)
    const hostMesh = createMesh(transports[0])
    const guestMesh = createMesh(transports[1])
    const host = createGameController({ initialState: lobbyState('peer-0'), mesh: hostMesh })
    const guest = createGameController({ initialState: lobbyState('peer-1'), mesh: guestMesh })
    const sequencer = createHostSequencer({ controller: host, mesh: hostMesh, words: [{ word: 'cat', category: 'animals' }] })
    sequencer.startGame()
    sequencer.endTurn('skipped')
    sequencer.endTurn('skipped')
    expect(host.state().phase).toBe('turn_intro')
    vi.advanceTimersByTime(5_000)
    expect(host.state().turn?.index).toBe(1)
    sequencer.endTurn('skipped')
    vi.advanceTimersByTime(5_000)
    expect(host.state().phase).toBe('game_over')
    expect(guest.state().phase).toBe('game_over')

    sequencer.stop()
    host.stop()
    guest.stop()
  })
})
