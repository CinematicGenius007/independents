/**
 * Room lifecycle: code generation, shareable URL, and the `RoomHandle` callers
 * actually use. All the Trystero-specific connect/fallback/timeout machinery
 * lives in trystero-transport.ts — this file just generates a code (or accepts
 * one to join), builds the deep link, and wires the two together.
 */

import type { RoomId } from '../shared/types'
import type { RoomHandle } from './protocol'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './protocol'
import { createTrysteroTransport } from './trystero-transport'

const ROOM_HASH_KEY = 'room'

/** Generates a room code from {@link ROOM_CODE_ALPHABET} at {@link ROOM_CODE_LENGTH}. */
export function generateRoomCode(random: () => number = Math.random): RoomId {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** Room codes are case-insensitive on entry; the canonical form is uppercase. */
export function normalizeRoomCode(raw: string): RoomId {
  return raw.trim().toUpperCase()
}

/** Shareable deep link, e.g. `https://host/path#room=ABCD12`. */
export function buildRoomUrl(roomId: RoomId): string {
  if (typeof location === 'undefined') {
    return `#${ROOM_HASH_KEY}=${roomId}`
  }
  return `${location.origin}${location.pathname}#${ROOM_HASH_KEY}=${roomId}`
}

/** Parses a `#room=CODE` fragment. Returns null if the hash doesn't match. */
export function parseRoomIdFromHash(hash: string): RoomId | null {
  const match = /^#?room=([A-Za-z0-9]+)$/.exec(hash.trim())
  return match ? normalizeRoomCode(match[1]) : null
}

/** Reads and parses `location.hash` on boot. Returns null outside a browser. */
export function parseRoomIdFromLocation(): RoomId | null {
  if (typeof location === 'undefined') return null
  return parseRoomIdFromHash(location.hash)
}

function buildRoomHandle(roomId: RoomId): RoomHandle {
  const connection = createTrysteroTransport(roomId)
  return {
    transport: connection.transport,
    url: buildRoomUrl(roomId),
    status: connection.status,
    onStatus: connection.onStatus,
  }
}

/** Creates a fresh room with a newly generated code. */
export function createRoom(random?: () => number): RoomHandle {
  return buildRoomHandle(generateRoomCode(random))
}

/** Joins an existing room by its code. */
export function joinRoom(code: string): RoomHandle {
  return buildRoomHandle(normalizeRoomCode(code))
}
