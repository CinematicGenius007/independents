/**
 * The vocabulary of the game.
 *
 * Two rules of the house, both of which the rest of the engine depends on:
 *
 * 1. **State is plain JSON.** No classes, no `Map`, no `undefined` in stored
 *    fields. Every state value has to survive `JSON.parse(JSON.stringify(x))`
 *    unchanged, because that is literally what happens to it when a peer joins
 *    late and is handed a snapshot over the wire.
 * 2. **Randomness lives outside the state transitions.** The bag is drawn from
 *    by whoever owns the game (the host, or the local solo runner) and the
 *    result is passed *into* the transition as data. That keeps the transition
 *    functions pure, and it keeps future draws out of the other players'
 *    memory, where a curious peer could read them.
 */

/**
 * The five glazes, in wall order.
 *
 * The order matters: the wall's fixed pattern is a diagonal shift of this
 * array, so changing it changes the board. Names are the colour of the glaze,
 * not of the pixel — the palette lives in the UI.
 */
export const COLORS = ['cobalt', 'saffron', 'crimson', 'basalt', 'verdigris'] as const

export type Color = (typeof COLORS)[number]

/** Tiles of each colour in the bag at the start of a game. */
export const TILES_PER_COLOR = 20

/** Rows and columns of the wall, and pattern lines per board. */
export const WALL_SIZE = 5

/** The floor line holds this many tiles; anything further is discarded. */
export const FLOOR_SIZE = 7

/** Penalty for each floor slot, left to right. */
export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3] as const

/** Tiles dealt onto each factory display at the start of a round. */
export const TILES_PER_FACTORY = 4

/** End-of-game bonuses. */
export const BONUS_ROW = 2
export const BONUS_COLUMN = 7
export const BONUS_COLOR = 10

/** Factory displays in play, by player count. */
export function factoryCount(players: number): number {
  return players * 2 + 1
}

/**
 * The colour the wall wants at `row`,`col`.
 *
 * Row 0 is {@link COLORS} in order and each row below shifts it one step
 * right, so every colour appears exactly once per row and once per column.
 */
export function wallColor(row: number, col: number): Color {
  return COLORS[(col - row + WALL_SIZE) % WALL_SIZE]
}

/** The column on `row` that holds `color`. Inverse of {@link wallColor}. */
export function wallColumn(row: number, color: Color): number {
  return (COLORS.indexOf(color) + row) % WALL_SIZE
}

/**
 * A pattern line: one colour at a time, filled right to left.
 * `color` is null exactly when `count` is 0.
 */
export interface PatternLine {
  color: Color | null
  count: number
}

/** A floor tile is either a glazed tile or the starting-player marker. */
export type FloorTile = Color | 'first'

export interface PlayerState {
  id: string
  name: string
  score: number
  /** Five lines of capacity 1..5, top to bottom. */
  lines: PatternLine[]
  /** `wall[row][col]` is true once that space is tiled. */
  wall: boolean[][]
  floor: FloorTile[]
}

/** Where a player is taking tiles from. Factories are indexed; -1 is the centre. */
export const CENTER = -1

/**
 * One turn's decision, whole and complete.
 *
 * `line` is the pattern line index, or {@link FLOOR} to send the whole handful
 * straight to the floor — which is legal, and sometimes correct.
 */
export const FLOOR = -1

export interface Move {
  source: number
  color: Color
  line: number
}

export type Phase = 'offer' | 'tiling' | 'over'

/**
 * A record of one tile reaching the wall, kept so the interface can narrate
 * the scoring rather than just showing the total jump.
 */
export interface Placement {
  playerIndex: number
  row: number
  col: number
  color: Color
  points: number
  /** Tiles counted horizontally and vertically, for the explanation. */
  horizontal: number
  vertical: number
}

/** What one player gained or lost in a wall-tiling phase. */
export interface RoundReport {
  playerIndex: number
  placements: Placement[]
  /** Negative, or zero when the floor was clean. */
  penalty: number
  floor: FloorTile[]
  scoreBefore: number
  scoreAfter: number
}

/** Final scoring, itemised. */
export interface FinalReport {
  playerIndex: number
  rows: number
  columns: number
  colors: number
  bonus: number
  scoreBefore: number
  scoreAfter: number
}

export interface GameState {
  players: PlayerState[]
  /** Each display holds up to {@link TILES_PER_FACTORY} tiles; empty stays as `[]`. */
  factories: Color[][]
  center: Color[]
  /** True while the starting-player marker is still on the table. */
  centerHasFirst: boolean
  /** Index of the player to act. Meaningless outside the `offer` phase. */
  current: number
  /** Who starts the next round; set when someone takes the marker. */
  nextStarter: number
  phase: Phase
  /** 1-based, for display. */
  round: number
  /** The wall-tiling that just happened, or null at the start of a round. */
  lastRound: RoundReport[] | null
  /** Set once the game is over. */
  finalReports: FinalReport[] | null
  /** Indices of the winner(s) — plural on a shared victory. */
  winners: number[] | null
}

/** The undealt tiles. Held by the game's owner, never sent to other peers. */
export interface Supply {
  bag: Color[]
  /** The box lid: tiles discarded this game, reshuffled when the bag runs dry. */
  lid: Color[]
}
