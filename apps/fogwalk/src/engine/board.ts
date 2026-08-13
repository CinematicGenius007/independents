export type Cell = 'wall' | 'floor' | 'mud' | 'hazard'

export interface Board {
  readonly width: number
  readonly height: number
  readonly cells: readonly Cell[]
  /** Index of the cell every possible position has to end up on. */
  readonly goal: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']

const STEPS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

export function indexOf(board: Board, x: number, y: number): number {
  return y * board.width + x
}

export function coordsOf(board: Board, index: number): { x: number; y: number } {
  return { x: index % board.width, y: Math.floor(index / board.width) }
}

export function cellAt(board: Board, index: number): Cell {
  return board.cells[index]
}

/** Cells a walker can occupy: everything that is neither wall nor hazard. */
export function standableCells(board: Board): number[] {
  const cells: number[] = []
  for (let i = 0; i < board.cells.length; i += 1) {
    const cell = board.cells[i]
    if (cell !== 'wall' && cell !== 'hazard') cells.push(i)
  }
  return cells
}

/**
 * Slide a single walker until something stops it.
 *
 * Floors are frictionless, mud grabs the walker on contact, walls block, and a
 * hazard anywhere along the path is fatal. The fatal case is what gives the game
 * its pressure: a plan is only legal if it is safe in every world at once, so one
 * unlucky starting cell invalidates the whole move.
 */
export function slide(board: Board, from: number, direction: Direction): number | 'dead' {
  const { dx, dy } = STEPS[direction]
  let { x, y } = coordsOf(board, from)
  let current = from

  for (;;) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height) return current

    const next = indexOf(board, nx, ny)
    const cell = board.cells[next]
    if (cell === 'wall') return current
    if (cell === 'hazard') return 'dead'

    x = nx
    y = ny
    current = next
    if (cell === 'mud') return current
  }
}
