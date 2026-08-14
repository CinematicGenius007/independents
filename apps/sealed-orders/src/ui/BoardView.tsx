import { CENTRE, coords, SIZE, type Board } from '../engine/board'
import type { Position, Side, Step } from '../engine/rules'

interface Props {
  board: Board
  position: Position
  you: Side
  /** The route the orders being written would take, for a live preview. */
  preview?: readonly number[]
}

const CELL = 44
const PAD = 6

export function BoardView({ board, position, you, preview = [] }: Props) {
  const span = SIZE * CELL + PAD * 2

  return (
    <svg viewBox={`0 0 ${span} ${span}`} className="board" role="img" aria-label="the well field">
      {board.walls.map((wall, cell) => {
        const { x, y } = coords(cell)
        return (
          <rect
            key={cell}
            x={PAD + x * CELL}
            y={PAD + y * CELL}
            width={CELL - 2}
            height={CELL - 2}
            rx={4}
            className={wall ? 'cell wall' : 'cell'}
          />
        )
      })}

      {board.wells.map((well) => {
        const { x, y } = coords(well)
        const owner = position.claims[well]
        const deep = well === CENTRE
        return (
          <g key={well} className={`well${owner === undefined ? '' : owner === you ? ' mine' : ' theirs'}`}>
            <circle
              cx={PAD + x * CELL + CELL / 2 - 1}
              cy={PAD + y * CELL + CELL / 2 - 1}
              r={deep ? 15 : 12}
            />
            {deep && (
              <circle
                cx={PAD + x * CELL + CELL / 2 - 1}
                cy={PAD + y * CELL + CELL / 2 - 1}
                r={8}
                className="deep"
              />
            )}
          </g>
        )
      })}

      {preview.map((cell, step) => {
        const { x, y } = coords(cell)
        return (
          <circle
            key={`${cell}-${step}`}
            cx={PAD + x * CELL + CELL / 2 - 1}
            cy={PAD + y * CELL + CELL / 2 - 1}
            r={4}
            className="ghost-step"
          />
        )
      })}

      {([0, 1] as Side[]).map((side) => {
        const { x, y } = coords(position.pieces[side])
        return (
          <g key={side} className={`piece${side === you ? ' mine' : ' theirs'}`}>
            <rect
              x={PAD + x * CELL + 9}
              y={PAD + y * CELL + 9}
              width={CELL - 20}
              height={CELL - 20}
              rx={side === you ? 3 : 11}
            />
          </g>
        )
      })}
    </svg>
  )
}

/** Where a set of steps would take a piece, for the preview trail. */
export function routeOf(board: Board, from: number, steps: readonly Step[]): number[] {
  const route: number[] = []
  let at = from
  for (const step of steps) {
    const { x, y } = coords(at)
    const dx = step === 'E' ? 1 : step === 'W' ? -1 : 0
    const dy = step === 'S' ? 1 : step === 'N' ? -1 : 0
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !board.walls[ny * SIZE + nx]) at = ny * SIZE + nx
    route.push(at)
  }
  return route
}
