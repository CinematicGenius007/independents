/**
 * Deterministic "hand-drawn" helpers.
 *
 * Everything that looks imperfect in this kit (rotation, corner choice, torn
 * edges) is derived from a stable hash of a string key — never
 * `Math.random()` — so it never jitters between renders but still varies
 * from instance to instance.
 */

/** FNV-1a, good enough distribution for tiny cosmetic jitter, not crypto. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic float in `[min, max)` derived from `key`. */
export function wobbleFromKey(key: string, min: number, max: number, salt = ''): number {
  const h = hashString(salt + key)
  const t = (h % 100000) / 100000
  return min + t * (max - min)
}

/** Deterministic pick from a list, stable per key. */
export function pickFromKey<T>(key: string, options: readonly T[], salt = ''): T {
  const h = hashString(salt + key)
  return options[h % options.length]
}

/** The two hand-drawn corner radius tokens, alternated per instance. */
export const DOODLE_RADII = ['var(--radius-doodle)', 'var(--radius-doodle-alt)'] as const

export function doodleRadius(key: string): string {
  return pickFromKey(key, DOODLE_RADII, 'radius')
}

/** Small per-instance rotation, degrees, within +/-0.4deg. */
export function doodleRotation(key: string, magnitude = 0.4): number {
  return wobbleFromKey(key, -magnitude, magnitude, 'rot')
}

/**
 * A jagged "torn paper" clip-path polygon for the bottom edge of a card.
 * Deterministic per `key` + `width`/`height` (percent-based, resolution
 * independent).
 */
export function tornBottomClipPath(key: string, teeth = 9): string {
  // Perimeter must be traced without crossing itself: across the top
  // left-to-right, then back across the jagged bottom right-to-left.
  const points: string[] = ['0% 0%', '100% 0%']
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100
    const jitter = wobbleFromKey(`${key}-${i}`, 0, 1, 'torn')
    const y = 100 - jitter * 10 - (i % 2 === 0 ? 0 : 5)
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`)
  }
  return `polygon(${points.join(', ')})`
}

/** Stable id-ish string for components that receive no natural label. */
export function fallbackKey(prefix: string, reactId: string): string {
  return `${prefix}:${reactId}`
}

/**
 * Shared focus-visible treatment for every interactive element in the kit.
 * Solid, high-contrast, never color-alone (also offset so it clears ink
 * borders/shadows cleanly).
 */
export const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] focus-visible:rounded-[2px]'

