/**
 * One player's board: pattern lines on the left, the wall on the right, the
 * floor beneath both.
 *
 * The wall is the piece worth looking at. Every space that has not been tiled
 * shows the pounce — the pricked outline of the motif that belongs there — so
 * the pattern is legible before a single tile lands, and a player can see
 * where a colour is going without being told the rule.
 */

import type { Color, PlayerState } from '../engine/types'
import { FLOOR_PENALTIES, FLOOR_SIZE, WALL_SIZE, wallColor } from '../engine/types'
import { FirstMarker, Tile } from './Tile'

export interface PendingPlacement {
  color: Color
  /** How many tiles the player is holding. */
  count: number
  /** Pattern lines this handful may legally go to. */
  legal: Set<number>
  /** Why a line is refused, for the ones that are. */
  refusals: Record<number, string>
}

export interface BoardProps {
  player: PlayerState
  /** True for the board belonging to this browser. */
  mine: boolean
  /** True when it is this player's turn. */
  active: boolean
  /** Set while this player is choosing where to put a handful of tiles. */
  pending?: PendingPlacement
  /** Wall spaces filled by the most recent wall-tiling, for the kiln flash. */
  fresh?: Set<string>
  onPlace?: (line: number) => void
  badge?: string
}

export function Board({ player, mine, active, pending, fresh, onPlace, badge }: BoardProps) {
  return (
    <section className={`panel board ${mine ? 'board--mine' : ''}`} aria-label={`${player.name}'s board`}>
      <header className="board__head">
        <h3 className="board__name">
          {player.name}
          {badge ? <span className="board__badge">{badge}</span> : null}
          {active ? <span className="board__badge">to play</span> : null}
        </h3>
        <span className="board__score">{player.score}</span>
      </header>

      <div className="board__grid">
        <div className="lines">
          {player.lines.map((line, index) => {
            const capacity = index + 1
            const playable = pending?.legal.has(index) ?? false
            const refusal = pending?.refusals[index]
            const overflow = pending ? Math.max(0, pending.count - (capacity - line.count)) : 0
            const label = playable
              ? `Put ${pending!.count} on line ${capacity}` +
                (overflow > 0 ? `, ${overflow} to the floor` : '')
              : refusal

            const slots = Array.from({ length: capacity }, (_, slot) => {
              // Lines fill from the right, so the filled slots are the last ones.
              const filled = slot >= capacity - line.count
              const previewed =
                playable &&
                !filled &&
                slot >= capacity - line.count - Math.min(pending!.count, capacity - line.count)
              if (filled && line.color) {
                return <Tile key={slot} color={line.color} className="slot" />
              }
              if (previewed && pending) {
                return <Tile key={slot} color={pending.color} className="slot" pounce />
              }
              return <span key={slot} className="slot" />
            })

            return playable ? (
              <button
                key={index}
                type="button"
                className="line line--playable"
                onClick={() => onPlace?.(index)}
                title={label}
                aria-label={label}
              >
                {slots}
              </button>
            ) : (
              <div
                key={index}
                className={`line ${pending ? 'line--refused' : ''}`}
                title={pending ? refusal : undefined}
              >
                {slots}
              </div>
            )
          })}
        </div>

        <div className="wall" role="grid" aria-label="Wall">
          {player.wall.map((row, r) =>
            row.map((filled, c) => {
              const color = wallColor(r, c)
              return (
                <div className="wall__cell" key={`${r}-${c}`} role="gridcell">
                  <Tile
                    color={color}
                    pounce={!filled}
                    fresh={filled && fresh?.has(`${r}-${c}`)}
                    title={
                      filled
                        ? `${color} tiled at row ${r + 1}, column ${c + 1}`
                        : `space for ${color}, row ${r + 1}, column ${c + 1}`
                    }
                  />
                </div>
              )
            }),
          )}
        </div>
      </div>

      <FloorLine
        floor={player.floor}
        pending={pending}
        onPlace={onPlace}
      />
    </section>
  )
}

function FloorLine({
  floor,
  pending,
  onPlace,
}: {
  floor: PlayerState['floor']
  pending?: PendingPlacement
  onPlace?: (line: number) => void
}) {
  const playable = Boolean(pending)
  const content = (
    <div className="floor">
      {Array.from({ length: FLOOR_SIZE }, (_, i) => {
        const tile = floor[i]
        return (
          <div key={i} className={`floor__slot ${tile ? 'floor__slot--taken' : ''}`}>
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

  if (!playable) return content
  return (
    <button
      type="button"
      className="floor--playable"
      onClick={() => onPlace?.(-1)}
      aria-label={`Drop all ${pending!.count} tiles on the floor`}
      title={`Drop all ${pending!.count} on the floor`}
    >
      {content}
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
