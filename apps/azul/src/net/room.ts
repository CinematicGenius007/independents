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
 * Where rooms are hosted, if anywhere.
 *
 * With `VITE_ROOMS_URL` set, rooms go through the independents rooms service:
 * a server that is always reachable, with reconnects and stable seats. Without
 * it, the game falls back to signalling peer to peer over public relays, which
 * needs no infrastructure at all but depends on strangers' servers and on two
 * browsers managing to reach each other directly.
 */
export const ROOMS_URL: string | null =
  (import.meta.env.VITE_ROOMS_URL ?? '').trim() || 'https://independents-rooms.cloudflareworkers-unsafe064.workers.dev'

/**
 * Loaded on demand.
 *
 * Networking code is most of this app's bytes, and a solo game never opens a
 * room. Fetching it only when somebody opens or joins one keeps the front
 * page cheap.
 */
async function handleFor(roomId: RoomId, name: string): Promise<RoomHandle> {
  if (ROOMS_URL) {
    const { createRoomsHandle } = await import('./ws-transport')
    return createRoomsHandle({ baseUrl: ROOMS_URL, roomId, name, url: buildRoomUrl(roomId) })
  }
  const { createTrysteroTransport } = await import('./trystero-transport')
  const connection = createTrysteroTransport(roomId)
  return {
    transport: connection.transport,
    url: buildRoomUrl(roomId),
    status: connection.status,
    onStatus: connection.onStatus,
  }
}

export function createRoom(name: string, random?: () => number): Promise<RoomHandle> {
  return handleFor(generateRoomCode(random), name)
}

export function joinRoom(code: string, name: string): Promise<RoomHandle> {
  return handleFor(normalizeRoomCode(code), name)
}
