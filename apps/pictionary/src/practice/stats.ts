import type { PlayerStats } from '../shared/types'
import type { PracticeState } from './types'

/** Returns a persistable delta only after every prompt has been reviewed. */
export function completedPracticeStatsDelta(state: PracticeState): Partial<PlayerStats> | null {
  if (state.phase !== 'complete') return null
  return {
    gamesPlayed: 1,
    wordsDrawn: state.results.length,
  }
}
