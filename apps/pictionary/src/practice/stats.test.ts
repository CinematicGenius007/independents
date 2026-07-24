import { describe, expect, it } from 'vitest'
import { completedPracticeStatsDelta } from './stats'
import { createPracticeSession, reducePractice } from './session'

describe('completedPracticeStatsDelta', () => {
  it('returns no delta for an unfinished session', () => {
    const state = createPracticeSession({
      seed: 'stats',
      prompts: [{ word: 'cat', category: 'animals' }],
      turnDurationMs: 30_000,
      startedAt: 0,
    })
    expect(completedPracticeStatsDelta(state)).toBeNull()
  })

  it('counts a completed practice game and every attempted drawing', () => {
    let state = createPracticeSession({
      seed: 'stats',
      prompts: [
        { word: 'cat', category: 'animals' },
        { word: 'cake', category: 'food' },
      ],
      turnDurationMs: 30_000,
      startedAt: 0,
    })
    state = reducePractice(state, { type: 'TICK', at: state.turnEndsAt })
    state = reducePractice(state, { type: 'NEXT_PROMPT', at: 30_000 })
    state = reducePractice(state, { type: 'TICK', at: state.turnEndsAt })
    state = reducePractice(state, { type: 'NEXT_PROMPT', at: 60_000 })

    expect(completedPracticeStatsDelta(state)).toEqual({ gamesPlayed: 1, wordsDrawn: 2 })
  })
})
