/**
 * Transports wired to each other in one process.
 *
 * This is how a four-player game gets played in a unit test: build a hub, hand
 * each `Session` one of its transports, and the same code that would run over
 * WebRTC runs over function calls. Delivery is asynchronous — a microtask, not
 * a direct call — because anything that only works when messages arrive
 * synchronously is a bug waiting for the real network to find it.
 */

import type { CtrlMessage, PeerId, RoomId, Transport, Unsubscribe } from './protocol'

interface Node {
  id: PeerId
  messageListeners: Set<(msg: CtrlMessage, from: PeerId) => void>
  joinListeners: Set<(id: PeerId) => void>
  leaveListeners: Set<(id: PeerId) => void>
  connected: boolean
}

export class MemoryHub {
  readonly roomId: RoomId
  private nodes = new Map<PeerId, Node>()

  constructor(roomId: RoomId = 'MEMORY') {
    this.roomId = roomId
  }

  /** Adds a peer and announces it to everyone already present. */
  join(id: PeerId): Transport {
    const node: Node = {
      id,
      messageListeners: new Set(),
      joinListeners: new Set(),
      leaveListeners: new Set(),
      connected: true,
    }
    const existing = [...this.nodes.values()].filter(n => n.connected)
    this.nodes.set(id, node)
    queueMicrotask(() => {
      for (const other of existing) {
        if (!other.connected || !node.connected) continue
        other.joinListeners.forEach(cb => cb(id))
        node.joinListeners.forEach(cb => cb(other.id))
      }
    })

    const transport: Transport = {
      roomId: this.roomId,
      selfId: id,
      peers: () =>
        [...this.nodes.values()].filter(n => n.connected && n.id !== id).map(n => n.id),
      send: (msg, to) => {
        if (!node.connected) return
        const targets = to ? [this.nodes.get(to)] : [...this.nodes.values()]
        const payload = JSON.parse(JSON.stringify(msg)) as CtrlMessage
        for (const target of targets) {
          if (!target || target.id === id || !target.connected) continue
          queueMicrotask(() => {
            if (!target.connected || !node.connected) return
            target.messageListeners.forEach(cb => cb(payload, id))
          })
        }
      },
      onMessage: cb => addTo(node.messageListeners, cb),
      onPeerJoin: cb => addTo(node.joinListeners, cb),
      onPeerLeave: cb => addTo(node.leaveListeners, cb),
      leave: () => this.drop(id),
    }
    return transport
  }

  /** Simulates a peer vanishing — a closed tab, a dead connection. */
  drop(id: PeerId): void {
    const node = this.nodes.get(id)
    if (!node || !node.connected) return
    node.connected = false
    this.nodes.delete(id)
    for (const other of this.nodes.values()) {
      if (!other.connected) continue
      queueMicrotask(() => other.leaveListeners.forEach(cb => cb(id)))
    }
  }
}

function addTo<T>(set: Set<T>, cb: T): Unsubscribe {
  set.add(cb)
  return () => set.delete(cb)
}

/** Lets every pending microtask-delivered message land. */
export async function settle(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}
