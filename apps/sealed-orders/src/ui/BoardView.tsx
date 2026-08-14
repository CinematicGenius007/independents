import { CENTRE, coords, SIZE, type Board } from '../engine/board'
import type { Position, Side, Step } from '../engine/rules'

interface Props {
  board: Board
  position: Position
  you: Side
  /** The route the orders being written would take, for a live preview. */
  preview?: readonly number[]
}

const CELL = 46
const PAD = 10

/**
 * The field, inked.
 *
 * The reference is a loose pen drawing over flat colour: one heavy black line
 * for everything that matters, flat fills with no shading, and edges that wobble
 * because a hand drew them. The wobble here is a displacement filter over the
 * whole board, which is enough to stop it reading as a spreadsheet.
 */
export function BoardView({ board, position, you, preview = [] }: Props) {
  const span = SIZE * CELL + PAD * 2

  return (
    <svg viewBox={`0 0 ${span} ${span}`} className="board" role="img" aria-label="the well field">
      <defs>
        <filter id="wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
        </filter>
      </defs>

      <g filter="url(#wobble)">
        <rect x={PAD - 4} y={PAD - 4} width={span - PAD * 2 + 8} height={span - PAD * 2 + 8} className="ground" />

        {board.walls.map((wall, cell) => {
          if (!wall) return null
          const { x, y } = coords(cell)
          return (
            <rect
              key={cell}
              x={PAD + x * CELL + 3}
              y={PAD + y * CELL + 3}
              width={CELL - 6}
              height={CELL - 6}
              className="rock"
            />
          )
        })}

        {Array.from({ length: SIZE + 1 }, (_, i) => (
          <g key={i} className="rule">
            <line x1={PAD} y1={PAD + i * CELL} x2={PAD + SIZE * CELL} y2={PAD + i * CELL} />
            <line x1={PAD + i * CELL} y1={PAD} x2={PAD + i * CELL} y2={PAD + SIZE * CELL} />
          </g>
        ))}

        {board.wells.map((well) => {
          const { x, y } = coords(well)
          const owner = position.claims[well]
          const deep = well === CENTRE
          const cx = PAD + x * CELL + CELL / 2
          const cy = PAD + y * CELL + CELL / 2
          return (
            <g
              key={well}
              className={`well${owner === undefined ? '' : owner === you ? ' mine' : ' theirs'}${deep ? ' deep' : ''}`}
            >
              <circle cx={cx} cy={cy} r={deep ? 17 : 14} />
              {deep && <circle cx={cx} cy={cy} r={9} className="deep-eye" />}
              {owner === undefined && <circle cx={cx} cy={cy} r={3} className="well-dot" />}
            </g>
          )
        })}

        {preview.map((cell, step) => {
          const { x, y } = coords(cell)
          return (
            <text
              key={`${cell}-${step}`}
              x={PAD + x * CELL + CELL / 2}
              y={PAD + y * CELL + CELL / 2 + 5}
              className="pip"
            >
              {step + 1}
            </text>
          )
        })}

        {([0, 1] as Side[]).map((side) => {
          const { x, y } = coords(position.pieces[side])
          const cx = PAD + x * CELL + CELL / 2
          const cy = PAD + y * CELL + CELL / 2
          return (
            <g key={side} className={`piece${side === you ? ' mine' : ' theirs'}`}>
              <rect
                x={cx - 11}
                y={cy - 11}
                width={22}
                height={22}
                rx={4}
                transform={side === you ? undefined : `rotate(45 ${cx} ${cy})`}
              />
            </g>
          )
        })}
      </g>
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
