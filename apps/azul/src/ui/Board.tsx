/**
 * One player's board: pattern lines on the left, the wall on the right, the
 * floor beneath both.
 *
 * Three things carry most of the design's weight here.
 *
 * The **pounce**: every untiled wall space shows the pricked outline of the
 * motif that belongs to it, so the wall's pattern is legible before a tile
 * lands and a new player never has to be told the rule.
 *
 * The **reckoning**: a line you could play shows what it would actually earn —
 * `+4` if it fires this round, `−2` for the tiles that will not fit. Nobody
 * should have to count runs in their head to know what a click costs.
 *
 * The **hierarchy**: your own board is the one full-size, full-contrast object
 * on the page. Everyone else's is compact and quieter, because you glance at
 * theirs and live in yours.
 */

import type { LinePreview } from '../engine/preview'
import { bonusProgress } from '../engine/preview'
import type { Color, PlayerState } from '../engine/types'
import { FLOOR_PENALTIES, FLOOR_SIZE, WALL_SIZE, wallColor } from '../engine/types'
import { FirstMarker, Tile } from './Tile'
import { flightId } from './useFlight'

export interface PendingPlacement {
  color: Color
  /** How many tiles the player is holding. */
  count: number
  /** Pattern lines this handful may legally go to. */
  legal: Set<number>
  /** Why a line is refused, for the ones that are. */
  refusals: Record<number, string>
  /** What each legal line would earn and cost. */
  previews: Record<number, LinePreview>
  /** What dropping the whole handful on the floor would cost. */
  floorPreview: LinePreview
}

export interface ScoringView {
  /** Wall spaces not yet revealed, keyed `seat:row-col`. */
  hidden: Set<string>
  /** Spaces revealed by the firing under way, for the kiln flash. */
  revealed: Set<string>
  /** The tile being counted, if it is this player's. */
  counting: { row: number; col: number; points: number } | null
}

export interface BoardProps {
  player: PlayerState
  seat: number
  /** True for the board belonging to this browser. */
  mine: boolean
  /** True when it is this player's turn. */
  active: boolean
  /** Smaller and quieter — used for everyone but you. */
  compact?: boolean
  /** Set while this player is choosing where to put a handful of tiles. */
  pending?: PendingPlacement
  scoring?: ScoringView
  /** Score to show, which during a firing counts up rather than jumping. */
  score?: number
  onPlace?: (line: number) => void
  badge?: string
}

export function Board({
  player,
  seat,
  mine,
  active,
  compact = false,
  pending,
  scoring,
  score,
  onPlace,
  badge,
}: BoardProps) {
  const progress = bonusProgress(player)
  const shown = score ?? player.score

  return (
    <section
      className={`panel board ${mine ? 'board--mine' : ''} ${compact ? 'board--compact' : ''} ${
        active ? 'board--active' : ''
      }`}
      aria-label={`${player.name}'s board`}
    >
      <header className="board__head">
        <h3 className="board__name">
          {player.name}
          {badge ? <span className="board__badge">{badge}</span> : null}
        </h3>
        <span className="board__score" aria-label={`${shown} points`}>
          {shown}
        </span>
      </header>

      <div className="board__grid">
        <div className="lines">
          {player.lines.map((line, index) => (
            <PatternLine
              key={index}
              seat={seat}
              index={index}
              line={line}
              pending={pending}
              onPlace={onPlace}
            />
          ))}
        </div>

        <div className="wall" role="grid" aria-label="Wall">
          {player.wall.map((row, r) =>
            row.map((filled, c) => {
              const color = wallColor(r, c)
              const id = `${seat}:${r}-${c}`
              const held = scoring?.hidden.has(id) ?? false
              const isFilled = filled && !held
              const counting = scoring?.counting?.row === r && scoring.counting.col === c
              return (
                <div
                  className={`wall__cell ${counting ? 'wall__cell--counting' : ''}`}
                  key={id}
                  role="gridcell"
                >
                  <Tile
                    color={color}
                    pounce={!isFilled}
                    fresh={isFilled && (scoring?.revealed.has(id) ?? false)}
                    title={
                      isFilled
                        ? `${color} tiled at row ${r + 1}, column ${c + 1}`
                        : `space for ${color}, row ${r + 1}, column ${c + 1}`
                    }
                  />
                  {counting ? (
                    <span className="wall__points">+{scoring!.counting!.points}</span>
                  ) : null}
                </div>
              )
            }),
          )}
        </div>
      </div>

      <FloorLine seat={seat} floor={player.floor} pending={pending} onPlace={onPlace} />

      {compact ? null : (
        <p className="board__progress">
          {progress.rows} rows · {progress.columns} columns · {progress.colors} colours
          {progress.nearestRow
            ? ` · row ${progress.nearestRow.row + 1} wants ${progress.nearestRow.missing}`
            : ''}
        </p>
      )}
    </section>
  )
}

function PatternLine({
  seat,
  index,
  line,
  pending,
  onPlace,
}: {
  seat: number
  index: number
  line: PlayerState['lines'][number]
  pending?: PendingPlacement
  onPlace?: (line: number) => void
}) {
  const capacity = index + 1
  const playable = pending?.legal.has(index) ?? false
  const refusal = pending?.refusals[index]
  const preview = pending?.previews[index]

  const slots = Array.from({ length: capacity }, (_, slot) => {
    // Lines fill from the right, so the filled slots are the last ones.
    const filled = slot >= capacity - line.count
    const willFill =
      playable &&
      !filled &&
      slot >= capacity - line.count - Math.min(pending!.count, capacity - line.count)
    const name = `slot:${seat}:${index}:${slot}`
    if (filled && line.color) {
      return <Tile key={slot} flight={name} color={line.color} className="slot" />
    }
    if (willFill && pending) {
      return <Tile key={slot} flight={name} color={pending.color} className="slot" pounce />
    }
    return <span key={slot} {...flightId(name)} className="slot" />
  })

  const reckoning = preview ? (
    <span className="line__reckoning">
      {preview.completes ? <b className="line__gain">+{preview.points}</b> : null}
      {preview.penalty < 0 ? <b className="line__cost">{preview.penalty}</b> : null}
      {!preview.completes && preview.penalty === 0 ? (
        <span className="line__wait">{capacity - line.count - pending!.count} short</span>
      ) : null}
    </span>
  ) : null

  const label = playable
    ? `Line ${capacity}: ${preview?.completes ? `fires for ${preview.points}` : 'stays short'}${
        preview && preview.penalty < 0 ? `, ${preview.overflow} to the floor for ${preview.penalty}` : ''
      }`
    : refusal

  if (!playable) {
    return (
      <div className={`line ${pending ? 'line--refused' : ''}`} title={pending ? refusal : undefined}>
        {slots}
      </div>
    )
  }

  return (
    <button type="button" className="line line--playable" onClick={() => onPlace?.(index)} title={label} aria-label={label}>
      {slots}
      {reckoning}
    </button>
  )
}

function FloorLine({
  seat,
  floor,
  pending,
  onPlace,
}: {
  seat: number
  floor: PlayerState['floor']
  pending?: PendingPlacement
  onPlace?: (line: number) => void
}) {
  const preview = pending?.floorPreview
  const content = (
    <div className="floor">
      {Array.from({ length: FLOOR_SIZE }, (_, i) => {
        const tile = floor[i]
        const incoming = preview ? i >= floor.length && i < floor.length + preview.overflow : false
        return (
          <div
            key={i}
            className={`floor__slot ${tile ? 'floor__slot--taken' : ''} ${
              incoming ? 'floor__slot--incoming' : ''
            }`}
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
  )

  if (!pending) return content
  return (
    <button
      type="button"
      className="floor--playable"
      onClick={() => onPlace?.(-1)}
      aria-label={`Drop all ${pending.count} on the floor for ${preview?.penalty ?? 0}`}
      title={`Drop all ${pending.count} on the floor`}
    >
      {content}
      <span className="line__reckoning">
        <b className="line__cost">{preview?.penalty ?? 0}</b>
      </span>
    </button>
  )
}

/** A miniature of a wall, used on the home screen. */
export function WallSampler() {
  return (
    <div className="hero__panel" aria-hidden="true">
      {Array.from({ length: WALL_SIZE }, (_, r) =>
        Array.from({ length: WALL_SIZE }, (_, c) => {
          const color: Color = wallColor(r, c)
          // Part of the wall is fired and the rest is still pounce, spread so
          // that every glaze shows up at least once.
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
