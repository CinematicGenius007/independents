import { CENTRE, coords, index, SIZE, WELLS_TO_WIN, type Board } from './board'

/**
 * How a turn resolves.
 *
 * Both players program three steps in secret. The steps then play out in
 * lockstep: step one for both, step two for both, step three for both. Nobody
 * reacts, which is the entire game — every turn is a guess about a person.
 */

export type Step = 'N' | 'E' | 'S' | 'W' | '.'
export type Orders = readonly [Step, Step, Step]
export type Side = 0 | 1

export const STEPS: readonly Step[] = ['N', 'E', 'S', 'W', '.']

const DELTA: Record<Step, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
  E: { dx: 1, dy: 0 },
  '.': { dx: 0, dy: 0 },
}

export interface Position {
  readonly pieces: readonly [number, number]
  /** Well cell -> the side that holds it. */
  readonly claims: Readonly<Record<number, Side>>
  /** Water drawn: one per well held, counted at the end of every turn. */
  readonly drawn: readonly [number, number]
  readonly turn: number
}

export interface StepOutcome {
  readonly pieces: readonly [number, number]
  /** True while both pieces occupy the same cell, which is allowed mid-turn. */
  readonly sharing: boolean
}

export function startPosition(board: Board): Position {
  return { pieces: [board.starts[0], board.starts[1]], claims: {}, drawn: [0, 0], turn: 1 }
}

function target(cell: number, step: Step, board: Board): number {
  const { dx, dy } = DELTA[step]
  const x = coords(cell).x + dx
  const y = coords(cell).y + dy
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return cell
  const next = index(x, y)
  return board.walls[next] ? cell : next
}

/**
 * One beat of a turn.
 *
 * Pieces pass through each other freely. Nothing is decided by bumping, because
 * an earlier version of these rules let two pieces block each other indefinitely
 * and four out of five matches ended in a stalemate. All the interaction now
 * happens at the end of a turn, where it can actually be planned for.
 */
export function resolveStep(
  board: Board,
  position: Position,
  steps: readonly [Step, Step],
): StepOutcome {
  const pieces: [number, number] = [
    target(position.pieces[0], steps[0], board),
    target(position.pieces[1], steps[1], board),
  ]
  return { pieces, sharing: pieces[0] === pieces[1] }
}

export interface TurnResult {
  readonly beats: readonly StepOutcome[]
  /** Wells taken this turn. */
  readonly claimed: readonly { cell: number; side: Side }[]
  /** A well both pieces finished on: nobody takes it, and both are sent home. */
  readonly contested: readonly number[]
  readonly position: Position
}

/**
 * On which beat did this side settle onto the cell and stay there?
 *
 * Sitting on a well is what takes it, and sitting on it *sooner* is what takes it
 * from somebody else. Walking across a well on the way past counts for nothing.
 */
export function settledOn(
  beats: readonly StepOutcome[],
  side: Side,
  cell: number,
): number | null {
  let earliest: number | null = null
  for (let beat = beats.length - 1; beat >= 0; beat -= 1) {
    if (beats[beat].pieces[side] !== cell) break
    earliest = beat
  }
  return earliest
}

/**
 * A turn is three beats, and a well belongs to whoever sat down on it first.
 *
 * Holding is not permanent. Sit on a well the other player owns, with nobody
 * there to answer, and it changes hands — so a lead has to be defended, and the
 * endgame is a question of which of your wells they are coming for.
 *
 * That single rule is what makes orders more than a destination. Arriving on beat
 * one and waiting beats arriving on beat three by the long way round, so padding
 * your waits at the front is a real cost. If both pieces settle on the same well
 * at the same moment, neither takes it and both are sent back where the turn
 * began — a whole turn spent, by both of you, on nothing.
 *
 * An earlier version had no timing rule: a shared well was always wasted for
 * both. Bots proved that dull, because a punishment both players share equally
 * gives neither any reason to think about the other. Timing turns the same
 * situation into a question worth asking.
 */
export function resolveTurn(board: Board, position: Position, orders: readonly [Orders, Orders]): TurnResult {
  const beats: StepOutcome[] = []
  let pieces = position.pieces

  for (let beat = 0; beat < 3; beat += 1) {
    const outcome = resolveStep(board, { ...position, pieces }, [orders[0][beat], orders[1][beat]])
    beats.push(outcome)
    pieces = outcome.pieces
  }

  const claims = { ...position.claims }
  const claimed: { cell: number; side: Side }[] = []
  const contested: number[] = []

  for (const well of board.wells) {
    const first = settledOn(beats, 0, well)
    const second = settledOn(beats, 1, well)
    if (first === null && second === null) continue

    if (second === null || (first !== null && first < second)) {
      if (claims[well] !== 0) claimed.push({ cell: well, side: 0 })
      claims[well] = 0
    } else if (first === null || second < first) {
      if (claims[well] !== 1) claimed.push({ cell: well, side: 1 })
      claims[well] = 1
    } else {
      contested.push(well)
      pieces = position.pieces
    }
  }

  // The deep well at the centre pays double, which is both a reason to fight over
  // it and the thing that stops two evenly matched players from finishing level.
  const drawn: [number, number] = [
    position.drawn[0] + waterFor(claims, 0),
    position.drawn[1] + waterFor(claims, 1),
  ]

  return {
    beats,
    claimed,
    contested,
    position: { pieces, claims, drawn, turn: position.turn + 1 },
  }
}

function waterFor(claims: Record<number, Side>, side: Side): number {
  let water = Object.values(claims).filter((owner) => owner === side).length
  if (claims[CENTRE] === side) water += 1
  return water
}

export function held(position: Position, side: Side): number {
  return Object.values(position.claims).filter((owner) => owner === side).length
}

export const TURN_LIMIT = 12

export type Verdict = { over: false } | { over: true; winner: Side | 'draw' }

export function verdict(_board: Board, position: Position): Verdict {
  for (const side of [0, 1] as Side[]) {
    if (held(position, side) >= WELLS_TO_WIN) return { over: true, winner: side }
  }

  // Wells change hands, so the only endings are three-at-once or the clock. At
  // the clock it is water drawn that counts, not wells held: a well taken early
  // and defended is worth more than one snatched on the final turn, and a match
  // decided on totals almost never ends level.
  if (position.turn > TURN_LIMIT) {
    const lead = position.drawn[0] - position.drawn[1]
    if (lead > 0) return { over: true, winner: 0 }
    if (lead < 0) return { over: true, winner: 1 }
    const deep = position.claims[CENTRE]
    if (deep !== undefined) return { over: true, winner: deep }
    return { over: true, winner: 'draw' }
  }

  return { over: false }
}

export function ordersToText(orders: Orders): string {
  return orders.join('')
}

export function ordersFromText(text: string): Orders | null {
  const cleaned = text.toUpperCase().trim()
  if (cleaned.length !== 3) return null
  if (![...cleaned].every((step) => (STEPS as readonly string[]).includes(step))) return null
  return [cleaned[0], cleaned[1], cleaned[2]] as unknown as Orders
}
