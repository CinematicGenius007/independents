/**
 * The only file allowed to import Trystero.
 *
 * Nostr relays are tried first and MQTT is the fallback, both through their
 * subpath entries so the strategies this app never uses are not bundled.
 * "Connected" means the signalling relay's socket is open, not that a peer
 * turned up — a room with nobody in it yet is still a working room.
 *
 * Sessions are shared per room and torn down late, because Trystero keeps its
 * relay subscriptions in module scope: a join/leave/join in quick succession —
 * exactly what React does on every mount in development — otherwise races its
 * own teardown and leaves the surviving room deaf.
 */

import type { Room } from '@trystero-p2p/core'
import { joinRoom as joinNostrRoom, selfId, getRelaySockets as nostrSockets } from '@trystero-p2p/nostr'
import { joinRoom as joinMqttRoom, getRelaySockets as mqttSockets } from '@trystero-p2p/mqtt'
import type { CtrlMessage, PeerId, RelayStatus, RoomId, Transport, Unsubscribe } from './protocol'
import { APP_ID } from './protocol'

const PRIMARY_TIMEOUT_MS = 5000
const FALLBACK_TIMEOUT_MS = 5000
const SOCKET_POLL_MS = 150
const TEARDOWN_GRACE_MS = 1500

interface Strategy {
  joinRoom: (config: { appId: string }, roomId: string) => Room
  getRelaySockets: () => Record<string, WebSocket>
}

const NOSTR: Strategy = { joinRoom: joinNostrRoom, getRelaySockets: nostrSockets }
const MQTT: Strategy = { joinRoom: joinMqttRoom, getRelaySockets: mqttSockets }

interface Bound {
  room: Room
  send: (msg: CtrlMessage, to?: string) => void
}

export interface TrysteroConnection {
  transport: Transport
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}

interface SharedSession {
  roomId: RoomId
  refs: number
  teardownTimer: ReturnType<typeof setTimeout> | null
  destroy: () => void
  transport: Omit<Transport, 'leave'>
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}

const sessions = new Map<RoomId, SharedSession>()

function createSession(roomId: RoomId): Omit<SharedSession, 'roomId' | 'refs' | 'teardownTimer'> {
  const messageListeners = new Set<(msg: CtrlMessage, from: PeerId) => void>()
  const joinListeners = new Set<(id: PeerId) => void>()
  const leaveListeners = new Set<(id: PeerId) => void>()
  const statusListeners = new Set<(status: RelayStatus) => void>()

  let status: RelayStatus = 'connecting'
  let bound: Bound | null = null
  let disposed = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const setStatus = (next: RelayStatus) => {
    if (status === next) return
    status = next
    statusListeners.forEach(cb => cb(next))
  }

  const attach = (strategy: Strategy) => {
    const room = strategy.joinRoom({ appId: APP_ID }, roomId)
    // The payload generic wants a structural JSON type; the protocol's tagged
    // union satisfies that in spirit but not to the checker's satisfaction, so
    // it crosses the boundary as an opaque payload and is cast back on arrival.
    const action = room.makeAction('ctrl', {
      onMessage: (data, context) => {
        const msg = data as unknown as CtrlMessage
        messageListeners.forEach(cb => cb(msg, context.peerId))
      },
    })
    room.onPeerJoin = id => joinListeners.forEach(cb => cb(id))
    room.onPeerLeave = id => leaveListeners.forEach(cb => cb(id))
    bound = {
      room,
      send: (msg, to) => {
        void action.send(msg as never, to ? { target: to } : undefined)
      },
    }
  }

  const clearPoll = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  const pollForRelay = (strategy: Strategy, timeoutMs: number, onTimeout: () => void) => {
    const start = Date.now()
    pollTimer = setInterval(() => {
      if (disposed) return clearPoll()
      const open = Object.values(strategy.getRelaySockets()).some(s => s.readyState === WebSocket.OPEN)
      if (open) {
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
  pollForRelay(NOSTR, PRIMARY_TIMEOUT_MS, () => {
    if (disposed) return
    const previous = bound?.room
    attach(MQTT)
    void previous?.leave()
    pollForRelay(MQTT, FALLBACK_TIMEOUT_MS, () => {
      if (!disposed) setStatus('failed')
    })
  })

  const track = <T>(set: Set<T>, cb: T): Unsubscribe => {
    set.add(cb)
    return () => set.delete(cb)
  }

  return {
    transport: {
      roomId,
      selfId,
      peers: () => (bound ? Object.keys(bound.room.getPeers()) : []),
      send: (msg, to) => bound?.send(msg, to),
      onMessage: cb => track(messageListeners, cb),
      onPeerJoin: cb => track(joinListeners, cb),
      onPeerLeave: cb => track(leaveListeners, cb),
    },
    status: () => status,
    onStatus: cb => track(statusListeners, cb),
    destroy: () => {
      if (disposed) return
      disposed = true
      clearPoll()
      messageListeners.clear()
      joinListeners.clear()
      leaveListeners.clear()
      statusListeners.clear()
      void bound?.room.leave()
      bound = null
    },
  }
}

/** Connects to `roomId`, sharing one underlying room between callers. */
export function createTrysteroTransport(roomId: RoomId): TrysteroConnection {
  let session = sessions.get(roomId)
  if (session) {
    if (session.teardownTimer) {
      clearTimeout(session.teardownTimer)
      session.teardownTimer = null
    }
    session.refs += 1
  } else {
    session = { roomId, refs: 1, teardownTimer: null, ...createSession(roomId) }
    sessions.set(roomId, session)
  }

  const held = session
  const owned: Unsubscribe[] = []
  let released = false
  const keep = (unsubscribe: Unsubscribe): Unsubscribe => {
    owned.push(unsubscribe)
    return unsubscribe
  }

  return {
    transport: {
      ...held.transport,
      onMessage: cb => keep(held.transport.onMessage(cb)),
      onPeerJoin: cb => keep(held.transport.onPeerJoin(cb)),
      onPeerLeave: cb => keep(held.transport.onPeerLeave(cb)),
      leave: () => {
        if (released) return
        released = true
        owned.splice(0).forEach(fn => fn())
        held.refs -= 1
        if (held.refs > 0) return
        held.teardownTimer = setTimeout(() => {
          if (held.refs > 0) return
          sessions.delete(held.roomId)
          held.destroy()
        }, TEARDOWN_GRACE_MS)
      },
    },
    status: () => held.status(),
    onStatus: cb => keep(held.onStatus(cb)),
  }
}
