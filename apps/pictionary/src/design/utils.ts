/**
 * Pixel-chrome helpers: hard bevels and ordered dithering.
 *
 * Nothing here is randomized or per-instance — pixel art is precise, not
 * hand-wobbled. `bevelClass` composes the CSS classes defined in
 * `theme.css` (`.pixel-bevel*`); `ditherStyle` builds a tiny tiled
 * checkerboard data URI for texture instead of a smooth gradient.
 */
import type { CSSProperties } from 'react'

export type BevelTone = 'chrome' | 'parchment' | 'gold' | 'red' | 'wood' | 'stone' | 'canvas' | 'moss'
export type BevelSize = 'sm' | 'md' | 'lg'

export interface BevelOptions {
  tone?: BevelTone
  size?: BevelSize
  /** Invert the bevel so the shape reads as physically pressed in. */
  pressed?: boolean
}

/**
 * Class list for the hard pixel-art outset border: light top+left, dark
 * bottom+right, 0 blur, 0 radius. A plain non-disabled `<button>` inverts
 * this automatically on `:active` (see theme.css); pass `pressed: true` for
 * a *toggled* selected state (e.g. the active drawing tool).
 */
export function bevelClass(options: BevelOptions = {}): string {
  const { tone = 'chrome', size = 'md', pressed = false } = options
  return [
    'pixel-bevel',
    size === 'sm' ? 'pixel-bevel-sm' : size === 'lg' ? 'pixel-bevel-lg' : '',
    `pixel-bevel-${tone}`,
    pressed ? 'pixel-bevel-pressed' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Tiny 2x2 ordered-dither checkerboard, tiled. No blur, no antialiasing. */
function ditherSvg(colorA: string, colorB: string, cell: number): string {
  const size = cell * 2
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' shape-rendering='crispEdges'>` +
    `<rect width='${size}' height='${size}' fill='${colorA}'/>` +
    `<rect width='${cell}' height='${cell}' fill='${colorB}'/>` +
    `<rect x='${cell}' y='${cell}' width='${cell}' height='${cell}' fill='${colorB}'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export interface DitherOptions {
  /** Base fill. Defaults to transparent so the element's own background shows through. */
  colorA?: string
  /** Dither speckle color. */
  colorB?: string
  /** Pixel size of one checker cell, in CSS px. */
  cell?: number
}

/** Inline style for a tiled ordered-dither texture layer (see `.pixel-dither` in theme.css). */
export function ditherStyle({ colorA = 'transparent', colorB, cell = 3 }: DitherOptions): CSSProperties {
  return {
    ['--dither-image' as string]: ditherSvg(colorA, colorB ?? colorA, cell),
    backgroundRepeat: 'repeat',
    imageRendering: 'pixelated',
  }
}

/**
 * Shared focus-visible treatment for every interactive element in the kit.
 * Solid, high-contrast gold, offset so it clears bevel borders cleanly. No
 * radius — the pixel kit has none.
 */
export const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]'
