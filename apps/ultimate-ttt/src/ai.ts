/**
 * The machine opponent, built on the same rules every other player uses.
 *
 * Three levels, from forgiving to firm. All of them only ever return a move
 * from `legalMoves`, so the AI can never play something the table would ignore.
 */

import { WIN_LINES, applyMove, legalMoves } from './game'
import type { Cell, GameState, Move, Player } from './game'

export type Level = 'rookie' | 'tactician' | 'grandmaster'

export const LEVELS: { id: Level; name: string; blurb: string }[] = [
  { id: 'rookie', name: 'Rookie', blurb: 'Takes wins and blocks, otherwise wanders.' },
  { id: 'tactician', name: 'Tactician', blurb: 'Looks three moves ahead.' },
  { id: 'grandmaster', name: 'Grandmaster', blurb: 'Searches deep, and does not forget.' },
]

const other = (p: Player): Player => (p === 'X' ? 'O' : 'X')
const pickRandom = <T>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)]

/** How promising a line of three cells is for `me`: open lines count, blocked ones do not. */
function lineValue(cells: (Cell | 'tie')[], me: Player): number {
  const opp = other(me)
  let value = 0
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]]
    const mine = line.filter(x => x === me).length
    const theirs = line.filter(x => x === opp).length
    if (line.includes('tie')) continue
    if (theirs === 0 && mine > 0) value += mine === 1 ? 1 : 4
    else if (mine === 0 && theirs > 0) value -= theirs === 1 ? 1 : 4
  }
  return value
}

const WIN = 100000

/** A static judgement of a position from `me`'s side; positive is good for me. */
export function evaluate(state: GameState, me: Player): number {
  if (state.winner === 'tie') return 0
  if (state.winner) return state.winner === me ? WIN : -WIN
  const opp = other(me)
  let value = 0
  for (let b = 0; b < 9; b++) {
    const w = state.boardWinners[b]
    const weight = b === 4 ? 1.5 : b % 2 === 0 ? 1.2 : 1
    if (w === me) value += 100 * weight
    else if (w === opp) value -= 100 * weight
    else if (!w) value += lineValue(state.boards[b], me) * 3 * weight
  }
  value += lineValue(state.boardWinners, me) * 40
  // Being sent somewhere already decided is a free choice for whoever moves.
  if (state.activeBoard === null) value += state.current === me ? 15 : -15
  return value
}

const TIMEOUT = Symbol('timeout')

interface Budget {
  deadline: number
  nodes: number
}

function search(state: GameState, depth: number, alpha: number, beta: number, me: Player, budget: Budget): number {
  if (state.winner || depth === 0) {
    const v = evaluate(state, me)
    // Prefer quick wins and slow losses.
    return v === WIN ? v + depth : v === -WIN ? v - depth : v
  }
  if ((++budget.nodes & 255) === 0 && Date.now() > budget.deadline) throw TIMEOUT

  const children = ordered(state, me)
  if (state.current === me) {
    let best = -Infinity
    for (const { next } of children) {
      best = Math.max(best, search(next, depth - 1, alpha, beta, me, budget))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const { next } of children) {
    best = Math.min(best, search(next, depth - 1, alpha, beta, me, budget))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

interface Child {
  move: Move
  next: GameState
  hint: number
}

/** Children, most forcing first, so alpha-beta can cut early. */
function ordered(state: GameState, me: Player): Child[] {
  const mover = state.current
  const children: Child[] = []
  for (const move of legalMoves(state)) {
    const next = applyMove(state, move)!
    let hint = 0
    if (next.winner && next.winner !== 'tie') hint = 1000
    else if (next.boardWinners[move.board] !== state.boardWinners[move.board]) hint = 100
    if (next.activeBoard === null) hint -= 30 // do not hand over a free choice
    if (mover !== me) hint = -hint // the minimiser wants to see its best (lowest) first
    children.push({ move, next, hint })
  }
  return children.sort((a, b) => (mover === me ? b.hint - a.hint : a.hint - b.hint))
}

function rookie(state: GameState, rng: () => number): Move {
  const me = state.current
  const children = ordered(state, me)
  const winning = children.filter(c => c.next.winner === me)
  if (winning.length) return pickRandom(winning, rng).move
  const captures = children.filter(c => c.next.boardWinners[c.move.board] === me)
  if (captures.length) return pickRandom(captures, rng).move

  // Block: a cell that would let the opponent take a small board.
  const opp = other(me)
  const blocks = children.filter(c => {
    const board = state.boards[c.move.board].slice()
    board[c.move.cell] = opp
    return WIN_LINES.some(([a, b, cc]) => board[a] === opp && board[b] === opp && board[cc] === opp)
  })
  if (blocks.length) return pickRandom(blocks, rng).move
  return pickRandom(children, rng).move
}

/** Searches to a fixed depth and picks among equally good moves at random. */
function fixedDepth(state: GameState, depth: number, rng: () => number): Move {
  const me = state.current
  const budget: Budget = { deadline: Infinity, nodes: 0 }
  let best = -Infinity
  let bestMoves: Move[] = []
  for (const { move, next } of ordered(state, me)) {
    const v = search(next, depth - 1, -Infinity, Infinity, me, budget)
    if (v > best) {
      best = v
      bestMoves = [move]
    } else if (v === best) bestMoves.push(move)
  }
  return pickRandom(bestMoves, rng)
}

/** Deepens one ply at a time until the budget runs out, keeping the last full answer. */
function timed(state: GameState, budgetMs: number, rng: () => number): Move {
  const me = state.current
  const budget: Budget = { deadline: Date.now() + budgetMs, nodes: 0 }
  const root = ordered(state, me)
  let answer = pickRandom(root, rng).move
  for (let depth = 1; depth <= 14; depth++) {
    let best = -Infinity
    let bestMoves: Move[] = []
    try {
      for (const { move, next } of root) {
        const v = search(next, depth - 1, -Infinity, Infinity, me, budget)
        if (v > best) {
          best = v
          bestMoves = [move]
        } else if (v === best) bestMoves.push(move)
      }
    } catch (e) {
      if (e === TIMEOUT) break
      throw e
    }
    answer = pickRandom(bestMoves, rng)
    if (Math.abs(best) >= WIN - 20) break // forced win or loss; deeper changes nothing
  }
  return answer
}

/** Chooses a move for whoever is to play. The position must have at least one legal move. */
export function chooseMove(state: GameState, level: Level, rng: () => number = Math.random, budgetMs = 700): Move {
  switch (level) {
    case 'rookie':
      return rookie(state, rng)
    case 'tactician':
      return fixedDepth(state, 3, rng)
    case 'grandmaster':
      return timed(state, budgetMs, rng)
  }
}
