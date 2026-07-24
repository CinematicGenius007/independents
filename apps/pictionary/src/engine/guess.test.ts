import { describe, expect, it } from 'vitest'
import { canGuess, classifyGuess, levenshtein } from './guess'
import type { GameState, TurnState } from './types'

function makeTurn(overrides: Partial<TurnState> = {}): TurnState {
  return {
    index: 0,
    round: 1,
    drawerId: 'drawer',
    word: null,
    wordShape: [3],
    category: 'general',
    startedAt: 0,
    endsAt: 80_000,
    revealed: {},
    correct: {},
    drawerPoints: 0,
    endReason: null,
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'drawing',
    roomId: 'room',
    selfId: 'guesser',
    hostId: 'drawer',
    gameNonce: 'nonce',
    config: {
      turnSeconds: 80,
      rounds: 3,
      categories: ['general'],
      customWordsOnly: false,
      customWords: [],
      hintsEnabled: true,
    },
    players: {},
    order: ['drawer', 'guesser'],
    scores: {},
    turn: makeTurn(),
    chat: [],
    lastGuessAt: {},
    nextTurnAt: null,
    ...overrides,
  }
}

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('cat', 'cat')).toBe(0)
  })

  it('counts a single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })

  it('counts a single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1)
  })

  it('counts a single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1)
  })

  it('handles totally different strings', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
  })

  it('respects a bound, returning something > maxDistance once exceeded', () => {
    const dist = levenshtein('completely', 'different', 2)
    expect(dist).toBeGreaterThan(2)
  })

  it('bounded and unbounded results agree when the true distance is within bound', () => {
    const unbounded = levenshtein('kitten', 'sitting')
    const bounded = levenshtein('kitten', 'sitting', 5)
    expect(bounded).toBe(unbounded)
  })
})

describe('classifyGuess', () => {
  it('is correct for an exact match', () => {
    expect(classifyGuess('elephant', 'elephant')).toBe('correct')
  })

  it('is correct ignoring case, accents, and punctuation', () => {
    expect(classifyGuess('  ÉLEPHANT!! ', 'elephant')).toBe('correct')
    expect(classifyGuess('Café', 'cafe')).toBe('correct')
  })

  it('is close for a small typo on a long-enough word', () => {
    expect(classifyGuess('elefant', 'elephant')).toBe('close')
  })

  it('is miss for a wildly wrong guess', () => {
    expect(classifyGuess('banana', 'elephant')).toBe('miss')
  })

  it('never returns close when the guess is actually correct', () => {
    // Distance is 0 for a true match; must short-circuit to 'correct'.
    expect(classifyGuess('cat', 'cat')).not.toBe('close')
    expect(classifyGuess('cat', 'cat')).toBe('correct')
  })

  it('applies the short-word guard: 3-letter word, 2 letters off is a miss, not close', () => {
    // "cat" vs "cop": c=c, a->o, t->p => distance 2, which is two-thirds of
    // a 3-letter word. That should not read as "so close!".
    expect(levenshtein('cat', 'cop')).toBe(2)
    expect(classifyGuess('cat', 'cop')).toBe('miss')
  })

  it('still allows close for a 1-letter-off short word when proportionally reasonable', () => {
    expect(levenshtein('cat', 'cot')).toBe(1)
    expect(classifyGuess('cat', 'cot')).toBe('close')
  })

  it('is miss for an empty guess', () => {
    expect(classifyGuess('', 'elephant')).toBe('miss')
    expect(classifyGuess('   ', 'elephant')).toBe('miss')
  })

  it('is close for a longer word within the distance threshold', () => {
    expect(classifyGuess('watermelan', 'watermelon')).toBe('close')
  })
})

describe('canGuess', () => {
  it('allows a normal guesser in the drawing phase', () => {
    const state = makeState()
    expect(canGuess(state, 'guesser', 10_000)).toBe(true)
  })

  it('disallows the drawer from guessing', () => {
    const state = makeState()
    expect(canGuess(state, 'drawer', 10_000)).toBe(false)
  })

  it('disallows a player who already solved this turn', () => {
    const state = makeState({
      turn: makeTurn({ correct: { guesser: { elapsedMs: 1000, points: 90, place: 1 } } }),
    })
    expect(canGuess(state, 'guesser', 10_000)).toBe(false)
  })

  it('disallows guessing outside the drawing phase', () => {
    const state = makeState({ phase: 'turn_review' })
    expect(canGuess(state, 'guesser', 10_000)).toBe(false)
  })

  it('disallows guessing when there is no active turn', () => {
    const state = makeState({ turn: null })
    expect(canGuess(state, 'guesser', 10_000)).toBe(false)
  })

  it('blocks a guess strictly inside the cooldown window', () => {
    const state = makeState({ lastGuessAt: { guesser: 1000 } })
    expect(canGuess(state, 'guesser', 1000 + 2999)).toBe(false)
  })

  it('allows a guess exactly at the cooldown boundary', () => {
    const state = makeState({ lastGuessAt: { guesser: 1000 } })
    expect(canGuess(state, 'guesser', 1000 + 3000)).toBe(true)
  })

  it('allows a guess just past the cooldown boundary', () => {
    const state = makeState({ lastGuessAt: { guesser: 1000 } })
    expect(canGuess(state, 'guesser', 1000 + 3001)).toBe(true)
  })
})
