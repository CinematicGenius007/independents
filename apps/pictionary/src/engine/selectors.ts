/**
 * Derived, side-effect-free views over {@link GameState} for the UI layer.
 */

import type { PlayerId } from '../shared/types'
import type { ChatEntry, GameState } from './types'

/** Chat entries visible to `viewerId`, applying the `audience` filter. */
export function visibleChat(state: GameState, viewerId: PlayerId): ChatEntry[] {
  const hasSolved = Boolean(
    state.turn && (viewerId in state.turn.correct || state.turn.drawerId === viewerId),
  )
  return state.chat.filter((entry) => {
    if (entry.audience === 'all') return true
    if (entry.audience === 'solved') return hasSolved
    return entry.audience === viewerId
  })
}

export interface ScoreRow {
  playerId: PlayerId
  score: number
}

/** Scores sorted highest-first; ties broken lexicographically by id for stability. */
export function sortedScores(state: GameState): ScoreRow[] {
  return Object.entries(state.scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
}

export function isDrawer(state: GameState, id: PlayerId): boolean {
  return state.turn?.drawerId === id
}

/** Ms remaining in the current turn, clamped to 0. */
export function remainingMs(state: GameState, now: number): number {
  if (!state.turn) return 0
  return Math.max(0, state.turn.endsAt - now)
}

/** True once every non-drawer player has a recorded correct guess this turn. */
export function allGuessed(state: GameState): boolean {
  if (!state.turn) return false
  const guessers = Object.keys(state.players).filter((id) => id !== state.turn!.drawerId)
  if (guessers.length === 0) return false
  return guessers.every((id) => id in state.turn!.correct)
}

/** The player id who should draw next, based on `order` and the current turn index. */
export function nextDrawer(state: GameState): PlayerId | null {
  if (state.order.length === 0) return null
  const nextIndex = state.turn ? state.turn.index + 1 : 0
  return state.order[nextIndex % state.order.length]
}

/**
 * Renders the word as blanks with spaces preserved and any hinted letters
 * filled in, e.g. `"ice cream"` with the `c` at index 1 revealed ->
 * `"_c_ _____"`. Returns the real word once the viewer is entitled to see it
 * in full (the drawer during their own turn, or anyone once the turn has
 * ended). `turn.word === ''` is the "cancelled, nobody ever knew the word"
 * case (see `TURN_ENDED` in types.ts) — that is deliberately *not* treated
 * as an entitled reveal, so it falls through to the blanks-plus-hints
 * rendering instead of returning a bogus empty string.
 */
export function wordDisplay(state: GameState, viewerId: PlayerId): string {
  const turn = state.turn
  if (!turn) return ''

  const entitled =
    turn.word !== null &&
    turn.word !== '' &&
    (viewerId === turn.drawerId || turn.endReason !== null)
  if (entitled) return turn.word as string

  const chars: string[] = []
  let pos = 0
  turn.wordShape.forEach((len, tokenIdx) => {
    if (tokenIdx > 0) {
      chars.push(' ')
      pos++
    }
    for (let i = 0; i < len; i++) {
      chars.push(turn.revealed[pos] ?? '_')
      pos++
    }
  })
  return chars.join('')
}
