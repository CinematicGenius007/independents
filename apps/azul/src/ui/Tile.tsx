/**
 * One tile, and the space printed on the board where a tile will go.
 *
 * The five tiles are drawn after the real set, from scratch, as flat vector:
 *
 * - blue — plain, glossy royal blue;
 * - yellow — warm gold with a red damask: on each axis a pair of facing
 *   curls hooking either side of a diamond finial, eyes out towards the
 *   diagonals, slim tails running back to the centre, ragged serrated
 *   flames into the corners, and a four-pointed star at the heart;
 * - red — plain, glossy red;
 * - black — near-black with a teal lattice set on the diagonal: dotted
 *   rosettes at the middle of each side, laced together by pairs of slim
 *   arcs, thin bars running corner to corner through the centre with
 *   arrow heads pointing in, and moths of wedges and diamonds at the corners;
 * - turquoise — a white field inside a turquoise border, bearing a turquoise
 *   eight-pointed star of separate rhombi.
 *
 * Every tile is a thick piece of resin: a darker side shows below and to the
 * right of the face, and the face carries a soft sheen from the top left.
 *
 * An empty wall space is the same face printed flat and faded, the way the
 * board itself is printed — so the wall says what belongs where before a
 * single tile has landed, and it says it in the tile's own design.
 *
 * Gradients and the face clip live once in {@link TileDefs}, mounted at the
 * root, because a flying tile is a clone of the SVG it left and must still
 * find them after the original has gone.
 */

import type { CSSProperties } from 'react'
import type { Color } from '../engine/types'
import { chamferedSquare, damask, lattice, lemoyneStar } from './tileGeometry'

/** The face colour of each tile. */
export const GLAZES: Record<Color, string> = {
  cobalt: '#1e63b8',
  saffron: '#f4b30f',
  crimson: '#e42344',
  basalt: '#0a0d11',
  verdigris: '#40bcd2',
}

/** The side of each tile, seen below and right of the face. */
const EDGES: Record<Color, string> = {
  cobalt: '#12437c',
  saffron: '#c47f0f',
  crimson: '#991329',
  basalt: '#030509',
  verdigris: '#1f8599',
}

/** Brighter stand-ins for text and counters, where the tile colour itself would vanish on the dark page. */
export const GLAZE_TEXT: Record<Color, string> = {
  cobalt: '#5d9cf2',
  saffron: '#f6b62b',
  crimson: '#f0677a',
  basalt: '#8a9ab0',
  verdigris: '#6fd6e8',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Blue',
  saffron: 'Yellow',
  crimson: 'Red',
  basalt: 'Black',
  verdigris: 'Turquoise',
}

const DAMASK = '#ea3817'
const LATTICE = '#3ac2d6'
const STAR = '#f6fcfd'

/** A square with Apple-style continuous corners, in a 24-unit box. */
const SQUIRCLE =
  'M5.2 0H18.8C22.6 0 24 1.4 24 5.2V18.8C24 22.6 22.6 24 18.8 24H5.2C1.4 24 0 22.6 0 18.8V5.2C0 1.4 1.4 0 5.2 0Z'

/** The face sits up and to the left of the tile's footprint, so its side shows bottom-right. */
const FACE_TRANSFORM = 'translate(0.8 0.6) scale(0.905)'

/**
 * Shared definitions for every tile on the page. Mount once; it draws nothing.
 */
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="azt-face" clipPathUnits="userSpaceOnUse">
          <path d={SQUIRCLE} transform={FACE_TRANSFORM} />
        </clipPath>
        {/* Light from the top left, falling away across the face. */}
        <linearGradient id="azt-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
        {/* The bright spot where a lamp catches the resin. */}
        <radialGradient id="azt-spec" cx="0.3" cy="0.22" r="0.42">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* The tile's side: lighter where it meets the face, darker at the foot. */}
        <linearGradient id="azt-side" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const DAMASK_PATHS = damask()

/** The yellow tile's red-orange damask; see {@link damask} for its construction. */
function Damask() {
  return (
    <g fill={DAMASK}>
      {DAMASK_PATHS.fills.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  )
}

const LATTICE_PATHS = lattice()

/** The black tile's teal lattice; see {@link lattice} for its construction. */
function Lattice() {
  // The lattice is built square to the axes and laid on the tile turned 45°:
  // rosettes at the middle of each side, fleurs at the corners and centre.
  return (
    <g transform="rotate(45 12 12)">
      <g fill={LATTICE}>
        {LATTICE_PATHS.fills.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={GLAZES.basalt}>
        {LATTICE_PATHS.holes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  )
}

const STAR_FIELD = chamferedSquare(10.1, 2.7)
const STAR_RHOMBI = lemoyneStar(9.9, 0.3)

/**
 * The turquoise tile: a thin turquoise border round a white field with its
 * corners cut, and on it a turquoise eight-pointed star of separate rhombi.
 */
function Star({ print = false }: { print?: boolean }) {
  return (
    <g>
      {/* the board prints this space plain white, without the tile's border */}
      <path d={print ? SQUIRCLE : STAR_FIELD} fill={STAR} />
      <g fill={GLAZES.verdigris}>
        {STAR_RHOMBI.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  )
}

/** The face: the tile's colour and, for three of the five, its painted pattern. */
function Face({ color, print = false }: { color: Color; print?: boolean }) {
  return (
    <>
      <path d={SQUIRCLE} fill={GLAZES[color]} />
      {color === 'saffron' ? <Damask /> : null}
      {color === 'basalt' ? <Lattice /> : null}
      {color === 'verdigris' ? <Star print={print} /> : null}
    </>
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
    // The board's print: the face, flat and faded, in a recessed square.
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
        <g className="tile__print">
          <Face color={color} print />
          {/* the paper showing through the ink */}
          <path d={SQUIRCLE} fill="#ffffff" fillOpacity="0.22" />
        </g>
        <path d={SQUIRCLE} transform="translate(0.5 0.5) scale(0.9583)" fill="none" stroke="#000000" strokeOpacity="0.35" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
      {/* the side of the tile */}
      <path d={SQUIRCLE} fill={EDGES[color]} />
      <path d={SQUIRCLE} fill="url(#azt-side)" />
      {/* the face, its pattern, and the glaze over it */}
      <g transform={FACE_TRANSFORM}>
        <Face color={color} />
      </g>
      <g clipPath="url(#azt-face)">
        <rect width="24" height="24" fill="url(#azt-sheen)" opacity={color === 'verdigris' || color === 'saffron' ? 0.75 : 1} />
        <rect width="24" height="24" fill="url(#azt-spec)" />
      </g>
      {/* a lit rim along the top and left of the face */}
      <path
        d="M1.9 18.3V5.6C1.9 3.1 3.1 1.7 5.6 1.7H18.2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The starting-player tile: cream, edged in blue, with a bold "1" — the number
 * of the player who goes first next round — and four small orange studs.
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
      <path d={SQUIRCLE} fill="#b9ab8c" />
      <g transform={FACE_TRANSFORM}>
        <path d={SQUIRCLE} fill="#f4ead2" />
        <path d={SQUIRCLE} transform="translate(1.3 1.3) scale(0.8917)" fill="none" stroke="#2f4a9a" strokeWidth="1.3" />
        <path d={SQUIRCLE} transform="translate(2.6 2.6) scale(0.7833)" fill="none" stroke="#2f4a9a" strokeWidth="0.5" strokeOpacity="0.6" />
        <text
          x="12"
          y="17.2"
          textAnchor="middle"
          fontSize="14.5"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
          fill="#1f3a8a"
        >
          1
        </text>
        <g fill="#e0541a">
          <circle cx="5.2" cy="5.2" r="0.9" />
          <circle cx="18.8" cy="5.2" r="0.9" />
          <circle cx="5.2" cy="18.8" r="0.9" />
          <circle cx="18.8" cy="18.8" r="0.9" />
        </g>
      </g>
      <g clipPath="url(#azt-face)">
        <rect width="24" height="24" fill="url(#azt-spec)" />
      </g>
    </svg>
  )
}
