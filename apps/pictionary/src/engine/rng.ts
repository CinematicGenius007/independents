/**
 * Deterministic randomness primitives.
 *
 * Every peer must derive identical sequences from identical seeds, so these
 * functions rely only on 32-bit integer arithmetic (`Math.imul`) and a single
 * final floating-point division — both are IEEE754-deterministic across JS
 * engines and platforms. No `Math.random()` anywhere in this module.
 */

/**
 * FNV-1a 32-bit string hash. Deterministic, fast, good-enough distribution
 * for seeding a PRNG (not cryptographic).
 */
export function hashString(s: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Mulberry32 PRNG. Given the same 32-bit seed, produces the same infinite
 * sequence of floats in `[0, 1)` on every platform.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function rand(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Non-mutating Fisher–Yates shuffle. Deterministic given a deterministic
 * `rand` (e.g. from {@link mulberry32}).
 */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}
