import type { GameState } from '../engine'
import type { GameHistoryEntry, PlayerStats } from '../shared/types'

export interface LocalTurnRecord {
  delta: Partial<PlayerStats>
  entry: GameHistoryEntry
  guessed: boolean
}

export interface LocalStatsProgress {
  turn?: { record: LocalTurnRecord; bestStreak: number }
  completedGame?: string
}

/** Observes every controller transition synchronously, before React can batch renders. */
export function createLocalStatsTracker(playerName: string) {
  const activeTurns = new Set<string>()
  const persistedTurns = new Set<string>()
  const persistedGames = new Set<string>()
  let streak = 0
  return (state: GameState): LocalStatsProgress | null => {
    if (!state.gameNonce) return null
    const result: LocalStatsProgress = {}
    const turnKey = state.turn ? `${state.gameNonce}:${state.turn.index}` : null
    if (state.phase === 'drawing' && turnKey) activeTurns.add(turnKey)
    if (state.phase === 'turn_review' && turnKey && activeTurns.has(turnKey) && !persistedTurns.has(turnKey)) {
      const record = localTurnRecord(state, playerName)
      if (record) {
        persistedTurns.add(turnKey)
        streak = record.guessed ? streak + 1 : 0
        result.turn = { record, bestStreak: streak }
      }
    }
    if (state.phase === 'game_over' && !persistedGames.has(state.gameNonce)) {
      persistedGames.add(state.gameNonce)
      result.completedGame = state.gameNonce
    }
    return result.turn || result.completedGame ? result : null
  }
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
