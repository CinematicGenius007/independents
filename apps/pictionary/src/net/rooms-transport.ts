/**
 * Pictionary over the independents rooms service.
 *
 * The second implementation of {@link Transport} beside Trystero: ctrl goes
 * over as small JSON envelopes, ink as base64 with transport-level batching
 * and chunking. Nothing above this file changes — the mesh still sees
 * `sendCtrl`/`sendInk` with the same ordering, snapshots still arrive as one
 * binary packet, and the host election still runs on `hello`/`roster`.
 *
 * Three adaptations live here, all forced by the rooms contract (JSON text
 * frames ≤ 64 KiB, ~8 msgs/s sustained after a burst of 40):
 *
 * - **ping/pong are dropped.** The service answers its own keepalive and
 *   reports presence authoritatively after an 8 s grace, so the 3 s per-peer
 *   heartbeat would spend the rate budget for zero information.
 * - **ink is batched.** Strokes flush at up to ~60 frames/s; the transport
 *   coalesces them into one envelope per {@link INK_FLUSH_MS} window and the
 *   receiver redelivers each frame in order, so the canvas layer is unaware.
 * - **oversize ink is chunked.** Snapshots routinely exceed one frame; they
 *   are split, reassembled per sender, and delivered as a single packet, so
 *   the mesh's snapshot-before-live-ink ordering still holds.
 */

import type { PlayerId, RoomId, Unsubscribe } from '../shared/types'
import type { CtrlMessage, RelayStatus, RoomHandle, Transport } from './protocol'
import { RoomsConnection } from './rooms-client'
import type { Identity, RoomsStatus } from './rooms-client'

export const GAME_ID = 'pictionary'

/** Coalescing window for stroke frames. One envelope per window per target. */
export const INK_FLUSH_MS = 120
/** Raw payload bytes above which an ink packet is chunked (base64 inflates ~4/3). */
export const INK_CHUNK_THRESHOLD = 40 * 1024
/** Raw bytes per chunk; each chunk fits one rooms frame with room to spare. */
export const INK_CHUNK_SIZE = 40 * 1024

type WireCtrl = { ch: 'ctrl'; msg: CtrlMessage }
type WireInk = { ch: 'ink'; b: string }
type WireBatch = { ch: 'ink-batch'; frames: string[] }
type WireChunk = { ch: 'ink-chunk'; id: number; i: number; n: number; b: string }
type Wire = WireCtrl | WireInk | WireBatch | WireChunk

function isWire(value: unknown): value is Wire {
  if (typeof value !== 'object' || value === null) return false
  const ch = (value as { ch?: unknown }).ch
  return ch === 'ctrl' || ch === 'ink' || ch === 'ink-batch' || ch === 'ink-chunk'
}

/** Browser-safe base64 without Node's Buffer; chunked to dodge arg limits. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const STEP = 0x8000
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export interface RoomsTransportOptions {
  baseUrl: string
  roomId: RoomId
  name: string
  /** Injected by tests. */
  identity?: Identity
  /** Injected by tests. */
  WebSocketImpl?: typeof WebSocket
  /** Injected by tests to shorten the batching window. */
  flushMs?: number
}

function relayStatus(status: RoomsStatus): RelayStatus {
  if (status === 'open') return 'connected'
  if (status === 'failed' || status === 'closed') return 'failed'
  return 'connecting'
}

export interface RoomsTransport {
  transport: Transport
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}

export function createRoomsTransport(options: RoomsTransportOptions): RoomsTransport {
  const connection = new RoomsConnection({
    baseUrl: options.baseUrl,
    game: GAME_ID,
    code: options.roomId,
    name: options.name,
    identity: options.identity,
    WebSocketImpl: options.WebSocketImpl,
  })
  const flushMs = options.flushMs ?? INK_FLUSH_MS

  const ctrlListeners = new Set<(msg: CtrlMessage, from: PlayerId) => void>()
  const inkListeners = new Set<(bytes: Uint8Array, from: PlayerId) => void>()
  const joinListeners = new Set<(id: PlayerId) => void>()
  const leaveListeners = new Set<(id: PlayerId) => void>()

  // --- outbound ink batching -------------------------------------------------
  // One queue per destination key so a broadcast and a directed snapshot never
  // share an envelope. Flushing is per key; oversize packets flush their key's
  // queue first so the receiver still sees bytes in send order.
  const batchQueues = new Map<string, string[]>()
  const batchTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const destKey = (to: PlayerId | PlayerId[] | undefined): string =>
    to === undefined ? '' : Array.isArray(to) ? [...to].sort().join(',') : to

  const sendTo = (wire: Wire, to: PlayerId | PlayerId[] | undefined): void => {
    if (to === undefined) {
      connection.send(wire)
      return
    }
    for (const id of Array.isArray(to) ? to : [to]) connection.send(wire, { to: id })
  }

  const flushBatch = (key: string, to: PlayerId | PlayerId[] | undefined): void => {
    const frames = batchQueues.get(key)
    batchTimers.delete(key)
    if (!frames || frames.length === 0) return
    batchQueues.delete(key)
    sendTo(frames.length === 1 ? { ch: 'ink', b: frames[0] } : { ch: 'ink-batch', frames }, to)
  }

  // fnv-1a ids only need to be unique per sender among in-flight transfers.
  let chunkId = 0
  const sendChunked = (bytes: Uint8Array, to: PlayerId | PlayerId[] | undefined): void => {
    const id = (chunkId = (chunkId + 1) >>> 0)
    const n = Math.ceil(bytes.length / INK_CHUNK_SIZE)
    for (let i = 0; i < n; i++) {
      const piece = bytes.subarray(i * INK_CHUNK_SIZE, (i + 1) * INK_CHUNK_SIZE)
      sendTo({ ch: 'ink-chunk', id, i, n, b: bytesToBase64(piece) }, to)
    }
  }

  // --- inbound chunk reassembly ----------------------------------------------
  interface Reassembly {
    parts: (Uint8Array | null)[]
    received: number
  }
  const pending = new Map<string, Reassembly>()
  const deliverChunk = (from: PlayerId, id: number, i: number, n: number, bytes: Uint8Array): void => {
    const key = `${from}:${id}`
    let entry = pending.get(key)
    if (!entry || entry.parts.length !== n) {
      entry = { parts: new Array<Uint8Array | null>(n).fill(null), received: 0 }
      pending.set(key, entry)
      // Bound memory: abandoned transfers must not accumulate.
      if (pending.size > 8) {
        const oldest = pending.keys().next()
        if (!oldest.done && oldest.value !== key) pending.delete(oldest.value)
      }
    }
    if (i < 0 || i >= n || entry.parts[i] !== null) return
    entry.parts[i] = bytes
    entry.received += 1
    if (entry.received < n) return
    pending.delete(key)
    const total = entry.parts.reduce((sum, part) => sum + (part?.length ?? 0), 0)
    const whole = new Uint8Array(total)
    let offset = 0
    for (const part of entry.parts) {
      if (!part) return // unreachable; guarded by received === n
      whole.set(part, offset)
      offset += part.length
    }
    inkListeners.forEach(cb => cb(whole, from))
  }

  const unsubMessage = connection.on('message', envelope => {
    const data = envelope.data
    if (!isWire(data)) return
    const from = envelope.from as PlayerId
    switch (data.ch) {
      case 'ctrl':
        // ping/pong never arrive (never sent) but stay ignored defensively.
        if (data.msg.t === 'ping' || data.msg.t === 'pong') return
        ctrlListeners.forEach(cb => cb(data.msg, from))
        return
      case 'ink':
        inkListeners.forEach(cb => cb(base64ToBytes(data.b), from))
        return
      case 'ink-batch':
        for (const b of data.frames) {
          const bytes = base64ToBytes(b)
          inkListeners.forEach(cb => cb(bytes, from))
        }
        return
      case 'ink-chunk':
        deliverChunk(from, data.id, data.i, data.n, base64ToBytes(data.b))
        return
    }
  })
  const unsubJoin = connection.on('join', peer => joinListeners.forEach(cb => cb(peer.id as PlayerId)))
  const unsubLeave = connection.on('leave', peer => leaveListeners.forEach(cb => cb(peer.id as PlayerId)))

  const transport: Transport = {
    roomId: options.roomId,
    selfId: connection.self as PlayerId,
    peers: () => [...connection.peers.keys()] as PlayerId[],
    sendCtrl: (msg, to) => {
      // The rooms service keeps its own keepalive; per-peer pings would spend
      // the ~8 msgs/s budget for no information. Presence retires with Trystero.
      if (msg.t === 'ping' || msg.t === 'pong') return
      sendTo({ ch: 'ctrl', msg }, to)
    },
    sendInk: (bytes, to) => {
      const key = destKey(to)
      if (bytes.length > INK_CHUNK_THRESHOLD) {
        flushBatch(key, to)
        sendChunked(bytes, to)
        return
      }
      let queue = batchQueues.get(key)
      if (!queue) {
        queue = []
        batchQueues.set(key, queue)
      }
      queue.push(bytesToBase64(bytes))
      if (!batchTimers.has(key)) {
        batchTimers.set(
          key,
          setTimeout(() => flushBatch(key, to), flushMs),
        )
      }
    },
    onCtrl: cb => {
      ctrlListeners.add(cb)
      return () => ctrlListeners.delete(cb)
    },
    onInk: cb => {
      inkListeners.add(cb)
      return () => inkListeners.delete(cb)
    },
    onPeerJoin: cb => {
      joinListeners.add(cb)
      return () => joinListeners.delete(cb)
    },
    onPeerLeave: cb => {
      leaveListeners.add(cb)
      return () => leaveListeners.delete(cb)
    },
    leave: () => {
      for (const timer of batchTimers.values()) clearTimeout(timer)
      batchTimers.clear()
      batchQueues.clear()
      pending.clear()
      unsubMessage()
      unsubJoin()
      unsubLeave()
      connection.close()
    },
  }

  return {
    transport,
    status: () => relayStatus(connection.getStatus()),
    onStatus: cb => connection.on('status', status => cb(relayStatus(status))),
  }
}

/**
 * Where rooms are hosted, if anywhere.
 *
 * With `VITE_ROOMS_URL` set, rooms go through the independents rooms service:
 * a server that is always reachable, with reconnects and stable seats. Without
 * it, the game keeps the previous behavior — signalling peer to peer over
 * public relays, which needs no infrastructure at all but depends on
 * strangers' servers and on two browsers managing to reach each other
 * directly.
 *
 * Unlike Azul there is intentionally no shipped default here: the deployed
 * worker does not host pictionary yet, so defaulting to it would break
 * multiplayer in production builds. Point a build at a worker that lists
 * pictionary in `GET /v1/games` to turn rooms on.
 */
export const ROOMS_URL: string | null =
  (import.meta.env.VITE_ROOMS_URL ?? '').trim() || null

export interface RoomsHandleOptions {
  baseUrl: string
  roomId: RoomId
  name: string
  url: string
  identity?: Identity
  WebSocketImpl?: typeof WebSocket
}

export function createRoomsHandle(options: RoomsHandleOptions): RoomHandle {
  const connection = createRoomsTransport({
    baseUrl: options.baseUrl,
    roomId: options.roomId,
    name: options.name,
    identity: options.identity,
    WebSocketImpl: options.WebSocketImpl,
  })
  return {
    transport: connection.transport,
    url: options.url,
    status: connection.status,
    onStatus: connection.onStatus,
  }
}
