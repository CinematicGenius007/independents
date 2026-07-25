import type { ReactElement } from 'react'

/** WCAG relative luminance from a `#rrggbb` hex string. Falls back to "light" for anything else. */
function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return 1
  const value = match[1]
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const r = channel(parseInt(value.slice(0, 2), 16) / 255)
  const g = channel(parseInt(value.slice(2, 4), 16) / 255)
  const b = channel(parseInt(value.slice(4, 6), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Face features for each of the 8 doodle avatars. Every one draws on top of
 * the same tinted head circle so the set reads as a family, but each is
 * unambiguously distinct at a glance (different eyes, mouth, and one
 * "prop" — glasses, hair, ears, freckles...).
 */
const FACES: Array<() => ReactElement> = [
  // 0 — round eyes, open smile
  () => (
    <>
      <circle cx="24" cy="30" r="3.2" fill="currentColor" />
      <circle cx="40" cy="30" r="3.2" fill="currentColor" />
      <path d="M22 40 Q32 48 42 40" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // 1 — dizzy X eyes, flat mouth
  () => (
    <>
      <path d="M20 27 L27 33 M27 27 L20 33" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M37 27 L44 33 M44 27 L37 33" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M23 42 Q32 39 41 42" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // 2 — wink + smirk
  () => (
    <>
      <path d="M19 30 Q24 27 29 30" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <circle cx="40" cy="30" r="3.2" fill="currentColor" />
      <path d="M22 41 Q32 44 43 38" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // 3 — round glasses, small smile
  () => (
    <>
      <circle cx="23" cy="30" r="6.5" fill="none" stroke="currentColor" strokeWidth={2.6} />
      <circle cx="41" cy="30" r="6.5" fill="none" stroke="currentColor" strokeWidth={2.6} />
      <path d="M29.5 30 H34.5" stroke="currentColor" strokeWidth={2.6} />
      <path d="M16.5 28 L11 25" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M47.5 28 L53 25" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M25 42 Q32 46 39 42" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // 4 — mustache, neutral dot eyes
  () => (
    <>
      <circle cx="24" cy="29" r="2.6" fill="currentColor" />
      <circle cx="40" cy="29" r="2.6" fill="currentColor" />
      <path
        d="M18 40 Q22 36 26 40 Q29 37 32 40 Q35 37 38 40 Q42 36 46 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  ),
  // 5 — freckles, big open smile
  () => (
    <>
      <circle cx="24" cy="30" r="3" fill="currentColor" />
      <circle cx="40" cy="30" r="3" fill="currentColor" />
      <g fill="currentColor" opacity={0.55}>
        <circle cx="18" cy="36" r="1.1" />
        <circle cx="22" cy="39" r="1.1" />
        <circle cx="42" cy="39" r="1.1" />
        <circle cx="46" cy="36" r="1.1" />
      </g>
      <path d="M21 39 Q32 50 43 39" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <path d="M25 41.5 H39" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  // 6 — spiky hair, determined brows
  () => (
    <>
      <path
        d="M12 14 L17 4 L22 15 L27 3 L32 15 L37 3 L42 15 L47 4 L52 14"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M19 27 L28 29 M45 27 L36 29" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx="24" cy="32" r="2.6" fill="currentColor" />
      <circle cx="40" cy="32" r="2.6" fill="currentColor" />
      <path d="M24 42 H40" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  // 7 — cat ears, whiskers
  () => (
    <>
      <path d="M14 16 L22 4 L26 17 Z" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <path d="M50 16 L42 4 L38 17 Z" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <circle cx="24" cy="30" r="2.8" fill="currentColor" />
      <circle cx="40" cy="30" r="2.8" fill="currentColor" />
      <path d="M30 36 L34 36 L32 39 Z" fill="currentColor" />
      <path d="M8 34 H20 M8 39 H19 M44 34 H56 M45 39 H56" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M27 42 Q32 45 37 42" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
]

export interface AvatarProps {
  /** Index into the doodle-avatar sprite set, matching {@link PlayerProfile.avatar}. Wraps modulo 8. */
  avatar: number
  /** Hex color, typically one of `AVATAR_COLORS`. */
  color: string
  size?: number
  className?: string
  /** Accessible label; pass the player's nickname where known. Purely decorative if omitted. */
  label?: string
}

/**
 * Inline SVG doodle face. 8 distinct hand-drawn designs (index 0-7, wraps),
 * tinted with the player's color. No external assets.
 */
export function Avatar({ avatar, color, size = 40, className = '', label }: AvatarProps) {
  const index = ((avatar % FACES.length) + FACES.length) % FACES.length
  const Face = FACES[index]
  // Facial features draw in `currentColor`. Most avatar tints are light/mid,
  // so ink reads fine — but the ink-black swatch needs paper-white features
  // or the whole face disappears into the fill.
  const featureColor = relativeLuminance(color) < 0.32 ? 'var(--color-paper-white)' : 'var(--color-ink)'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="32" cy="34" r="24" fill={color} stroke="var(--color-ink)" strokeWidth={3} />
      <g fill={color} style={{ color: featureColor }}>
        <Face />
      </g>
    </svg>
  )
}
