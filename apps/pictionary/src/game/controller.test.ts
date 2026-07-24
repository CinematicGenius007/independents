import { describe, expect, it } from 'vitest'
import { initialState, reduce, type GameState } from '../engine'
import { createMesh as createMemoryMesh } from '../net/memory-transport'
import { createMesh } from '../net/mesh'
import { DEFAULT_CONFIG, type Player } from '../shared/types'
import { createGameController } from './controller'

const players: Player[] = [
  { id: 'peer-0', nickname: 'Host', color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 1 },
  { id: 'peer-1', nickname: 'Guest', color: '#F2603C', avatar: 1, connection: 'connected', joinedAt: 2 },
]

function drawingState(selfId: string): GameState {
  let state = initialState('TEST00', selfId, DEFAULT_CONFIG)
  for (const player of players) state = reduce(state, { type: 'PLAYER_JOINED', player })
  state = reduce(state, { type: 'HOST_CHANGED', hostId: 'peer-0' })
  state = reduce(state, {
    type: 'GAME_STARTED', gameNonce: 'game-1', order: ['peer-0', 'peer-1'], config: DEFAULT_CONFIG, at: 1_000,
  })
  return reduce(state, {
    type: 'TURN_STARTED', index: 0, round: 1, drawerId: 'peer-0', wordShape: [5], category: 'animals',
    startedAt: 2_000, endsAt: 82_000,
  })
}

describe('game controller', () => {
  it('routes a guest guess through host adjudication and replicates the score', () => {
    const { transports } = createMemoryMesh(2)
    const host = createGameController({ initialState: drawingState('peer-0'), mesh: createMesh(transports[0]), now: () => 7_000 })
    const guest = createGameController({ initialState: drawingState('peer-1'), mesh: createMesh(transports[1]), now: () => 7_000 })
    host.setSecretWord('zebra')

    expect(guest.submitGuess('zebra')).toBe(true)
    expect(host.state().turn?.correct['peer-1']).toMatchObject({ elapsedMs: 5_000, points: 90, place: 1 })
    expect(guest.state().turn?.correct['peer-1']).toEqual(host.state().turn?.correct['peer-1'])
    expect(guest.state().scores['peer-1']).toBe(90)

    host.stop()
    guest.stop()
  })

  it('serves engine and ink snapshots only from the host', () => {
    const { transports } = createMemoryMesh(2)
    let receivedInk: Uint8Array | null = null
    const host = createGameController({
      initialState: drawingState('peer-0'),
      mesh: createMesh(transports[0]),
      getInkSnapshot: () => new Uint8Array([1, 2, 3]),
    })
    const guest = createGameController({
      initialState: drawingState('peer-1'),
      mesh: createMesh(transports[1]),
      applyInkSnapshot: (bytes) => { receivedInk = bytes },
    })

    guest.requestSync('peer-0')
    expect(receivedInk).toEqual(new Uint8Array([1, 2, 3]))
    expect(guest.state().selfId).toBe('peer-1')
    expect(guest.state().turn?.word).toBeNull()

    host.stop()
    guest.stop()
  })
})
