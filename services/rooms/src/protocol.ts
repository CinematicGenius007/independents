/**
 * The wire contract between every app and the rooms service. Version 1.
 *
 * The service does not understand any game. It does four things, and the
 * protocol is exactly those four things:
 *
 * 1. **Presence.** Who is in the room, announced as they arrive and leave.
 * 2. **Sequencing.** Every relayed message is stamped with a room-wide `seq`.
 *    A Durable Object is single-threaded, so that number is a total order every
 *    client agrees on — enough to run a deterministic game in lockstep with no
 *    host at all.
 * 3. **Relay.** To everyone else, to one peer, or back to the sender too.
 * 4. **Memory, if asked.** Games registered with a log get the room's history
 *    replayed on join, so a late arrival or a reconnect can rebuild the board.
 *
 * Messages are JSON text frames. The bare string `ping` is answered with the
 * bare string `pong` by the runtime itself, without waking the room, so
 * keepalives cost nothing while the room hibernates.
 */

/** Current protocol version, in the URL: `/v1/rooms/:game/:code`. */
export const PROTOCOL_VERSION = 1

export const KEEPALIVE_PING = 'ping'
export const KEEPALIVE_PONG = 'pong'

export interface PeerInfo {
  id: string
  name: string
}

/** Anything JSON-serialisable. The service never looks inside it. */
export type Payload = unknown

export type ClientMessage = {
  t: 'send'
  data: Payload
  /** Deliver to one peer only. Omit to broadcast. */
  to?: string
  /** Also deliver to the sender, in sequence. Lockstep games want this. */
  echo?: boolean
  /**
   * Clear the room's log and make this message its first entry. The service
   * applies it unconditionally, so it is only safe for a game whose clients
   * would all accept the message anyway — a lockstep game that validates
   * moves against history should not rebase, because a late joiner would
   * then trust an entry the others rejected.
   */
  rebase?: boolean
}

export type ServerMessage =
  | {
      t: 'welcome'
      self: string
      peers: PeerInfo[]
      /** The room's current sequence number. */
      seq: number
      /** The room's history, oldest first. Present only for logged games. */
      log?: Envelope[]
      /** True when this client was already a member and has reconnected. */
      resumed: boolean
    }
  | { t: 'join'; peer: PeerInfo }
  | { t: 'leave'; peer: PeerInfo }
  | Envelope
  | { t: 'error'; code: ErrorCode; message: string }

export interface Envelope {
  t: 'msg'
  seq: number
  from: string
  data: Payload
  /** Present when the message was sent to one peer rather than the room. */
  direct?: true
}

export type ErrorCode =
  | 'bad_request'
  | 'unknown_game'
  | 'bad_code'
  | 'bad_identity'
  | 'identity_taken'
  | 'room_full'
  | 'too_large'
  | 'rate_limited'
  | 'unknown_peer'
  | 'origin_not_allowed'

/**
 * WebSocket close codes the service uses. 4000–4999 is the range reserved for
 * applications. A client must not reconnect after a "fatal" one: the same
 * request would only be refused again.
 */
export const CLOSE = {
  /** A newer connection for the same client replaced this one. */
  REPLACED: 4000,
  BAD_REQUEST: 4400,
  /** The secret did not match the one this client id joined with. */
  IDENTITY_TAKEN: 4403,
  ROOM_FULL: 4409,
} as const

export const FATAL_CLOSE_CODES: readonly number[] = [
  CLOSE.REPLACED,
  CLOSE.BAD_REQUEST,
  CLOSE.IDENTITY_TAKEN,
  CLOSE.ROOM_FULL,
]

/** Client ids are chosen by the client and stable across reconnects. */
export const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/
/** Proves a reconnect is the same client, not someone who read the id. */
export const CLIENT_SECRET = /^[A-Za-z0-9_-]{16,128}$/
/** Room codes are case-insensitive on entry and uppercase on the wire. */
export const ROOM_CODE = /^[A-Z0-9]{4,12}$/

export const MAX_NAME_LENGTH = 32
/** Largest text frame accepted, in bytes. Azul's full position is ~6 KB. */
export const MAX_MESSAGE_BYTES = 64 * 1024

/** Trims a display name to something safe to show anyone. */
export function cleanName(raw: string | null): string {
  if (!raw) return 'Player'
  // Control characters and bidi overrides could spoof other players' names.
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  return cleaned || 'Player'
}

/** Parses and shape-checks a client frame. Returns null if it is malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const msg = value as Record<string, unknown>
  if (msg.t !== 'send' || !('data' in msg)) return null
  if (msg.to !== undefined && (typeof msg.to !== 'string' || !CLIENT_ID.test(msg.to))) return null
  if (msg.echo !== undefined && typeof msg.echo !== 'boolean') return null
  if (msg.rebase !== undefined && typeof msg.rebase !== 'boolean') return null
  return {
    t: 'send',
    data: msg.data,
    to: msg.to as string | undefined,
    echo: msg.echo as boolean | undefined,
    rebase: msg.rebase as boolean | undefined,
  }
}
