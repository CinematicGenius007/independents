export type Cell =
  | 'wall'
  | 'floor'
  | 'mud'
  | 'hazard'
  /** A ratchet only lets a walker through in the direction it points. */
  | 'ratchet-up'
  | 'ratchet-down'
  | 'ratchet-left'
  | 'ratchet-right'
  /** A gate swallows a walker and spits it out at its twin, stopping it there. */
  | 'gate'

export interface Board {
  readonly width: number
  readonly height: number
  readonly cells: readonly Cell[]
  /** Gate cell -> the gate it opens onto. Always symmetric. */
  readonly gates: Readonly<Record<number, number>>
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

const RATCHETS: Record<string, Direction> = {
  'ratchet-up': 'up',
  'ratchet-down': 'down',
  'ratchet-left': 'left',
  'ratchet-right': 'right',
}

export function ratchetDirection(cell: Cell): Direction | null {
  return RATCHETS[cell] ?? null
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
 * Floors are frictionless, mud grabs on contact, walls block, hazards kill, a
 * ratchet only opens for a walker travelling its way, and a gate throws the
 * walker to its twin and lets go of it there.
 *
 * The last two matter mathematically as much as physically. Sliding alone gives
 * a transition function whose merges are all local; ratchets make it asymmetric
 * (a move is no longer undoable by its opposite) and gates make merges non-local,
 * which is what lets a board fold distant possibilities together.
 */
export function slide(board: Board, from: number, direction: Direction): number | 'dead' {
  const { dx, dy } = STEPS[direction]
  let { x, y } = coordsOf(board, from)
  let current = from
  let hops = 0

  for (;;) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height) return current

    const next = indexOf(board, nx, ny)
    const cell = board.cells[next]
    if (cell === 'wall') return current
    if (cell === 'hazard') return 'dead'

    const ratchet = ratchetDirection(cell)
    if (ratchet && ratchet !== direction) return current

    if (cell === 'gate') {
      const exit = board.gates[next]
      return exit === undefined ? next : exit
    }

    x = nx
    y = ny
    current = next
    if (cell === 'mud') return current

    // A ring of ratchets could otherwise be entered but never left.
    hops += 1
    if (hops > board.width * board.height) return current
  }
}
