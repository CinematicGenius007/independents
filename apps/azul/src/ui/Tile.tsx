/**
 * One tile, and the mark left where a tile will go.
 *
 * Printed, not lit: a flat square of ink with its motif drawn over it in white
 * line work, the way a chart prints a symbol. Every glaze has its own motif —
 * quatrefoil, compass star, lozenge, chevrons, waves — so the board reads
 * without relying on hue.
 *
 * An unfired wall space is the same motif in its own glaze, dotted and faint
 * inside a hairline square. It is the pounce of the old design kept honest:
 * the wall shows what belongs where before a single tile has landed.
 */

import type { CSSProperties } from 'react'
import type { Color } from '../engine/types'

export const GLAZES: Record<Color, string> = {
  cobalt: '#4472c0',
  saffron: '#d29b2c',
  crimson: '#c9493a',
  basalt: '#56647c',
  verdigris: '#3a9486',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Cobalt',
  saffron: 'Saffron',
  crimson: 'Crimson',
  basalt: 'Basalt',
  verdigris: 'Verdigris',
}

/** Motifs in a 24×24 box, stroked. */
function Motif({ color }: { color: Color }) {
  switch (color) {
    case 'cobalt':
      return (
        <>
          <circle cx="12" cy="8.6" r="3.3" />
          <circle cx="12" cy="15.4" r="3.3" />
          <circle cx="8.6" cy="12" r="3.3" />
          <circle cx="15.4" cy="12" r="3.3" />
        </>
      )
    case 'saffron':
      return <path d="M12 3.4 13.9 10.1 20.6 12 13.9 13.9 12 20.6 10.1 13.9 3.4 12 10.1 10.1Z" />
    case 'crimson':
      return (
        <>
          <path d="M12 3.8 19.4 12 12 20.2 4.6 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )
    case 'basalt':
      return (
        <>
          <path d="M5 9.4 12 5.2 19 9.4" />
          <path d="M5 14.3 12 10.1 19 14.3" />
          <path d="M5 19.2 12 15 19 19.2" />
        </>
      )
    case 'verdigris':
      return (
        <>
          <path d="M3.8 15.2c2.6 0 2.6-3.1 5.2-3.1s2.6 3.1 5.2 3.1 2.6-3.1 5.2-3.1" />
          <path d="M3.8 10c2.6 0 2.6-3.1 5.2-3.1s2.6 3.1 5.2 3.1 2.6-3.1 5.2-3.1" />
        </>
      )
  }
}

/** A square with Apple-style continuous corners, in a 24-unit box. */
const SQUIRCLE =
  'M5.2 0H18.8C22.6 0 24 1.4 24 5.2V18.8C24 22.6 22.6 24 18.8 24H5.2C1.4 24 0 22.6 0 18.8V5.2C0 1.4 1.4 0 5.2 0Z'

export interface TileProps {
  color: Color
  /** Draws the dotted, unfired mark instead of a tile. */
  pounce?: boolean
  /** Plays the landing once, for a tile that has just fired onto the wall. */
  fresh?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  /** Names this tile as a flight endpoint. */
  flight?: string
}

export function Tile({ color, pounce = false, fresh = false, className = '', style, title, flight }: TileProps) {
  const classes = ['tile', pounce ? 'tile--pounce' : 'tile--ink', fresh ? 'tile--fresh' : '', className]
    .filter(Boolean)
    .join(' ')
  const label = title ?? `${COLOR_NAMES[color]}${pounce ? ' space' : ' tile'}`

  if (pounce) {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
        <path d={SQUIRCLE} transform="translate(0.5 0.5) scale(0.9583)" fill="none" stroke="var(--rule-strong)" strokeWidth="1.04" />
        <g
          fill="none"
          stroke={GLAZES[color]}
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="1.4 1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Motif color={color} />
        </g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
      <path d={SQUIRCLE} fill={GLAZES[color]} />
      <g
        fill="none"
        stroke="#ffffff"
        strokeOpacity={color === 'basalt' ? 0.78 : 0.92}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Motif color={color} />
      </g>
    </svg>
  )
}

/** The starting-player marker: a signal-ink star in an open square. */
export function FirstMarker({ className = '', flight }: { className?: string; flight?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`tile tile--first ${className}`}
      data-flight={flight}
      role="img"
      aria-label="Starting player marker"
    >
      <path d={SQUIRCLE} transform="translate(0.5 0.5) scale(0.9583)" fill="none" stroke="var(--signal)" strokeWidth="1.04" />
      <path
        d="M12 5.5 13.6 10.4 18.5 12 13.6 13.6 12 18.5 10.4 13.6 5.5 12 10.4 10.4Z"
        fill="none"
        stroke="var(--signal)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  )
}
