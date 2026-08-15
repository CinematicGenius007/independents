/**
 * What a move would cost and earn, worked out before it is made.
 *
 * At a physical table a player counts this on their fingers: if I put four
 * here, one lands on the wall next to that one and scores three, and the other
 * two go on the floor and cost me four. The interface should not make anyone
 * do that arithmetic in their head, and it should not make them guess either.
 *
 * These are pure read-only questions about a position. They never move a tile.
 */

import { describePlacement, floorPenalty } from './rules'
import type { Color, FloorTile, GameState, PlayerState } from './types'
import { COLORS, FLOOR_SIZE, TILES_PER_COLOR, WALL_SIZE, wallColor, wallColumn } from './types'

export interface LinePreview {
  /** The handful fills this line, so it reaches the wall this round. */
  completes: boolean
  /** Points the tile would score when it fires. Zero if the line stays short. */
  points: number
  /** Tiles that will not fit and fall to the floor. */
  overflow: number
  /** Extra floor penalty those tiles bring, as a negative number. */
  penalty: number
}

/** What happens if `count` tiles of `color` go on pattern line `line`. */
export function previewLine(
  player: PlayerState,
  line: number,
  color: Color,
  count: number,
  extraFloor = 0,
): LinePreview {
  const capacity = line + 1
  const room = capacity - player.lines[line].count
  const placed = Math.min(room, count)
  const overflow = count - placed
  const completes = player.lines[line].count + placed >= capacity

  let points = 0
  if (completes) {
    const wall = player.wall.map(row => [...row])
    const col = wallColumn(line, color)
    wall[line][col] = true
    points = describePlacement(wall, line, col).points
  }

  return { completes, points, overflow, penalty: floorCost(player.floor, overflow + extraFloor) }
}

/** What sending `count` tiles straight to the floor costs, as a negative. */
export function previewFloor(player: PlayerState, count: number, extraFloor = 0): LinePreview {
  return {
    completes: false,
    points: 0,
    overflow: count,
    penalty: floorCost(player.floor, count + extraFloor),
  }
}

/** The extra penalty `added` tiles bring to a floor that already holds some. */
function floorCost(floor: FloorTile[], added: number): number {
  if (added <= 0) return 0
  const grown: FloorTile[] = [...floor]
  for (let i = 0; i < added && grown.length < FLOOR_SIZE; i++) grown.push('cobalt')
  return floorPenalty(grown) - floorPenalty(floor)
}

/**
 * Tiles of each colour nobody can see: still in the bag, or in the lid waiting
 * to be shuffled back into it.
 *
 * Every other tile in the game is on a wall, in a pattern line, on a floor, on
 * a display or in the centre, so what is left over is exactly what is unseen.
 * Counting it is legal, ordinary play — at a table you do it by looking.
 */
export function unseenTiles(state: GameState): Record<Color, number> {
  const unseen = Object.fromEntries(COLORS.map(c => [c, TILES_PER_COLOR])) as Record<Color, number>
  const take = (color: Color, n = 1) => {
    unseen[color] -= n
  }

  for (const player of state.players) {
    player.wall.forEach((row, r) =>
      row.forEach((filled, c) => {
        if (filled) take(wallColor(r, c))
      }),
    )
    for (const line of player.lines) if (line.color) take(line.color, line.count)
    for (const tile of player.floor) if (tile !== 'first') take(tile)
  }
  for (const display of state.factories) for (const tile of display) take(tile)
  for (const tile of state.center) take(tile)

  for (const color of COLORS) unseen[color] = Math.max(0, unseen[color])
  return unseen
}

/** Rows, columns and colours each player has finished, for the end-game race. */
export function bonusProgress(player: PlayerState): {
  rows: number
  columns: number
  colors: number
  /** The row closest to completion, and how many tiles it still wants. */
  nearestRow: { row: number; missing: number } | null
} {
  const rows = player.wall.filter(row => row.every(Boolean)).length
  let columns = 0
  for (let c = 0; c < WALL_SIZE; c++) if (player.wall.every(row => row[c])) columns++
  let colors = 0
  for (const color of COLORS) {
    if (player.wall.every((row, r) => row[wallColumn(r, color)])) colors++
  }

  let nearestRow: { row: number; missing: number } | null = null
  player.wall.forEach((row, index) => {
    const missing = row.filter(filled => !filled).length
    if (missing === 0) return
    if (!nearestRow || missing < nearestRow.missing) nearestRow = { row: index, missing }
  })

  return { rows, columns, colors, nearestRow }
}
