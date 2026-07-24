import type { GameState } from '../engine'
import type { GameHistoryEntry, PlayerStats } from '../shared/types'

export interface LocalTurnRecord {
  delta: Partial<PlayerStats>
  entry: GameHistoryEntry
  guessed: boolean
}

/** Builds the local-only persistence record for a completed turn. */
export function localTurnRecord(state: GameState, playerName: string): LocalTurnRecord | null {
  const turn = state.turn
  if (!turn || turn.endReason === null || !turn.word) return null
  const isDrawer = turn.drawerId === state.selfId
  const correct = turn.correct[state.selfId]
  const score = isDrawer ? turn.drawerPoints : correct?.points ?? 0
  return {
    delta: isDrawer
      ? { wordsDrawn: 1 }
      : {
          wordsGuessed: correct ? 1 : 0,
          totalGuessTimeMs: correct?.elapsedMs ?? 0,
          guessCount: correct ? 1 : 0,
        },
    entry: {
      gameId: state.gameNonce,
      playerName,
      score,
      role: isDrawer ? 'drawer' : 'guesser',
      word: turn.word,
      timestamp: turn.endsAt,
    },
    guessed: Boolean(correct),
  }
}
