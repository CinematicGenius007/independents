import { coords, neighbours, type Board } from './board'
import { resolveTurn, STEPS, type Orders, type Position, type Side, type Step } from './rules'
import { createRng, type Rng } from './rng'

/**
 * The ghost: an opponent for players with nobody to send a link to.
 *
 * It plans a dash to whichever unclaimed well it can reach first, but it also
 * asks whether the other piece would get there sooner. When it would lose the
 * race it goes somewhere else instead, because two pieces arriving at once means
 * neither gets the well — which is the lesson the game most wants to teach.
 */

export type Personality = 'rush' | 'ghost' | 'drift' | 'reader'

export function distances(board: Board, from: number): number[] {
  const out = new Array<number>(board.walls.length).fill(Infinity)
  out[from] = 0
  const queue = [from]

  while (queue.length > 0) {
    const cell = queue.shift()!
    for (const next of neighbours(cell)) {
      if (board.walls[next] || out[next] !== Infinity) continue
      out[next] = out[cell] + 1
      queue.push(next)
    }
  }

  return out
}

function stepToward(board: Board, from: number, field: number[]): Step {
  let best: { cell: number; cost: number } | null = null
  for (const next of neighbours(from)) {
    if (board.walls[next]) continue
    if (!best || field[next] < best.cost) best = { cell: next, cost: field[next] }
  }
  if (!best || best.cost >= field[from]) return '.'

  const here = coords(from)
  const there = coords(best.cell)
  if (there.y < here.y) return 'N'
  if (there.y > here.y) return 'S'
  if (there.x < here.x) return 'W'
  return 'E'
}

function pickTarget(board: Board, position: Position, side: Side, personality: Personality, rng: Rng) {
  const mine = distances(board, position.pieces[side])
  const theirs = distances(board, position.pieces[side === 0 ? 1 : 0])
  const open = board.wells.filter((well) => position.claims[well] !== side)
  const ownedUnderThreat = board.wells.filter(
    (well) => position.claims[well] === side && theirs[well] <= 3 && mine[well] <= theirs[well],
  )

  // With two wells in hand and a third being taken from you, holding what you
  // have is worth more than reaching for what you do not.
  if (personality === 'ghost' && ownedUnderThreat.length > 0 && open.length > 0) {
    const pressure = ownedUnderThreat.sort((a, b) => mine[a] - mine[b])[0]
    const nearest = open.sort((a, b) => mine[a] - mine[b])[0]
    if (mine[pressure] <= mine[nearest]) return pressure
  }

  if (open.length === 0) return null

  const scored = open.map((well) => {
    let cost = mine[well]
    if (personality === 'ghost') {
      // A well goes to whoever sits down on it first, so losing the race by a
      // beat is worthless and tying it wastes the turn outright.
      const raceable = mine[well] <= 3 && theirs[well] <= 3
      if (raceable && theirs[well] < mine[well]) cost += 6
      else if (raceable && theirs[well] === mine[well]) cost += 4
      else if (theirs[well] < mine[well]) cost += 2
      cost += rng.int(2)
    }
    if (personality === 'drift') cost += rng.int(4)
    return { well, cost }
  })

  return scored.sort((a, b) => a.cost - b.cost)[0].well
}

/** Every order a piece could give: three beats, five choices each. */
export function allOrders(): Orders[] {
  const out: Orders[] = []
  for (const a of STEPS) for (const b of STEPS) for (const c of STEPS) out.push([a, b, c] as Orders)
  return out
}

/**
 * How good is this position for a side, in wells first and footing second?
 *
 * The positional term is deliberately small: it only breaks ties between plans
 * that win the same number of wells, by preferring to end up near the next one.
 */
function evaluate(board: Board, position: Position, side: Side): number {
  const other = (side === 0 ? 1 : 0) as Side
  let score = (heldBy(position, side) - heldBy(position, other)) * 10
  score += (position.drawn[side] - position.drawn[other]) * 2

  const field = distances(board, position.pieces[side])
  const wanted = board.wells.filter((well) => position.claims[well] !== side)
  if (wanted.length > 0) score -= Math.min(...wanted.map((well) => field[well])) * 0.4

  return score
}

function heldBy(position: Position, side: Side): number {
  return Object.values(position.claims).filter((owner) => owner === side).length
}

/**
 * The reader: a player that answers what it expects rather than what it wants.
 *
 * It scores every one of its own 125 possible orders against a handful of orders
 * the opponent plausibly gives, and plays the best reply on average. This exists
 * because the simpler bots could not settle whether the game rewards thinking
 * about the other player at all — a question a heuristic opponent cannot answer,
 * since losing to a rusher may only mean the heuristic was bad.
 */
export function readerOrders(board: Board, position: Position, side: Side, rng: Rng): Orders {
  const other = (side === 0 ? 1 : 0) as Side
  const expected = [
    botOrders(board, position, other, 'rush', rng),
    botOrders(board, position, other, 'ghost', rng),
    botOrders(board, position, other, 'drift', rng),
  ]

  let best: { orders: Orders; score: number } | null = null
  for (const candidate of allOrders()) {
    let total = 0
    for (const theirs of expected) {
      const pair: [Orders, Orders] =
        side === 0 ? [candidate, theirs] : [theirs, candidate]
      total += evaluate(board, resolveTurn(board, position, pair).position, side)
    }
    const score = total / expected.length
    if (!best || score > best.score) best = { orders: candidate, score }
  }

  return best!.orders
}

export function botOrders(
  board: Board,
  position: Position,
  side: Side,
  personality: Personality,
  rng: Rng = createRng(1),
): Orders {
  if (personality === 'reader') return readerOrders(board, position, side, rng)

  const steps: Step[] = []
  let at = position.pieces[side]
  const target = pickTarget(board, position, side, personality, rng)
  const field = target === null ? null : distances(board, target)

  for (let beat = 0; beat < 3; beat += 1) {
    // Only the finishing cell claims a well, so a piece that arrives early
    // stands still rather than wandering off it.
    if (field === null || at === target) {
      steps.push('.')
      continue
    }
    const step = stepToward(board, at, field)
    steps.push(step)
    if (step === '.') continue

    const here = coords(at)
    const dx = step === 'E' ? 1 : step === 'W' ? -1 : 0
    const dy = step === 'S' ? 1 : step === 'N' ? -1 : 0
    at = (here.y + dy) * 7 + (here.x + dx)
  }

  return [steps[0], steps[1], steps[2]] as unknown as Orders
}
