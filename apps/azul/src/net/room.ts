/**
 * Room codes and the link that carries them.
 *
 * The code is the whole account system: five characters, no vowels and no
 * lookalike glyphs, so it survives being read aloud over a phone.
 */

import type { RoomHandle, RoomId } from './protocol'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './protocol'

const ROOM_HASH_KEY = 'room'

export function generateRoomCode(random: () => number = Math.random): RoomId {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** Codes are typed in any case; the canonical form is upper. */
export function normalizeRoomCode(raw: string): RoomId {
  return raw.trim().toUpperCase()
}

export function isRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw)
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every(ch => ROOM_CODE_ALPHABET.includes(ch))
  )
}

/** The shareable link, e.g. `https://host/path#room=KP4TQ`. */
export function buildRoomUrl(roomId: RoomId): string {
  if (typeof location === 'undefined') return `#${ROOM_HASH_KEY}=${roomId}`
  return `${location.origin}${location.pathname}#${ROOM_HASH_KEY}=${roomId}`
}

export function parseRoomIdFromHash(hash: string): RoomId | null {
  const match = /^#?room=([A-Za-z0-9]+)$/.exec(hash.trim())
  if (!match) return null
  const code = normalizeRoomCode(match[1])
  return isRoomCode(code) ? code : null
}

export function parseRoomIdFromLocation(): RoomId | null {
  if (typeof location === 'undefined') return null
  return parseRoomIdFromHash(location.hash)
}

/**
 * Loaded on demand.
 *
 * The signalling libraries are most of this app's bytes, and a solo game never
 * signals anything. Fetching them only when somebody opens or joins a room
 * keeps the front page cheap.
 */
async function handleFor(roomId: RoomId): Promise<RoomHandle> {
  const { createTrysteroTransport } = await import('./trystero-transport')
  const connection = createTrysteroTransport(roomId)
  return {
    transport: connection.transport,
    url: buildRoomUrl(roomId),
    status: connection.status,
    onStatus: connection.onStatus,
  }
}

export function createRoom(random?: () => number): Promise<RoomHandle> {
  return handleFor(generateRoomCode(random))
}

export function joinRoom(code: string): Promise<RoomHandle> {
  return handleFor(normalizeRoomCode(code))
}
