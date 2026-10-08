/**
 * One scoreboard for the whole table.
 *
 * Like the printed board, a single track of a hundred spaces carries every
 * player's pawn, so a lead — or a catch-up — is something you see rather than
 * work out from separate numbers. Under it, the standings: position, name and
 * score. During scoring the pawns walk the track one point at a time, and each
 * point flies into the cell it lands on.
 *
 * The track can be laid out as a snake (five rows of twenty) or as a ring
 * around the standings, the way the real board runs it round the edge.
 */

import { useState } from 'react'
import type { GameState } from '../engine/types'
import type { Seat } from '../net/protocol'
import { flightId } from './useFlight'

/** A pawn colour per seat. Not glazes, so a pawn is never mistaken for a tile. */
export const PAWNS = ['#ff6a3d', '#e9e8f5', '#a78bfa', '#f0abfc']

const TRACK = 100
const SNAKE_COLUMNS = 20
const RING_SIDE = 26
const LAYOUT_KEY = 'azulejo:track'

export type TrackLayout = 'snake' | 'ring'

function readLayout(): TrackLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'ring' ? 'ring' : 'snake'
  } catch {
    return 'snake'
  }
}

/** Grid position (1-based row and column) of a track space. */
export function snakeCell(index: number): { row: number; col: number } {
  const row = Math.floor(index / SNAKE_COLUMNS)
  const along = index % SNAKE_COLUMNS
  return { row: row + 1, col: (row % 2 === 0 ? along : SNAKE_COLUMNS - 1 - along) + 1 }
}

/**
 * The ring runs clockwise from the top-left corner: 26 along the top, 25 down
 * the right, 25 back along the bottom and 24 up the left — exactly a hundred.
 */
export function ringCell(index: number): { row: number; col: number } {
  const last = RING_SIDE - 1
  if (index <= last) return { row: 1, col: index + 1 }
  if (index <= last + last) return { row: index - last + 1, col: RING_SIDE }
  if (index <= last * 3) return { row: RING_SIDE, col: RING_SIDE - (index - last * 2) }
  return { row: RING_SIDE - (index - last * 3), col: 1 }
}

export interface ScoreBoardProps {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  scores: number[]
  focus: number | null
  /** While scoring plays out, nobody is "to play" yet. */
  counting: boolean
}

export function ScoreBoard({ state, seats, seatIndex, scores, focus, counting }: ScoreBoardProps) {
  const [layout, setLayout] = useState<TrackLayout>(readLayout)
  const choose = (next: TrackLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // the choice lasts for this visit
    }
  }

  const shown = state.players.map((player, i) => scores[i] ?? player.score)
  const leader = Math.max(...shown)
  const order = state.players
    .map((player, index) => ({ player, index, score: shown[index] }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const place = layout === 'ring' ? ringCell : snakeCell
  const pawnsAt = (cell: number) =>
    state.players
      .map((player, index) => ({ player, index }))
      .filter(({ index }) => shown[index] % TRACK === cell)

  const cells = Array.from({ length: TRACK }, (_, i) => {
    const { row, col } = place(i)
    const pawns = pawnsAt(i)
    return (
      <span
        key={i}
        className={['cell', i % 5 === 0 ? 'cell--five' : '', i <= leader % TRACK || leader >= TRACK ? 'cell--lit' : '']
          .filter(Boolean)
          .join(' ')}
        style={{ gridRow: row, gridColumn: col }}
        {...flightId(`pip:${i}`)}
      >
        {i % 5 === 0 ? i : null}
        {pawns.map(({ player, index }, k) => (
          <i
            key={`${player.id}-${shown[index]}`}
            className={`pawn pawn--${Math.min(k, 3)}`}
            style={{ background: PAWNS[index % PAWNS.length] }}
            title={`${player.name}: ${shown[index]}`}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </i>
        ))}
      </span>
    )
  })

  const standings = (
    <ol className="standings">
      {order.map(({ player, index, score }, rank) => {
        const seat = seats[index]
        const turn = state.current === index && state.phase === 'offer' && !counting
        const status = turn
          ? 'to play'
          : seat?.kind === 'bot'
            ? 'house'
            : seat && !seat.present
              ? 'away'
              : state.nextStarter === index && !state.centerHasFirst
                ? 'starts next'
                : ''
        return (
          <li
            key={player.id}
            className={['standing', turn ? 'standing--turn' : '', focus === index ? 'standing--scoring' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="standing__rank">{rank + 1}</span>
            <i className="standing__pawn" style={{ background: PAWNS[index % PAWNS.length] }} />
            <span className="standing__name">
              {player.name}
              {index === seatIndex ? <span className="eyebrow eyebrow--signal"> you</span> : null}
              {status ? (
                <span className={`standing__status eyebrow ${turn ? 'eyebrow--signal' : 'eyebrow--faint'}`}> {status}</span>
              ) : null}
            </span>
            <span className="standing__score" aria-label={`${score} points`}>
              {score}
              {score >= TRACK ? <small>+{Math.floor(score / TRACK) * TRACK}</small> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )

  return (
    <section className={`module scoreboard scoreboard--${layout}`} aria-label="Scoreboard">
      <header className="module__head">
        <span className="eyebrow">Score track · Round {String(state.round).padStart(2, '0')}</span>
        <span className="scoreboard__switch" role="group" aria-label="Track layout">
          {(['snake', 'ring'] as const).map(option => (
            <button
              key={option}
              type="button"
              className="eyebrow"
              aria-pressed={layout === option}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
        </span>
      </header>
      {layout === 'ring' ? (
        <div className="track track--ring">
          {cells}
          <div className="track__inner">{standings}</div>
        </div>
      ) : (
        <>
          <div className="track track--snake">{cells}</div>
          {standings}
        </>
      )}
    </section>
  )
}
