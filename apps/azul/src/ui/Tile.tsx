/**
 * One tile, and the mark left where a tile will go.
 *
 * The five tiles follow the look of the real set — a glossy royal blue, a
 * yellow with an orange floral, a plain red, a black with a white rosette, and
 * an ivory with a sky-blue star — drawn here from scratch as flat vector, with
 * a soft inner edge for the glaze. Each also carries its own motif, so the
 * board reads without relying on hue.
 *
 * An unfired wall space is the same motif in its own glaze, dotted and faint
 * inside a hairline square. It is the pounce of the old design kept honest:
 * the wall shows what belongs where before a single tile has landed.
 */

import type { CSSProperties } from 'react'
import type { Color } from '../engine/types'

export const GLAZES: Record<Color, string> = {
  cobalt: '#2f62c4',
  saffron: '#f0b030',
  crimson: '#d9432f',
  basalt: '#1f2533',
  verdigris: '#e9eef2',
}

/** Brighter stand-ins for text and counters, where the tile colour itself would vanish on the dark page. */
export const GLAZE_TEXT: Record<Color, string> = {
  cobalt: '#6f98e6',
  saffron: '#f0b030',
  crimson: '#ee6a55',
  basalt: '#8a96ad',
  verdigris: '#7cc4e8',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Cobalt',
  saffron: 'Saffron',
  crimson: 'Crimson',
  basalt: 'Basalt',
  verdigris: 'Ivory',
}

/** The motif as a plain outline, for the dotted unfired space on the wall. */
function Outline({ color }: { color: Color }) {
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
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.4" />
          <path d="M12 5v4.6M12 14.4V19M5 12h4.6M14.4 12H19" />
        </>
      )
    case 'verdigris':
      return (
        <>
          <path d="M12 3.4 20.6 12 12 20.6 3.4 12Z" />
          <path d="M6 6h12v12H6Z" />
        </>
      )
  }
}

/** The painted face of each tile, in a 24×24 box, over its glaze. */
function Face({ color }: { color: Color }) {
  switch (color) {
    case 'cobalt':
      // Plain glossy blue, with the faintest quatrefoil so it is never only a colour.
      return (
        <g fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.9">
          <circle cx="12" cy="8.8" r="3" />
          <circle cx="12" cy="15.2" r="3" />
          <circle cx="8.8" cy="12" r="3" />
          <circle cx="15.2" cy="12" r="3" />
        </g>
      )
    case 'saffron':
      // The orange floral: a four-petal flower, leaves between, a dotted ring.
      return (
        <g fill="none" stroke="#e0541a" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.6c1.9 2 1.9 4.2 0 6-1.9-1.8-1.9-4 0-6ZM12 13.4c1.9 1.8 1.9 4 0 6-1.9-2-1.9-4.2 0-6ZM4.6 12c2-1.9 4.2-1.9 6 0-1.8 1.9-4 1.9-6 0ZM13.4 12c1.8-1.9 4-1.9 6 0-2 1.9-4.2 1.9-6 0Z" />
          <circle cx="12" cy="12" r="1.5" fill="#e0541a" stroke="none" />
          <path d="M6.2 6.2 8 8M17.8 6.2 16 8M6.2 17.8 8 16M17.8 17.8 16 16" />
        </g>
      )
    case 'crimson':
      // Plain red, a faint lozenge.
      return (
        <g fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.9">
          <path d="M12 4.6 19.4 12 12 19.4 4.6 12Z" />
          <circle cx="12" cy="12" r="2.2" />
        </g>
      )
    case 'basalt':
      // Black with a white rosette.
      return (
        <g fill="none" stroke="#f4f4f8" strokeOpacity="0.9" strokeWidth="1" strokeLinecap="round">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.4" />
          <path d="M12 5v4.6M12 14.4V19M5 12h4.6M14.4 12H19" />
          <path d="M7.1 7.1 8.7 8.7M16.9 7.1 15.3 8.7M7.1 16.9 8.7 15.3M16.9 16.9 15.3 15.3" strokeOpacity="0.7" />
        </g>
      )
    case 'verdigris':
      // Ivory with the sky-blue eight-point star.
      return (
        <g strokeLinejoin="round">
          <path d="M12 3.4 20.6 12 12 20.6 3.4 12Z M6 6h12v12H6Z" fill="#7cc4e8" fillOpacity="0.35" stroke="#2f9bd0" strokeWidth="1" />
          <path d="M12 7.6 16.4 12 12 16.4 7.6 12Z" fill="#2f9bd0" fillOpacity="0.55" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="#ffffff" stroke="none" />
        </g>
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
          <Outline color={color} />
        </g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} style={style} data-flight={flight} role="img" aria-label={label}>
      <path d={SQUIRCLE} fill={GLAZES[color]} />
      <Face color={color} />
      {/* The glaze: a soft light edge top-left and a darker one bottom-right. */}
      <path
        d={SQUIRCLE}
        transform="translate(0.7 0.7) scale(0.9417)"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={color === 'verdigris' ? 0.9 : 0.22}
        strokeWidth="0.9"
      />
      <path d="M2 21.2c1 .6 2.2.8 3.4.8h13.4c1.9 0 3.2-1.3 3.2-3.2V5.4" fill="none" stroke="#000000" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  )
}

/**
 * The starting-player tile: ivory, edged in blue, with a bold "1" — the number
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
    </svg>
  )
}
