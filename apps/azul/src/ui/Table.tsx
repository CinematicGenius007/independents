/**
 * The table in play, laid out like the chart it is drawn as.
 *
 * Main column: the displays, the centre, and your board — everything you act
 * on. Side column: the key, the standings with each player's score track, and
 * everyone else's board — everything you read. The status line sits at the
 * foot of the screen and never scrolls away.
 *
 * A turn is two clicks, and every line you could play says what it would earn
 * and cost before you commit. Every move, yours or not, flies its tiles to
 * where they land. Every round's scoring is played out a tile and a point at
 * a time, each point carried to its owner's track.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Color, GameState, Move } from '../engine/types'
import { CENTER, COLORS, FLOOR, WALL_SIZE, wallColor } from '../engine/types'
import { moveError, needsDeal } from '../engine/rules'
import { previewFloor, previewLine } from '../engine/preview'
import type { LinePreview } from '../engine/preview'
import { PIP_FLIGHT_MS } from '../engine/timeline'
import type { TimelineEvent } from '../engine/timeline'
import type { Seat } from '../net/protocol'
import type { LastMove } from '../net/session'
import { Board, ScoreTrack } from './Board'
import type { PendingPlacement, ScoringView } from './Board'
import { COLOR_NAMES, FirstMarker, GLAZES, Tile } from './Tile'
import { useScoring } from './useScoring'
import { flightId, flyPiece, prefersReducedMotion, useFlight } from './useFlight'
import { play, playDebit, playPoint, playScore } from './audio'

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
  const pointsInTile = useRef(0)

  // Each scoring event, as the clock passes it: the tile lands, then each of
  // its points is carried to the owner's track, each with its own small sound.
  const onScoringEvent = (event: TimelineEvent) => {
    const node = root.current
    if (event.kind === 'place') {
      pointsInTile.current = 0
      playScore(event.points)
      return
    }
    if (event.kind === 'bonus') {
      pointsInTile.current = 0
      play('turn')
      return
    }
    if (event.kind === 'focus' || !node) return
    if (event.delta > 0) {
      const from =
        event.source.kind === 'wall'
          ? `wall:${event.seat}:${event.source.row}-${event.source.col}`
          : `board:${event.seat}`
      const tint =
        event.source.kind === 'wall' ? GLAZES[wallColor(event.source.row, event.source.col)] : 'var(--ink)'
      flyPiece(node, {
        from,
        to: `pip:${event.seat}:${(event.scoreAfter - 1) % 100}`,
        tint,
        duration: PIP_FLIGHT_MS,
        size: 10,
      })
      playPoint(pointsInTile.current++)
    } else {
      flyPiece(node, {
        from: `pip:${event.seat}:${event.scoreAfter % 100}`,
        to: `floor:${event.seat}:0`,
        tint: 'var(--cost)',
        duration: PIP_FLIGHT_MS,
        size: 10,
      })
      playDebit()
    }
  }

  const scoring = useScoring(state, onScoringEvent)

  // On a narrow screen the board being scored can be below the fold, and then
  // the whole point — watching the pieces travel — happens out of sight. Bring
  // it into view, but only when it is actually off screen.
  const focusSeat = scoring.frame.focus
  useEffect(() => {
    if (focusSeat === null) return
    const board = root.current?.querySelector<HTMLElement>(`[data-flight="board:${focusSeat}"]`)
    if (!board) return
    const box = board.getBoundingClientRect()
    const offscreen = box.bottom < 0 || box.top > window.innerHeight - 80
    if (offscreen) board.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [focusSeat])
  const myTurn =
    seatIndex !== null && state.current === seatIndex && state.phase === 'offer' && !scoring.running

  // A pick belongs to one position; anything that changes the table drops it.
  useEffect(() => {
    setPick(null)
  }, [state.round, state.current, state.phase])

  const pending = useMemo<PendingPlacement | undefined>(() => {
    if (!pick || !myTurn || seatIndex === null) return undefined
    const pile = pick.source === CENTER ? state.center : state.factories[pick.source]
    const count = pile.filter(t => t === pick.color).length
    const player = state.players[seatIndex]
    // Taking the marker costs a floor slot too, and the reckoning says so.
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
    return { color: pick.color, count, legal, refusals, previews, floorPreview: previewFloor(player, count, marker) }
  }, [pick, myTurn, seatIndex, state])

  // Fly the handful from its pile to the slots it lands in, worked out against
  // the previous position — the only place the pile was still full.
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
        to.push(`slot:${seat}:${played.line}:${capacity - player.lines[played.line].count - 1 - i}`)
      }
      const claimed = played.source === CENTER && before.centerHasFirst ? 1 : 0
      let floorSlot = player.floor.length + claimed
      for (let i = 0; i < taken - placed && floorSlot < 7; i++, floorSlot++) to.push(`floor:${seat}:${floorSlot}`)
      if (to.length === 0) return null
      return { request: { color: played.color, from: `pile:${played.source}`, to }, tint: GLAZES[played.color] }
    },
    root,
  )

  useEffect(() => {
    previous.current = state
  }, [state])

  // Sounds for things that happen on the table rather than in scoring.
  const heard = useRef(0)
  useEffect(() => {
    if (!lastMove || lastMove.serial === heard.current) return
    heard.current = lastMove.serial
    play(lastMove.move.line === FLOOR ? 'floor' : 'place')
  }, [lastMove])

  const wasMyTurn = useRef(false)
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) play('turn')
    wasMyTurn.current = myTurn
  }, [myTurn])

  const finished = state.phase === 'over' && !scoring.running
  useEffect(() => {
    if (finished) play('finish')
  }, [finished])

  const place = (line: number) => {
    if (!pick) return
    onPlay({ source: pick.source, color: pick.color, line })
    setPick(null)
  }

  // Number keys place, 0 floors, Escape puts the handful back; space skips
  // the scoring playback once you have seen enough.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'Escape') return setPick(null)
      if (scoring.running && event.key === ' ') {
        event.preventDefault()
        return scoring.skip()
      }
      if (!pending) return
      if (event.key === '0') return place(FLOOR)
      const line = Number(event.key) - 1
      if (Number.isInteger(line) && pending.legal.has(line)) place(line)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const choose = (source: number, color: Color) => {
    play('pick')
    setPick({ source, color })
  }

  const scoringFor = (seat: number): ScoringView => ({
    pending: scoring.frame.pending,
    fired: scoring.frame.fired,
    counting:
      scoring.frame.current && scoring.frame.current.seat === seat
        ? { row: scoring.frame.current.row, col: scoring.frame.current.col, points: scoring.frame.current.points }
        : null,
    focus: scoring.frame.focus === seat,
  })

  const mine = seatIndex === null ? null : state.players[seatIndex]
  const others = state.players.map((player, index) => ({ player, index })).filter(p => p.index !== seatIndex)
  const activeDisplays = state.factories.filter(f => f.length > 0).length

  return (
    <div className="table" ref={root}>
      <div className="table__main">
        <section className="module" aria-label="The displays and the centre">
          <header className="module__head">
            <span className="eyebrow">Displays · {String(activeDisplays).padStart(2, '0')} active</span>
            <span className="eyebrow eyebrow--faint">Take all of one glaze</span>
          </header>
          <div className="displays">
            {state.factories.map((display, index) => (
              <Display
                key={index}
                index={index}
                tiles={display}
                pick={pick}
                enabled={myTurn}
                onPick={color => choose(index, color)}
              />
            ))}
          </div>
          <Centre
            tiles={state.center}
            hasFirst={state.centerHasFirst}
            pick={pick}
            enabled={myTurn}
            onPick={color => choose(CENTER, color)}
          />
        </section>

        {mine ? (
          <Board
            player={mine}
            seat={seatIndex!}
            mine
            active={state.current === seatIndex && state.phase === 'offer' && !scoring.running}
            pending={pending}
            scoring={scoringFor(seatIndex!)}
            score={scoring.scores[seatIndex!]}
            onPlace={line => place(line === -1 ? FLOOR : line)}
          />
        ) : null}
      </div>

      <aside className="table__side">
        <GlazeKey />
        <Standings
          state={state}
          seats={seats}
          seatIndex={seatIndex}
          scores={scoring.scores}
          focus={scoring.frame.focus}
          counting={scoring.running}
        />
        {finished ? <Result state={state} /> : null}
        {others.map(({ player, index }) => (
          <Board
            key={player.id}
            player={player}
            seat={index}
            mine={false}
            compact
            active={state.current === index && state.phase === 'offer' && !scoring.running}
            scoring={scoringFor(index)}
            score={scoring.scores[index]}
            badge={seats[index]?.kind === 'bot' ? 'house' : seats[index]?.present ? undefined : 'away'}
          />
        ))}
      </aside>

      <StatusBar
        state={state}
        seats={seats}
        seatIndex={seatIndex}
        pick={pick}
        pending={pending}
        notice={notice}
        scoring={scoring}
      />
    </div>
  )
}

// ------------------------------------------------------------ the displays

function Display({
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
  const held = pick?.source === index
  return (
    <div className={`display ${held ? 'display--held' : ''}`}>
      <div className={`ring ${tiles.length === 0 ? 'ring--empty' : ''}`} {...flightId(`pile:${index}`)}>
        {tiles.length > 0 ? (
          <div className="ring__tiles">
            {tiles.map((color, slot) => {
              const picked = held && pick?.color === color
              const count = tiles.filter(t => t === color).length
              return (
                <button
                  key={slot}
                  type="button"
                  className="pocket"
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
        ) : null}
      </div>
      <span className={`eyebrow ${held ? 'eyebrow--signal' : 'eyebrow--faint'}`}>
        D{index + 1}
        {held ? ' · held' : ''}
      </span>
    </div>
  )
}

function Centre({
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
  const groups = COLORS.map(color => ({ color, count: tiles.filter(t => t === color).length })).filter(g => g.count > 0)
  return (
    <div className="centre" {...flightId(`pile:${CENTER}`)}>
      <span className="eyebrow centre__label">Centre</span>
      {hasFirst ? <FirstMarker className="pocket-tile" /> : null}
      {groups.map(({ color, count }) =>
        Array.from({ length: count }, (_, i) => (
          <button
            key={`${color}-${i}`}
            type="button"
            className="pocket"
            data-picked={pick?.source === CENTER && pick.color === color}
            disabled={!enabled}
            onClick={() => onPick(color)}
            aria-label={`Take ${count} ${COLOR_NAMES[color]} from the centre${hasFirst ? ', and the starting marker' : ''}`}
            title={enabled ? `Take ${count} × ${COLOR_NAMES[color]}` : COLOR_NAMES[color]}
          >
            <Tile color={color} />
          </button>
        )),
      )}
      <span className="centre__hint">
        {groups.length === 0
          ? hasFirst
            ? 'Leftovers slide in here. The first hand taken from here carries the marker.'
            : 'Leftovers slide in here.'
          : hasFirst
            ? 'first hand taken from here carries the marker — and the next round'
            : ''}
      </span>
    </div>
  )
}

// ------------------------------------------------------------- side column

function GlazeKey() {
  return (
    <section className="module module--key" aria-label="Glaze key">
      <header className="module__head">
        <span className="eyebrow">Glaze key</span>
        <span className="eyebrow eyebrow--faint">Motif = glaze</span>
      </header>
      <div className="key">
        {COLORS.map(color => (
          <span className="key__item" key={color}>
            <Tile color={color} className="key__tile" />
            <span className="eyebrow eyebrow--faint">{COLOR_NAMES[color]}</span>
          </span>
        ))}
        <span className="key__item">
          <Tile color="cobalt" pounce className="key__tile" />
          <span className="eyebrow eyebrow--faint">Unfired</span>
        </span>
      </div>
    </section>
  )
}

function Standings({
  state,
  seats,
  seatIndex,
  scores,
  focus,
  counting,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  scores: number[]
  focus: number | null
  /** While scoring plays out, nobody is "to play" yet. */
  counting: boolean
}) {
  return (
    <section className="module" aria-label="Standings">
      <header className="module__head">
        <span className="eyebrow">Standings</span>
        <span className="eyebrow eyebrow--faint">Round {String(state.round).padStart(2, '0')}</span>
      </header>
      <div className="standings">
        {state.players.map((player, index) => {
          const seat = seats[index]
          const turn = state.current === index && state.phase === 'offer' && !counting
          const status =
            index === seatIndex && turn
              ? 'to play'
              : seat?.kind === 'bot'
                ? 'house'
                : seat && !seat.present
                  ? 'away'
                  : turn
                    ? 'to play'
                    : state.nextStarter === index && !state.centerHasFirst
                      ? 'starts next'
                      : ''
          return (
            <div
              key={player.id}
              className={['standing', turn ? 'standing--turn' : '', focus === index ? 'standing--scoring' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <span className={`standing__seat ${index === seatIndex ? 'eyebrow--signal' : ''}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="standing__name">
                {player.name}
                {index === seatIndex ? <span className="eyebrow eyebrow--signal"> you</span> : null}
              </span>
              <span className={`standing__status eyebrow ${status === 'to play' ? 'eyebrow--signal' : status === 'starts next' ? 'eyebrow--teal' : 'eyebrow--faint'}`}>
                {status}
              </span>
              <span className="standing__score">{scores[index] ?? player.score}</span>
              <ScoreTrack seat={index} score={scores[index] ?? player.score} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** The itemised end-of-game count, shown once the bonuses have been paid out. */
export function Result({ state }: { state: GameState }) {
  const reports = state.finalReports ?? []
  return (
    <section className="module" aria-label="Final count">
      <header className="module__head">
        <span className="eyebrow">Final count</span>
        <span className="eyebrow eyebrow--faint">rows · cols · sets</span>
      </header>
      <div className="result">
        {reports.map(report => {
          const player = state.players[report.playerIndex]
          const won = state.winners?.includes(report.playerIndex)
          return (
            <div className={`result__row ${won ? 'result__row--winner' : ''}`} key={report.playerIndex}>
              <span className="result__name">{player.name}</span>
              <span>+{report.rows * 2}</span>
              <span>+{report.columns * 7}</span>
              <span>+{report.colors * 10}</span>
              <span className="result__total">{report.scoreAfter}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// --------------------------------------------------------------- status bar

function StatusBar({
  state,
  seats,
  seatIndex,
  pick,
  pending,
  notice,
  scoring,
}: {
  state: GameState
  seats: Seat[]
  seatIndex: number | null
  pick: Pick | null
  pending?: PendingPlacement
  notice: string | null
  scoring: ReturnType<typeof useScoring>
}) {
  let tag = ''
  let tone: 'signal' | 'quiet' | 'warn' | 'win' = 'quiet'
  let text = ''
  let action: React.ReactNode = null

  if (notice) {
    tone = 'warn'
    tag = 'Refused'
    text = notice
  } else if (scoring.running) {
    const seat = scoring.frame.focus
    const name = seat !== null ? state.players[seat]?.name : null
    tag = state.phase === 'over' && scoring.frame.bonus ? 'Final count' : 'Firing'
    text = scoring.frame.bonus
      ? `${name}: ${scoring.frame.bonus.label} for +${scoring.frame.bonus.points}`
      : scoring.frame.current
        ? `${name}: a tile worth ${scoring.frame.current.points}`
        : name
          ? `${name}'s wall`
          : 'The walls'
    action = (
      <button type="button" className="button button--small" onClick={scoring.skip}>
        Skip <kbd>space</kbd>
      </button>
    )
  } else if (state.phase === 'over') {
    tone = 'win'
    const names = (state.winners ?? []).map(i => state.players[i].name)
    tag = 'Finished'
    text = names.length > 1 ? `${names.join(' and ')} share the wall.` : `${names[0]} takes the wall.`
  } else if (state.phase === 'tiling') {
    tag = 'Bare table'
    text = 'Into the kiln.'
  } else if (needsDeal(state)) {
    // Reached after skipping the count: the table waits for everyone else's
    // playback before dealing, so say so rather than claim it is your turn.
    tag = 'Between rounds'
    text = `Round ${state.round} is dealt once everyone has seen the count.`
  } else if (seatIndex === null) {
    tag = 'Watching'
    text = `${state.players[state.current].name} is choosing.`
  } else if (state.current !== seatIndex) {
    const seat = seats[state.current]
    tag = 'Waiting'
    text = `${state.players[state.current].name} is choosing${seat?.kind === 'bot' ? ' — watch the tiles travel' : ''}.`
  } else if (pick && pending) {
    tone = 'signal'
    tag = `Holding ${pending.count} × ${COLOR_NAMES[pick.color]}`
    text = 'Pick a line — number keys work — or 0 for the floor, Esc to put them back.'
  } else {
    tone = 'signal'
    tag = 'Your turn'
    text = 'Take every tile of one glaze from a display, or from the centre.'
  }

  return (
    <footer className={`status status--${tone}`} aria-live="polite">
      <span className="status__tag">{tag}</span>
      <span className="status__text">{text}</span>
      <span className="status__legend">
        {action ?? (
          <>
            <span className="eyebrow reckon--gain">+N earns if it fires</span>
            <span className="eyebrow reckon--cost">−N costs on the floor</span>
          </>
        )}
      </span>
    </footer>
  )
}
