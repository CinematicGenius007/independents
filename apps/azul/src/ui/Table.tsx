/**
 * The table in play: the displays, the centre, and every board.
 *
 * A turn is two clicks, and the whole interface exists to make the second one
 * informed. Picking a colour names the handful in the prompt, lights the lines
 * that can take it, marks each one with what it would earn and what it would
 * cost, and shows the tiles it would receive as pounce marks before anything
 * is committed. Escape puts them back.
 *
 * What happens away from your hands is shown too: every move — an opponent's,
 * a bot's — flies its tiles from the pile they came off to the board they land
 * on, and the wall-tiling is counted out one tile at a time instead of
 * arriving as a new number.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Color, GameState, Move } from '../engine/types'
import { CENTER, COLORS, FLOOR, WALL_SIZE } from '../engine/types'
import { moveError } from '../engine/rules'
import { previewFloor, previewLine, unseenTiles } from '../engine/preview'
import type { LinePreview } from '../engine/preview'
import type { Seat } from '../net/protocol'
import type { LastMove } from '../net/session'
import { Board } from './Board'
import type { PendingPlacement, ScoringView } from './Board'
import { COLOR_NAMES, FirstMarker, GLAZES, Tile } from './Tile'
import { useScoring } from './useScoring'
import { flightId, useFlight } from './useFlight'
import { play, playScore } from './audio'

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
  lastMove: LastMove | null
}

export function Table({ state, seats, seatIndex, onPlay, notice, lastMove }: TableProps) {
  const [pick, setPick] = useState<Pick | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const previous = useRef<GameState | null>(null)
  const scoring = useScoring(state)
  const myTurn =
    seatIndex !== null && state.current === seatIndex && state.phase === 'offer' && !scoring.running

  // A pick belongs to one position. Anything that changes the table — a turn
  // taken, a round dealt — drops it rather than letting it point at tiles that
  // are no longer there.
  useEffect(() => {
    setPick(null)
  }, [state.round, state.current, state.phase])

  const pending = useMemo<PendingPlacement | undefined>(() => {
    if (!pick || !myTurn || seatIndex === null) return undefined
    const pile = pick.source === CENTER ? state.center : state.factories[pick.source]
    const count = pile.filter(t => t === pick.color).length
    const player = state.players[seatIndex]
    // Taking the marker costs a floor slot too, and the reckoning has to say so.
    const marker = pick.source === CENTER && state.centerHasFirst ? 1 : 0
    const legal = new Set<number>()
    const refusals: Record<number, string> = {}
    const previews: Record<number, LinePreview> = {}
    for (let line = 0; line < WALL_SIZE; line++) {
      const error = moveError(state, { source: pick.source, color: pick.color, line })
      if (error) {
        refusals[line] = error
        continue
      }
      legal.add(line)
      previews[line] = previewLine(player, line, pick.color, count, marker)
    }
    return {
      color: pick.color,
      count,
      legal,
      refusals,
      previews,
      floorPreview: previewFloor(player, count, marker),
    }
  }, [pick, myTurn, seatIndex, state])

  // Fly the handful from the pile it came off to the slots it lands in. The
  // position has already changed by now, so the arithmetic is done against the
  // previous one, which is the only place the pile was still full.
  useFlight(
    lastMove,
    move => {
      const before = previous.current
      if (!before) return null
      const { seat, move: played } = move
      const pile = played.source === CENTER ? before.center : before.factories[played.source]
      if (!pile) return null
      const taken = pile.filter(t => t === played.color).length
      if (taken === 0) return null

      const player = before.players[seat]
      const capacity = played.line === FLOOR ? 0 : played.line + 1
      const room = played.line === FLOOR ? 0 : capacity - player.lines[played.line].count
      const placed = Math.min(room, taken)
      const to: string[] = []
      for (let i = 0; i < placed; i++) {
        const slot = capacity - player.lines[played.line].count - 1 - i
        to.push(`slot:${seat}:${played.line}:${slot}`)
      }
      const claimed = played.source === CENTER && before.centerHasFirst ? 1 : 0
      let floorSlot = player.floor.length + claimed
      for (let i = 0; i < taken - placed && floorSlot < 7; i++, floorSlot++) {
        to.push(`floor:${seat}:${floorSlot}`)
      }
      if (to.length === 0) return null
      return {
        request: { color: played.color, from: `pile:${played.source}`, to },
        tint: GLAZES[played.color],
      }
    },
    root,
  )

  useEffect(() => {
    previous.current = state
  }, [state])

  // Every move makes a sound, not only yours — a turn you cannot see happen is
  // a turn you can at least hear happen.
  const heard = useRef(0)
  useEffect(() => {
    if (!lastMove || lastMove.serial === heard.current) return
    heard.current = lastMove.serial
    play(lastMove.move.line === FLOOR ? 'floor' : 'place')
  }, [lastMove])

  // Each tile reaching the wall rings at a pitch set by what it scored, so a
  // good round sounds like a good round.
  const counted = scoring.current
  useEffect(() => {
    if (counted) playScore(counted.points)
  }, [counted])

  const wasMyTurn = useRef(false)
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) play('turn')
    wasMyTurn.current = myTurn
  }, [myTurn])

  useEffect(() => {
    if (state.phase === 'over') play('finish')
  }, [state.phase])

  const place = (line: number) => {
    if (!pick) return
    onPlay({ source: pick.source, color: pick.color, line })
    setPick(null)
  }

  // Number keys place, Escape puts the handful back — the two things a player
  // repeats a hundred times in a game.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return setPick(null)
      if (!pending) return
      if (event.key === '0') return place(FLOOR)
      const line = Number(event.key) - 1
      if (Number.isInteger(line) && pending.legal.has(line)) place(line)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const mine = seatIndex === null ? null : state.players[seatIndex]
  const others = state.players.map((player, index) => ({ player, index })).filter(p => p.index !== seatIndex)

  const scoringFor = (seat: number): ScoringView => ({
    hidden: scoring.hidden,
    revealed: scoring.revealed,
    counting:
      scoring.current && scoring.current.playerIndex === seat
        ? { row: scoring.current.row, col: scoring.current.col, points: scoring.current.points }
        : null,
  })

  return (
    <div className="table" ref={root}>
      <div className="table__prompt" aria-live="polite">
        <Prompt
          state={state}
          seats={seats}
          seatIndex={seatIndex}
          pick={pick}
          pending={pending}
          notice={notice}
          firing={scoring.running}
        />
      </div>

      <section className="panel panel--dark table__supply" aria-label="The table">
        <div className="supply__head">
          <h2 className="panel__title">Displays</h2>
          <SupplyTrack state={state} />
        </div>
        <div className="factories">
          {state.factories.map((display, index) => (
            <Plate
              key={index}
              index={index}
              tiles={display}
              pick={pick}
              enabled={myTurn}
              onPick={(color: Color) => {
                play('pick')
                setPick({ source: index, color })
              }}
            />
          ))}
        </div>
        <h2 className="panel__title panel__title--spaced">Centre</h2>
        <Basin
          tiles={state.center}
          hasFirst={state.centerHasFirst}
          pick={pick}
          enabled={myTurn}
          onPick={(color: Color) => {
            play('pick')
            setPick({ source: CENTER, color })
          }}
        />
      </section>

      <div className="rail table__info">
        <Seats state={state} seats={seats} seatIndex={seatIndex} scores={scoring.scores} />
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
            seat={seatIndex!}
            mine
            active={state.current === seatIndex && state.phase === 'offer'}
            pending={pending}
            scoring={scoringFor(seatIndex!)}
            score={scoring.scores[seatIndex!]}
            onPlace={line => place(line === -1 ? FLOOR : line)}
          />
        ) : null}
      </div>

      <div className="rail table__others">
        {others.map(({ player, index }) => (
          <Board
            key={player.id}
            player={player}
            seat={index}
            mine={false}
            compact
            active={state.current === index && state.phase === 'offer'}
            scoring={scoringFor(index)}
            score={scoring.scores[index]}
            badge={seats[index]?.kind === 'bot' ? 'house' : seats[index]?.present ? undefined : 'away'}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * How many tiles of each colour nobody has seen yet.
 *
 * At a table you read this off the bag and the discards without thinking about
 * it; a screen has to be asked. It is the difference between guessing whether
 * more crimson is coming and knowing.
 */
function SupplyTrack({ state }: { state: GameState }) {
  const unseen = unseenTiles(state)
  return (
    <div className="supply__track" aria-label="Tiles not yet in play">
      {COLORS.map(color => (
        <span className="supply__item" key={color} title={`${unseen[color]} ${COLOR_NAMES[color]} still unseen`}>
          <Tile color={color} className="supply__tile" />
          <b>{unseen[color]}</b>
        </span>
      ))}
    </div>
  )
}

function Prompt({
  state,
  seats,
  seatIndex,
  pick,
  pending,
  notice,
  firing,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  pick: Pick | null
  pending?: PendingPlacement
  notice: string | null
  firing: boolean
}) {
  if (notice) return <p className="prompt prompt--warn">{notice}</p>
  if (firing) return <p className="prompt prompt--quiet">Firing the walls, tile by tile…</p>

  if (state.phase === 'over') {
    const names = (state.winners ?? []).map(i => state.players[i].name)
    return (
      <p className="prompt prompt--win">
        {names.length > 1 ? `${names.join(' and ')} share the wall.` : `${names[0]} takes the wall.`}
      </p>
    )
  }

  if (state.phase === 'tiling') return <p className="prompt prompt--quiet">The table is bare. Into the kiln.</p>

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
        <Tile color={pick.color} className="prompt__tile" />
        Holding {pending.count} × {COLOR_NAMES[pick.color]}. Pick a line — number keys work — or
        press <kbd>0</kbd> for the floor, <kbd>Esc</kbd> to put them back.
      </p>
    )
  }
  return (
    <p className="prompt prompt--turn">
      Your turn. Take every tile of one colour from a display, or from the centre.
    </p>
  )
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
    return (
      <div className="plate plate--empty" {...flightId(`pile:${index}`)} aria-label={`Display ${index + 1}, empty`} />
    )
  }
  return (
    <div className="plate" {...flightId(`pile:${index}`)} role="group" aria-label={`Display ${index + 1}`}>
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
    <div className="basin" {...flightId(`pile:${CENTER}`)}>
      {hasFirst ? (
        <span className="basin__marker" title="Whoever takes from the centre first takes this, and starts the next round">
          <FirstMarker className="basin__tile" />
        </span>
      ) : null}
      {counts.length === 0 ? (
        <span className="basin__empty">
          {hasFirst
            ? 'Take from here first and this marker is yours — a point, and the next round.'
            : 'Leftovers slide in here.'}
        </span>
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
  scores,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  scores: number[]
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
                  <span className="seat__meta seat__meta--gold">starts next</span>
                ) : null}
              </span>
              <span className="seat__score">{scores[index] ?? player.score}</span>
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
            <div className={`result__row ${won ? 'result__row--winner' : ''}`} key={report.playerIndex}>
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
