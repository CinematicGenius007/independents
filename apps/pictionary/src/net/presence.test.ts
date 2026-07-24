import { describe, expect, it, vi } from 'vitest'
import type { Player } from '../shared/types'
import { LIMITS } from '../shared/types'
import { createMesh } from './memory-transport'
import { createPresence, electHost } from './presence'

function player(id: string, joinedAt: number): Player {
  return { id, nickname: id, color: '#F5D311', avatar: 0, connection: 'connected', joinedAt }
}

// Tests use compressed timings for speed, but preserve LIMITS' documented
// disconnect:grace ratio rather than hardcoding a doubled value.
const DISCONNECT_TO_GRACE_RATIO = LIMITS.peerDisconnectMs / LIMITS.peerGraceMs

describe('electHost', () => {
  it('picks the earliest joinedAt regardless of roster order', () => {
    const roster = [player('b', 3000), player('a', 1000), player('c', 2000)]
    expect(electHost(roster)).toBe('a')
    expect(electHost([...roster].reverse())).toBe('a')
  })

  it('is deterministic across many shuffles of the same roster', () => {
    const base = [player('x', 500), player('y', 100), player('z', 900), player('w', 100)]
    // 'y' and 'w' tie at 100; lexicographically 'w' < 'y' so 'w' wins.
    const expected = electHost(base)
    expect(expected).toBe('w')

    for (let i = 0; i < 20; i++) {
      const shuffled = [...base].sort(() => Math.random() - 0.5)
      expect(electHost(shuffled)).toBe(expected)
    }
  })

  it('breaks ties by lexicographic id when joinedAt is equal', () => {
    const roster = [player('zeta', 1000), player('alpha', 1000), player('mid', 1000)]
    expect(electHost(roster)).toBe('alpha')
    expect(electHost([...roster].reverse())).toBe('alpha')
  })

  it('throws on an empty roster', () => {
    expect(() => electHost([])).toThrow()
  })
})

describe('presence grace-period staging', () => {
  it('marks a silent peer unstable then disconnected, without ever removing it', () => {
    vi.useFakeTimers()
    try {
      const { mesh, transports, ids } = createMesh(2)
      const pingIntervalMs = 1000
      const graceMs = 3000
      const disconnectMs = graceMs * DISCONNECT_TO_GRACE_RATIO

      const presenceA = createPresence(transports[0], { pingIntervalMs, graceMs, disconnectMs })
      const presenceB = createPresence(transports[1], { pingIntervalMs, graceMs, disconnectMs })

      // Seeded from the roster at creation time (join already happened).
      expect(presenceA.get(ids[1])?.connection).toBe('connected')

      // Let one healthy ping/pong cycle happen first to prove liveness works at all.
      vi.advanceTimersByTime(pingIntervalMs)
      expect(presenceA.get(ids[1])?.connection).toBe('connected')
      expect(presenceA.get(ids[1])?.rttMs).not.toBeNull()

      // Now go silent.
      mesh.drop(ids[1])

      vi.advanceTimersByTime(pingIntervalMs) // silence: 1s
      expect(presenceA.get(ids[1])?.connection).toBe('connected')

      vi.advanceTimersByTime(pingIntervalMs * 3) // silence: ~4s > graceMs(3s)
      expect(presenceA.get(ids[1])?.connection).toBe('unstable')
      // Never removed.
      expect(presenceA.list().map(p => p.id)).toContain(ids[1])

      vi.advanceTimersByTime(pingIntervalMs * 4) // silence: ~8s > disconnectMs(6s)
      expect(presenceA.get(ids[1])?.connection).toBe('disconnected')
      expect(presenceA.list().map(p => p.id)).toContain(ids[1])

      presenceA.stop()
      presenceB.stop()
      mesh.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers to connected once traffic resumes', () => {
    vi.useFakeTimers()
    try {
      const { mesh, transports, ids } = createMesh(2)
      const pingIntervalMs = 1000
      const graceMs = 3000
      const disconnectMs = graceMs * DISCONNECT_TO_GRACE_RATIO

      const presenceA = createPresence(transports[0], { pingIntervalMs, graceMs, disconnectMs })
      const presenceB = createPresence(transports[1], { pingIntervalMs, graceMs, disconnectMs })

      mesh.drop(ids[1])
      vi.advanceTimersByTime(pingIntervalMs * 5)
      expect(presenceA.get(ids[1])?.connection).toBe('unstable')

      mesh.restore(ids[1])
      vi.advanceTimersByTime(pingIntervalMs)
      expect(presenceA.get(ids[1])?.connection).toBe('connected')

      presenceA.stop()
      presenceB.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stop() clears the heartbeat timer and stops reacting to transport events', () => {
    vi.useFakeTimers()
    try {
      const { transports, ids } = createMesh(2)
      const presenceA = createPresence(transports[0], { pingIntervalMs: 1000, graceMs: 3000 })

      expect(vi.getTimerCount()).toBeGreaterThan(0)
      presenceA.stop()
      expect(vi.getTimerCount()).toBe(0)

      const changeSpy = vi.fn()
      presenceA.onChange(changeSpy) // subscribing after stop still "works" but nothing should ever fire
      transports[1].sendCtrl({ t: 'ping', nonce: 1, at: Date.now() }, ids[0])
      vi.advanceTimersByTime(5000)
      expect(changeSpy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
