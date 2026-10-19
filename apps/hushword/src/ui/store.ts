import type { GameState } from '../engine/game'

/**
 * What the browser remembers.
 *
 * A puzzle shared by a friend is something you come back to, and the daily is
 * something you do most days, so both need somewhere to live. There is no server
 * — that is the whole premise — so this is the only place a half-finished puzzle
 * can be, and the app says so rather than pretending otherwise.
 *
 * Everything here is advisory. A tampered record only cheats the person who
 * tampered with it, and a case that will not parse is simply a case that starts
 * again, so nothing is validated beyond its shape.
 */

const CASE_PREFIX = 'hushword.case.'
const RESULTS_KEY = 'hushword.results'
const PREF_KEY = 'hushword.prefs'
/** Bump when the packed link shape changes, so old records are ignored rather than misread. */
const VERSION = 2

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A private window can refuse storage. Nothing here is essential.
  }
}

export interface SavedCase {
  readonly v: number
  readonly seed: string
  readonly state: GameState
  readonly elapsed: number
}

export function loadCase(fragment: string, seed: string): SavedCase | null {
  const saved = read<SavedCase>(`${CASE_PREFIX}${fragment}`)
  if (!saved || saved.v !== VERSION || saved.seed !== seed) return null
  if (!saved.state || !Array.isArray(saved.state.turns)) return null
  return saved
}

export function saveCase(fragment: string, seed: string, state: GameState, elapsed: number): void {
  // A finished puzzle is a result, not a resumption.
  if (state.status !== 'playing') {
    forgetCase(fragment)
    return
  }
  write(`${CASE_PREFIX}${fragment}`, { v: VERSION, seed, state, elapsed } satisfies SavedCase)
}

export function forgetCase(fragment: string): void {
  try {
    window.localStorage.removeItem(`${CASE_PREFIX}${fragment}`)
  } catch {
    // Nothing to do.
  }
}

export interface Result {
  readonly id: string
  readonly solved: boolean
  readonly guesses: number
  readonly at: number
}

export function recordResult(result: Result): void {
  const previous = results().filter((entry) => entry.id !== result.id)
  write(RESULTS_KEY, [result, ...previous].slice(0, 120))
}

export function results(): Result[] {
  const parsed = read<Result[]>(RESULTS_KEY)
  return Array.isArray(parsed) ? parsed : []
}

export function resultFor(id: string): Result | null {
  return results().find((entry) => entry.id === id) ?? null
}

/** The day before a `YYYY-MM-DD` key. */
export function previousDay(key: string): string {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Consecutive days solved, counting back from today.
 *
 * Today counts if it is done; if it is not, the streak is whatever yesterday's
 * run was, because a streak that breaks at midnight is a worse thing to build
 * than one that waits for you.
 */
export function streak(today: string): number {
  const played = new Set(results().filter((entry) => entry.id.startsWith('daily-')).map((entry) => entry.id.slice(6)))
  let day = played.has(today) ? today : previousDay(today)
  let count = 0
  while (played.has(day)) {
    count += 1
    day = previousDay(day)
  }
  return count
}

export interface Prefs {
  readonly dailyMode: 'hushword' | 'clean'
  readonly dailyLength: number
  readonly theme: 'dark' | 'light'
}

export function prefs(): Prefs {
  const saved = read<Partial<Prefs>>(PREF_KEY)
  return {
    dailyMode: saved?.dailyMode === 'clean' ? 'clean' : 'hushword',
    dailyLength: typeof saved?.dailyLength === 'number' ? saved.dailyLength : 6,
    theme: saved?.theme === 'light' ? 'light' : 'dark',
  }
}

export function savePrefs(next: Partial<Prefs>): void {
  write(PREF_KEY, { ...prefs(), ...next })
}
