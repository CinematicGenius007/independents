/**
 * Guess evaluation: fuzzy matching and the client-side anti-spam gate.
 */

import { LIMITS } from '../shared/types'
import type { PlayerId } from '../shared/types'
import type { GameState } from './types'
import { normalize } from './words'

/**
 * Bounded Levenshtein distance. `maxDistance` both short-circuits rows once
 * every cell in the row exceeds the bound, and short-circuits immediately on
 * a length gap that already exceeds it.
 */
export function levenshtein(a: string, b: string, maxDistance: number = Infinity): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return Math.min(bl, maxDistance === Infinity ? bl : maxDistance + 1)
  if (bl === 0) return Math.min(al, maxDistance === Infinity ? al : maxDistance + 1)
  if (Math.abs(al - bl) > maxDistance) return maxDistance + 1

  let prev = new Array<number>(bl + 1)
  let curr = new Array<number>(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j

  for (let i = 1; i <= al; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > maxDistance) return maxDistance + 1
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[bl]
}

/**
 * Classifies a guess against the target word. `'close'` requires the
 * normalized distance to be within {@link LIMITS.closeGuessDistance} *and*
 * that distance to not span most of the (shorter) word — otherwise a wildly
 * wrong 2-letter guess against a 3-letter word would read as "so close!".
 */
export function classifyGuess(text: string, word: string): 'correct' | 'close' | 'miss' {
  const guess = normalize(text)
  const target = normalize(word)
  if (guess.length === 0) return 'miss'
  if (guess === target) return 'correct'

  const dist = levenshtein(guess, target, LIMITS.closeGuessDistance)
  if (dist > LIMITS.closeGuessDistance) return 'miss'
  if (dist === 0) return 'correct'

  // Guard: on short words, a distance of `closeGuessDistance` covers most or
  // all of the letters, so it isn't meaningfully "close".
  if (target.length <= dist * 2) return 'miss'

  return 'close'
}

/**
 * Whether `playerId` is currently allowed to submit a guess: must be in the
 * `'drawing'` phase, not be the drawer, not have already solved this turn,
 * and be outside the rate-limit cooldown (`at - lastGuessAt >= cooldownMs`,
 * so the cooldown boundary itself is allowed).
 */
export function canGuess(state: GameState, playerId: PlayerId, at: number): boolean {
  if (state.phase !== 'drawing') return false
  if (!state.turn) return false
  if (state.turn.drawerId === playerId) return false
  if (playerId in state.turn.correct) return false
  const last = state.lastGuessAt[playerId]
  if (last !== undefined && at - last < LIMITS.guessCooldownMs) return false
  return true
}
