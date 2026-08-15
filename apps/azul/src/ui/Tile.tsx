/**
 * One glazed tile, and the pounce mark left where a tile will go.
 *
 * Every colour carries its own painted motif. That is not decoration: it is
 * what makes the wall readable at a glance and what makes the game playable
 * without relying on hue, which about one man in twelve cannot be asked to do.
 *
 * The motifs are drawn as line work over a flat glaze, in the vocabulary of
 * the tiles the game is named for — a quatrefoil, a compass star, a pomegranate
 * lozenge, a chevron, a scallop.
 */

import type { CSSProperties } from 'react'
import type { Color } from '../engine/types'

export const GLAZES: Record<Color, string> = {
  cobalt: '#2b4fa8',
  saffron: '#d59a1c',
  crimson: '#ac3b39',
  basalt: '#202834',
  verdigris: '#3d8c83',
}

/** The line colour painted over each glaze. Basalt is the one that inverts. */
const LINEWORK: Record<Color, string> = {
  cobalt: '#c9d8ff',
  saffron: '#5c3d05',
  crimson: '#f4d3ce',
  basalt: '#8fa2bd',
  verdigris: '#dff0eb',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Cobalt',
  saffron: 'Saffron',
  crimson: 'Crimson',
  basalt: 'Basalt',
  verdigris: 'Verdigris',
}

/** Motif paths, drawn in a 24×24 box. */
function Motif({ color, stroke }: { color: Color; stroke: string }) {
  const common = {
    fill: 'none',
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (color) {
    case 'cobalt':
      // Quatrefoil: four petals meeting at the centre.
      return (
        <g {...common}>
          <path d="M12 5c2.2 0 3.6 1.5 3.6 3.5S13.9 12 12 12s-3.6-1.5-3.6-3.5S9.8 5 12 5Z" />
          <path d="M12 19c-2.2 0-3.6-1.5-3.6-3.5S10.1 12 12 12s3.6 1.5 3.6 3.5S14.2 19 12 19Z" />
          <path d="M5 12c0-2.2 1.5-3.6 3.5-3.6S12 10.1 12 12s-1.5 3.6-3.5 3.6S5 14.2 5 12Z" />
          <path d="M19 12c0 2.2-1.5 3.6-3.5 3.6S12 13.9 12 12s1.5-3.6 3.5-3.6S19 9.8 19 12Z" />
        </g>
      )
    case 'saffron':
      // Compass star.
      return (
        <g {...common}>
          <path d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5L3.5 12l6.5-2 2-6.5Z" />
        </g>
      )
    case 'crimson':
      // Pomegranate lozenge.
      return (
        <g {...common}>
          <path d="M12 4 19 12l-7 8-7-8 7-8Z" />
          <circle cx="12" cy="12" r="2.6" />
        </g>
      )
    case 'basalt':
      // Chevrons, the mason's mark.
      return (
        <g {...common}>
          <path d="M5 9.5 12 5l7 4.5" />
          <path d="M5 14.5 12 10l7 4.5" />
          <path d="M5 19 12 14.5 19 19" />
        </g>
      )
    case 'verdigris':
      // Scalloped wave.
      return (
        <g {...common}>
          <path d="M4 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3" />
          <path d="M4 10c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3" />
        </g>
      )
  }
}

export interface TileProps {
  color: Color
  /** Draws the pricked stencil outline instead of a fired tile. */
  pounce?: boolean
  /** Plays the kiln flash once, for a tile that has just landed. */
  fresh?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}

export function Tile({ color, pounce = false, fresh = false, className = '', style, title }: TileProps) {
  // A pounce mark is charcoal on whatever it is dusted onto, so it takes its
  // colour from the surface: dark on a tin panel, pale on the glazed ground.
  const stroke = pounce ? 'currentColor' : LINEWORK[color]
  return (
    <svg
      viewBox="0 0 24 24"
      className={[
        'tile',
        pounce ? 'tile--pounce' : 'tile--glazed',
        fresh ? 'tile--fresh' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role="img"
      aria-label={title ?? `${COLOR_NAMES[color]}${pounce ? ' space' : ' tile'}`}
    >
      {pounce ? (
        <rect
          x="0.75"
          y="0.75"
          width="22.5"
          height="22.5"
          rx="1"
          fill="currentColor"
          fillOpacity="0.07"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="0.9"
        />
      ) : (
        <rect x="0" y="0" width="24" height="24" rx="1.5" fill={GLAZES[color]} />
      )}
      <g opacity={pounce ? 0.75 : 1}>
        {pounce ? (
          <PounceMotif color={color} stroke={stroke} />
        ) : (
          <Motif color={color} stroke={stroke} />
        )}
      </g>
    </svg>
  )
}

/** The same motif, pricked through paper: dotted, and a little shy. */
function PounceMotif({ color, stroke }: { color: Color; stroke: string }) {
  return (
    <g strokeDasharray="0.8 2.4" strokeOpacity="0.9">
      <Motif color={color} stroke={stroke} />
    </g>
  )
}

/** The starting-player marker: not a glaze, a gilded blank. */
export function FirstMarker({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`tile tile--first ${className}`}
      role="img"
      aria-label="Starting player marker"
    >
      <rect x="0" y="0" width="24" height="24" rx="1.5" fill="#f4f0e2" />
      <path
        d="M12 5.5 13.8 10h4.7l-3.8 2.9 1.5 4.6L12 14.7 7.8 17.5l1.5-4.6L5.5 10h4.7L12 5.5Z"
        fill="none"
        stroke="#c9a227"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
