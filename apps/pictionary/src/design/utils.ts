/**
 * Shared helpers for the sketch kit.
 *
 * The kit used to derive a per-instance rotation, an alternating corner
 * radius and a jagged "torn paper" clip-path from a hash of each component's
 * key. That read as skewed and misshapen rather than hand-drawn, so the
 * geometry is now strictly square: the hand-drawn quality comes from the ink
 * border, the hard offset shadow, the paper grain and the display face —
 * none of which need the boxes to be crooked.
 */

/** FNV-1a, good enough distribution for tiny cosmetic derivations, not crypto. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic pick from a list, stable per key. */
export function pickFromKey<T>(key: string, options: readonly T[], salt = ''): T {
  const h = hashString(salt + key)
  return options[h % options.length]
}

/**
 * Shared focus-visible treatment for every interactive element in the kit.
 * Solid, high-contrast, never color-alone (also offset so it clears ink
 * borders/shadows cleanly).
 */
export const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] focus-visible:rounded-[2px]'
