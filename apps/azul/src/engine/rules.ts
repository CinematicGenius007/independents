/**
 * The rules, as pure functions.
 *
 * Every exported transition takes a state and returns a new one; nothing here
 * mutates its argument, reads a clock, or touches randomness. That is what
 * lets four browsers run this code over the same ordered list of moves and
 * land on identical boards without ever comparing them.
 *
 * Transitions that put tiles out of play return them as `discarded` rather
 * than throwing them away, because the game's owner has to drop them in the
 * lid — the lid is what refills the bag.
 */

import type {
  Color,
  FinalReport,
  FloorTile,
  GameState,
  Move,
  PatternLine,
  Placement,
  PlayerState,
  RoundReport,
} from './types'
import {
  BONUS_COLOR,
  BONUS_COLUMN,
  BONUS_ROW,
  CENTER,
  COLORS,
  FLOOR,
  FLOOR_PENALTIES,
  FLOOR_SIZE,
  WALL_SIZE,
  wallColumn,
} from './types'

/** A transition's result: the new state, plus tiles that left the game. */
export interface Transition {
  state: GameState
  discarded: Color[]
}

function emptyBoard(id: string, name: string): PlayerState {
  return {
    id,
    name,
    score: 0,
    lines: Array.from({ length: WALL_SIZE }, () => ({ color: null, count: 0 }) as PatternLine),
    wall: Array.from({ length: WALL_SIZE }, () => Array.from({ length: WALL_SIZE }, () => false)),
    floor: [],
  }
}

/**
 * A game before its first deal: boards empty, nothing on the table.
 *
 * `players` is in seating order, and the first seat starts. Call
 * {@link startRound} with a deal to make it playable.
 */
export function createGame(players: { id: string; name: string }[]): GameState {
  if (players.length < 2 || players.length > 4) {
    throw new Error(`Azulejo seats two to four players, not ${players.length}`)
  }
  return {
    players: players.map(p => emptyBoard(p.id, p.name)),
    factories: [],
    center: [],
    centerHasFirst: true,
    current: 0,
    nextStarter: 0,
    phase: 'offer',
    round: 1,
    lastRound: null,
    finalReports: null,
    winners: null,
  }
}

/** True in the gap between a wall-tiling and the next deal. */
export function needsDeal(state: GameState): boolean {
  return (
    state.phase === 'offer' &&
    state.center.length === 0 &&
    state.factories.every(f => f.length === 0)
  )
}

/**
 * Puts a fresh deal on the table and hands the round to whoever holds the
 * starting-player marker.
 */
export function startRound(state: GameState, factories: Color[][]): GameState {
  return {
    ...state,
    factories: factories.map(f => [...f]),
    center: [],
    centerHasFirst: true,
    current: state.nextStarter,
    phase: 'offer',
    lastRound: null,
  }
}

/** Tiles of `color` available at `source`, or 0 if there are none to take. */
function availableAt(state: GameState, source: number, color: Color): number {
  const pile = source === CENTER ? state.center : state.factories[source]
  if (!pile) return 0
  return pile.filter(t => t === color).length
}

/**
 * Why a move is illegal, or null if it is fine.
 *
 * Spelled out rather than returning a boolean because the interface uses these
 * strings to explain a greyed-out line instead of silently refusing a click.
 */
export function moveError(state: GameState, move: Move): string | null {
  if (state.phase !== 'offer') return 'The round is not taking moves right now.'
  if (needsDeal(state)) return 'The table is empty; the next round has not been dealt.'
  if (move.source !== CENTER && (move.source < 0 || move.source >= state.factories.length)) {
    return 'No such factory display.'
  }
  if (availableAt(state, move.source, move.color) === 0) {
    return 'There are no tiles of that colour there.'
  }
  if (move.line === FLOOR) return null
  if (move.line < 0 || move.line >= WALL_SIZE) return 'No such pattern line.'

  const player = state.players[state.current]
  const line = player.lines[move.line]
  if (player.wall[move.line][wallColumn(move.line, move.color)]) {
    return 'That colour is already on the wall in this row.'
  }
  if (line.color !== null && line.color !== move.color) {
    return 'That line is holding another colour.'
  }
  if (line.count >= move.line + 1) return 'That line is already full.'
  return null
}

/** Every move the player to act could legally make. */
export function legalMoves(state: GameState): Move[] {
  if (state.phase !== 'offer') return []
  const moves: Move[] = []
  const sources = [CENTER, ...state.factories.map((_, i) => i)]
  for (const source of sources) {
    for (const color of COLORS) {
      if (availableAt(state, source, color) === 0) continue
      for (const line of [FLOOR, 0, 1, 2, 3, 4]) {
        const move = { source, color, line }
        if (moveError(state, move) === null) moves.push(move)
      }
    }
  }
  return moves
}

/** Adds tiles to a floor line, dropping anything past the seventh slot. */
function addToFloor(floor: FloorTile[], tiles: FloorTile[]): { floor: FloorTile[]; discarded: Color[] } {
  const next = [...floor]
  const discarded: Color[] = []
  for (const tile of tiles) {
    if (next.length < FLOOR_SIZE) next.push(tile)
    else if (tile !== 'first') discarded.push(tile)
  }
  return { floor: next, discarded }
}

/**
 * Takes a handful of tiles and lays them down.
 *
 * The whole turn is here: the pile empties, a factory's leftovers slide to the
 * centre, the marker is claimed if it was still sitting there, the pattern
 * line takes what it can hold and the floor takes the rest.
 */
export function applyMove(state: GameState, move: Move): Transition {
  const error = moveError(state, move)
  if (error) throw new Error(error)

  const factories = state.factories.map(f => [...f])
  let center = [...state.center]
  let taken: number
  let centerHasFirst = state.centerHasFirst
  let nextStarter = state.nextStarter
  const claimedMarker = move.source === CENTER && state.centerHasFirst

  if (move.source === CENTER) {
    taken = center.filter(t => t === move.color).length
    center = center.filter(t => t !== move.color)
    if (claimedMarker) {
      centerHasFirst = false
      nextStarter = state.current
    }
  } else {
    const display = factories[move.source]
    taken = display.filter(t => t === move.color).length
    center = [...center, ...display.filter(t => t !== move.color)]
    factories[move.source] = []
  }

  const players = state.players.map((p, i) => (i === state.current ? { ...p } : p))
  const player = players[state.current]
  const overflow: FloorTile[] = claimedMarker ? ['first'] : []

  if (move.line === FLOOR) {
    for (let i = 0; i < taken; i++) overflow.push(move.color)
  } else {
    const line = player.lines[move.line]
    const room = move.line + 1 - line.count
    const placed = Math.min(room, taken)
    player.lines = player.lines.map((l, i) =>
      i === move.line ? { color: move.color, count: l.count + placed } : l,
    )
    for (let i = 0; i < taken - placed; i++) overflow.push(move.color)
  }

  const floored = addToFloor(player.floor, overflow)
  player.floor = floored.floor

  const tableEmpty = center.length === 0 && factories.every(f => f.length === 0)

  return {
    state: {
      ...state,
      players,
      factories,
      center,
      centerHasFirst,
      nextStarter,
      current: tableEmpty ? state.current : (state.current + 1) % state.players.length,
      phase: tableEmpty ? 'tiling' : 'offer',
    },
    discarded: floored.discarded,
  }
}

/**
 * Points for a tile just laid at `row`,`col`.
 *
 * A tile touching nothing is worth one. Otherwise it is worth the length of
 * each run it belongs to — counted in both directions, and counted twice when
 * it joins a horizontal run *and* a vertical one.
 */
export function scorePlacement(wall: boolean[][], row: number, col: number): number {
  return describePlacement(wall, row, col).points
}

/** {@link scorePlacement} with the run lengths that produced the number. */
export function describePlacement(
  wall: boolean[][],
  row: number,
  col: number,
): { points: number; horizontal: number; vertical: number } {
  let horizontal = 1
  for (let c = col - 1; c >= 0 && wall[row][c]; c--) horizontal++
  for (let c = col + 1; c < WALL_SIZE && wall[row][c]; c++) horizontal++

  let vertical = 1
  for (let r = row - 1; r >= 0 && wall[r][col]; r--) vertical++
  for (let r = row + 1; r < WALL_SIZE && wall[r][col]; r++) vertical++

  const points =
    horizontal === 1 && vertical === 1
      ? 1
      : (horizontal > 1 ? horizontal : 0) + (vertical > 1 ? vertical : 0)
  return { points, horizontal, vertical }
}

/** The floor penalty a line of `n` tiles carries. */
export function floorPenalty(floor: FloorTile[]): number {
  return floor.reduce((sum, _, i) => sum + (FLOOR_PENALTIES[i] ?? 0), 0)
}

function completeRows(wall: boolean[][]): number {
  return wall.filter(row => row.every(Boolean)).length
}

function completeColumns(wall: boolean[][]): number {
  let count = 0
  for (let c = 0; c < WALL_SIZE; c++) {
    if (wall.every(row => row[c])) count++
  }
  return count
}

function completeColors(wall: boolean[][]): number {
  let count = 0
  for (const color of COLORS) {
    if (wall.every((row, r) => row[wallColumn(r, color)])) count++
  }
  return count
}

/**
 * The wall-tiling phase, for everyone at once.
 *
 * Complete pattern lines move their rightmost tile to the wall and send the
 * rest to the lid; incomplete lines stay exactly as they are. Floors are then
 * charged and swept, and the marker goes back to the middle of the table.
 *
 * A score never drops below zero — the rules are explicit about that, and it
 * is the only place the game is kind.
 */
export function tileWall(state: GameState): Transition {
  if (state.phase !== 'tiling') throw new Error('The round is still being played.')

  const discarded: Color[] = []
  const reports: RoundReport[] = []

  const players = state.players.map((player, playerIndex) => {
    const wall = player.wall.map(row => [...row])
    const lines = player.lines.map(l => ({ ...l }))
    const placements: Placement[] = []
    let score = player.score

    for (let row = 0; row < WALL_SIZE; row++) {
      const line = lines[row]
      if (line.color === null || line.count < row + 1) continue
      const color = line.color
      const col = wallColumn(row, color)
      wall[row][col] = true
      const { points, horizontal, vertical } = describePlacement(wall, row, col)
      score += points
      placements.push({ playerIndex, row, col, color, points, horizontal, vertical })
      for (let i = 0; i < row; i++) discarded.push(color)
      lines[row] = { color: null, count: 0 }
    }

    const penalty = floorPenalty(player.floor)
    const scoreBefore = player.score
    score = Math.max(0, score + penalty)
    for (const tile of player.floor) {
      if (tile !== 'first') discarded.push(tile)
    }

    reports.push({
      playerIndex,
      placements,
      penalty,
      floor: [...player.floor],
      scoreBefore,
      scoreAfter: score,
    })

    return { ...player, wall, lines, floor: [], score }
  })

  const finished = players.some(p => completeRows(p.wall) > 0)
  const tiled: GameState = {
    ...state,
    players,
    center: [],
    centerHasFirst: true,
    current: state.nextStarter,
    round: state.round + 1,
    phase: 'offer',
    lastRound: reports,
  }

  return { state: finished ? finalScore(tiled) : tiled, discarded }
}

/**
 * Adds the end-of-game bonuses and decides the winner.
 *
 * Most points wins; a tie is broken by complete rows, and if that ties too the
 * victory is genuinely shared, which the rules allow and the interface says
 * out loud.
 */
export function finalScore(state: GameState): GameState {
  const reports: FinalReport[] = []
  const players = state.players.map((player, playerIndex) => {
    const rows = completeRows(player.wall)
    const columns = completeColumns(player.wall)
    const colors = completeColors(player.wall)
    const bonus = rows * BONUS_ROW + columns * BONUS_COLUMN + colors * BONUS_COLOR
    reports.push({
      playerIndex,
      rows,
      columns,
      colors,
      bonus,
      scoreBefore: player.score,
      scoreAfter: player.score + bonus,
    })
    return { ...player, score: player.score + bonus }
  })

  const best = Math.max(...players.map(p => p.score))
  const leaders = players
    .map((p, i) => ({ index: i, score: p.score, rows: completeRows(p.wall) }))
    .filter(p => p.score === best)
  const mostRows = Math.max(...leaders.map(l => l.rows))
  const winners = leaders.filter(l => l.rows === mostRows).map(l => l.index)

  return { ...state, players, phase: 'over', finalReports: reports, winners }
}
