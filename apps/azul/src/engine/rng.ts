/**
 * A small seeded generator, so a game can be replayed exactly from its seed.
 *
 * `Math.random` is fine for shuffling a bag nobody will ever check, but a
 * reproducible seed is what makes a failing playtest debuggable: the harness
 * prints the seed, and the seed brings the whole game back.
 */

export type Rng = () => number

/** Mulberry32 — 32 bits of state, good enough for a bag of tiles. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seed drawn from the platform's own entropy, for a fresh game. */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return Math.floor(Math.random() * 0xffffffff)
}

/** Fisher-Yates, in place. Returns the same array for convenience. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}
