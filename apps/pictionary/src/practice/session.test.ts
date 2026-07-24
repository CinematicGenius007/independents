import { describe, expect, it } from 'vitest'
import { createPracticeSession, currentPracticePrompt, practiceTimeLeftMs, reducePractice } from './session'
import type { PracticePrompt, PracticeState } from './types'

const prompts: PracticePrompt[] = [
  { word: 'cat', category: 'animals' },
  { word: 'ice cream', category: 'food' },
]

function session(seed = 'practice-seed'): PracticeState {
  return createPracticeSession({ seed, prompts, turnDurationMs: 60_000, startedAt: 1_000 })
}

describe('practice session', () => {
  it('creates the same simulated guess schedule for the same inputs', () => {
    expect(session()).toEqual(session())
    expect(session('another-seed').simulatedGuessAt).not.toBe(session().simulatedGuessAt)
  })

  it('records a simulated guess at its scheduled time, independent of tick frequency', () => {
    let initial = session()
    for (let i = 1; initial.simulatedGuessAt === null; i++) initial = session(`success-${i}`)
    const next = reducePractice(initial, { type: 'TICK', at: initial.turnEndsAt + 10_000 })

    expect(next.phase).toBe('review')
    expect(next.results).toEqual([
      {
        ...prompts[0],
        startedAt: initial.turnStartedAt,
        endedAt: initial.simulatedGuessAt,
        guessed: true,
      },
    ])
  })

  it('times out deterministic misses and ignores duplicate or stale actions', () => {
    let initial = session('seed-1')
    for (let i = 2; initial.simulatedGuessAt !== null; i++) initial = session(`seed-${i}`)

    const stale = reducePractice(initial, { type: 'TICK', at: initial.turnStartedAt - 1 })
    expect(stale).toBe(initial)

    const review = reducePractice(initial, { type: 'TICK', at: initial.turnEndsAt + 1 })
    expect(review.results[0]?.guessed).toBe(false)
    expect(review.results[0]?.endedAt).toBe(initial.turnEndsAt)
    expect(reducePractice(review, { type: 'TICK', at: initial.turnEndsAt + 2 })).toBe(review)
  })

  it('advances through prompts and completes after the final review', () => {
    let state = session()
    state = reducePractice(state, { type: 'TICK', at: state.turnEndsAt })
    state = reducePractice(state, { type: 'NEXT_PROMPT', at: 70_000 })

    expect(state.turnIndex).toBe(1)
    expect(currentPracticePrompt(state)).toEqual(prompts[1])
    expect(practiceTimeLeftMs(state, 80_000)).toBe(50_000)

    state = reducePractice(state, { type: 'TICK', at: state.turnEndsAt })
    state = reducePractice(state, { type: 'NEXT_PROMPT', at: 140_000 })

    expect(state.phase).toBe('complete')
    expect(state.completedAt).toBe(140_000)
    expect(state.results).toHaveLength(2)
    expect(currentPracticePrompt(state)).toBeNull()
  })

  it('validates session inputs', () => {
    expect(() =>
      createPracticeSession({ seed: 'x', prompts: [], turnDurationMs: 60_000, startedAt: 0 }),
    ).toThrow('at least one prompt')
    expect(() =>
      createPracticeSession({
        seed: 'x',
        prompts: [{ word: '  ', category: 'general' }],
        turnDurationMs: 60_000,
        startedAt: 0,
      }),
    ).toThrow('cannot be blank')
  })
})
