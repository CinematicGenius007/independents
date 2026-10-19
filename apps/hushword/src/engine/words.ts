import { ANSWER_SOURCE } from './answers'
import { guessesOfLength } from './lexicon'
import { hashSeed } from './rng'

/**
 * The catalogue, in two halves.
 *
 * `answers` is what a case may be set to, and it is hand-curated — a dictionary
 * is a fine keyboard and a terrible puzzle. `guesses` is everything a solver may
 * type, and it is generated from Webster's Second International.
 *
 * The split is not bookkeeping. It is what makes the difficulty number mean
 * something: the reference player narrows its beliefs among the *answers* while
 * probing among the *guesses*, which is exactly the position a person is in.
 * Measuring against one merged list — as the first version of this engine did —
 * makes both the search and the keyboard wrong at once.
 *
 * The answers are eager and small, because every screen needs them. The guesses
 * are 175,472 words in ten modules, one for each length from three to twelve,
 * and are loaded for the length in play — which is why `wordListFor` is the only
 * way to get one.
 */

export interface WordList {
  readonly answers: readonly string[]
  /** Membership only: nothing ever enumerates this in a hot path. */
  readonly guesses: ReadonlySet<string>
  /** The same words as a list, for the reference player, which samples them. */
  readonly guessList: readonly string[]
}

/** Rejects a malformed entry at load rather than at play, so a typo cannot ship. */
function normalise(words: readonly string[], label: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of words) {
    const word = raw.trim().toLowerCase()
    if (!/^[a-z]{3,12}$/.test(word)) throw new Error(`${label}: not a word: ${JSON.stringify(raw)}`)
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
  }
  return out
}

export const ANSWERS: readonly string[] = normalise(ANSWER_SOURCE, 'answers').sort()

export function answersOfLength(length: number): string[] {
  return ANSWERS.filter((word) => word.length === length)
}

/**
 * The lengths the curated answers actually cover.
 *
 * The rules support three to twelve; the *catalogue* supports five and six, and
 * the difference is worth surfacing rather than pretending. A seven-letter case
 * would build happily and then have no answers to narrow between, so the
 * interface reads this and refuses to offer one.
 */
export function coveredLengths(): number[] {
  return [...new Set(ANSWERS.map((word) => word.length))].sort((a, b) => a - b)
}

/**
 * The word list for one length.
 *
 * Webster's 1934 predates `modem`, `pixel`, `laptop` and `vegan`, so the answers
 * are unioned in: anything the game will set as a case, a solver must be allowed
 * to type. The gap is small and the test suite measures it rather than patching
 * it with an exception list.
 */
export async function wordListFor(length: number): Promise<WordList> {
  const guessList = await guessesOfLength(length)
  const guesses = new Set(guessList)
  for (const answer of answersOfLength(length)) guesses.add(answer)
  return { answers: ANSWERS, guesses, guessList }
}

export function isGuess(list: WordList, word: string): boolean {
  return list.guesses.has(word.trim().toLowerCase())
}

/**
 * A list that costs nothing to build, for the test suite.
 *
 * Its guesses are its own answers, which is a legitimate — if unforgiving —
 * solver: it can only ever guess words that could be the answer. The full
 * dictionary is exercised by the playtest and by the one suite that awaits a
 * real length module.
 */
export const SAMPLE: WordList = { answers: ANSWERS, guesses: new Set(ANSWERS), guessList: ANSWERS }

/**
 * A bounded, evenly strided sample of a list.
 *
 * Curated answers only exist for five and six letters. For any other length the
 * honest pool is the whole dictionary — which is both the right answer and far
 * too slow to search a hundred thousand times — so the rating runs against a
 * sample of it, evenly spaced rather than truncated, and the readout says so.
 */
export function sampleWords(words: readonly string[], size: number): string[] {
  if (words.length <= size) return [...words]
  const stride = words.length / size
  const out: string[] = []
  for (let i = 0; i < size; i += 1) out.push(words[Math.floor(i * stride)])
  return out
}

/** `2026-10-16`, so a daily board is named the same everywhere. */
export function dateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dailyIndex(key: string, length: number, poolSize: number): number {
  if (poolSize <= 0) throw new Error('empty pool')
  return hashSeed(`hushword:v1:daily:${key}:${length}`) % poolSize
}

/**
 * The daily is a hash of the date, so everyone gets the same word without
 * anybody agreeing on anything and without a server holding a schedule.
 */
export function dailyAnswer(key: string, length: number): string {
  const pool = answersOfLength(length)
  return pool[dailyIndex(key, length, pool.length)]
}
