import { describe, expect, it } from 'vitest'
import { hintIndices, hintReveals, normalize, pickWords, wordShape } from './words'

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('ICE CREAM')).toBe('ice cream')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalize('  ice cream  ')).toBe('ice cream')
  })

  it('collapses internal whitespace', () => {
    expect(normalize('ice     cream')).toBe('ice cream')
  })

  it('strips punctuation', () => {
    expect(normalize("Ice-Cream!")).toBe('ice cream')
  })

  it('strips diacritics', () => {
    expect(normalize('Café')).toBe('cafe')
  })

  it('treats case, accents, and punctuation as equal for matching', () => {
    expect(normalize('  Café!! ')).toBe(normalize('cafe'))
  })

  it('handles the empty string', () => {
    expect(normalize('')).toBe('')
  })
})

describe('wordShape', () => {
  it('returns token lengths for a multi-word phrase', () => {
    expect(wordShape('ice cream')).toEqual([3, 5])
  })

  it('returns a single-element array for a single word', () => {
    expect(wordShape('elephant')).toEqual([8])
  })

  it('ignores extraneous whitespace between tokens', () => {
    expect(wordShape('ice   cream sandwich')).toEqual([3, 5, 8])
  })
})

describe('pickWords', () => {
  const pool = Array.from({ length: 20 }, (_, i) => `word${i}`)

  it('is deterministic for a fixed pool and nonce', () => {
    expect(pickWords(pool, 10, 'nonce-a')).toEqual(pickWords(pool, 10, 'nonce-a'))
  })

  it('does not repeat within a single pass over the pool', () => {
    const picks = pickWords(pool, pool.length, 'nonce-b')
    expect(new Set(picks).size).toBe(pool.length)
  })

  it('returns exactly `count` words when count <= pool size', () => {
    const picks = pickWords(pool, 7, 'nonce-c')
    expect(picks.length).toBe(7)
    for (const w of picks) expect(pool).toContain(w)
  })

  it('can pick more words than the pool has by relapping deterministically', () => {
    const smallPool = ['alpha', 'beta', 'gamma']
    const picks = pickWords(smallPool, 8, 'nonce-d')
    expect(picks.length).toBe(8)
    for (const w of picks) expect(smallPool).toContain(w)
  })

  it('produces a different sequence for a different nonce (spot check)', () => {
    expect(pickWords(pool, 10, 'nonce-e')).not.toEqual(pickWords(pool, 10, 'nonce-f'))
  })

  it('returns an empty array for an empty pool', () => {
    expect(pickWords([], 5, 'nonce')).toEqual([])
  })

  it('returns an empty array for a zero count', () => {
    expect(pickWords(pool, 0, 'nonce')).toEqual([])
  })
})

describe('hintIndices', () => {
  it('is deterministic for the same inputs', () => {
    const a = hintIndices('ice cream', 3, 'nonce', 0)
    const b = hintIndices('ice cream', 3, 'nonce', 0)
    expect(a).toEqual(b)
  })

  it('never reveals a space index', () => {
    const word = 'ice cream sandwich'
    const spaceIndices = new Set<number>()
    for (let i = 0; i < word.length; i++) if (word[i] === ' ') spaceIndices.add(i)

    for (let revealCount = 1; revealCount <= word.replace(/ /g, '').length; revealCount++) {
      const indices = hintIndices(word, revealCount, 'nonce', 1)
      for (const idx of indices) expect(spaceIndices.has(idx)).toBe(false)
    }
  })

  it('stops at the number of non-space characters (clamps revealCount)', () => {
    const word = 'cat'
    const indices = hintIndices(word, 999, 'nonce', 2)
    expect(indices.length).toBe(3)
    expect(indices.slice().sort((x, y) => x - y)).toEqual([0, 1, 2])
  })

  it('returns indices sorted ascending', () => {
    const indices = hintIndices('elephant', 5, 'nonce', 3)
    const sorted = indices.slice().sort((a, b) => a - b)
    expect(indices).toEqual(sorted)
  })

  it('grows as a prefix as revealCount increases (stable early reveals)', () => {
    const word = 'watermelon'
    const small = hintIndices(word, 2, 'nonce', 4)
    const big = hintIndices(word, 5, 'nonce', 4)
    for (const idx of small) expect(big).toContain(idx)
  })

  it('is not simply the first N positions (spread across the word, not front-clustered)', () => {
    // Across a spread of seeds, at least some reveal sets for revealCount=2
    // on a long word should NOT be the naive front-clustered {0, 1}.
    const word = 'watermelons'
    let sawNonFrontCluster = false
    for (let turnIndex = 0; turnIndex < 30; turnIndex++) {
      const indices = hintIndices(word, 2, `seed-${turnIndex}`, turnIndex)
      if (JSON.stringify(indices) !== JSON.stringify([0, 1])) {
        sawNonFrontCluster = true
        break
      }
    }
    expect(sawNonFrontCluster).toBe(true)
  })

  it('returns an empty array for revealCount 0', () => {
    expect(hintIndices('cat', 0, 'nonce', 0)).toEqual([])
  })
})

describe('hintReveals', () => {
  it('maps each hinted index to its actual character', () => {
    const word = 'ice cream'
    const reveals = hintReveals(word, 3, 'nonce', 0)
    for (const [key, char] of Object.entries(reveals)) {
      expect(word[Number(key)]).toBe(char)
    }
    expect(Object.keys(reveals).length).toBe(3)
  })

  it('is deterministic for the same inputs', () => {
    expect(hintReveals('elephant', 4, 'nonce', 2)).toEqual(hintReveals('elephant', 4, 'nonce', 2))
  })

  it('never reveals a space character', () => {
    const reveals = hintReveals('ice cream sandwich', 15, 'nonce', 5)
    expect(Object.values(reveals)).not.toContain(' ')
  })

  it('agrees with hintIndices on which positions are chosen', () => {
    const word = 'watermelon'
    const indices = hintIndices(word, 4, 'nonce', 1)
    const reveals = hintReveals(word, 4, 'nonce', 1)
    expect(Object.keys(reveals).map(Number).sort((a, b) => a - b)).toEqual(indices)
  })

  it('returns an empty object for revealCount 0', () => {
    expect(hintReveals('cat', 0, 'nonce', 0)).toEqual({})
  })
})
