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
  cobalt: '#2c7fa9',
  saffron: '#f3b53a',
  crimson: '#e03b4d',
  basalt: '#171c25',
  verdigris: '#f3f6f5',
}

/** Brighter stand-ins for text and counters, where the tile colour itself would vanish on the dark page. */
export const GLAZE_TEXT: Record<Color, string> = {
  cobalt: '#5fb4de',
  saffron: '#f3b53a',
  crimson: '#f0677a',
  basalt: '#8a9ab0',
  verdigris: '#8fd6e2',
}

export const COLOR_NAMES: Record<Color, string> = {
  cobalt: 'Cobalt',
  saffron: 'Saffron',
  crimson: 'Crimson',
  basalt: 'Basalt',
  verdigris: 'Ivory',
}

/** Points of an n-pointed star as a closed path. */
function starPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const steps: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = (Math.PI * i) / points - Math.PI / 2
    steps.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${steps.join('L')}Z`
}

const STAR_OUTER = starPath(12, 12, 9.6, 4.4, 8)
const STAR_MID = starPath(12, 12, 6.7, 3.1, 8)
const STAR_INNER = starPath(12, 12, 4, 1.9, 8)

/** One quarter of the yellow tile's floral, rotated into place four times. */
function Floral() {
  return (
    <g>
      {/* the long leaf on the axis, with its midrib knocked out in gold */}
      <path d="M12 8.1C10.2 6.5 10.3 4.5 12 2.9 13.7 4.5 13.8 6.5 12 8.1Z" />
      <path d="M12 7.3V4.2" fill="none" stroke="#f3b53a" strokeWidth="0.45" />
      {/* the main scroll, curling out along the diagonal to a bead */}
      <path
        d="M14.1 9.9C15.9 8.5 17.6 8.9 18.4 7.5 19.2 6.1 18 4.8 16.7 5.4 15.8 5.8 15.9 7 16.9 7"
        fill="none"
      />
      <circle cx="16.85" cy="6.15" r="0.5" stroke="none" />
      {/* a tendril going the other way, ending in a small leaf */}
      <path d="M10.1 9.7C8.5 8.9 7.5 7.5 7.7 5.9" fill="none" strokeWidth="0.7" />
      <path d="M7.7 5.9C6.6 5.6 6.1 4.8 6.2 3.9 7.3 4.1 7.9 4.8 7.7 5.9Z" />
      {/* a half-petal at the edge between them, and studs in the corner */}
      <path d="M14.9 2.5C16.2 2.6 17.1 3.3 17.2 4.4 16 4.5 15.2 3.8 14.9 2.5Z" />
      <circle cx="19.7" cy="4.3" r="0.8" stroke="none" />
      <circle cx="21.3" cy="2.7" r="0.4" stroke="none" />
      <circle cx="19.1" cy="12" r="0.5" stroke="none" />
    </g>
  )
}

/** Eight petals around a centre, for the middle of the yellow tile. */
function Rosette() {
  return (
    <g stroke="none">
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="12" cy="9.3" rx="0.95" ry="2" transform={`rotate(${i * 45} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.15" fill="#f3b53a" />
      <circle cx="12" cy="12" r="0.55" />
    </g>
  )
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
      return (
        <>
          {[0, 90, 180, 270].map(angle => (
            <path
              key={angle}
              transform={`rotate(${angle} 12 12)`}
              d="M12 9.1C10.7 7.6 10.8 5.9 12 4.3 13.2 5.9 13.3 7.6 12 9.1Z M13.7 10.3C15.3 9 16.6 9.5 17.5 8.2"
            />
          ))}
          <circle cx="12" cy="12" r="1.7" />
        </>
      )
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
          <circle cx="12" cy="12" r="7.4" />
          <circle cx="12" cy="12" r="4.6" />
          <circle cx="12" cy="12" r="1.8" />
        </>
      )
    case 'verdigris':
      return <path d={STAR_OUTER} />
  }
}

/** The painted face of each tile, in a 24×24 box, over its glaze. */
function Face({ color }: { color: Color }) {
  switch (color) {
    case 'cobalt':
      // Plain glossy blue: a pale inner frame, faint corner arcs, a ghost quatrefoil.
      return (
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          <path d={SQUIRCLE} transform="translate(2.4 2.4) scale(0.8)" strokeOpacity="0.16" strokeWidth="0.6" />
          <g strokeOpacity="0.22" strokeWidth="0.8">
            <circle cx="12" cy="8.8" r="3" />
            <circle cx="12" cy="15.2" r="3" />
            <circle cx="8.8" cy="12" r="3" />
            <circle cx="15.2" cy="12" r="3" />
          </g>
          <path d="M4.2 7.4A3.2 3.2 0 0 1 7.4 4.2M16.6 4.2A3.2 3.2 0 0 1 19.8 7.4M19.8 16.6A3.2 3.2 0 0 1 16.6 19.8M7.4 19.8A3.2 3.2 0 0 1 4.2 16.6" strokeOpacity="0.2" strokeWidth="0.7" />
          <g fill="#ffffff" fillOpacity="0.14" stroke="none">
            <circle cx="6.1" cy="17.2" r="0.35" />
            <circle cx="17.6" cy="6.6" r="0.3" />
            <circle cx="18.2" cy="17.9" r="0.3" />
            <circle cx="5.6" cy="7.2" r="0.3" />
          </g>
        </g>
      )
    case 'saffron':
      // Gold, painted in red-orange: a framed filigree, a rosette and a floral in every quarter.
      return (
        <g fill="#e2481f" stroke="#e2481f" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round">
          <path d={SQUIRCLE} transform="translate(1.9 1.9) scale(0.8417)" fill="none" strokeWidth="0.45" strokeOpacity="0.75" />
          {[0, 90, 180, 270].map(angle => (
            <g key={angle} transform={`rotate(${angle} 12 12)`}>
              <Floral />
            </g>
          ))}
          <Rosette />
          <circle cx="12" cy="12" r="4.4" fill="none" strokeWidth="0.5" strokeDasharray="0.8 1" />
        </g>
      )
    case 'crimson':
      return (
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          <path d={SQUIRCLE} transform="translate(2.4 2.4) scale(0.8)" strokeOpacity="0.16" strokeWidth="0.6" />
          <g strokeOpacity="0.22" strokeWidth="0.8">
            <path d="M12 4.6 19.4 12 12 19.4 4.6 12Z" />
            <circle cx="12" cy="12" r="2.2" />
          </g>
          <path d="M4.2 7.4A3.2 3.2 0 0 1 7.4 4.2M16.6 4.2A3.2 3.2 0 0 1 19.8 7.4M19.8 16.6A3.2 3.2 0 0 1 16.6 19.8M7.4 19.8A3.2 3.2 0 0 1 4.2 16.6" strokeOpacity="0.2" strokeWidth="0.7" />
          <g fill="#ffffff" fillOpacity="0.14" stroke="none">
            <circle cx="6.4" cy="17.4" r="0.35" />
            <circle cx="17.3" cy="6.4" r="0.3" />
            <circle cx="17.9" cy="17.6" r="0.3" />
          </g>
        </g>
      )
    case 'basalt':
      // Black, with a teal rosette lattice: rings, overlapping petals, a ring of beads, corner arcs.
      return (
        <g fill="none" stroke="#3aa3bd" strokeWidth="0.7" strokeLinecap="round">
          <path d={SQUIRCLE} transform="translate(1.7 1.7) scale(0.8583)" strokeWidth="0.4" strokeOpacity="0.6" />
          <circle cx="12" cy="12" r="8.2" strokeOpacity="0.9" />
          <circle cx="12" cy="12" r="6.6" strokeWidth="0.45" strokeOpacity="0.7" />
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 8
            return <circle key={i} cx={12 + 3.6 * Math.cos(angle)} cy={12 + 3.6 * Math.sin(angle)} r="2.2" strokeOpacity="0.85" />
          })}
          <circle cx="12" cy="12" r="1.6" fill="#3aa3bd" stroke="none" />
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 16
            return (
              <circle key={i} cx={12 + 7.4 * Math.cos(angle)} cy={12 + 7.4 * Math.sin(angle)} r="0.5" fill="#3aa3bd" stroke="none" />
            )
          })}
          <path d="M2.2 7.2A5 5 0 0 0 7.2 2.2M16.8 2.2A5 5 0 0 0 21.8 7.2M21.8 16.8A5 5 0 0 0 16.8 21.8M7.2 21.8A5 5 0 0 0 2.2 16.8" />
          <path d="M2.2 5A2.8 2.8 0 0 0 5 2.2M19 2.2A2.8 2.8 0 0 0 21.8 5M21.8 19A2.8 2.8 0 0 0 19 21.8M5 21.8A2.8 2.8 0 0 0 2.2 19" strokeWidth="0.45" strokeOpacity="0.7" />
        </g>
      )
    case 'verdigris':
      // Ivory, with a sky-blue star in layers over a faint ground of crossed lines.
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d={SQUIRCLE} transform="translate(1.6 1.6) scale(0.8667)" fill="none" stroke="#3db5c9" strokeWidth="0.45" strokeOpacity="0.55" />
          <path d="M12 2.4V21.6M2.4 12H21.6M5.2 5.2 18.8 18.8M18.8 5.2 5.2 18.8" stroke="#3db5c9" strokeWidth="0.35" strokeOpacity="0.35" fill="none" />
          <path d={STAR_OUTER} fill="#3db5c9" />
          <path d={STAR_MID} fill="#f3f6f5" />
          <path d={STAR_MID} fill="none" stroke="#3db5c9" strokeWidth="0.45" strokeOpacity="0.8" transform="translate(12 12) scale(0.72) translate(-12 -12)" />
          <path d={STAR_INNER} fill="#3db5c9" />
          <circle cx="12" cy="12" r="0.95" fill="#f3f6f5" />
          <g fill="#3db5c9">
            <circle cx="4.1" cy="4.1" r="0.7" />
            <circle cx="19.9" cy="4.1" r="0.7" />
            <circle cx="4.1" cy="19.9" r="0.7" />
            <circle cx="19.9" cy="19.9" r="0.7" />
          </g>
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
          stroke={GLAZE_TEXT[color]}
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
      {/* The glaze: a lit rim top-left, a shaded rim bottom-right, a soft sheen. */}
      <path d="M2.3 21V5.5C2.3 3.8 3.8 2.3 5.5 2.3H21" fill="none" stroke="#ffffff" strokeOpacity={color === 'verdigris' ? 0 : 0.38} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M21.7 3V18.5C21.7 20.2 20.2 21.7 18.5 21.7H3" fill="none" stroke="#000000" strokeOpacity={color === 'verdigris' ? 0.1 : 0.28} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M3 3H21L3 21Z" fill="#ffffff" fillOpacity={color === 'verdigris' ? 0 : 0.06} />
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
