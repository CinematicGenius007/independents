import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../shared/types'
import type { Player, PlayerId } from '../shared/types'
import type { SyncableState } from '../engine/types'
import { MemoryMesh } from './memory-transport'
import { createMesh as createMeshLayer } from './mesh'
import { electHost } from './presence'

function player(id: PlayerId, joinedAt: number): Player {
  return { id, nickname: id, color: '#F5D311', avatar: 0, connection: 'connected', joinedAt }
}

function fakeSyncableState(overrides: Partial<SyncableState> = {}): SyncableState {
  return {
    phase: 'lobby',
    roomId: 'ROOM01',
    hostId: 'peer-1',
    gameNonce: 'nonce',
    config: DEFAULT_CONFIG,
    players: {},
    order: [],
    scores: {},
    turn: null,
    chat: [],
    lastGuessAt: {},
    nextTurnAt: null,
    ...overrides,
  }
}

describe('net layer integration: join, host election, migration, late-join sync', () => {
  it('3 peers join, elect a host, the host drops, survivors re-elect the same new host, ' +
    'and that host serves a sync_state to a late joiner', () => {
    const mesh = new MemoryMesh('ROOM01')

    // Join order determines joinedAt in this test harness (a real room would stamp it
    // via the 'hello' handshake; that's the controller layer's job, not net's).
    const joinedAt: Record<PlayerId, number> = { p0: 1000, p1: 2000, p2: 3000 }
    mesh.join('p0')
    const t1 = mesh.join('p1')
    const t2 = mesh.join('p2')

    let roster: Player[] = [player('p0', joinedAt.p0), player('p1', joinedAt.p1), player('p2', joinedAt.p2)]

    // Every peer computes the identical host from the identical roster.
    const hostAccordingTo0 = electHost(roster)
    const hostAccordingTo1 = electHost([...roster].reverse())
    const hostAccordingTo2 = electHost([roster[2], roster[0], roster[1]])
    expect(hostAccordingTo0).toBe('p0')
    expect(hostAccordingTo1).toBe('p0')
    expect(hostAccordingTo2).toBe('p0')

    // The host (p0) drops.
    const leftOnP1: PlayerId[] = []
    const leftOnP2: PlayerId[] = []
    t1.onPeerLeave(id => leftOnP1.push(id))
    t2.onPeerLeave(id => leftOnP2.push(id))

    mesh.leave('p0')

    expect(leftOnP1).toEqual(['p0'])
    expect(leftOnP2).toEqual(['p0'])
    expect(t1.peers()).not.toContain('p0')
    expect(t2.peers()).not.toContain('p0')

    // Survivors reconcile their roster and re-elect, independently, from the shrunk list.
    roster = roster.filter(p => p.id !== 'p0')
    const newHostAccordingTo1 = electHost([...roster])
    const newHostAccordingTo2 = electHost([...roster].reverse())
    expect(newHostAccordingTo1).toBe('p1')
    expect(newHostAccordingTo2).toBe('p1')
    expect(newHostAccordingTo1).toBe(newHostAccordingTo2)

    // The new host (p1) serves a full sync_state to a late joiner (p3).
    const t3 = mesh.join('p3')
    const meshHost = createMeshLayer(t1)
    const meshLate = createMeshLayer(t3)

    const syncRequests: PlayerId[] = []
    meshHost.onSyncRequest(from => syncRequests.push(from))

    let deliveredState: SyncableState | null = null
    let deliveredInk: Uint8Array | null = null
    meshLate.onSyncState((_revision, state, ink) => {
      deliveredState = state
      deliveredInk = ink
    })

    meshLate.requestSync('p1')
    expect(syncRequests).toEqual(['p3'])

    const state = fakeSyncableState({ hostId: 'p1', order: ['p1', 'p2'] })
    const ink = new Uint8Array([9, 8, 7, 6])
    meshHost.serveSyncState('p3', 4, state, ink)

    expect(deliveredState).toEqual(state)
    expect(deliveredInk).toBeInstanceOf(Uint8Array)
    expect(Array.from(deliveredInk as unknown as Uint8Array)).toEqual([9, 8, 7, 6])

    meshHost.stop()
    meshLate.stop()
  })
})
