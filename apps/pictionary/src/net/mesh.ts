/**
 * Application-facing message plumbing built on top of {@link Transport}.
 *
 * Callers above net never touch `sendCtrl`/`onCtrl` directly — they broadcast
 * `SharedAction`s, deliver the private word, whisper, guess, and request/serve
 * state snapshots through this narrower API.
 *
 * Snapshot rule (per protocol.ts's {@link SNAPSHOT_INLINE_LIMIT}): a small
 * encoded ink log rides inline on the ctrl channel as a plain number array.
 * A large one is sent as `sync_state` with `ink: null`, immediately followed by
 * a snapshot-tagged byte packet on the ink channel; `onSyncState` correlates the two and hands
 * the caller a single `Uint8Array` either way. The ink bytes themselves are
 * never inspected — only routed and, for the inline case, converted between
 * the wire's `number[]` and `Uint8Array`, which is just format normalization.
 */

import type { Category, PlayerId, Unsubscribe } from '../shared/types'
import type { CtrlMessage, Transport } from './protocol'
import { SNAPSHOT_INLINE_LIMIT } from './protocol'
import type { SharedAction, SyncableState } from '../engine/types'

// Out-of-band snapshots share the transport's binary channel with live InkCodec
// frames. A distinct prefix prevents a live stroke racing ahead of the snapshot
// from being mistaken for the pending sync payload.
const SNAPSHOT_PACKET_PREFIX = new Uint8Array([0x50, 0x49, 0x43, 0x53, 0x4e, 0x41, 0x50, 0x01])

function snapshotPacket(ink: Uint8Array): Uint8Array {
  const packet = new Uint8Array(SNAPSHOT_PACKET_PREFIX.byteLength + ink.byteLength)
  packet.set(SNAPSHOT_PACKET_PREFIX)
  packet.set(ink, SNAPSHOT_PACKET_PREFIX.byteLength)
  return packet
}

function snapshotPayload(packet: Uint8Array): Uint8Array | null {
  if (packet.byteLength < SNAPSHOT_PACKET_PREFIX.byteLength) return null
  for (let index = 0; index < SNAPSHOT_PACKET_PREFIX.byteLength; index++) {
    if (packet[index] !== SNAPSHOT_PACKET_PREFIX[index]) return null
  }
  return packet.slice(SNAPSHOT_PACKET_PREFIX.byteLength)
}

export interface Mesh {
  broadcastAction(action: SharedAction): void
  onAction(cb: (action: SharedAction, from: PlayerId) => void): Unsubscribe

  /** Host → drawer only. Callers are responsible for only ever targeting the drawer. */
  sendWord(to: PlayerId, word: string, category: Category | null, turnIndex: number): void
  onWord(
    cb: (word: string, category: Category | null, turnIndex: number, from: PlayerId) => void,
  ): Unsubscribe

  sendWhisper(to: PlayerId, text: string, at: number): void
  onWhisper(cb: (text: string, at: number, from: PlayerId) => void): Unsubscribe

  /** Omit `to` to broadcast a guess; pass the host's id to target adjudication directly. */
  sendGuess(text: string, at: number, to?: PlayerId): void
  onGuess(cb: (text: string, at: number, from: PlayerId) => void): Unsubscribe

  requestSync(to?: PlayerId): void
  onSyncRequest(cb: (from: PlayerId) => void): Unsubscribe

  /** Implements the snapshot rule described above. */
  serveSyncState(to: PlayerId, state: SyncableState, ink: Uint8Array): void
  onSyncState(cb: (state: SyncableState, ink: Uint8Array, from: PlayerId) => void): Unsubscribe

  /** Removes every listener this mesh registered on the transport. */
  stop(): void
}

export function createMesh(transport: Transport): Mesh {
  const actionListeners = new Set<(action: SharedAction, from: PlayerId) => void>()
  const wordListeners = new Set<
    (word: string, category: Category | null, turnIndex: number, from: PlayerId) => void
  >()
  const whisperListeners = new Set<(text: string, at: number, from: PlayerId) => void>()
  const guessListeners = new Set<(text: string, at: number, from: PlayerId) => void>()
  const syncRequestListeners = new Set<(from: PlayerId) => void>()
  const syncStateListeners = new Set<(state: SyncableState, ink: Uint8Array, from: PlayerId) => void>()

  // Peers whose next ink frame is the tail of an out-of-band sync_state snapshot
  // rather than a live stroke. FIFO per peer in case more than one is ever queued.
  const pendingSnapshots = new Map<PlayerId, SyncableState[]>()

  const unsubCtrl = transport.onCtrl((msg: CtrlMessage, from) => {
    switch (msg.t) {
      case 'action':
        actionListeners.forEach(cb => cb(msg.action, from))
        return
      case 'word':
        wordListeners.forEach(cb => cb(msg.word, msg.category, msg.turnIndex, from))
        return
      case 'whisper':
        whisperListeners.forEach(cb => cb(msg.text, msg.at, from))
        return
      case 'guess':
        guessListeners.forEach(cb => cb(msg.text, msg.at, from))
        return
      case 'sync_request':
        syncRequestListeners.forEach(cb => cb(from))
        return
      case 'sync_state':
        if (msg.ink === null) {
          const queue = pendingSnapshots.get(from) ?? []
          queue.push(msg.state)
          pendingSnapshots.set(from, queue)
        } else {
          const bytes = Uint8Array.from(msg.ink)
          syncStateListeners.forEach(cb => cb(msg.state, bytes, from))
        }
        return
      case 'hello':
      case 'roster':
      case 'ping':
      case 'pong':
        // Handled by room.ts's roster wiring and presence.ts respectively.
        return
    }
  })

  const unsubInk = transport.onInk((bytes, from) => {
    const ink = snapshotPayload(bytes)
    if (!ink) return
    const queue = pendingSnapshots.get(from)
    if (!queue || queue.length === 0) return
    const state = queue.shift()
    if (!state) return
    if (queue.length === 0) pendingSnapshots.delete(from)
    syncStateListeners.forEach(cb => cb(state, ink, from))
  })

  let stopped = false

  return {
    broadcastAction: action => transport.sendCtrl({ t: 'action', action }),
    onAction: cb => {
      actionListeners.add(cb)
      return () => actionListeners.delete(cb)
    },

    sendWord: (to, word, category, turnIndex) =>
      transport.sendCtrl({ t: 'word', word, category, turnIndex }, to),
    onWord: cb => {
      wordListeners.add(cb)
      return () => wordListeners.delete(cb)
    },

    sendWhisper: (to, text, at) => transport.sendCtrl({ t: 'whisper', text, at }, to),
    onWhisper: cb => {
      whisperListeners.add(cb)
      return () => whisperListeners.delete(cb)
    },

    sendGuess: (text, at, to) => transport.sendCtrl({ t: 'guess', text, at }, to),
    onGuess: cb => {
      guessListeners.add(cb)
      return () => guessListeners.delete(cb)
    },

    requestSync: to => transport.sendCtrl({ t: 'sync_request' }, to),
    onSyncRequest: cb => {
      syncRequestListeners.add(cb)
      return () => syncRequestListeners.delete(cb)
    },

    serveSyncState: (to, state, ink) => {
      if (ink.byteLength <= SNAPSHOT_INLINE_LIMIT) {
        transport.sendCtrl({ t: 'sync_state', state, ink: Array.from(ink) }, to)
      } else {
        transport.sendCtrl({ t: 'sync_state', state, ink: null }, to)
        transport.sendInk(snapshotPacket(ink), to)
      }
    },
    onSyncState: cb => {
      syncStateListeners.add(cb)
      return () => syncStateListeners.delete(cb)
    },

    stop: () => {
      if (stopped) return
      stopped = true
      unsubCtrl()
      unsubInk()
      actionListeners.clear()
      wordListeners.clear()
      whisperListeners.clear()
      guessListeners.clear()
      syncRequestListeners.clear()
      syncStateListeners.clear()
      pendingSnapshots.clear()
    },
  }
}
