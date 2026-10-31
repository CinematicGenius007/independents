/**
 * A finished game, as something small enough to put in a link.
 *
 * The rules are a pure function of the moves, so a game *is* its move list.
 * The list is bit-packed (a forced board needs only the cell, 4 bits; a free
 * choice needs board and cell, 7 bits), and decoding replays it through the
 * real rules, so a link carrying an illegal move is rejected rather than shown.
 *
 * The match number is a short hash of the same record. Anyone replaying a link
 * recomputes it, which shows the moves were not altered along the way. It is a
 * label, not a registry: nothing stops someone inventing a legal game.
 */

import { sha256 } from './sha256'
import { applyMove, initialState } from './game'
import type { GameState, Move, Player } from './game'

export interface MatchRecord {
  starter: Player
  moves: Move[]
}

const VERSION = 1
const MAX_MOVES = 81
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

class BitWriter {
  private bytes: number[] = []
  private used = 8 // bits used in the last byte; 8 means "start a new one"

  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      if (this.used === 8) {
        this.bytes.push(0)
        this.used = 0
      }
      this.bytes[this.bytes.length - 1] |= ((value >> i) & 1) << (7 - this.used)
      this.used++
    }
  }

  result(): number[] {
    return this.bytes
  }
}

class BitReader {
  private pos = 0
  constructor(private bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length * 8 - this.pos
  }

  read(bits: number): number | null {
    if (this.remaining < bits) return null
    let value = 0
    for (let i = 0; i < bits; i++) {
      const byte = this.bytes[this.pos >> 3]
      value = (value << 1) | ((byte >> (7 - (this.pos & 7))) & 1)
      this.pos++
    }
    return value
  }
}

function toBase64Url(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, c => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** Packs a record into URL-safe text. Throws if the moves are not a legal game. */
export function encodeRecord(record: MatchRecord): string {
  if (record.moves.length > MAX_MOVES) throw new Error('Too many moves.')
  const out = new BitWriter()
  out.write(VERSION, 7)
  out.write(record.starter === 'O' ? 1 : 0, 1)
  out.write(record.moves.length, 7)

  let state = initialState(record.starter)
  for (const move of record.moves) {
    if (state.activeBoard !== null) out.write(move.cell, 4)
    else out.write(move.board * 9 + move.cell, 7)
    const next = applyMove(state, move)
    if (!next) throw new Error('Illegal move in record.')
    state = next
  }
  return toBase64Url(out.result())
}

/** Replays a record's text, or returns null if it is malformed or not a legal game. */
export function decodeRecord(text: string): MatchRecord | null {
  const bytes = fromBase64Url(text)
  if (!bytes) return null
  const reader = new BitReader(bytes)
  if (reader.read(7) !== VERSION) return null
  const starterBit = reader.read(1)
  const count = reader.read(7)
  if (starterBit === null || count === null || count > MAX_MOVES) return null

  const starter: Player = starterBit ? 'O' : 'X'
  const moves: Move[] = []
  let state = initialState(starter)
  for (let i = 0; i < count; i++) {
    let move: Move
    if (state.activeBoard !== null) {
      const cell = reader.read(4)
      if (cell === null) return null
      move = { board: state.activeBoard, cell }
    } else {
      const packed = reader.read(7)
      if (packed === null || packed > 80) return null
      move = { board: Math.floor(packed / 9), cell: packed % 9 }
    }
    const next = applyMove(state, move)
    if (!next) return null
    moves.push(move)
    state = next
  }
  // Only zero padding may follow, so every game has exactly one spelling.
  const record = { starter, moves }
  return encodeRecord(record) === text ? record : null
}

/** The position after the first `count` moves of a record. */
export function stateAt(record: MatchRecord, count: number): GameState {
  let state = initialState(record.starter)
  for (let i = 0; i < Math.min(count, record.moves.length); i++) {
    state = applyMove(state, record.moves[i]) ?? state
  }
  return state
}

/** A short label for a record, such as `7QK-4M2`. */
export async function matchNumber(record: MatchRecord): Promise<string> {
  const canonical = `${record.starter}:${record.moves.map(m => m.board * 9 + m.cell).join(',')}`
  const bytes = new TextEncoder().encode(canonical)
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    : sha256(bytes)
  let bits = 0
  let acc = 0
  let text = ''
  for (const byte of digest) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5 && text.length < 6) {
      bits -= 5
      text += CROCKFORD[(acc >> bits) & 31]
    }
    if (text.length === 6) break
  }
  return `${text.slice(0, 3)}-${text.slice(3)}`
}

/** `#m=<record>.<number>` — the number lets a replay say whether the moves arrived intact. */
export function replayHash(code: string, number: string): string {
  return `#m=${code}.${number.replace('-', '')}`
}

export function parseReplayHash(hash: string): { record: MatchRecord; claimed: string | null } | null {
  const match = /^#?m=([A-Za-z0-9_-]+)(?:\.([0-9A-Za-z]{6}))?$/.exec(hash)
  if (!match) return null
  const record = decodeRecord(match[1])
  if (!record) return null
  const claimed = match[2] ? `${match[2].slice(0, 3)}-${match[2].slice(3)}`.toUpperCase() : null
  return { record, claimed }
}
