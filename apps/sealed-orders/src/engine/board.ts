import { createRng, hashSeed } from './rng'

/**
 * The ground both pieces move on.
 *
 * Boards are generated from the match seed, so a link carries a whole board in
 * six characters. Wells are placed symmetrically about the centre: whatever
 * advantage a start position has, the other player has the mirror of it.
 */

export const SIZE = 7
export const WELLS_TO_WIN = 3

/** The deep well: always present, and the tiebreak when a match runs long. */
export const CENTRE = Math.floor((SIZE * SIZE) / 2)

export interface Board {
  readonly walls: readonly boolean[]
  readonly wells: readonly number[]
  readonly starts: readonly [number, number]
}

export function index(x: number, y: number): number {
  return y * SIZE + x
}

export function coords(cell: number): { x: number; y: number } {
  return { x: cell % SIZE, y: Math.floor(cell / SIZE) }
}

/** 180° rotation, the symmetry every board is built around. */
export function mirror(cell: number): number {
  const { x, y } = coords(cell)
  return index(SIZE - 1 - x, SIZE - 1 - y)
}

export function generateBoard(seed: string): Board {
  const rng = createRng(hashSeed(seed))
  const walls = new Array<boolean>(SIZE * SIZE).fill(false)

  const starts: [number, number] = [index(0, Math.floor(SIZE / 2)), index(SIZE - 1, Math.floor(SIZE / 2))]
  const centre = index(Math.floor(SIZE / 2), Math.floor(SIZE / 2))

  const blocked = new Set<number>([...starts, centre])

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const cell = rng.int(SIZE * SIZE)
    const twin = mirror(cell)
    if (blocked.has(cell) || blocked.has(twin) || cell === twin) continue
    walls[cell] = true
    walls[twin] = true
    blocked.add(cell)
    blocked.add(twin)
  }

  // Wells are balanced rather than mirrored: both players face the same
  // multiset of distances, but not the same board. Perfectly mirrored wells make
  // identical play produce identical results, and bot matches showed that ending
  // two thirds of mirror matchups in a dead-level draw.
  const wells = placeWells(walls, blocked, centre, rng)

  if (!isConnected(walls, [...starts, ...wells])) return generateBoard(`${seed}!`)

  return { walls, wells: wells.sort((a, b) => a - b), starts }
}

function placeWells(
  walls: readonly boolean[],
  blocked: ReadonlySet<number>,
  centre: number,
  rng: { int(max: number): number },
): number[] {
  const starts = [index(0, Math.floor(SIZE / 2)), index(SIZE - 1, Math.floor(SIZE / 2))]
  const open: number[] = []
  for (let cell = 0; cell < walls.length; cell += 1) {
    if (!walls[cell] && !blocked.has(cell) && cell !== centre) open.push(cell)
  }

  const fromFirst = walkDistances(walls, starts[0])
  const fromSecond = walkDistances(walls, starts[1])

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const picked: number[] = []
    const pool = [...open]
    while (picked.length < 4 && pool.length > 0) picked.push(pool.splice(rng.int(pool.length), 1)[0])
    if (picked.length < 4) break

    const mine = picked.map((well) => fromFirst[well]).sort((a, b) => a - b)
    const theirs = picked.map((well) => fromSecond[well]).sort((a, b) => a - b)
    const balanced = mine.every((value, at) => value === theirs[at] && Number.isFinite(value))
    const spread = new Set(picked.map((well) => fromFirst[well])).size > 1
    if (balanced && spread) return [centre, ...picked].sort((a, b) => a - b)
  }

  // Fall back to the mirrored layout, which is always balanced.
  const mirrored: number[] = [centre]
  for (const cell of open) {
    const twin = mirror(cell)
    if (mirrored.length >= 5) break
    if (walls[twin] || blocked.has(twin) || mirrored.includes(cell) || mirrored.includes(twin)) continue
    mirrored.push(cell, twin)
  }
  return mirrored.sort((a, b) => a - b)
}

function walkDistances(walls: readonly boolean[], from: number): number[] {
  const out = new Array<number>(walls.length).fill(Infinity)
  out[from] = 0
  const queue = [from]
  while (queue.length > 0) {
    const cell = queue.shift()!
    for (const next of neighbours(cell)) {
      if (walls[next] || out[next] !== Infinity) continue
      out[next] = out[cell] + 1
      queue.push(next)
    }
  }
  return out
}

function isConnected(walls: readonly boolean[], required: readonly number[]): boolean {
  const start = required[0]
  const seen = new Set<number>([start])
  const queue = [start]

  while (queue.length > 0) {
    const cell = queue.shift()!
    for (const next of neighbours(cell)) {
      if (walls[next] || seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }

  return required.every((cell) => seen.has(cell))
}

export function neighbours(cell: number): number[] {
  const { x, y } = coords(cell)
  const out: number[] = []
  if (y > 0) out.push(index(x, y - 1))
  if (y < SIZE - 1) out.push(index(x, y + 1))
  if (x > 0) out.push(index(x - 1, y))
  if (x < SIZE - 1) out.push(index(x + 1, y))
  return out
}
