/**
 * One tile, and the space printed on the board where a tile will go.
 *
 * The tiles speak the Astral design language from the Paper glaze key: five
 * flat glaze grounds, each carrying its own light line-drawn sign — orbit
 * rings, compass star, rose diamond, chevrons, waves — built on one shared
 * grid in {@link glazeMotif}. An empty wall space is the same sign dotted,
 * so the wall says what belongs where before a single tile has landed.
 *
 * Gradients stay out of the way: there are none. Tiles are flat ink with a
 * soft contact shadow (in CSS) and one faint lit rim. {@link TileDefs} is
 * still mounted at the root for anything else that needs the shared defs.
 */

import type { CSSProperties } from 'react'
import type { Color } from '../engine/types'
import { glazeMotif, markerDial, type GlazeKind } from './tileGeometry'

/**
 * The glaze grounds. These match the `--glaze-*` tokens in styles.css —
 * flat mid-tone inks, so the near-white line work reads on every one.
 */
export const GLAZES: Record<Color, string> = {
  cobalt: '#4472c0',
  saffron: '#d29b2c',
  crimson: '#c9493a',
  basalt: '#56647c',
  verdigris: '#3a9486',
}

/** Brighter stand-ins for text and counters, where the tile colour itself would vanish on the dark page. */
export const GLAZE_TEXT: Record<Color, string> = {
  cobalt: '#7ba5ea',
  saffron: '#e8b84b',
  crimson: '#ec7a6b',
  basalt: '#8a9ab0',
  verdigris: '#6fc2b4',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Blue',
  saffron: 'Yellow',
  crimson: 'Red',
  basalt: 'Black',
  verdigris: 'Turquoise',
}

/** The near-white ink every sign is drawn in. */
const MOTIF_INK = '#f5f7ff'

/** A square with Apple-style continuous corners, in a 24-unit box. */
const SQUIRCLE =
  'M5.2 0H18.8C22.6 0 24 1.4 24 5.2V18.8C24 22.6 22.6 24 18.8 24H5.2C1.4 24 0 22.6 0 18.8V5.2C0 1.4 1.4 0 5.2 0Z'

/**
 * Shared definitions for every tile on the page. Mount once; it draws nothing.
 */
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="azt-face" clipPathUnits="userSpaceOnUse">
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
    </svg>
  )
}

export interface MotifProps {
  color: Color
  /** Dots the sign instead of drawing it solid: an empty wall space. */
  dotted?: boolean
}

/** One glaze's sign, solid or dotted. See {@link glazeMotif} for the geometry. */
export function Motif({ color, dotted = false }: MotifProps) {
  const motif = glazeMotif(color as GlazeKind)
  const ink = dotted ? GLAZES[color] : MOTIF_INK
  const dash = dotted ? { strokeDasharray: '1.2 2.2' } : {}
  return (
    <g
      fill="none"
      stroke={ink}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={dotted ? 0.62 : 1}
    >
      {motif.main.map((d, i) => (
        <path key={i} d={d} strokeWidth={dotted ? 1.3 : 1.15} strokeOpacity={dotted ? 1 : 0.92} {...dash} />
      ))}
      {motif.hair.map((d, i) => (
        <path key={`h${i}`} d={d} strokeWidth={0.55} strokeOpacity={dotted ? 1 : 0.6} {...dash} />
      ))}
      <g fill={ink} stroke="none" opacity={dotted ? 1 : 0.92}>
        {motif.dots.map((dot, i) => (
          <circle key={`d${i}`} cx={dot.x} cy={dot.y} r={dot.r} />
        ))}
      </g>
    </g>
  )
}

export interface TileProps {
  color: Color
  /** Draws the printed board space instead of a tile. */
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
    // The board's print: the sign dotted in its own glaze, inside a hairline
    // recessed square. Flat, matte, unmistakably unfired.
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
        <g className="tile__print">
          <path d={SQUIRCLE} fill="none" stroke="#5d5b7d" strokeWidth="0.7" />
          <Motif color={color} dotted />
        </g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
      {/* the flat glaze ground */}
      <path d={SQUIRCLE} fill={GLAZES[color]} />
      <Motif color={color} />
      {/* a faint lit rim along the top and left, for touch */}
      <path
        d="M1.9 18.3V5.6C1.9 3.1 3.1 1.7 5.6 1.7H18.2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

const DIAL = markerDial()

/**
 * The starting-player tile: an observatory plate — dark ink ground, hairline
 * instrument ring with ticks at the cardinals, and a white "1", the number of
 * the player who goes first next round.
 */
export function FirstMarker({ className = '', flight }: { className?: string; flight?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`tile tile--first ${className}`}
      data-flight={flight}
      role="img"
      aria-label="Starting player marker"
    >
      <path d={SQUIRCLE} fill="#161824" />
      <g fill="none" stroke="#8b89b0" strokeLinecap="round">
        {DIAL.rings.map((d, i) => (
          <path key={i} d={d} strokeWidth="0.55" strokeOpacity="0.8" />
        ))}
        {DIAL.ticks.map((d, i) => (
          <path key={`t${i}`} d={d} strokeWidth="0.55" strokeOpacity="0.8" />
        ))}
      </g>
      <text
        x="12"
        y="17.4"
        textAnchor="middle"
        fontSize="13.5"
        fontWeight="300"
        fontFamily="'Saira Condensed','Arial Narrow',sans-serif"
        fill="#ffffff"
      >
        1
      </text>
      <path
        d="M1.9 18.3V5.6C1.9 3.1 3.1 1.7 5.6 1.7H18.2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
