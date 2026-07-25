/**
 * Application-facing message plumbing built on top of {@link Transport}.
 *
 * Callers above net never touch `sendCtrl`/`onCtrl` directly — they broadcast
 * `SharedAction`s, deliver the private word, whisper, guess, and request/serve
 * state snapshots through this narrower API.
 *
 * Snapshots use one tagged binary ink-channel packet containing their shared
 * revision, state, and canvas. This keeps the baseline ordered before any live
 * ink frames sent after it while the revision protects control state.
 * The ink bytes themselves are
 * never inspected — only routed and, for the inline case, converted between
 * the wire's `number[]` and `Uint8Array`, which is just format normalization.
 */

import type { Category, PlayerId, Unsubscribe } from '../shared/types'
import type { CtrlMessage, Transport } from './protocol'
import type { SharedAction, SyncableState } from '../engine/types'

// Out-of-band snapshots share the transport's binary channel with live InkCodec
// frames. A distinct prefix prevents a live stroke racing ahead of the snapshot
// from being mistaken for the pending sync payload.
const SNAPSHOT_PACKET_PREFIX = new Uint8Array([0x50, 0x49, 0x43, 0x53, 0x4e, 0x41, 0x50, 0x01])

function snapshotPacket(revision: number, state: SyncableState, ink: Uint8Array): Uint8Array {
  const stateBytes = new TextEncoder().encode(JSON.stringify(state))
  const headerBytes = SNAPSHOT_PACKET_PREFIX.byteLength + 8
  const packet = new Uint8Array(headerBytes + stateBytes.byteLength + ink.byteLength)
  packet.set(SNAPSHOT_PACKET_PREFIX)
  const view = new DataView(packet.buffer)
  view.setUint32(SNAPSHOT_PACKET_PREFIX.byteLength, revision)
  view.setUint32(SNAPSHOT_PACKET_PREFIX.byteLength + 4, stateBytes.byteLength)
  packet.set(stateBytes, headerBytes)
  packet.set(ink, headerBytes + stateBytes.byteLength)
  return packet
}

function snapshotPayload(packet: Uint8Array): { revision: number; state: SyncableState; ink: Uint8Array } | null {
  const headerBytes = SNAPSHOT_PACKET_PREFIX.byteLength + 8
  if (packet.byteLength < headerBytes) return null
  for (let index = 0; index < SNAPSHOT_PACKET_PREFIX.byteLength; index++) {
    if (packet[index] !== SNAPSHOT_PACKET_PREFIX[index]) return null
  }
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  const revision = view.getUint32(SNAPSHOT_PACKET_PREFIX.byteLength)
  const stateLength = view.getUint32(SNAPSHOT_PACKET_PREFIX.byteLength + 4)
  const inkOffset = headerBytes + stateLength
  if (inkOffset > packet.byteLength) return null
  try {
    const state = JSON.parse(new TextDecoder().decode(packet.slice(headerBytes, inkOffset))) as SyncableState
    return { revision, state, ink: packet.slice(inkOffset) }
  } catch {
    return null
  }
}

export interface Mesh {
  broadcastAction(action: SharedAction, revision: number): void
  onAction(cb: (action: SharedAction, revision: number, from: PlayerId) => void): Unsubscribe

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
  serveSyncState(to: PlayerId, revision: number, state: SyncableState, ink: Uint8Array): void
  onSyncState(cb: (revision: number, state: SyncableState, ink: Uint8Array, from: PlayerId) => void): Unsubscribe

  /** Removes every listener this mesh registered on the transport. */
  stop(): void
}

export function createMesh(transport: Transport): Mesh {
  const actionListeners = new Set<(action: SharedAction, revision: number, from: PlayerId) => void>()
  const wordListeners = new Set<
    (word: string, category: Category | null, turnIndex: number, from: PlayerId) => void
  >()
  const whisperListeners = new Set<(text: string, at: number, from: PlayerId) => void>()
  const guessListeners = new Set<(text: string, at: number, from: PlayerId) => void>()
  const syncRequestListeners = new Set<(from: PlayerId) => void>()
  const syncStateListeners = new Set<(revision: number, state: SyncableState, ink: Uint8Array, from: PlayerId) => void>()

  const unsubCtrl = transport.onCtrl((msg: CtrlMessage, from) => {
    switch (msg.t) {
      case 'action':
        actionListeners.forEach(cb => cb(msg.action, msg.revision, from))
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
        if (msg.ink !== null) {
          const bytes = Uint8Array.from(msg.ink)
          syncStateListeners.forEach(cb => cb(msg.revision, msg.state, bytes, from))
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
    const snapshot = snapshotPayload(bytes)
    if (!snapshot) return
    syncStateListeners.forEach(cb => cb(snapshot.revision, snapshot.state, snapshot.ink, from))
  })

  let stopped = false

  return {
    broadcastAction: (action, revision) => transport.sendCtrl({ t: 'action', action, revision }),
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

    serveSyncState: (to, revision, state, ink) => {
      transport.sendInk(snapshotPacket(revision, state, ink), to)
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
    },
  }
}
