export interface Rng {
  next(): number
  int(maxExclusive: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

/** mulberry32: small, fast, and good enough for a redaction map. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
}

/** FNV-1a, so a typed seed and a derived seed land in the same space. */
export function hashSeed(text: string): number {
  let hash = 2166136261
  const normalized = text.trim().toUpperCase()
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const SEED_WORDS = ['ASH', 'VEIL', 'MORA', 'THISTLE', 'QUILL', 'BRAM', 'ONDINE', 'SLATE']

/** A pronounceable seed, because a case worth sharing deserves a name. */
export function randomSeedText(): string {
  const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]
  return `${word}-${Math.floor(Math.random() * 900) + 100}`
}

/** The four-character tag printed on a sheet, so two cases never look alike. */
export function seedTag(seed: string): string {
  return hashSeed(seed).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}
