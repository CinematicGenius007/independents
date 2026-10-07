/**
 * Azul over the independents rooms service.
 *
 * This is the second implementation of {@link Transport}, beside Trystero, and
 * the reason the interface was drawn where it was: nothing above it changes.
 * The session still elects a host, still replicates sequenced events, still
 * asks for a snapshot when it falls out of step. What changes is everything
 * underneath — a server that is always there, sockets that reconnect on their
 * own, and an identity that survives a reload, so a player whose phone slept
 * comes back to their own seat.
 */

import type { CtrlMessage, PeerId, RelayStatus, RoomHandle, RoomId, Transport, Unsubscribe } from './protocol'
import { RoomsConnection } from './rooms-client'
import type { Identity, RoomsStatus } from './rooms-client'

export const GAME_ID = 'azul'

export interface RoomsHandleOptions {
  baseUrl: string
  roomId: RoomId
  name: string
  /** The shareable link for this room. */
  url: string
  /** Injected by tests. */
  WebSocketImpl?: typeof WebSocket
  identity?: Identity
}

/** The rooms client's richer states, folded into the three the UI shows. */
function relayStatus(status: RoomsStatus): RelayStatus {
  if (status === 'open') return 'connected'
  if (status === 'failed' || status === 'closed') return 'failed'
  return 'connecting'
}

export function createRoomsHandle(options: RoomsHandleOptions): RoomHandle {
  const connection = new RoomsConnection({
    baseUrl: options.baseUrl,
    game: GAME_ID,
    code: options.roomId,
    name: options.name,
    identity: options.identity,
    WebSocketImpl: options.WebSocketImpl,
  })

  const transport: Transport = {
    roomId: connection.code,
    selfId: connection.self,
    peers: () => [...connection.peers.keys()],
    send: (msg: CtrlMessage, to?: PeerId) => connection.send(msg, to ? { to } : {}),
    onMessage: (cb): Unsubscribe =>
      connection.on('message', envelope => cb(envelope.data as CtrlMessage, envelope.from)),
    onPeerJoin: (cb): Unsubscribe => connection.on('join', peer => cb(peer.id)),
    onPeerLeave: (cb): Unsubscribe => connection.on('leave', peer => cb(peer.id)),
    leave: () => connection.close(),
  }

  return {
    transport,
    url: options.url,
    status: () => relayStatus(connection.getStatus()),
    onStatus: cb => connection.on('status', status => cb(relayStatus(status))),
  }
}
