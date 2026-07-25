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

  it('ignores a guest-provided timestamp when scoring', () => {
    const { transports } = createMemoryMesh(2)
    const hostMesh = createMesh(transports[0])
    const guestMesh = createMesh(transports[1])
    const host = createGameController({ initialState: drawingState('peer-0'), mesh: hostMesh, now: () => 7_000 })
    const guest = createGameController({ initialState: drawingState('peer-1'), mesh: guestMesh })
    host.setSecretWord('zebra')

    guestMesh.sendGuess('zebra', 2_001, 'peer-0')
    expect(host.state().turn?.correct['peer-1']?.elapsedMs).toBe(5_000)
    expect(host.state().turn?.correct['peer-1']?.points).toBe(90)

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

  it('lets a promoted host recover a snapshot from an explicitly requested survivor', () => {
    const { transports } = createMemoryMesh(2)
    let promotedState = reduce(drawingState('peer-0'), { type: 'HOST_CHANGED', hostId: 'peer-0' })
    let survivorState = reduce(drawingState('peer-1'), { type: 'HOST_CHANGED', hostId: 'peer-0' })
    promotedState = { ...promotedState, selfId: 'peer-0' }
    survivorState = { ...survivorState, selfId: 'peer-1' }
    let recovered: Uint8Array | null = null
    const promoted = createGameController({
      initialState: promotedState,
      mesh: createMesh(transports[0]),
      applyInkSnapshot: (bytes) => { recovered = bytes },
    })
    const survivor = createGameController({
      initialState: survivorState,
      mesh: createMesh(transports[1]),
      getInkSnapshot: () => new Uint8Array([9, 8, 7]),
    })

    promoted.requestSync('peer-1')
    expect(recovered).toEqual(new Uint8Array([9, 8, 7]))

    promoted.stop()
    survivor.stop()
  })

  it('does not roll back newer actions when a large snapshot arrives late', async () => {
    const { transports } = createMemoryMesh(2)
    const delayedInk: Array<() => void> = []
    const sendInk = transports[0].sendInk.bind(transports[0])
    transports[0].sendInk = (bytes, to) => delayedInk.push(() => sendInk(bytes, to))
    const host = createGameController({
      initialState: drawingState('peer-0'),
      mesh: createMesh(transports[0]),
      getInkSnapshot: () => new Uint8Array(50_000),
    })
    let appliedInk = false
    const guest = createGameController({
      initialState: drawingState('peer-1'),
      mesh: createMesh(transports[1]),
      applyInkSnapshot: () => { appliedInk = true },
    })

    const syncing = guest.requestSync('peer-0')
    host.dispatchShared({ type: 'TURN_ENDED', word: 'zebra', reason: 'timeout', drawerPoints: 0, at: 82_000 })
    host.dispatchShared({ type: 'INTERMISSION', nextTurnAt: 87_000 })
    delayedInk.splice(0).forEach((send) => send())

    expect(await syncing).toBe(false)
    expect(guest.state().phase).toBe('turn_intro')
    expect(guest.state().turn?.word).toBe('zebra')
    expect(appliedInk).toBe(true)
    host.stop()
    guest.stop()
  })

  it('preserves newer guesses received while a drawing-phase snapshot is in flight', async () => {
    const { transports } = createMemoryMesh(2)
    const delayedInk: Array<() => void> = []
    const sendInk = transports[0].sendInk.bind(transports[0])
    transports[0].sendInk = (bytes, to) => delayedInk.push(() => sendInk(bytes, to))
    const host = createGameController({
      initialState: drawingState('peer-0'), mesh: createMesh(transports[0]), getInkSnapshot: () => new Uint8Array(50_000),
    })
    const guest = createGameController({ initialState: drawingState('peer-1'), mesh: createMesh(transports[1]) })

    const syncing = guest.requestSync('peer-0')
    host.dispatchShared({ type: 'GUESS_POSTED', playerId: 'peer-1', text: 'zebra', at: 7_000 })
    host.dispatchShared({ type: 'GUESS_CORRECT', playerId: 'peer-1', elapsedMs: 5_000, points: 90, place: 1, at: 7_000 })
    delayedInk.splice(0).forEach((send) => send())

    expect(await syncing).toBe(false)
    expect(guest.state().turn?.correct['peer-1']?.points).toBe(90)
    expect(guest.state().scores['peer-1']).toBe(90)
    host.stop()
    guest.stop()
  })

  it('buffers a revision gap until the missing snapshot arrives', async () => {
    const { transports } = createMemoryMesh(2)
    const delayedInk: Array<() => void> = []
    const sendInk = transports[0].sendInk.bind(transports[0])
    transports[0].sendInk = (bytes, to) => delayedInk.push(() => sendInk(bytes, to))
    const host = createGameController({
      initialState: drawingState('peer-0'), mesh: createMesh(transports[0]), getInkSnapshot: () => new Uint8Array(50_000),
    })
    for (let index = 0; index < 10; index++) {
      host.dispatchShared({ type: 'SYSTEM_MESSAGE', text: `before-${index}`, at: index, audience: 'all' })
    }
    const guest = createGameController({ initialState: drawingState('peer-1'), mesh: createMesh(transports[1]) })

    const syncing = guest.requestSync('peer-0')
    host.dispatchShared({ type: 'SYSTEM_MESSAGE', text: 'after-snapshot', at: 20, audience: 'all' })
    expect(guest.state().chat).toHaveLength(0)
    delayedInk.splice(0).forEach((send) => send())

    expect(await syncing).toBe(true)
    expect(guest.state().chat.map((entry) => entry.text)).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `before-${index}`),
      'after-snapshot',
    ])
    host.stop()
    guest.stop()
  })

})
