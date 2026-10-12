/**
 * A player's board, drawn as a chart: pattern lines with their reckoning, the
 * wall, and the floor as the ruler it actually is.
 *
 * Three sizes of tile, on purpose. The pattern lines are where you act, so
 * they are the largest; the wall is what you read, a step smaller; the
 * displays are what you choose from at a glance, smaller still. Size tracks
 * how closely each thing needs to be looked at.
 *
 * Your board is the one full-size object on the page. Everyone else's is a
 * compact card: enough to see what they are collecting and how their wall is
 * shaping, without competing with yours.
 */

import type { LinePreview } from '../engine/preview'
import { bonusProgress } from '../engine/preview'
import type { Color, PlayerState } from '../engine/types'
import { FLOOR_PENALTIES, FLOOR_SIZE, WALL_SIZE, wallColor } from '../engine/types'
import { FirstMarker, Tile } from './Tile'
import { flightId } from './useFlight'

export interface PendingPlacement {
  color: Color
  count: number
  legal: Set<number>
  refusals: Record<number, string>
  previews: Record<number, LinePreview>
  floorPreview: LinePreview
}

export interface ScoringView {
  /** Wall spaces fired this round but not shown yet, keyed `seat:row-col`. */
  pending: Set<string>
  /** Wall spaces fired this round and already shown, for the landing. */
  fired: Set<string>
  /** The tile being counted, if it is on this board. */
  counting: { row: number; col: number; points: number } | null
  /** This board is the one being scored right now. */
  focus: boolean
  /**
   * Pattern rows still holding their tiles: row -> colour. A complete line
   * stays full until its own wall tile fires, so the stack empties one tile
   * at a time as each piece travels to the wall — never all at once up front.
   */
  holds?: Map<number, Color>
}

export interface BoardProps {
  player: PlayerState
  seat: number
  mine: boolean
  active: boolean
  compact?: boolean
  pending?: PendingPlacement
  scoring?: ScoringView
  score?: number
  /** Short status words for the eyebrow, e.g. "house" or "away". */
  badge?: string
  /** Show the beginner's aids: previews, the reckoning, bonus progress, points as they fire. */
  learning?: boolean
  onPlace?: (line: number) => void
}

export function Board(props: BoardProps) {
  return props.compact ? <CompactBoard {...props} /> : <FullBoard {...props} />
}

function eyebrow({ seat, mine, active, badge }: BoardProps): string {
  const parts = [`Seat ${String(seat + 1).padStart(2, '0')}`]
  if (mine) parts.push('you')
  if (badge) parts.push(badge)
  if (active) parts.push('to play')
  return parts.join(' · ')
}

function FullBoard(props: BoardProps) {
  const { player, seat, active, pending, scoring, score, onPlace, learning = true } = props
  const progress = bonusProgress(player)
  const shown = score ?? player.score
  const penalty = FLOOR_PENALTIES.slice(0, player.floor.length).reduce((a, b) => a + b, 0)

  return (
    <section
      className={[
        'board',
        'board--mine',
        learning ? 'board--learning' : '',
        active ? 'board--active' : '',
        scoring?.focus ? 'board--scoring' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${player.name}'s board`}
      {...flightId(`board:${seat}`)}
    >
      <header className="board__head">
        <div className="board__title">
          <span className="eyebrow eyebrow--signal">{eyebrow(props)}</span>
          <h3 className="board__name">{player.name}</h3>
        </div>
        <div className="board__tally">
          {learning ? (
          <span className="board__progress">
            rows {progress.rows} · cols {progress.columns} · sets {progress.colors}
            {progress.nearestRow ? (
              <>
                <br />
                row {progress.nearestRow.row + 1} wants {progress.nearestRow.missing}
              </>
            ) : null}
          </span>
          ) : null}
          <span className="board__score" aria-label={`${shown} points`}>
            {shown}
          </span>
        </div>
      </header>

      <div className="board__body">
        <div className="board__left">
          <div className="lines">
            {player.lines.map((line, index) => (
              <PatternLine
                key={index}
                seat={seat}
                index={index}
                line={line}
                pending={pending}
                learning={learning}
                onPlace={onPlace}
                hold={scoring?.holds?.get(index)}
              />
            ))}
          </div>
          <FloorRuler
            seat={seat}
            floor={player.floor}
            pending={pending}
            penalty={penalty}
            learning={learning}
            onPlace={onPlace}
          />
        </div>
        <Wall player={player} seat={seat} scoring={scoring} learning={learning} />
      </div>
    </section>
  )
}

function CompactBoard(props: BoardProps) {
  const { player, seat, active, scoring, score, learning = true } = props
  const shown = score ?? player.score
  const penalty = FLOOR_PENALTIES.slice(0, player.floor.length).reduce((a, b) => a + b, 0)
  return (
    <section
      className={['board', 'board--compact', active ? 'board--active' : '', scoring?.focus ? 'board--scoring' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${player.name}'s board`}
      {...flightId(`board:${seat}`)}
    >
      <div className="board__title">
        <span className={`eyebrow ${active ? 'eyebrow--signal' : ''}`}>{eyebrow(props)}</span>
        <h3 className="board__name board__name--small">{player.name}</h3>
        <span className="board__score board__score--small">{shown}</span>
        <span className="eyebrow">
          floor {penalty === 0 ? '0' : penalty}
          {player.floor.includes('first') ? ' · starts next' : ''}
        </span>
      </div>
      <div className="board__body board__body--compact">
        <div className="lines lines--compact" aria-label="Pattern lines">
          {player.lines.map((line, index) => {
            const hold = scoring?.holds?.get(index)
            const shownLine = hold ? { color: hold, count: index + 1 } : line
            return (
            <div className="line line--compact" key={index}>
              {Array.from({ length: index + 1 }, (_, slot) => {
                const filled = slot >= index + 1 - shownLine.count
                const name = `slot:${seat}:${index}:${slot}`
                return filled && shownLine.color ? (
                  <Tile key={slot} flight={name} color={shownLine.color} className="slot" />
                ) : (
                  <span key={slot} {...flightId(name)} className="slot" />
                )
              })}
            </div>
            )
          })}
        </div>
        <Wall player={player} seat={seat} scoring={scoring} learning={learning} />
      </div>
      {/* Floor slots exist for flights to land in, even though they are not drawn. */}
      <div className="floor-anchors" aria-hidden="true">
        {Array.from({ length: FLOOR_SIZE }, (_, i) => (
          <span key={i} {...flightId(`floor:${seat}:${i}`)} />
        ))}
      </div>
    </section>
  )
}

function Wall({
  player,
  seat,
  scoring,
  learning,
}: {
  player: PlayerState
  seat: number
  scoring?: ScoringView
  learning: boolean
}) {
  return (
    <div className="wall" role="grid" aria-label="Wall">
      {player.wall.map((row, r) =>
        row.map((filled, c) => {
          const color = wallColor(r, c)
          const id = `${seat}:${r}-${c}`
          const shown = filled && !(scoring?.pending.has(id) ?? false)
          const counting = scoring?.counting?.row === r && scoring.counting.col === c
          return (
            <div className={`wall__cell ${counting ? 'wall__cell--counting' : ''}`} key={id} role="gridcell">
              <Tile
                color={color}
                pounce={!shown}
                fresh={shown && (scoring?.fired.has(id) ?? false)}
                flight={`wall:${id}`}
                title={shown ? `${color}, row ${r + 1}, column ${c + 1}` : `space for ${color}, row ${r + 1}, column ${c + 1}`}
              />
              {counting && learning ? <span className="wall__points">+{scoring!.counting!.points}</span> : null}
            </div>
          )
        }),
      )}
    </div>
  )
}

function PatternLine({
  seat,
  index,
  line,
  pending,
  learning,
  onPlace,
  hold,
}: {
  seat: number
  index: number
  line: PlayerState['lines'][number]
  pending?: PendingPlacement
  learning: boolean
  onPlace?: (line: number) => void
  /** When scoring holds this row, show it full in this colour until its wall tile fires. */
  hold?: Color
}) {
  const capacity = index + 1
  // During scoring the post-tiling state is already empty; hold reconstructs
  // the pre-tiling full line until its own placement fires.
  const shownLine = hold ? { color: hold, count: capacity } : line
  const playable = pending?.legal.has(index) ?? false
  const refusal = pending?.refusals[index]
  const preview = pending?.previews[index]
  const willTake = pending ? Math.min(pending.count, capacity - shownLine.count) : 0

  const slots = Array.from({ length: capacity }, (_, slot) => {
    const filled = slot >= capacity - shownLine.count
    const incoming = learning && playable && !filled && slot >= capacity - shownLine.count - willTake
    const name = `slot:${seat}:${index}:${slot}`
    if (filled && shownLine.color) return <Tile key={slot} flight={name} color={shownLine.color} className="slot" />
    if (incoming && pending) {
      return <Tile key={slot} flight={name} color={pending.color} className="slot slot--incoming" pounce />
    }
    return <span key={slot} {...flightId(name)} className="slot" />
  })

  // The reckoning: what this line would earn, what spills would cost, or how
  // far short it would stay. Said before the click, in its own lane.
  let reckoning: React.ReactNode = <span className="reckon reckon--idle">—</span>
  if (!learning) {
    reckoning = null
  } else if (preview) {
    reckoning = (
      <span className="reckon">
        {preview.completes ? <b className="reckon--gain">+{preview.points}</b> : null}
        {preview.penalty < 0 ? <b className="reckon--cost">{preview.penalty}</b> : null}
        {!preview.completes && preview.penalty === 0 ? (
          <span className="reckon--short">{capacity - shownLine.count - pending!.count} short</span>
        ) : null}
      </span>
    )
  }

  const label = playable && !learning
    ? `Line ${capacity}`
    : playable
    ? `Line ${capacity}: ${preview?.completes ? `fires for ${preview.points}` : 'stays short'}${
        preview && preview.penalty < 0 ? `, ${preview.overflow} to the floor for ${preview.penalty}` : ''
      }`
    : (refusal ?? `Line ${capacity}`)

  const content = (
    <>
      <span className="line__reckoning">{reckoning}</span>
      <span className="line__slots">{slots}</span>
      <span className="line__index">{capacity}</span>
    </>
  )

  if (!playable) {
    return (
      <div className={`line ${pending ? 'line--refused' : ''}`} title={pending ? refusal : undefined}>
        {content}
      </div>
    )
  }
  return (
    <button type="button" className="line line--playable" onClick={() => onPlace?.(index)} title={label} aria-label={label}>
      {content}
    </button>
  )
}

function FloorRuler({
  seat,
  floor,
  pending,
  penalty,
  learning,
  onPlace,
}: {
  seat: number
  floor: PlayerState['floor']
  pending?: PendingPlacement
  penalty: number
  learning: boolean
  onPlace?: (line: number) => void
}) {
  const preview = learning ? pending?.floorPreview : undefined
  const ruler = (
    <div className="floor">
      <div className="floor__label">
        <span className="eyebrow">Floor</span>
        <span className={`eyebrow ${penalty < 0 ? 'eyebrow--cost' : ''}`}>
          {penalty < 0 ? `${penalty} this round` : 'clean'}
        </span>
      </div>
      <div className="floor__ruler">
        {Array.from({ length: FLOOR_SIZE }, (_, i) => {
          const tile = floor[i]
          const incoming = preview ? i >= floor.length && i < floor.length + preview.overflow : false
          return (
            <div
              key={i}
              className={['floor__slot', tile ? 'floor__slot--taken' : '', incoming ? 'floor__slot--incoming' : '']
                .filter(Boolean)
                .join(' ')}
              {...flightId(`floor:${seat}:${i}`)}
            >
              <span className="floor__cost">{FLOOR_PENALTIES[i]}</span>
              {tile === 'first' ? (
                <FirstMarker className="floor__box" />
              ) : tile ? (
                <Tile color={tile} className="floor__box" />
              ) : (
                <span className="floor__box" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (!pending) return ruler
  return (
    <button
      type="button"
      className="floor--playable"
      onClick={() => onPlace?.(-1)}
      aria-label={
        preview ? `Drop all ${pending.count} on the floor for ${preview.penalty}` : `Drop all ${pending.count} on the floor`
      }
      title={`Drop all ${pending.count} on the floor (key 0)`}
    >
      {ruler}
    </button>
  )
}

/** A miniature wall for the home screen: some spaces fired, the rest unfired. */
export function WallSampler() {
  return (
    <div className="hero__panel" aria-hidden="true">
      {Array.from({ length: WALL_SIZE }, (_, r) =>
        Array.from({ length: WALL_SIZE }, (_, c) => {
          const color: Color = wallColor(r, c)
          const fired = (r + 2 * c) % WALL_SIZE < 2
          return (
            <div className="hero__cell" key={`${r}-${c}`}>
              <Tile color={color} pounce={!fired} />
            </div>
          )
        }),
      )}
    </div>
  )
}
