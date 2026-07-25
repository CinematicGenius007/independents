/**
 * Peer-to-peer wire contract.
 *
 * OWNED BY THE ORCHESTRATOR. Implemented by the net agent.
 *
 * Two channels, chosen for very different traffic shapes:
 *
 * - **ctrl** — low-rate structured messages (join, config, engine actions,
 *   chat, snapshots). JSON-safe objects; the transport handles framing.
 * - **ink** — high-rate stroke frames. Raw `Uint8Array`, encoded by the canvas
 *   layer's {@link InkCodec}. The net layer never inspects these bytes; it only
 *   routes them, which keeps the hot path free of parsing cost.
 */

import type {
  Category,
  Player,
  PlayerId,
  PlayerProfile,
  RoomId,
  Unsubscribe,
} from '../shared/types'
import type { SharedAction, SyncableState } from '../engine/types'

/** Namespacing for the public signaling relay. Bump to invalidate stale rooms. */
export const APP_ID = 'scribble-club-v1'

export type CtrlMessage =
  /** First thing every peer sends on connect, and replies with on receipt. */
  | { t: 'hello'; profile: PlayerProfile; joinedAt: number; established: boolean }
  /** Host's authoritative roster; recipients reconcile against it. */
  | { t: 'roster'; players: Player[]; hostId: PlayerId }
  /** A replicated engine action. The only path by which game state changes. */
  | { t: 'action'; revision: number; action: SharedAction }
  /** Host → drawer only. Never broadcast. */
  | { t: 'word'; word: string; category: Category | null; turnIndex: number }
  /** Host → one player. Close-guess whisper and similar private notices. */
  | { t: 'whisper'; text: string; at: number }
  /** A guess a player is submitting for host adjudication. */
  | { t: 'guess'; text: string; at: number }
  /** Late joiner or freshly promoted host asking to be caught up. */
  | { t: 'sync_request' }
  /**
   * Legacy inline catch-up payload. Current peers send revisioned state and
   * canvas together as one tagged binary ink-channel packet so ordering is atomic.
   */
  | { t: 'sync_state'; revision: number; state: SyncableState; ink: number[] | null }
  /** Latency probe. */
  | { t: 'ping'; nonce: number; at: number }
  | { t: 'pong'; nonce: number; at: number }

export type CtrlKind = CtrlMessage['t']

/** Above this many encoded ink bytes, snapshots go over the ink channel instead. */
export const SNAPSHOT_INLINE_LIMIT = 48 * 1024

/** Interval at which peers exchange pings to detect silent drops, in ms. */
export const PING_INTERVAL_MS = 3000

/**
 * Transport abstraction. The Trystero adapter implements it; an in-memory
 * double implements it for tests. Nothing above this interface may import
 * Trystero — swapping relays, or falling back to manual SDP exchange, must be a
 * one-file change.
 */
export interface Transport {
  readonly roomId: RoomId
  readonly selfId: PlayerId
  /** Currently connected peer ids, excluding self. */
  peers(): PlayerId[]
  /** Omit `to` to broadcast. */
  sendCtrl(msg: CtrlMessage, to?: PlayerId | PlayerId[]): void
  sendInk(bytes: Uint8Array, to?: PlayerId | PlayerId[]): void
  onCtrl(cb: (msg: CtrlMessage, from: PlayerId) => void): Unsubscribe
  onInk(cb: (bytes: Uint8Array, from: PlayerId) => void): Unsubscribe
  onPeerJoin(cb: (id: PlayerId) => void): Unsubscribe
  onPeerLeave(cb: (id: PlayerId) => void): Unsubscribe
  leave(): void
}

export type RelayStatus = 'connecting' | 'connected' | 'failed'

export interface RoomHandle {
  transport: Transport
  /** Shareable deep link, e.g. `https://host/#room=ABCD12`. */
  url: string
  status(): RelayStatus
  onStatus(cb: (status: RelayStatus) => void): Unsubscribe
}

/**
 * Host election is deterministic on every peer: earliest established join
 * order wins, ties broken by lexicographic id. The first pair establishes that
 * order from peer ids; the elected host stamps later arrivals.
 */
export type ElectHost = (players: Player[]) => PlayerId

/** Room codes are uppercase alphanumeric, ambiguity-free (no O/0, I/1). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6
