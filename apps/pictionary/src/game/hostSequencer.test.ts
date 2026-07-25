import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialState, reduce, type GameState } from '../engine'
import { createMesh as createMemoryMesh } from '../net/memory-transport'
import { createMesh } from '../net/mesh'
import { DEFAULT_CONFIG, LIMITS, type Player } from '../shared/types'
import { createGameController } from './controller'
import { createHostSequencer } from './hostSequencer'

const players: Player[] = [
  { id: 'peer-0', nickname: 'Host', color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 1 },
  { id: 'peer-1', nickname: 'Guest', color: '#F2603C', avatar: 1, connection: 'connected', joinedAt: 2 },
]

const trio: Player[] = [
  ...players,
  { id: 'peer-2', nickname: 'Third', color: '#3C7DF2', avatar: 2, connection: 'connected', joinedAt: 3 },
]

function lobbyState(selfId: string, roster: Player[] = players): GameState {
  let state = initialState('TEST00', selfId, { ...DEFAULT_CONFIG, turnSeconds: 30, rounds: 1 })
  for (const player of roster) state = reduce(state, { type: 'PLAYER_JOINED', player })
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

  it('keeps host and guest action order identical when the last guess ends a turn', () => {
    vi.useFakeTimers()
    vi.setSystemTime(7_000)
    const { transports } = createMemoryMesh(2)
    const hostMesh = createMesh(transports[0])
    const guestMesh = createMesh(transports[1])
    const host = createGameController({ initialState: lobbyState('peer-0'), mesh: hostMesh })
    const guest = createGameController({ initialState: lobbyState('peer-1'), mesh: guestMesh })
    const sequencer = createHostSequencer({ controller: host, mesh: hostMesh, words: [{ word: 'cat', category: 'animals' }] })
    sequencer.startGame()
    const guesser = host.state().turn?.drawerId === 'peer-0' ? guest : host
    expect(guesser.submitGuess('cat')).toBe(true)

    const withoutSelf = ({ selfId: _selfId, ...state }: GameState) => state
    expect(withoutSelf(guest.state())).toEqual(withoutSelf(host.state()))
    expect(host.state().phase).toBe('turn_intro')

    sequencer.stop()
    host.stop()
    guest.stop()
  })

  it('resumes the current timeout after host migration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const { transports } = createMemoryMesh(2)
    const promotedMesh = createMesh(transports[1])
    let state = lobbyState('peer-1')
    state = reduce(state, { type: 'GAME_STARTED', gameNonce: 'migrating-game', order: ['peer-0', 'peer-1'], config: state.config, at: 1_000 })
    state = reduce(state, { type: 'TURN_STARTED', index: 0, round: 1, drawerId: 'peer-0', wordShape: [3], category: 'animals', startedAt: 1_000, endsAt: 12_000 })
    state = reduce(state, { type: 'PLAYER_LEFT', playerId: 'peer-0' })
    state = reduce(state, { type: 'HOST_CHANGED', hostId: 'peer-1' })
    // Model the synced survivor state before the new host reconstructs timers.
    state = { ...state, phase: 'drawing', turn: state.turn && { ...state.turn, endReason: null } }
    const promoted = createGameController({ initialState: state, mesh: promotedMesh })
    const sequencer = createHostSequencer({ controller: promoted, mesh: promotedMesh, words: [{ word: 'cat', category: 'animals' }] })

    expect(sequencer.resumeGame()).toBe(true)
    vi.advanceTimersByTime(2_000)
    expect(promoted.state().turn).toMatchObject({ word: 'cat', endReason: 'timeout' })

    sequencer.stop()
    promoted.stop()
  })

  it('reveals the word and advances after the drawer disconnects mid-turn', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { transports } = createMemoryMesh(3)
    const hostMesh = createMesh(transports[0])
    const guestMesh = createMesh(transports[1])
    const host = createGameController({ initialState: lobbyState('peer-0', trio), mesh: hostMesh })
    const guest = createGameController({ initialState: lobbyState('peer-2', trio), mesh: guestMesh })
    const sequencer = createHostSequencer({
      controller: host,
      mesh: hostMesh,
      words: [
        { word: 'zebra', category: 'animals' },
        { word: 'cat', category: 'animals' },
        { word: 'dog', category: 'animals' },
      ],
    })

    expect(sequencer.startGame()).toBe(true)
    const drawerId = host.state().turn!.drawerId
    expect(drawerId).not.toBe('peer-0')

    // What RoomView does on every peer when the roster notices a departure.
    host.dispatchLocal({ type: 'PLAYER_LEFT', playerId: drawerId })
    guest.dispatchLocal({ type: 'PLAYER_LEFT', playerId: drawerId })

    // The host must publish the reveal rather than leaving the turn stranded.
    // The word is whichever the seeded pick landed on; what matters is that it
    // is revealed at all, and that both peers see the same one.
    const revealed = host.state().turn?.word
    expect(['zebra', 'cat', 'dog']).toContain(revealed)
    expect(host.state().turn?.endReason).toBe('drawer_left')
    expect(guest.state().turn).toMatchObject({ word: revealed, endReason: 'drawer_left' })

    // ...and the game must move on instead of parking in turn_review forever.
    vi.advanceTimersByTime(LIMITS.intermissionMs + 1_000)
    expect(host.state().phase).not.toBe('turn_review')
    expect(host.state().turn?.index).toBe(1)
    expect(guest.state().turn?.index).toBe(1)

    sequencer.stop()
    host.stop()
    guest.stop()
  })

  it('does not re-score a turn the drawer disconnect already closed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { transports } = createMemoryMesh(3)
    const hostMesh = createMesh(transports[0])
    const host = createGameController({ initialState: lobbyState('peer-0', trio), mesh: hostMesh })
    const sequencer = createHostSequencer({
      controller: host,
      mesh: hostMesh,
      words: [
        { word: 'zebra', category: 'animals' },
        { word: 'cat', category: 'animals' },
        { word: 'dog', category: 'animals' },
      ],
    })

    sequencer.startGame()
    const drawerId = host.state().turn!.drawerId
    host.dispatchLocal({ type: 'PLAYER_LEFT', playerId: drawerId })
    const scoreAfterClose = host.state().scores[drawerId] ?? 0

    // The pending turn timer still fires; it must not pay the drawer twice.
    vi.advanceTimersByTime(60_000)
    expect(host.state().scores[drawerId] ?? 0).toBe(scoreAfterClose)

    sequencer.stop()
    host.stop()
  })
})
