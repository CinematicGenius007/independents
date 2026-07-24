import { describe, expect, it, vi } from 'vitest'
import { createMesh, MemoryMesh } from './memory-transport'

describe('memory-transport', () => {
  it('broadcasts ctrl messages to every other peer', () => {
    const { transports, ids } = createMesh(3)
    const received: Array<{ from: string; nonce: number }> = []

    transports[1].onCtrl((msg, from) => {
      if (msg.t === 'ping') received.push({ from, nonce: msg.nonce })
    })
    transports[2].onCtrl((msg, from) => {
      if (msg.t === 'ping') received.push({ from, nonce: msg.nonce })
    })

    transports[0].sendCtrl({ t: 'ping', nonce: 1, at: 0 })

    expect(received).toHaveLength(2)
    expect(received).toEqual(
      expect.arrayContaining([
        { from: ids[0], nonce: 1 },
        { from: ids[0], nonce: 1 },
      ]),
    )
  })

  it('sends targeted ctrl messages only to the named peer(s)', () => {
    const { transports, ids } = createMesh(3)
    const seenBy1: unknown[] = []
    const seenBy2: unknown[] = []
    transports[1].onCtrl(msg => seenBy1.push(msg))
    transports[2].onCtrl(msg => seenBy2.push(msg))

    transports[0].sendCtrl({ t: 'whisper', text: 'psst', at: 0 }, ids[1])

    expect(seenBy1).toHaveLength(1)
    expect(seenBy2).toHaveLength(0)
  })

  it('routes ink as raw Uint8Array without JSON round tripping', () => {
    const { transports, ids } = createMesh(2)
    let receivedBytes: Uint8Array | null = null
    transports[1].onInk(bytes => {
      receivedBytes = bytes
    })

    const payload = new Uint8Array([1, 2, 3, 255, 0])
    transports[0].sendInk(payload, ids[1])

    expect(receivedBytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(receivedBytes as unknown as Uint8Array)).toEqual([1, 2, 3, 255, 0])
    // Mutating the sender's buffer afterwards must not affect the delivered copy.
    payload[0] = 99
    expect((receivedBytes as unknown as Uint8Array)[0]).toBe(1)
  })

  it('peers() excludes self and reflects the current roster', () => {
    const { transports, ids } = createMesh(3)
    expect(transports[0].peers().sort()).toEqual([ids[1], ids[2]].sort())
    expect(transports[1].peers().sort()).toEqual([ids[0], ids[2]].sort())
  })

  it('fires onPeerJoin on existing peers when a new peer joins', () => {
    const mesh = new MemoryMesh('ROOM01')
    const a = mesh.join('a')
    const joins: string[] = []
    a.onPeerJoin(id => joins.push(id))

    mesh.join('b')
    mesh.join('c')

    expect(joins).toEqual(['b', 'c'])
  })

  it('leave() fires onPeerLeave on remaining peers and removes the peer from rosters', () => {
    const { mesh, transports, ids } = createMesh(3)
    const leftEvents: string[] = []
    transports[1].onPeerLeave(id => leftEvents.push(id))
    transports[2].onPeerLeave(id => leftEvents.push(id))

    mesh.leave(ids[0])

    expect(leftEvents).toEqual([ids[0], ids[0]])
    expect(transports[1].peers()).not.toContain(ids[0])
    expect(transports[2].peers()).not.toContain(ids[0])
  })

  it('leave() is a no-op for further sends and stops delivering to the left peer', () => {
    const { transports, ids } = createMesh(2)
    const received: unknown[] = []
    transports[1].onCtrl(msg => received.push(msg))

    transports[0].leave()
    transports[0].sendCtrl({ t: 'sync_request' }, ids[1])

    expect(received).toHaveLength(0)
  })

  it('leave() is idempotent', () => {
    const { transports } = createMesh(2)
    expect(() => {
      transports[0].leave()
      transports[0].leave()
    }).not.toThrow()
  })

  it('drop() blocks traffic in both directions without firing onPeerLeave or changing peers()', () => {
    const { mesh, transports, ids } = createMesh(2)
    const leftEvents: string[] = []
    transports[0].onPeerLeave(id => leftEvents.push(id))
    transports[1].onPeerLeave(id => leftEvents.push(id))

    mesh.drop(ids[1])

    const seenBy0: unknown[] = []
    const seenBy1: unknown[] = []
    transports[0].onCtrl(msg => seenBy0.push(msg))
    transports[1].onCtrl(msg => seenBy1.push(msg))

    transports[0].sendCtrl({ t: 'sync_request' }, ids[1])
    transports[1].sendCtrl({ t: 'sync_request' }, ids[0])

    expect(seenBy0).toHaveLength(0)
    expect(seenBy1).toHaveLength(0)
    expect(leftEvents).toHaveLength(0)
    expect(transports[0].peers()).toContain(ids[1])
    expect(transports[1].peers()).toContain(ids[0])
  })

  it('restore() reverses drop()', () => {
    const { mesh, transports, ids } = createMesh(2)
    mesh.drop(ids[1])
    mesh.restore(ids[1])

    const seenBy1: unknown[] = []
    transports[1].onCtrl(msg => seenBy1.push(msg))
    transports[0].sendCtrl({ t: 'sync_request' }, ids[1])

    expect(seenBy1).toHaveLength(1)
  })

  it('applies artificial latency and leaves no timers behind after destroy()', () => {
    vi.useFakeTimers()
    try {
      const { mesh, transports, ids } = createMesh(2, { latencyMs: 100 })
      let delivered = false
      transports[1].onCtrl(() => {
        delivered = true
      })

      transports[0].sendCtrl({ t: 'sync_request' }, ids[1])
      expect(delivered).toBe(false)

      vi.advanceTimersByTime(100)
      expect(delivered).toBe(true)

      // A second message left pending, then torn down before it fires.
      transports[0].sendCtrl({ t: 'sync_request' }, ids[1])
      expect(vi.getTimerCount()).toBeGreaterThan(0)
      mesh.destroy()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws if the same peer id joins twice', () => {
    const mesh = new MemoryMesh('ROOM01')
    mesh.join('a')
    expect(() => mesh.join('a')).toThrow()
  })
})
