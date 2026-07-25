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

/** Lighten (`amount` > 0) or darken (`amount` < 0) a `#rrggbb` hex color toward white/black. */
function shade(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return hex
  const value = match[1]
  const target = amount >= 0 ? 255 : 0
  const channel = (offset: number) => {
    const c = parseInt(value.slice(offset, offset + 2), 16)
    return Math.round(c + (target - c) * Math.abs(amount))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

type Point = [number, number]

/** One filled 1x1 grid cell per point — the unit of every pixel-art face. */
function Pixels({ points, opacity }: { points: Point[]; opacity?: number }) {
  return (
    <>
      {points.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" opacity={opacity} />
      ))}
    </>
  )
}

/**
 * Face features for each of the 8 pixel-art avatars, on a 16x16 grid. Every
 * one draws on top of the same tinted stepped-square head so the set reads
 * as a family, but each is unambiguously distinct at a glance.
 */
const FACES: Array<() => ReactElement> = [
  // 0 — square dot eyes, wide grin
  () => (
    <>
      <Pixels points={[[5, 6], [10, 6]]} />
      <Pixels
        points={[
          [5, 10],
          [6, 11], [7, 11], [8, 11], [9, 11],
          [10, 10],
        ]}
      />
    </>
  ),
  // 1 — dizzy X eyes, flat mouth
  () => (
    <>
      <Pixels points={[[4, 5], [5, 6], [5, 5], [4, 6]]} />
      <Pixels points={[[10, 5], [9, 6], [9, 5], [10, 6]]} />
      <Pixels points={[[6, 11], [7, 11], [8, 11], [9, 11]]} />
    </>
  ),
  // 2 — wink + smirk
  () => (
    <>
      <Pixels points={[[4, 6], [5, 6]]} />
      <Pixels points={[[10, 6]]} />
      <Pixels points={[[6, 11], [7, 11], [8, 10], [9, 10]]} />
    </>
  ),
  // 3 — pixel glasses, small smile
  () => (
    <>
      <Pixels points={[[4, 5], [5, 5], [6, 5], [4, 6], [6, 6], [4, 7], [5, 7], [6, 7]]} />
      <Pixels points={[[9, 5], [10, 5], [11, 5], [9, 6], [11, 6], [9, 7], [10, 7], [11, 7]]} />
      <Pixels points={[[7, 6], [8, 6]]} />
      <Pixels points={[[6, 11], [7, 11], [8, 11], [9, 11]]} />
    </>
  ),
  // 4 — mustache, neutral dot eyes
  () => (
    <>
      <Pixels points={[[5, 6], [10, 6]]} />
      <Pixels
        points={[
          [5, 10], [6, 10], [9, 10], [10, 10],
          [6, 11], [7, 11], [8, 11], [9, 11],
        ]}
      />
    </>
  ),
  // 5 — freckles, big open grin
  () => (
    <>
      <Pixels points={[[5, 6], [10, 6]]} />
      <Pixels points={[[4, 8], [6, 8], [9, 8], [11, 8]]} opacity={0.55} />
      <Pixels
        points={[
          [5, 10],
          [6, 11], [7, 11], [8, 11], [9, 11],
          [10, 10],
        ]}
      />
    </>
  ),
  // 6 — spiky hair, determined brows
  () => (
    <>
      <Pixels points={[[3, 2], [4, 1], [5, 3], [6, 1], [7, 3], [8, 1], [9, 3], [10, 1], [11, 2]]} />
      <Pixels points={[[4, 5], [5, 5], [10, 5], [9, 5]]} />
      <Pixels points={[[5, 7], [10, 7]]} />
      <Pixels points={[[6, 11], [7, 11], [8, 11], [9, 11]]} />
    </>
  ),
  // 7 — cat ears, whiskers
  () => (
    <>
      <Pixels points={[[3, 1], [3, 2], [4, 2]]} />
      <Pixels points={[[12, 1], [12, 2], [11, 2]]} />
      <Pixels points={[[5, 6], [10, 6]]} />
      <Pixels points={[[7, 9], [8, 9]]} />
      <Pixels points={[[1, 7], [2, 7], [1, 9], [2, 9]]} />
      <Pixels points={[[13, 7], [14, 7], [13, 9], [14, 9]]} />
      <Pixels points={[[6, 11], [9, 11]]} />
    </>
  ),
]

export interface AvatarProps {
  /** Index into the pixel-avatar sprite set, matching {@link PlayerProfile.avatar}. Wraps modulo 8. */
  avatar: number
  /** Hex color, typically one of `AVATAR_COLORS`. */
  color: string
  size?: number
  className?: string
  /** Accessible label; pass the player's nickname where known. Purely decorative if omitted. */
  label?: string
}

/**
 * Inline SVG pixel sprite. 8 distinct designs (index 0-7, wraps), tinted
 * with the player's color, drawn on a fixed 16x16 grid with crisp edges and
 * its own hard bevel frame. No external assets.
 */
export function Avatar({ avatar, color, size = 40, className = '', label }: AvatarProps) {
  const index = ((avatar % FACES.length) + FACES.length) % FACES.length
  const Face = FACES[index]
  // Facial features draw in `currentColor`. Most avatar tints are light/mid,
  // so ink reads fine — but a very dark swatch needs canvas-bright features
  // or the whole face disappears into the fill.
  const featureColor = relativeLuminance(color) < 0.32 ? 'var(--color-canvas-hi)' : 'var(--color-ink)'
  const hi = shade(color, 0.4)
  const lo = shade(color, -0.5)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* stepped-corner pixel head silhouette */}
      <rect x={1} y={2} width={14} height={12} fill={color} />
      <rect x={2} y={1} width={12} height={14} fill={color} />
      {/* hard bevel: light top+left, dark bottom+right */}
      <rect x={2} y={1} width={12} height={1} fill={hi} />
      <rect x={1} y={2} width={1} height={12} fill={hi} />
      <rect x={2} y={14} width={12} height={1} fill={lo} />
      <rect x={14} y={2} width={1} height={12} fill={lo} />
      <g style={{ color: featureColor }}>
        <Face />
      </g>
    </svg>
  )
}
