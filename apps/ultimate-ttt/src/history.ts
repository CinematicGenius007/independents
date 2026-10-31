/**
 * The last three matches on this device, and a running record.
 *
 * Everything lives in localStorage and is read defensively: storage may be
 * refused (private windows) or hold something from an older build, and neither
 * should ever stop the game from loading.
 */

import type { BoardWinner, Player } from './game'

export interface HistoryEntry {
  /** Match number, such as `7QK-4M2`. */
  n: string
  /** The encoded record, ready for a replay link. */
  code: string
  winner: Exclude<BoardWinner, null>
  /** The side this device played, or null if it only watched. */
  me: Player | null
  vs: string
  moves: number
  at: number
}

export interface Tally {
  w: number
  l: number
  d: number
}

const HISTORY_KEY = 'ultimate-ttt:history'
const TALLY_KEY = 'ultimate-ttt:tally'
const CODENAME_KEY = 'ultimate-ttt:codename'
export const HISTORY_SIZE = 3

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage refused; this visit simply is not remembered
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    typeof e.n === 'string' &&
    typeof e.code === 'string' &&
    (e.winner === 'X' || e.winner === 'O' || e.winner === 'tie') &&
    (e.me === 'X' || e.me === 'O' || e.me === null) &&
    typeof e.vs === 'string' &&
    typeof e.moves === 'number' &&
    typeof e.at === 'number'
  )
}

export function loadHistory(): HistoryEntry[] {
  const data = read(HISTORY_KEY)
  return Array.isArray(data) ? data.filter(isEntry).slice(0, HISTORY_SIZE) : []
}

export function loadTally(): Tally {
  const data = read(TALLY_KEY) as Partial<Tally> | null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  return { w: num(data?.w), l: num(data?.l), d: num(data?.d) }
}

/** Adds a match, newest first. A match number already on file is ignored. Returns the new list. */
export function addMatch(entry: HistoryEntry): HistoryEntry[] {
  const current = loadHistory()
  // The same moves are the same match: a reload that folds the log again must not count twice.
  if (current.some(e => e.n === entry.n)) return current
  const next = [entry, ...current].slice(0, HISTORY_SIZE)
  write(HISTORY_KEY, next)

  if (entry.me) {
    const tally = loadTally()
    if (entry.winner === 'tie') tally.d++
    else if (entry.winner === entry.me) tally.w++
    else tally.l++
    write(TALLY_KEY, tally)
  }
  return next
}

const ADJECTIVES = ['quiet', 'brisk', 'lucky', 'amber', 'steady', 'sly', 'bold', 'calm', 'keen', 'swift']
const ANIMALS = ['fox', 'owl', 'lynx', 'heron', 'otter', 'raven', 'moth', 'stoat', 'crane', 'wolf']

/** A stable, friendly name for this device until its owner picks one. */
export function codename(): string {
  try {
    const stored = localStorage.getItem(CODENAME_KEY)
    if (stored) return stored
  } catch {
    // fall through and make one
  }
  const r = new Uint8Array(3)
  crypto.getRandomValues(r)
  const name = `${ADJECTIVES[r[0] % ADJECTIVES.length]}-${ANIMALS[r[1] % ANIMALS.length]}-${String(r[2] % 100).padStart(2, '0')}`
  try {
    localStorage.setItem(CODENAME_KEY, name)
  } catch {
    // not remembered; a new one next visit
  }
  return name
}
