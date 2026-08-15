/**
 * The wire contract.
 *
 * The shape of the traffic decides the design here. A game of Azulejo is a few
 * dozen turn-taking decisions and nothing else — no strokes, no cursors, no
 * stream. So there is one channel, messages are small JSON, and the whole
 * protocol fits on a page.
 *
 * The arrangement is host-authoritative replication, not shared simulation:
 *
 * - Only the host holds the bag. Draws are broadcast as `deal`, already drawn,
 *   so no other peer has the future in its memory to peek at.
 * - Every other transition is deterministic, so peers replicate an ordered log
 *   of `move` and `tile` events and arrive at identical boards without ever
 *   sending a board.
 * - A peer that receives an event out of order does not guess. It asks for a
 *   snapshot, which is cheap because the whole position is a few hundred bytes.
 */

import type { GameState, Move } from '../engine/types'
import type { BotStyle } from '../engine/bot'

/** Namespacing on the public signalling relays. Bump to invalidate old rooms. */
export const APP_ID = 'azulejo-v1'

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

export const MAX_SEATS = 4
export const MIN_SEATS = 2

export type PeerId = string
export type RoomId = string
export type Unsubscribe = () => void

/** How the relay connection is doing, for the corner of the screen. */
export type RelayStatus = 'connecting' | 'connected' | 'failed'

/** One place at the table. A seat with no peer is played by the house. */
export interface Seat {
  /** Stable for the whole game; a bot's id is synthetic. */
  id: string
  name: string
  kind: 'human' | 'bot'
  style: BotStyle
  /** False when the human who owns this seat is not currently connected. */
  present: boolean
}

export interface RoomConfig {
  /** Milliseconds a bot waits before playing, so its turn can be watched. */
  botDelayMs: number
}

export const DEFAULT_CONFIG: RoomConfig = { botDelayMs: 850 }

export type CtrlMessage =
  /** Sent on connect and echoed back, so both ends learn each other's name. */
  | { t: 'hello'; name: string; joinedAt: number }
  /** The host's view of the table. Authoritative; recipients overwrite theirs. */
  | { t: 'roster'; hostId: PeerId; seats: Seat[]; config: RoomConfig; started: boolean }
  /** The game begins with these seats, in this order. */
  | { t: 'begin'; seq: number; seats: Seat[] }
  /** Tiles drawn from the host's bag, already dealt onto the displays. */
  | { t: 'deal'; seq: number; factories: GameState['factories'] }
  /** A turn taken by `seat`. */
  | { t: 'move'; seq: number; seat: number; move: Move }
  /** Run the wall-tiling phase. Carries no data: the result is derivable. */
  | { t: 'tile'; seq: number }
  /** Full position, for a late joiner or a peer that fell out of step. */
  | { t: 'snapshot'; seq: number; state: GameState; seats: Seat[]; config: RoomConfig }
  /** "I am lost, send me a snapshot." */
  | { t: 'sync'; }
  /** A peer asking the host to play a move on its behalf. */
  | { t: 'intent'; move: Move }
  /** Sent by the surviving peer that has taken over an abandoned game. */
  | { t: 'claim'; hostId: PeerId; at: number }

/**
 * Transport abstraction.
 *
 * Nothing above this interface may import Trystero. The in-memory double used
 * by the tests implements the same three methods, which is the whole reason a
 * full game can be played in a unit test without a network.
 */
export interface Transport {
  readonly roomId: RoomId
  readonly selfId: PeerId
  peers(): PeerId[]
  /** Omit `to` to broadcast to every peer. */
  send(msg: CtrlMessage, to?: PeerId): void
  onMessage(cb: (msg: CtrlMessage, from: PeerId) => void): Unsubscribe
  onPeerJoin(cb: (id: PeerId) => void): Unsubscribe
  onPeerLeave(cb: (id: PeerId) => void): Unsubscribe
  leave(): void
}

export interface RoomHandle {
  transport: Transport
  /** The link to send someone. */
  url: string
  status: () => RelayStatus
  onStatus: (cb: (status: RelayStatus) => void) => Unsubscribe
}
