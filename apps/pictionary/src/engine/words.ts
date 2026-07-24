/**
 * Word-pool helpers. Word *selection* (`pickWords`) and hint scheduling
 * (`hintIndices`) are deterministic functions of a seed, so any client can
 * reproduce them — but the host is the one who actually calls them during
 * play (see PLAN.md's "host as sequencer" note), delivering the result to
 * the drawer privately and to everyone else as position-only hint reveals.
 *
 * `normalize` is also used by `guess.ts` for guess matching.
 */

import { hashString, mulberry32, shuffle } from './rng'

/**
 * Deterministic, non-repeating word picks for an entire game. If `count`
 * exceeds `pool.length`, the pool is reshuffled (with a lap-specific seed)
 * and reused rather than repeating within a single pass.
 */
export function pickWords(pool: readonly string[], count: number, gameNonce: string): string[] {
  if (pool.length === 0 || count <= 0) return []
  const result: string[] = []
  let lap = 0
  while (result.length < count) {
    const rand = mulberry32(hashString(`${gameNonce}:words:${lap}`))
    const shuffled = shuffle(pool, rand)
    for (const word of shuffled) {
      if (result.length >= count) break
      result.push(word)
    }
    lap++
  }
  return result
}

/** Token lengths of a word, e.g. `"ice cream"` -> `[3, 5]`. */
export function wordShape(word: string): number[] {
  return word
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => token.length)
}

/**
 * Deterministically picks which character positions (indices into the
 * *joined* word string, spaces included) should be revealed as hints, given
 * how many letters should be revealed so far. Never reveals a space. Spread
 * across the word via a seeded shuffle rather than sequential front-to-back
 * reveal, and results are a growing prefix as `revealCount` increases (so
 * hosts can call this once per reveal tick and only broadcast the delta).
 */
export function hintIndices(
  word: string,
  revealCount: number,
  gameNonce: string,
  turnIndex: number,
): number[] {
  const validIndices: number[] = []
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ') validIndices.push(i)
  }
  const clamped = Math.max(0, Math.min(revealCount, validIndices.length))
  const rand = mulberry32(hashString(`${gameNonce}:hint:${turnIndex}`))
  const order = shuffle(validIndices, rand)
  return order.slice(0, clamped).sort((a, b) => a - b)
}

/**
 * Convenience wrapper the host calls directly when emitting `HINT_REVEALED`:
 * runs {@link hintIndices} and maps each chosen index to its character, since
 * that action carries characters (not positions) so guessers — whose engine
 * state never holds the secret word — can render the hint.
 */
export function hintReveals(
  word: string,
  revealCount: number,
  gameNonce: string,
  turnIndex: number,
): Record<number, string> {
  const indices = hintIndices(word, revealCount, gameNonce, turnIndex)
  const reveals: Record<number, string> = {}
  for (const i of indices) reveals[i] = word[i]
  return reveals
}

/**
 * Lowercase, trim, collapse internal whitespace, strip punctuation and
 * diacritics. Used for guess matching so `"Café!"`, `"cafe"`, and `" CAFE "`
 * all compare equal.
 */
export function normalize(s: string): string {
  const withoutDiacritics = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return withoutDiacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
