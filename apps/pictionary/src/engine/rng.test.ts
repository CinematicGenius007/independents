import { describe, expect, it } from 'vitest'
import { hashString, mulberry32, shuffle } from './rng'

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('room-42:nonce-abc')).toBe(hashString('room-42:nonce-abc'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('anything')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
  })

  it('produces different hashes for different inputs (spot check)', () => {
    const seen = new Set<number>()
    for (const s of ['a', 'b', 'ab', 'ba', 'room1', 'room2', 'nonce-1', 'nonce-2']) {
      seen.add(hashString(s))
    }
    expect(seen.size).toBe(8)
  })

  it('hashes the empty string without throwing', () => {
    expect(() => hashString('')).not.toThrow()
  })
})

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const seq1 = Array.from({ length: 10 }, mulberry32(12345))
    const seq2 = Array.from({ length: 10 }, mulberry32(12345))
    expect(seq1).toEqual(seq2)
  })

  it('produces values in [0, 1)', () => {
    const rand = mulberry32(999)
    for (let i = 0; i < 200; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).not.toEqual(seqB)
  })

  it('two independent instances with the same seed stay in lockstep', () => {
    const a = mulberry32(hashString('same-seed'))
    const b = mulberry32(hashString('same-seed'))
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b())
    }
  })
})

describe('shuffle', () => {
  it('is deterministic given a deterministic rand', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const r1 = shuffle(items, mulberry32(7))
    const r2 = shuffle(items, mulberry32(7))
    expect(r1).toEqual(r2)
  })

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5]
    const copy = items.slice()
    shuffle(items, mulberry32(42))
    expect(items).toEqual(copy)
  })

  it('returns a permutation (same multiset of elements)', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = shuffle(items, mulberry32(3))
    expect(result.slice().sort()).toEqual(items.slice().sort())
    expect(result.length).toBe(items.length)
  })

  it('actually reorders a large-enough array (not an identity no-op)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const result = shuffle(items, mulberry32(2024))
    expect(result).not.toEqual(items)
  })
})
