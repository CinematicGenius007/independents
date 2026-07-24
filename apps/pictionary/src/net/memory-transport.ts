/**
 * In-memory {@link Transport} double.
 *
 * Wires N fake peers together in-process so the rest of the net layer (and,
 * later, integration tests for the whole app) can be exercised deterministically
 * without a real network. Nothing here imports Trystero.
 *
 * Two knobs simulate real-network conditions:
 * - `latencyMs` delays delivery of every message by a fixed amount.
 * - `drop(peerId)` simulates a silent partition: the peer stays in everyone's
 *   `peers()` roster (nothing fires `onPeerLeave`), but ctrl/ink traffic to and
 *   from it silently vanishes. This is what lets presence's heartbeat-driven
 *   grace-period logic be exercised in isolation from a hard disconnect.
 *   A hard disconnect is simulated with `leave()` / `mesh.leave(id)` instead,
 *   which does fire `onPeerLeave` on every remaining peer.
 */

import type { PlayerId, RoomId } from '../shared/types'
import type { CtrlMessage, Transport } from './protocol'

export interface MemoryTransportOptions {
  /** Fixed artificial delivery delay in ms, applied to every ctrl/ink message. */
  latencyMs?: number
}

interface MemoryNode {
  id: PlayerId
  ctrlListeners: Set<(msg: CtrlMessage, from: PlayerId) => void>
  inkListeners: Set<(bytes: Uint8Array, from: PlayerId) => void>
  joinListeners: Set<(id: PlayerId) => void>
  leaveListeners: Set<(id: PlayerId) => void>
  left: boolean
}

function cloneCtrl(msg: CtrlMessage): CtrlMessage {
  // The real ctrl channel is JSON-framed (see protocol.ts), so a JSON round trip
  // both mirrors that framing and stops peers from sharing mutable references.
  return JSON.parse(JSON.stringify(msg)) as CtrlMessage
}

/** A single in-process room. Construct peers with `join`; use `createMesh` for the common case. */
export class MemoryMesh {
  readonly roomId: RoomId
  private latencyMs: number
  private nodes = new Map<PlayerId, MemoryNode>()
  private dropped = new Set<PlayerId>()
  private timers = new Set<ReturnType<typeof setTimeout>>()

  constructor(roomId: RoomId, options: MemoryTransportOptions = {}) {
    this.roomId = roomId
    this.latencyMs = options.latencyMs ?? 0
  }

  /** Adds a peer to the mesh and returns its Transport. Fires `onPeerJoin` on existing peers. */
  join(id: PlayerId): Transport {
    if (this.nodes.has(id)) {
      throw new Error(`memory-transport: peer "${id}" already joined`)
    }

    const node: MemoryNode = {
      id,
      ctrlListeners: new Set(),
      inkListeners: new Set(),
      joinListeners: new Set(),
      leaveListeners: new Set(),
      left: false,
    }
    this.nodes.set(id, node)

    for (const other of this.nodes.values()) {
      if (other.id === id) continue
      other.joinListeners.forEach(cb => cb(id))
    }

    const send = (kind: 'ctrl' | 'ink', payload: CtrlMessage | Uint8Array, to: PlayerId | PlayerId[] | undefined) => {
      if (node.left) return
      for (const targetId of this.resolveTargets(id, to)) {
        if (this.dropped.has(id) || this.dropped.has(targetId)) continue
        this.deliver(kind, payload, id, targetId)
      }
    }

    const transport: Transport = {
      roomId: this.roomId,
      selfId: id,
      peers: () => this.peersOf(id),
      sendCtrl: (msg, to) => send('ctrl', cloneCtrl(msg), to),
      sendInk: (bytes, to) => send('ink', bytes.slice(), to),
      onCtrl: cb => {
        node.ctrlListeners.add(cb)
        return () => node.ctrlListeners.delete(cb)
      },
      onInk: cb => {
        node.inkListeners.add(cb)
        return () => node.inkListeners.delete(cb)
      },
      onPeerJoin: cb => {
        node.joinListeners.add(cb)
        return () => node.joinListeners.delete(cb)
      },
      onPeerLeave: cb => {
        node.leaveListeners.add(cb)
        return () => node.leaveListeners.delete(cb)
      },
      leave: () => this.leave(id),
    }

    return transport
  }

  private resolveTargets(from: PlayerId, to: PlayerId | PlayerId[] | undefined): PlayerId[] {
    if (to === undefined) return this.peersOf(from)
    return Array.isArray(to) ? to : [to]
  }

  private peersOf(id: PlayerId): PlayerId[] {
    return Array.from(this.nodes.keys()).filter(other => other !== id)
  }

  private deliver(kind: 'ctrl' | 'ink', payload: CtrlMessage | Uint8Array, from: PlayerId, to: PlayerId): void {
    const run = () => {
      const target = this.nodes.get(to)
      if (!target || target.left) return
      if (kind === 'ctrl') {
        target.ctrlListeners.forEach(cb => cb(payload as CtrlMessage, from))
      } else {
        target.inkListeners.forEach(cb => cb(payload as Uint8Array, from))
      }
    }

    if (this.latencyMs > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer)
        run()
      }, this.latencyMs)
      this.timers.add(timer)
    } else {
      run()
    }
  }

  /** Hard disconnect: removes the peer from the mesh and fires `onPeerLeave` everywhere else. */
  leave(id: PlayerId): void {
    const node = this.nodes.get(id)
    if (!node || node.left) return
    node.left = true
    this.nodes.delete(id)
    this.dropped.delete(id)

    for (const other of this.nodes.values()) {
      other.leaveListeners.forEach(cb => cb(id))
    }

    node.ctrlListeners.clear()
    node.inkListeners.clear()
    node.joinListeners.clear()
    node.leaveListeners.clear()
  }

  /**
   * Simulates silent packet loss to/from a peer without a formal leave: the mesh
   * still lists them as connected via `peers()`, but no ctrl/ink traffic reaches
   * or leaves them in either direction. Used to exercise heartbeat-driven
   * grace-period logic independently of hard disconnects.
   */
  drop(id: PlayerId): void {
    this.dropped.add(id)
  }

  /** Reverses `drop`. */
  restore(id: PlayerId): void {
    this.dropped.delete(id)
  }

  /** Clears any in-flight latency timers. Call in test teardown when `latencyMs > 0`. */
  destroy(): void {
    this.timers.forEach(t => clearTimeout(t))
    this.timers.clear()
  }
}

/** Convenience: builds an N-peer in-memory mesh and returns each peer's Transport. */
export function createMesh(
  n: number,
  options: MemoryTransportOptions = {},
): { mesh: MemoryMesh; transports: Transport[]; ids: PlayerId[] } {
  const mesh = new MemoryMesh('TEST00', options)
  const ids = Array.from({ length: n }, (_, i) => `peer-${i}`)
  const transports = ids.map(id => mesh.join(id))
  return { mesh, transports, ids }
}
