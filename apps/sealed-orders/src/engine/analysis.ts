import type { Board } from './board'
import { allOrders } from './bot'
import { resolveTurn, type Orders, type Position, type Side } from './rules'

/**
 * What a turn was actually worth.
 *
 * Every turn here is a one-shot simultaneous game: a payoff matrix over the
 * orders both players could have given. That means it has an equilibrium, and a
 * move can be measured against it — not "you lost the well" but "against the mix
 * a rational opponent plays, this order gave up two thirds of a well".
 *
 * The matrix is built over *distinct outcomes* rather than over all 125 order
 * strings, because most of those strings are the same plan written differently
 * and a matrix full of duplicates makes the equilibrium meaningless.
 */

export interface TurnAnalysis {
  /** The distinct plans available to each side this turn. */
  readonly actionCount: number
  /** Value of the turn to the analysed side under equilibrium play. */
  readonly value: number
  /** What the chosen order was worth against the opponent's equilibrium mix. */
  readonly chosenValue: number
  /** How much the choice gave up: zero is a best reply. */
  readonly regret: number
  /** The order that would have been the best reply. */
  readonly best: Orders
}

/** Water and wells, from one side's point of view. */
function payoff(board: Board, position: Position, orders: [Orders, Orders], side: Side): number {
  const after = resolveTurn(board, position, orders).position
  const other = (side === 0 ? 1 : 0) as Side
  const wells = (owner: Side) => Object.values(after.claims).filter((who) => who === owner).length
  return (wells(side) - wells(other)) * 2 + (after.drawn[side] - after.drawn[other])
}

/**
 * Collapse orders that do the same thing.
 *
 * Two orders are equivalent when they leave the piece in the same place at the
 * same moment of the turn, which is all the rules ever look at.
 */
export function distinctOrders(board: Board, position: Position, side: Side): Orders[] {
  const seen = new Map<string, Orders>()
  const idle: Orders = ['.', '.', '.']

  for (const candidate of allOrders()) {
    const pair: [Orders, Orders] = side === 0 ? [candidate, idle] : [idle, candidate]
    const { beats } = resolveTurn(board, position, pair)
    const key = beats.map((beat) => beat.pieces[side]).join('-')
    if (!seen.has(key)) seen.set(key, candidate)
  }

  return [...seen.values()]
}

/**
 * Fictitious play: both sides repeatedly best-respond to the history of the
 * other, and the empirical frequencies converge on an equilibrium. It is not the
 * fastest solver, but it is twenty lines and needs no linear programming.
 */
function equilibrium(matrix: number[][], rounds = 240): { row: number[]; column: number[]; value: number } {
  const rows = matrix.length
  const columns = matrix[0].length
  const rowCounts = new Array<number>(rows).fill(0)
  const columnCounts = new Array<number>(columns).fill(0)
  const rowPayoff = new Array<number>(rows).fill(0)
  const columnPayoff = new Array<number>(columns).fill(0)

  for (let round = 0; round < rounds; round += 1) {
    let bestRow = 0
    for (let i = 1; i < rows; i += 1) if (rowPayoff[i] > rowPayoff[bestRow]) bestRow = i
    let bestColumn = 0
    for (let j = 1; j < columns; j += 1) if (columnPayoff[j] < columnPayoff[bestColumn]) bestColumn = j

    rowCounts[bestRow] += 1
    columnCounts[bestColumn] += 1
    for (let i = 0; i < rows; i += 1) rowPayoff[i] += matrix[i][bestColumn]
    for (let j = 0; j < columns; j += 1) columnPayoff[j] += matrix[bestRow][j]
  }

  const row = rowCounts.map((count) => count / rounds)
  const column = columnCounts.map((count) => count / rounds)

  let value = 0
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < columns; j += 1) value += row[i] * column[j] * matrix[i][j]
  }

  return { row, column, value }
}

export function analyseTurn(
  board: Board,
  position: Position,
  side: Side,
  chosen: Orders,
): TurnAnalysis {
  const other = (side === 0 ? 1 : 0) as Side
  const mine = distinctOrders(board, position, side)
  const theirs = distinctOrders(board, position, other)

  const matrix = mine.map((row) =>
    theirs.map((column) => {
      const pair: [Orders, Orders] = side === 0 ? [row, column] : [column, row]
      return payoff(board, position, pair, side)
    }),
  )

  const { column, value } = equilibrium(matrix)

  const against = (order: Orders) => {
    let total = 0
    theirs.forEach((reply, index) => {
      const pair: [Orders, Orders] = side === 0 ? [order, reply] : [reply, order]
      total += column[index] * payoff(board, position, pair, side)
    })
    return total
  }

  let best = mine[0]
  let bestValue = -Infinity
  for (const order of mine) {
    const worth = against(order)
    if (worth > bestValue) {
      bestValue = worth
      best = order
    }
  }

  const chosenValue = against(chosen)
  return {
    actionCount: mine.length,
    value,
    chosenValue,
    regret: Math.max(0, bestValue - chosenValue),
    best,
  }
}
