import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../../shared/types'
import { MIN_SEED_WORDS } from '../types'
import wordsData from './words.json'

interface SeedWord {
  word: string
  category: string
  difficulty: number
}

const words = wordsData as SeedWord[]

describe('seed word library', () => {
  it('has at least MIN_SEED_WORDS entries, with headroom', () => {
    expect(words.length).toBeGreaterThanOrEqual(MIN_SEED_WORDS)
    // Headroom over the contract minimum, per the P2 brief (>= 520).
    expect(words.length).toBeGreaterThanOrEqual(520)
  })

  it('has zero duplicate words across the whole file', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const entry of words) {
      const key = entry.word.trim().toLowerCase()
      if (seen.has(key)) {
        duplicates.push(entry.word)
      } else {
        seen.set(key, entry.category)
      }
    }
    expect(duplicates).toEqual([])
  })

  it('every entry uses a known category and a 1-3 difficulty rating', () => {
    for (const entry of words) {
      expect(CATEGORIES).toContain(entry.category)
      expect(entry.difficulty).toBeGreaterThanOrEqual(1)
      expect(entry.difficulty).toBeLessThanOrEqual(3)
      expect(Number.isInteger(entry.difficulty)).toBe(true)
      expect(entry.word.trim().length).toBeGreaterThan(0)
    }
  })

  it('every category is non-empty', () => {
    const counts = new Map<string, number>()
    for (const entry of words) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1)
    }
    for (const category of CATEGORIES) {
      expect(counts.get(category) ?? 0).toBeGreaterThan(0)
    }
  })

  it('no entry is blank or only whitespace after trimming', () => {
    for (const entry of words) {
      expect(entry.word).toBe(entry.word.trim())
    }
  })
})
