/**
 * The table in play: the factory displays, the centre, and every board.
 *
 * The turn is two clicks and the interface is built around making the second
 * one obvious. Picking a colour puts the player in a holding state — the
 * handful is named in the prompt, the lines that can take it are lit, the ones
 * that cannot say why on hover, and the pattern line shows the tiles it would
 * receive as pounce marks before they are committed.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Color, GameState, Move } from '../engine/types'
import { CENTER, COLORS, FLOOR, WALL_SIZE } from '../engine/types'
import { moveError } from '../engine/rules'
import type { Seat } from '../net/protocol'
import { Board } from './Board'
import type { PendingPlacement } from './Board'
import { COLOR_NAMES, FirstMarker, Tile } from './Tile'

interface Pick {
  source: number
  color: Color
}

export interface TableProps {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  onPlay: (move: Move) => void
  notice: string | null
}

export function Table({ state, seats, seatIndex, onPlay, notice }: TableProps) {
  const [pick, setPick] = useState<Pick | null>(null)
  const myTurn = seatIndex !== null && state.current === seatIndex && state.phase === 'offer'

  // A pick belongs to one position. Anything that changes the table — a turn
  // taken, a round dealt — drops it rather than letting it point at tiles that
  // are no longer there.
  useEffect(() => {
    setPick(null)
  }, [state.round, state.current, state.phase])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPick(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pending = useMemo<PendingPlacement | undefined>(() => {
    if (!pick || !myTurn) return undefined
    const pile = pick.source === CENTER ? state.center : state.factories[pick.source]
    const count = pile.filter(t => t === pick.color).length
    const legal = new Set<number>()
    const refusals: Record<number, string> = {}
    for (let line = 0; line < WALL_SIZE; line++) {
      const error = moveError(state, { source: pick.source, color: pick.color, line })
      if (error) refusals[line] = error
      else legal.add(line)
    }
    return { color: pick.color, count, legal, refusals }
  }, [pick, myTurn, state])

  const place = (line: number) => {
    if (!pick) return
    onPlay({ source: pick.source, color: pick.color, line })
    setPick(null)
  }

  const mine = seatIndex === null ? null : state.players[seatIndex]
  const others = state.players.filter((_, i) => i !== seatIndex)

  return (
    <div className="table">
      <div className="table__prompt" aria-live="polite">
        <Prompt state={state} seats={seats} seatIndex={seatIndex} pick={pick} pending={pending} notice={notice} />
      </div>

      <section className="panel panel--dark table__supply" aria-label="The table">
        <h2 className="panel__title">Displays</h2>
        <div className="factories">
          {state.factories.map((display, index) => (
            <Plate
              key={index}
              index={index}
              tiles={display}
              pick={pick}
              enabled={myTurn}
              onPick={(color: Color) => setPick({ source: index, color })}
            />
          ))}
        </div>
        <h2 className="panel__title panel__title--spaced">Centre</h2>
        <Basin
          tiles={state.center}
          hasFirst={state.centerHasFirst}
          pick={pick}
          enabled={myTurn}
          onPick={(color: Color) => setPick({ source: CENTER, color })}
        />
      </section>

      <div className="rail table__info">
        <Seats state={state} seats={seats} seatIndex={seatIndex} />
        {state.phase === 'over' ? (
          <Result state={state} />
        ) : state.lastRound ? (
          <RoundSummary state={state} />
        ) : null}
      </div>

      <div className="rail table__mine">
        {mine ? (
          <Board
            player={mine}
            mine
            active={state.current === seatIndex && state.phase === 'offer'}
            pending={pending}
            fresh={freshFor(state, seatIndex!)}
            onPlace={line => place(line === -1 ? FLOOR : line)}
          />
        ) : null}
      </div>

      <div className="rail table__others">
        {others.map(player => {
          const index = state.players.indexOf(player)
          return (
            <Board
              key={player.id}
              player={player}
              mine={false}
              active={state.current === index && state.phase === 'offer'}
              fresh={freshFor(state, index)}
              badge={seats[index]?.kind === 'bot' ? 'house' : seats[index]?.present ? undefined : 'away'}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Wall spaces filled by the most recent tiling, keyed `row-col`. */
function freshFor(state: GameState, seat: number): Set<string> {
  const report = state.lastRound?.find(r => r.playerIndex === seat)
  return new Set(report?.placements.map(p => `${p.row}-${p.col}`) ?? [])
}

function Prompt({
  state,
  seats,
  seatIndex,
  pick,
  pending,
  notice,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  pick: Pick | null
  pending?: PendingPlacement
  notice: string | null
}) {
  if (notice) return <p className="prompt prompt--warn">{notice}</p>

  if (state.phase === 'over') {
    const names = (state.winners ?? []).map(i => state.players[i].name)
    return (
      <p className="prompt">
        {names.length > 1 ? `${names.join(' and ')} share the wall.` : `${names[0]} takes the wall.`}
      </p>
    )
  }

  if (state.phase === 'tiling') return <p className="prompt prompt--quiet">Firing the walls…</p>

  const current = state.players[state.current]
  if (seatIndex === null) {
    return <p className="prompt prompt--quiet">Watching. {current.name} is choosing.</p>
  }
  if (state.current !== seatIndex) {
    const seat = seats[state.current]
    return (
      <p className="prompt prompt--quiet">
        {current.name} is choosing{seat?.kind === 'bot' ? ' — the house plays quickly' : ''}.
      </p>
    )
  }
  if (pick && pending) {
    return (
      <p className="prompt">
        <Tile color={pick.color} style={{ ['--tile' as string]: '1.5rem' }} />
        Holding {pending.count} × {COLOR_NAMES[pick.color]}. Pick a line, or drop them on the floor.
        Press Escape to put them back.
      </p>
    )
  }
  return <p className="prompt">Your turn. Take every tile of one colour from a display, or from the centre.</p>
}

function Plate({
  index,
  tiles,
  pick,
  enabled,
  onPick,
}: {
  index: number
  tiles: Color[]
  pick: Pick | null
  enabled: boolean
  onPick: (color: Color) => void
}) {
  if (tiles.length === 0) {
    return <div className="plate plate--empty" aria-label={`Display ${index + 1}, empty`} />
  }
  return (
    <div className="plate" role="group" aria-label={`Display ${index + 1}`}>
      {tiles.map((color, slot) => {
        const picked = pick?.source === index && pick.color === color
        const count = tiles.filter(t => t === color).length
        return (
          <button
            key={slot}
            type="button"
            className="plate__tile"
            data-picked={picked}
            disabled={!enabled}
            onClick={() => onPick(color)}
            aria-label={`Take ${count} ${COLOR_NAMES[color]} from display ${index + 1}`}
            title={enabled ? `Take ${count} × ${COLOR_NAMES[color]}` : COLOR_NAMES[color]}
          >
            <Tile color={color} />
          </button>
        )
      })}
    </div>
  )
}

function Basin({
  tiles,
  hasFirst,
  pick,
  enabled,
  onPick,
}: {
  tiles: Color[]
  hasFirst: boolean
  pick: Pick | null
  enabled: boolean
  onPick: (color: Color) => void
}) {
  const counts = COLORS.map(color => ({ color, count: tiles.filter(t => t === color).length })).filter(
    entry => entry.count > 0,
  )

  return (
    <div className="basin">
      {hasFirst ? <FirstMarker className="basin__tile" /> : null}
      {counts.length === 0 && !hasFirst ? (
        <span className="basin__empty">Nothing has slid into the centre yet.</span>
      ) : null}
      {counts.map(({ color, count }) =>
        Array.from({ length: count }, (_, i) => (
          <button
            key={`${color}-${i}`}
            type="button"
            className="plate__tile basin__tile"
            data-picked={pick?.source === CENTER && pick.color === color}
            disabled={!enabled}
            onClick={() => onPick(color)}
            aria-label={`Take ${count} ${COLOR_NAMES[color]} from the centre${
              hasFirst ? ', and the starting player marker' : ''
            }`}
            title={enabled ? `Take ${count} × ${COLOR_NAMES[color]}` : COLOR_NAMES[color]}
          >
            <Tile color={color} />
          </button>
        )),
      )}
    </div>
  )
}

function Seats({
  state,
  seats,
  seatIndex,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
}) {
  return (
    <section className="panel panel--dark">
      <h2 className="panel__title">Round {state.round}</h2>
      <div className="seats">
        {state.players.map((player, index) => {
          const seat = seats[index]
          const turn = state.current === index && state.phase === 'offer'
          return (
            <div key={player.id} className={`seat ${turn ? 'seat--turn' : ''}`}>
              <span className="seat__name">
                {player.name}
                {index === seatIndex ? <span className="seat__meta">you</span> : null}
                {seat?.kind === 'bot' ? <span className="seat__meta">house</span> : null}
                {seat && seat.kind === 'human' && !seat.present ? (
                  <span className="seat__meta">away</span>
                ) : null}
                {state.nextStarter === index && !state.centerHasFirst ? (
                  <span className="seat__meta">starts next</span>
                ) : null}
              </span>
              <span className="seat__score">{player.score}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RoundSummary({ state }: { state: GameState }) {
  const reports = state.lastRound ?? []
  return (
    <section className="panel panel--dark">
      <h2 className="panel__title">Last firing</h2>
      <div className="log">
        {reports.map(report => {
          const player = state.players[report.playerIndex]
          const gained = report.placements.reduce((sum, p) => sum + p.points, 0)
          return (
            <p className="log__entry" key={report.playerIndex}>
              <b>{player.name}</b>
              <span>
                {report.placements.length === 0
                  ? 'tiled nothing'
                  : `tiled ${report.placements.length} for +${gained}`}
                {report.penalty < 0 ? `, floor ${report.penalty}` : ''} → {report.scoreAfter}
              </span>
            </p>
          )
        })}
      </div>
    </section>
  )
}

/** The itemised end-of-game scoring. */
export function Result({ state }: { state: GameState }) {
  const reports = state.finalReports ?? []
  return (
    <section className="panel panel--dark">
      <h2 className="panel__title">Final count</h2>
      <div className="result">
        <div className="result__row result__row--head">
          <span>Player</span>
          <span>Rows</span>
          <span>Cols</span>
          <span>Sets</span>
          <span>Total</span>
        </div>
        {reports.map(report => {
          const player = state.players[report.playerIndex]
          const won = state.winners?.includes(report.playerIndex)
          return (
            <div
              className={`result__row ${won ? 'result__row--winner' : ''}`}
              key={report.playerIndex}
            >
              <span className="result__name">{player.name}</span>
              <span>+{report.rows * 2}</span>
              <span>+{report.columns * 7}</span>
              <span>+{report.colors * 10}</span>
              <span>{report.scoreAfter}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
