/**
 * Roster liveness and host election.
 *
 * Presence layers a heartbeat on top of a {@link Transport}: it pings every
 * connected peer every {@link PING_INTERVAL_MS}, tracks RTT from the reply, and
 * degrades a silent peer through `'unstable'` then `'disconnected'` rather than
 * ever removing it — the caller decides what to do with a disconnected entry
 * (grey it out, wait for rejoin, etc.).
 *
 * Grace staging: the wire contract defines both thresholds. Silence past
 * {@link LIMITS.peerGraceMs} shows as `'unstable'`; silence past
 * {@link LIMITS.peerDisconnectMs} shows as `'disconnected'`. Both constants
 * live in one place so callers (e.g. the UI labelling the two states) never
 * have to re-derive either threshold.
 */

import type { ConnectionState, PlayerId, Unsubscribe } from '../shared/types'
import { LIMITS } from '../shared/types'
import type { CtrlMessage, ElectHost, Transport } from './protocol'
import { PING_INTERVAL_MS } from './protocol'

export interface PeerPresence {
  id: PlayerId
  connection: ConnectionState
  /** Last measured round-trip time in ms, or null before the first pong. */
  rttMs: number | null
  /** Epoch ms this peer was last heard from (ping, pong, or any other ctrl traffic). */
  lastSeenAt: number
}

export interface PresenceTracker {
  get(id: PlayerId): PeerPresence | undefined
  list(): PeerPresence[]
  onChange(cb: (peers: PeerPresence[]) => void): Unsubscribe
  /** Stops the heartbeat timer and removes all transport listeners. No leaked timers. */
  stop(): void
}

export interface PresenceOptions {
  now?: () => number
  pingIntervalMs?: number
  /** `'unstable'` cutoff. Defaults to {@link LIMITS.peerGraceMs}. */
  graceMs?: number
  /** `'disconnected'` cutoff. Defaults to {@link LIMITS.peerDisconnectMs}. */
  disconnectMs?: number
}

interface PeerState {
  rttMs: number | null
  lastSeenAt: number
  connection: ConnectionState
  pendingNonce: number | null
  pendingSentAt: number | null
}

export function createPresence(transport: Transport, options: PresenceOptions = {}): PresenceTracker {
  const now = options.now ?? Date.now
  const pingIntervalMs = options.pingIntervalMs ?? PING_INTERVAL_MS
  const graceMs = options.graceMs ?? LIMITS.peerGraceMs
  const disconnectMs = options.disconnectMs ?? LIMITS.peerDisconnectMs

  const peers = new Map<PlayerId, PeerState>()
  let nonceCounter = 0
  const changeListeners = new Set<(peers: PeerPresence[]) => void>()

  const snapshot = (): PeerPresence[] =>
    Array.from(peers.entries()).map(([id, p]) => ({
      id,
      connection: p.connection,
      rttMs: p.rttMs,
      lastSeenAt: p.lastSeenAt,
    }))

  const emitChange = () => {
    const s = snapshot()
    changeListeners.forEach(cb => cb(s))
  }

  const ensurePeer = (id: PlayerId): PeerState => {
    let p = peers.get(id)
    if (!p) {
      p = { rttMs: null, lastSeenAt: now(), connection: 'connected', pendingNonce: null, pendingSentAt: null }
      peers.set(id, p)
    }
    return p
  }

  const touch = (id: PlayerId) => {
    const p = ensurePeer(id)
    p.lastSeenAt = now()
    if (p.connection !== 'connected') {
      p.connection = 'connected'
      emitChange()
    }
  }

  // Seed with whoever is already connected — real Trystero rooms (and the memory
  // double) only fire onPeerJoin for peers that join *after* this subscribes.
  for (const id of transport.peers()) {
    ensurePeer(id)
  }

  const unsubJoin = transport.onPeerJoin(id => {
    ensurePeer(id)
    touch(id)
    emitChange()
  })

  const unsubLeave = transport.onPeerLeave(id => {
    const p = ensurePeer(id)
    p.connection = 'disconnected'
    p.pendingNonce = null
    p.pendingSentAt = null
    emitChange()
  })

  const unsubCtrl = transport.onCtrl((msg: CtrlMessage, from) => {
    if (msg.t === 'ping') {
      touch(from)
      transport.sendCtrl({ t: 'pong', nonce: msg.nonce, at: now() }, from)
      return
    }
    if (msg.t === 'pong') {
      const p = ensurePeer(from)
      if (p.pendingNonce === msg.nonce && p.pendingSentAt !== null) {
        p.rttMs = now() - p.pendingSentAt
        p.pendingNonce = null
        p.pendingSentAt = null
      }
      touch(from)
      return
    }
    // Any other ctrl traffic is also proof of life.
    touch(from)
  })

  const tick = () => {
    const currentPeerIds = new Set(transport.peers())

    for (const id of currentPeerIds) {
      const p = ensurePeer(id)
      const nonce = nonceCounter++
      p.pendingNonce = nonce
      p.pendingSentAt = now()
      transport.sendCtrl({ t: 'ping', nonce, at: now() }, id)
    }

    let changed = false
    for (const [id, p] of peers) {
      const silentFor = now() - p.lastSeenAt
      let next: ConnectionState
      if (!currentPeerIds.has(id)) {
        next = 'disconnected'
      } else if (silentFor > disconnectMs) {
        next = 'disconnected'
      } else if (silentFor > graceMs) {
        next = 'unstable'
      } else {
        next = 'connected'
      }
      if (next !== p.connection) {
        p.connection = next
        changed = true
      }
    }

    if (changed) emitChange()
  }

  const interval = setInterval(tick, pingIntervalMs)

  let stopped = false

  return {
    get: id => {
      const p = peers.get(id)
      return p ? { id, connection: p.connection, rttMs: p.rttMs, lastSeenAt: p.lastSeenAt } : undefined
    },
    list: snapshot,
    onChange: cb => {
      changeListeners.add(cb)
      return () => changeListeners.delete(cb)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      clearInterval(interval)
      unsubJoin()
      unsubLeave()
      unsubCtrl()
      changeListeners.clear()
    },
  }
}

/**
 * Host election, implemented exactly per {@link ElectHost}'s documented rule:
 * earliest `joinedAt` wins, ties broken by lexicographic `id`. Every peer
 * computes this from the same roster, so nobody needs to be told the answer.
 */
export const electHost: ElectHost = players => {
  if (players.length === 0) {
    throw new Error('electHost: cannot elect a host from an empty roster')
  }
  let best = players[0]
  for (let i = 1; i < players.length; i++) {
    const p = players[i]
    if (p.joinedAt < best.joinedAt || (p.joinedAt === best.joinedAt && p.id < best.id)) {
      best = p
    }
  }
  return best.id
}
