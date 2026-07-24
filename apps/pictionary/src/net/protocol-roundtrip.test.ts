import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../shared/types'
import type { CtrlMessage } from './protocol'
import { SNAPSHOT_INLINE_LIMIT } from './protocol'
import { createMesh } from './memory-transport'
import { createMesh as createMeshLayer } from './mesh'
import type { SyncableState } from '../engine/types'

function fakeSyncableState(overrides: Partial<SyncableState> = {}): SyncableState {
  return {
    phase: 'lobby',
    roomId: 'TEST00',
    hostId: 'peer-0',
    gameNonce: 'nonce-abc',
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

describe('CtrlMessage round trip', () => {
  const variants: CtrlMessage[] = [
    { t: 'hello', profile: { id: 'peer-1', nickname: 'Ada', color: '#F5D311', avatar: 0 }, joinedAt: 1000 },
    {
      t: 'roster',
      players: [
        { id: 'peer-0', nickname: 'Ada', color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 1000 },
        { id: 'peer-1', nickname: 'Bo', color: '#3C7DF2', avatar: 1, connection: 'unstable', joinedAt: 2000 },
      ],
      hostId: 'peer-0',
    },
    { t: 'action', action: { type: 'PLAYER_LEFT', playerId: 'peer-1' } },
    { t: 'word', word: 'ICE CREAM', category: 'food', turnIndex: 2 },
    { t: 'word', word: 'ANYTHING', category: null, turnIndex: 0 },
    { t: 'whisper', text: "You're very close!", at: 12345 },
    { t: 'guess', text: 'zebra', at: 6789 },
    { t: 'sync_request' },
    { t: 'sync_state', state: fakeSyncableState(), ink: [1, 2, 3, 254, 255] },
    { t: 'sync_state', state: fakeSyncableState({ hostId: 'peer-1' }), ink: null },
    { t: 'ping', nonce: 7, at: 42 },
    { t: 'pong', nonce: 7, at: 43 },
  ]

  for (const msg of variants) {
    it(`survives a send/receive round trip for "${msg.t}"${'ink' in msg ? ` (ink: ${msg.ink === null ? 'null' : 'array'})` : ''}`, () => {
      const { transports, ids } = createMesh(2)
      let received: CtrlMessage | null = null
      transports[1].onCtrl(m => {
        received = m
      })

      transports[0].sendCtrl(msg, ids[1])

      expect(received).toEqual(msg)
      // Structural, not referential — mirrors real JSON-framed delivery.
      expect(received).not.toBe(msg)
    })
  }

  it('broadcast (omitted `to`) reaches every peer with identical structure', () => {
    const { transports } = createMesh(3)
    const receivedBy1: CtrlMessage[] = []
    const receivedBy2: CtrlMessage[] = []
    transports[1].onCtrl(m => receivedBy1.push(m))
    transports[2].onCtrl(m => receivedBy2.push(m))

    const action: CtrlMessage = { t: 'action', action: { type: 'GAME_ENDED', at: 999 } }
    transports[0].sendCtrl(action)

    expect(receivedBy1).toEqual([action])
    expect(receivedBy2).toEqual([action])
  })
})

describe('mesh.ts sync_state snapshot rule', () => {
  it('sends small ink logs inline on the ctrl channel as Uint8Array via onSyncState', () => {
    const { transports, ids } = createMesh(2)
    const meshA = createMeshLayer(transports[0])
    const meshB = createMeshLayer(transports[1])

    const inkBytes = new Uint8Array([10, 20, 30])
    expect(inkBytes.byteLength).toBeLessThanOrEqual(SNAPSHOT_INLINE_LIMIT)

    let receivedState: SyncableState | null = null
    let receivedInk: Uint8Array | null = null
    let inkChannelHits = 0
    transports[1].onInk(() => {
      inkChannelHits++
    })
    meshB.onSyncState((state, ink) => {
      receivedState = state
      receivedInk = ink
    })

    const state = fakeSyncableState({ hostId: ids[0] })
    meshA.serveSyncState(ids[1], state, inkBytes)

    expect(receivedState).toEqual(state)
    expect(receivedInk).toBeInstanceOf(Uint8Array)
    expect(Array.from(receivedInk as unknown as Uint8Array)).toEqual([10, 20, 30])
    // Inline path never touches the ink channel.
    expect(inkChannelHits).toBe(0)

    meshA.stop()
    meshB.stop()
  })

  it('sends large ink logs as sync_state{ink:null} followed by the ink channel, correlated by onSyncState', () => {
    const { transports, ids } = createMesh(2)
    const meshA = createMeshLayer(transports[0])
    const meshB = createMeshLayer(transports[1])

    const bigInk = new Uint8Array(SNAPSHOT_INLINE_LIMIT + 1024)
    for (let i = 0; i < bigInk.length; i++) bigInk[i] = i % 256

    const ctrlMessages: CtrlMessage[] = []
    transports[1].onCtrl(m => ctrlMessages.push(m))

    let receivedState: SyncableState | null = null
    let receivedInk: Uint8Array | null = null
    meshB.onSyncState((state, ink) => {
      receivedState = state
      receivedInk = ink
    })

    const state = fakeSyncableState({ hostId: ids[0] })
    meshA.serveSyncState(ids[1], state, bigInk)

    // The ctrl channel carried an ink:null placeholder ahead of the ink-channel payload.
    expect(ctrlMessages).toHaveLength(1)
    expect(ctrlMessages[0]).toMatchObject({ t: 'sync_state', ink: null })

    expect(receivedState).toEqual(state)
    expect(receivedInk).toBeInstanceOf(Uint8Array)
    expect((receivedInk as unknown as Uint8Array).byteLength).toBe(bigInk.byteLength)
    expect(Array.from(receivedInk as unknown as Uint8Array)).toEqual(Array.from(bigInk))

    meshA.stop()
    meshB.stop()
  })
})
