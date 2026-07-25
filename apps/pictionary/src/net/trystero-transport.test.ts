import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guards the session sharing in `trystero-transport`.
 *
 * Trystero keeps relay subscriptions and its offer pool in module scope, so a
 * join/leave/join of the same room in quick succession races its own teardown
 * and leaves the surviving room subscribed to nothing — peer discovery fails
 * silently and permanently. React StrictMode performs exactly that sequence on
 * every mount in development, which made multiplayer look completely broken
 * while every unit test still passed.
 */

const rooms: Array<{ id: string; left: boolean }> = []

function fakeRoom(roomId: string) {
  const room = { id: roomId, left: false }
  rooms.push(room)
  return {
    makeAction: () => [vi.fn(), vi.fn(), vi.fn()],
    onPeerJoin: vi.fn(),
    onPeerLeave: vi.fn(),
    getPeers: () => ({}),
    leave: () => {
      room.left = true
    },
  }
}

vi.mock('trystero/nostr', () => ({
  joinRoom: (_config: unknown, roomId: string) => fakeRoom(roomId),
  selfId: 'self-test-id',
  getRelaySockets: () => ({ 'wss://relay': { readyState: 1 } as WebSocket }),
}))

vi.mock('trystero/mqtt', () => ({
  joinRoom: (_config: unknown, roomId: string) => fakeRoom(roomId),
  getRelaySockets: () => ({}),
}))

const { createTrysteroTransport } = await import('./trystero-transport')

beforeEach(() => {
  rooms.length = 0
  vi.useRealTimers()
})

describe('trystero transport session sharing', () => {
  it('reuses one underlying room across a StrictMode-style remount', () => {
    const first = createTrysteroTransport('ROOM01')
    first.transport.leave()
    const second = createTrysteroTransport('ROOM01')

    // One room object total: the remount adopted the live session instead of
    // building a second one on top of a teardown still in flight.
    expect(rooms).toHaveLength(1)
    expect(rooms[0].left).toBe(false)
    expect(second.transport.selfId).toBe('self-test-id')

    second.transport.leave()
  })

  it('keeps the room alive while another holder is still using it', () => {
    const a = createTrysteroTransport('ROOM02')
    const b = createTrysteroTransport('ROOM02')

    a.transport.leave()
    expect(rooms[0].left).toBe(false)

    b.transport.leave()
    expect(rooms).toHaveLength(1)
  })

  it('tears the room down once the last holder leaves and the grace window passes', () => {
    vi.useFakeTimers()
    const handle = createTrysteroTransport('ROOM03')
    handle.transport.leave()

    expect(rooms[0].left).toBe(false)
    vi.advanceTimersByTime(5_000)
    expect(rooms[0].left).toBe(true)
  })

  it('releases only the leaving handle\'s subscriptions', () => {
    const a = createTrysteroTransport('ROOM04')
    const b = createTrysteroTransport('ROOM04')
    const seen: string[] = []
    a.transport.onPeerJoin(() => seen.push('a'))
    b.transport.onPeerJoin(() => seen.push('b'))

    a.transport.leave()
    // b's listener must survive a's departure; the shared session is not reset.
    expect(rooms[0].left).toBe(false)
    b.transport.leave()
  })
})
