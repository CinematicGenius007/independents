/**
 * An opponent for an empty seat.
 *
 * It is a one-ply evaluator, not a search: it plays every legal move on a copy
 * of the board and keeps the one whose *resulting position* it likes best. The
 * whole opinion of the bot therefore lives in {@link evaluate}, which is a much
 * easier thing to tune and to argue with than a tree.
 *
 * Three levels, differing only in how much they see and how steady their hand
 * is. The apprentice barely looks past the tile in front of it; the master
 * cares about the shape of its wall and about what it leaves on the table.
 */

import { applyMove, describePlacement, floorPenalty, legalMoves } from './rules'
import type { Rng } from './rng'
import type { Color, GameState, Move } from './types'
import { CENTER, COLORS, WALL_SIZE, wallColumn } from './types'

export type BotStyle = 'apprentice' | 'artisan' | 'master'

export const BOT_STYLES: BotStyle[] = ['apprentice', 'artisan', 'master']

export interface Weights {
  /** Points from lines that will reach the wall at the end of this round. */
  immediate: number
  /** Credit for a line part-filled and still fillable. */
  progress: number
  /** How much the floor line hurts. */
  floor: number
  /** Appetite for the row, column and colour bonuses. */
  bonus: number
  /** How much it minds handing the next player a fat pile in the centre. */
  denial: number
  /** Random jitter added to every move's value, in points. */
  noise: number
  /**
   * How much weight the best reply of the next player gets. Zero is a bot that
   * only looks at its own board; above it, the bot also asks what its move
   * leaves on offer for the person who plays next.
   */
  reply: number
  /** Candidates, best first by one-ply value, that are searched a ply deeper. */
  breadth: number
  /**
   * Candidates played out to the end of the round, everyone following the
   * greedy policy. Within a round nothing is hidden — the displays are on the
   * table — so the playout is exact for as long as the others play greedily.
   * Zero switches it off.
   */
  rollouts: number
  /** How much a playout's verdict counts against the one-ply-and-reply value. */
  rolloutWeight: number
}

const WEIGHTS: Record<BotStyle, Weights> = {
  apprentice: { immediate: 1, progress: 0.2, floor: 0.6, bonus: 0, denial: 0, noise: 2.5, reply: 0, breadth: 0, rollouts: 0, rolloutWeight: 0 },
  artisan: { immediate: 1, progress: 0.55, floor: 1, bonus: 0.4, denial: 0.15, noise: 0.6, reply: 0.5, breadth: 8, rollouts: 0, rolloutWeight: 0 },
  master: { immediate: 1, progress: 0.7, floor: 1.1, bonus: 0.8, denial: 0.1, noise: 0.05, reply: 0.9, breadth: 40, rollouts: 12, rolloutWeight: 1 },
}

/** Tiles of `color` still reachable for `seat`: on the table, anywhere. */
function onTable(state: GameState, color: Color): number {
  let count = state.center.filter(t => t === color).length
  for (const display of state.factories) count += display.filter(t => t === color).length
  return count
}

/**
 * How close a wall is to the end-of-game bonuses.
 *
 * Quadratic on purpose: four tiles in a row is worth much more than four tiles
 * scattered, because only the concentrated four is one tile from a bonus.
 */
function bonusPotential(wall: boolean[][]): number {
  let value = 0
  for (let r = 0; r < WALL_SIZE; r++) {
    const filled = wall[r].filter(Boolean).length
    value += (filled * filled) / WALL_SIZE
  }
  for (let c = 0; c < WALL_SIZE; c++) {
    let filled = 0
    for (let r = 0; r < WALL_SIZE; r++) if (wall[r][c]) filled++
    value += ((filled * filled) / WALL_SIZE) * 1.4
  }
  for (const color of COLORS) {
    let filled = 0
    for (let r = 0; r < WALL_SIZE; r++) if (wall[r][wallColumn(r, color)]) filled++
    value += ((filled * filled) / WALL_SIZE) * 1.2
  }
  return value
}

/**
 * What one seat's position is worth, in points-ish.
 *
 * Complete lines are counted as the points they will actually score, in row
 * order, on a copy of the wall — so a tile that will land next to another tile
 * placed the same round is credited for the pair.
 */
export function evaluate(state: GameState, seat: number, weights: Weights): number {
  const player = state.players[seat]
  const wall = player.wall.map(row => [...row])
  let value = player.score

  for (let row = 0; row < WALL_SIZE; row++) {
    const line = player.lines[row]
    if (line.color === null) continue
    const capacity = row + 1
    if (line.count >= capacity) {
      const col = wallColumn(row, line.color)
      wall[row][col] = true
      value += describePlacement(wall, row, col).points * weights.immediate
    } else {
      // A part-filled line is only worth something if the colour it wants is
      // still out there to be had.
      const wanted = capacity - line.count
      const reachable = Math.min(wanted, onTable(state, line.color))
      const hope = reachable / wanted
      value += (line.count / capacity) * capacity * weights.progress * (0.4 + 0.6 * hope)
    }
  }

  value += floorPenalty(player.floor) * weights.floor
  value += bonusPotential(wall) * weights.bonus
  return value
}

/** The largest single-colour pile the move leaves sitting in the centre. */
function centreGift(state: GameState): number {
  let worst = 0
  for (const color of COLORS) {
    worst = Math.max(worst, state.center.filter(t => t === color).length)
  }
  return worst
}

/** One move's own worth to the player making it, before looking at replies. */
function ownValue(state: GameState, move: Move, seat: number, weights: Weights, before: number): { value: number; next: GameState } {
  const { state: next } = applyMove(state, move)
  let value = evaluate(next, seat, weights) - before
  if (weights.denial > 0) {
    value -= centreGift(next) * weights.denial
    // Taking the marker is a real cost late in a round and a real prize early.
    if (move.source === CENTER && state.centerHasFirst) {
      value += state.factories.filter(f => f.length > 0).length >= 2 ? 0.6 : -0.4
    }
  }
  return { value, next }
}

/**
 * The most the player after `seat` can gain from the position `state`, by
 * their own evaluation. A move that hands them a fat, ready-made line is worth
 * less to the mover than its own score suggests.
 */
function bestReplyGain(state: GameState, weights: Weights): number {
  if (state.phase !== 'offer') return 0
  const replier = state.current
  const base = evaluate(state, replier, weights)
  let best = 0
  for (const reply of legalMoves(state)) {
    const { state: after } = applyMove(state, reply)
    best = Math.max(best, evaluate(after, replier, weights) - base)
  }
  return best
}

/** The policy everyone is assumed to follow inside a playout: the artisan, steady-handed. */
const PLAYOUT: Weights = { ...WEIGHTS.artisan, noise: 0, reply: 0, breadth: 0 }

/**
 * Plays the round out from `state` with the greedy policy and says how `seat`
 * stands at the end of it: its own position minus the average of the others.
 */
function playout(state: GameState, seat: number): number {
  let current = state
  let guard = 80
  while (current.phase === 'offer' && guard-- > 0) {
    const moves = legalMoves(current)
    if (moves.length === 0) break
    const player = current.current
    const base = evaluate(current, player, PLAYOUT)
    let best = moves[0]
    let bestValue = -Infinity
    for (const move of moves) {
      const { state: next } = applyMove(current, move)
      let value = evaluate(next, player, PLAYOUT) - base
      value -= centreGift(next) * PLAYOUT.denial
      if (value > bestValue) {
        bestValue = value
        best = move
      }
    }
    current = applyMove(current, best).state
  }
  let others = 0
  for (let i = 0; i < current.players.length; i++) if (i !== seat) others += evaluate(current, i, PLAYOUT)
  return evaluate(current, seat, PLAYOUT) - others / Math.max(1, current.players.length - 1)
}

/**
 * Picks a move for the player to act.
 *
 * Every legal move is valued on its own result; the best few are then searched
 * one ply deeper, against the best answer the next player has. Ties are broken
 * by the jitter rather than by move order, so two bots in the same seat
 * position do not play the same game twice.
 */
export function chooseMove(state: GameState, rng: Rng, style: BotStyle = 'master'): Move | null {
  const moves = legalMoves(state)
  if (moves.length === 0) return null

  const weights = WEIGHTS[style]
  const seat = state.current
  const before = evaluate(state, seat, weights)

  const scored = moves
    .map(move => ({ move, ...ownValue(state, move, seat, weights, before) }))
    .map(entry => ({ ...entry, value: entry.value + (rng() - 0.5) * 2 * weights.noise }))
    .sort((a, b) => b.value - a.value)

  if (weights.reply === 0 || weights.breadth === 0) return scored[0].move

  const searched = scored.slice(0, weights.breadth).map(entry => ({
    ...entry,
    value: entry.value - weights.reply * bestReplyGain(entry.next, weights),
  }))
  searched.sort((a, b) => b.value - a.value)

  if (weights.rollouts > 0) {
    const top = searched.slice(0, weights.rollouts)
    const spread = top[0].value
    let best = top[0]
    let bestValue = -Infinity
    for (const entry of top) {
      const value = playout(entry.next, seat) * weights.rolloutWeight + (entry.value - spread) * 0.25
      if (value > bestValue) {
        bestValue = value
        best = entry
      }
    }
    return best.move
  }
  return searched[0].move
}
