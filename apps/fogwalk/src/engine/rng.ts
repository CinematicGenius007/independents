export interface Rng {
  next(): number
  int(maxExclusive: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
}

/** mulberry32: small, fast, and good enough for level layout. */
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
  }
}

/** Turn a human-typed seed such as `MIST-7` into a stable 32-bit number. */
export function hashSeed(text: string): number {
  let hash = 2166136261
  const normalized = text.trim().toUpperCase()
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const SEED_WORDS = [
  'MIST',
  'HAZE',
  'DRIFT',
  'VEIL',
  'SMOKE',
  'CLOUD',
  'DUSK',
  'GLIM',
  'MURK',
  'PALE',
  'SHROUD',
  'WISP',
]

/** A pronounceable seed, so a good board is easy to pass to somebody else. */
export function randomSeedText(): string {
  const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]
  const number = Math.floor(Math.random() * 900) + 100
  return `${word}-${number}`
}
