/**
 * The one file in this layer allowed to import Trystero.
 *
 * Strategy: Nostr relays are primary (`trystero/nostr`), MQTT relays
 * (`trystero/mqtt`) are the fallback if the primary can't reach any relay
 * within {@link PRIMARY_TIMEOUT_MS}. Both are imported via their subpath
 * entries so the unused strategies (firebase, ipfs, supabase, torrent) that
 * `trystero`'s main entry pulls in are never bundled.
 *
 * "Reached a relay" is judged by polling the strategy's own relay sockets
 * (exposed via `getRelaySockets()`) for an OPEN `WebSocket`, rather than
 * waiting for a peer — a room can be legitimately alone and still be
 * "connected" to the signaling relay.
 */

import type { PlayerId, RoomId, Unsubscribe } from '../shared/types'
import type { ActionProgress, ActionReceiver, ActionSender, Room } from 'trystero'
import { joinRoom as joinNostrRoom, selfId as trysteroSelfId, getRelaySockets as getNostrSockets } from 'trystero/nostr'
import { joinRoom as joinMqttRoom, getRelaySockets as getMqttSockets } from 'trystero/mqtt'
import type { CtrlMessage, RelayStatus, Transport } from './protocol'
import { APP_ID } from './protocol'

const PRIMARY_TIMEOUT_MS = 5000
const FALLBACK_TIMEOUT_MS = 5000
const SOCKET_POLL_MS = 150

type StrategyName = 'nostr' | 'mqtt'

interface StrategyModule {
  name: StrategyName
  joinRoom: (config: { appId: string }, roomId: string) => Room
  getRelaySockets: () => Record<string, WebSocket>
}

const NOSTR: StrategyModule = { name: 'nostr', joinRoom: joinNostrRoom, getRelaySockets: getNostrSockets }
const MQTT: StrategyModule = { name: 'mqtt', joinRoom: joinMqttRoom, getRelaySockets: getMqttSockets }

/** Loosely typed: makeAction's generic is nominal only, so a runtime cast avoids
 *  fighting structural JsonValue inference on a large discriminated union. */
function makeCtrlAction(room: Room): [ActionSender<CtrlMessage>, ActionReceiver<CtrlMessage>, ActionProgress] {
  return room.makeAction('ctrl') as unknown as [ActionSender<CtrlMessage>, ActionReceiver<CtrlMessage>, ActionProgress]
}

function makeInkAction(room: Room): [ActionSender<Uint8Array>, ActionReceiver<Uint8Array>, ActionProgress] {
  return room.makeAction('ink') as unknown as [ActionSender<Uint8Array>, ActionReceiver<Uint8Array>, ActionProgress]
}

function toUint8Array(data: Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

interface Bound {
  room: Room
  sendCtrlRaw: ActionSender<CtrlMessage>
  sendInkRaw: ActionSender<Uint8Array>
}

interface Handlers {
  onCtrl: (msg: CtrlMessage, from: PlayerId) => void
  onInk: (bytes: Uint8Array, from: PlayerId) => void
  onJoin: (id: PlayerId) => void
  onLeave: (id: PlayerId) => void
}

function bind(room: Room, handlers: Handlers): Bound {
  const [sendCtrlRaw, onCtrlRaw] = makeCtrlAction(room)
  const [sendInkRaw, onInkRaw] = makeInkAction(room)
  onCtrlRaw((msg, from) => handlers.onCtrl(msg, from))
  onInkRaw((bytes, from) => handlers.onInk(toUint8Array(bytes), from))
  room.onPeerJoin(id => handlers.onJoin(id))
  room.onPeerLeave(id => handlers.onLeave(id))
  return { room, sendCtrlRaw, sendInkRaw }
}

export interface TrysteroConnection {
  transport: Transport
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}

interface SessionConnection {
  transport: Omit<Transport, 'leave'>
  destroy: () => void
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}

interface Session {
  roomId: RoomId
  refs: number
  teardown: () => void
  teardownTimer: ReturnType<typeof setTimeout> | null
  connection: SessionConnection
}

/**
 * Live sessions keyed by room, reference counted.
 *
 * Trystero keeps relay subscriptions and its offer pool in module scope, so a
 * join/leave/join of the same room in quick succession races its own teardown
 * and leaves the surviving room deaf — it stays subscribed to nothing and no
 * peer is ever discovered. React StrictMode does exactly that on every mount in
 * development, and so does any fast route change.
 *
 * Sharing one session per room and deferring teardown past the remount window
 * makes those sequences a no-op instead of a silent, permanent failure.
 */
const sessions = new Map<RoomId, Session>()

/** How long a session with no holders is kept alive in case of a remount. */
const TEARDOWN_GRACE_MS = 1500

function createSession(roomId: RoomId): SessionConnection {
  const ctrlListeners = new Set<(msg: CtrlMessage, from: PlayerId) => void>()
  const inkListeners = new Set<(bytes: Uint8Array, from: PlayerId) => void>()
  const joinListeners = new Set<(id: PlayerId) => void>()
  const leaveListeners = new Set<(id: PlayerId) => void>()
  const statusListeners = new Set<(status: RelayStatus) => void>()

  let status: RelayStatus = 'connecting'
  let bound: Bound | null = null
  const leftPermanently = false
  let disposed = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const setStatus = (next: RelayStatus) => {
    if (status === next) return
    status = next
    statusListeners.forEach(cb => cb(next))
  }

  const handlers: Handlers = {
    onCtrl: (msg, from) => ctrlListeners.forEach(cb => cb(msg, from)),
    onInk: (bytes, from) => inkListeners.forEach(cb => cb(bytes, from)),
    onJoin: id => joinListeners.forEach(cb => cb(id)),
    onLeave: id => leaveListeners.forEach(cb => cb(id)),
  }

  const attach = (strategy: StrategyModule) => {
    const room = strategy.joinRoom({ appId: APP_ID }, roomId)
    bound = bind(room, handlers)
  }

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const pollForConnection = (strategy: StrategyModule, timeoutMs: number, onTimeout: () => void) => {
    const start = Date.now()
    pollTimer = setInterval(() => {
      if (disposed) {
        clearPoll()
        return
      }
      const sockets = strategy.getRelaySockets()
      const anyOpen = Object.values(sockets).some(s => s.readyState === WebSocket.OPEN)
      if (anyOpen) {
        clearPoll()
        setStatus('connected')
        return
      }
      if (Date.now() - start >= timeoutMs) {
        clearPoll()
        onTimeout()
      }
    }, SOCKET_POLL_MS)
  }

  attach(NOSTR)
  pollForConnection(NOSTR, PRIMARY_TIMEOUT_MS, () => {
    if (disposed) return
    const previousRoom = bound?.room
    attach(MQTT)
    void previousRoom?.leave()
    pollForConnection(MQTT, FALLBACK_TIMEOUT_MS, () => {
      if (disposed) return
      setStatus('failed')
    })
  })

  const transport: Omit<Transport, 'leave'> = {
    roomId,
    selfId: trysteroSelfId,
    peers: () => (bound ? Object.keys(bound.room.getPeers()) : []),
    sendCtrl: (msg, to) => {
      if (leftPermanently || !bound) return
      void bound.sendCtrlRaw(msg, to === undefined ? null : to)
    },
    sendInk: (bytes, to) => {
      if (leftPermanently || !bound) return
      void bound.sendInkRaw(bytes, to === undefined ? null : to)
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
  }

  const destroy = () => {
    if (disposed) return
    disposed = true
    clearPoll()
    ctrlListeners.clear()
    inkListeners.clear()
    joinListeners.clear()
    leaveListeners.clear()
    statusListeners.clear()
    void bound?.room.leave()
    bound = null
  }

  return {
    transport,
    destroy,
    status: () => status,
    onStatus: cb => {
      statusListeners.add(cb)
      return () => statusListeners.delete(cb)
    },
  }
}

/**
 * Connects to `roomId` over Trystero, trying Nostr first and MQTT on timeout.
 *
 * Callers get their own handle over a shared per-room session. `leave()`
 * releases only that handle's subscriptions; the underlying room is torn down
 * once the last holder leaves and the grace window passes.
 */
export function createTrysteroTransport(roomId: RoomId): TrysteroConnection {
  let session = sessions.get(roomId)
  if (session) {
    if (session.teardownTimer) {
      clearTimeout(session.teardownTimer)
      session.teardownTimer = null
    }
    session.refs += 1
  } else {
    const connection = createSession(roomId)
    session = {
      roomId,
      refs: 1,
      teardownTimer: null,
      teardown: connection.destroy,
      connection,
    }
    sessions.set(roomId, session)
  }

  const held = session
  const owned: Unsubscribe[] = []
  let released = false
  const track = (unsubscribe: Unsubscribe): Unsubscribe => {
    owned.push(unsubscribe)
    return unsubscribe
  }

  const transport: Transport = {
    ...held.connection.transport,
    onCtrl: cb => track(held.connection.transport.onCtrl(cb)),
    onInk: cb => track(held.connection.transport.onInk(cb)),
    onPeerJoin: cb => track(held.connection.transport.onPeerJoin(cb)),
    onPeerLeave: cb => track(held.connection.transport.onPeerLeave(cb)),
    leave: () => {
      if (released) return
      released = true
      owned.splice(0).forEach(unsubscribe => unsubscribe())
      held.refs -= 1
      if (held.refs > 0) return
      held.teardownTimer = setTimeout(() => {
        if (held.refs > 0) return
        sessions.delete(held.roomId)
        held.teardown()
      }, TEARDOWN_GRACE_MS)
    },
  }

  return {
    transport,
    status: () => held.connection.status(),
    onStatus: cb => track(held.connection.onStatus(cb)),
  }
}
