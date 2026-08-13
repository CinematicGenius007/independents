import type { Belief } from '../engine/belief'
import type { Board } from '../engine/board'

interface Props {
  board: Board
  belief: Belief
  doomed: boolean
  shaking: boolean
}

/**
 * The fog is drawn as one ghost per possible position. As worlds merge, ghosts
 * disappear; when a single one is left it settles into a solid walker, which is
 * the moment the player is playing for.
 */
export function BoardView({ board, belief, doomed, shaking }: Props) {
  const present = new Set(belief)
  const settled = belief.length === 1

  return (
    <div className="board-wrap">
      <div
        className={`board${shaking ? ' shake' : ''}`}
        style={{ gridTemplateColumns: `repeat(${board.width}, var(--cell))` }}
        role="img"
        aria-label={`${belief.length} possible positions remain on a ${board.width} by ${board.height} maze`}
      >
        {board.cells.map((cell, index) => {
          const classes = ['cell', cell]
          if (index === board.goal) classes.push('goal')
          return (
            <div key={index} className={classes.join(' ')}>
              {present.has(index) && (
                <div
                  className={`ghost${settled ? ' settled' : ''}${doomed ? ' doomed' : ''}`}
                  style={{ opacity: settled ? 1 : Math.max(0.5, 1.6 / Math.sqrt(belief.length)) }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
