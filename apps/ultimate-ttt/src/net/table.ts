/**
 * An online table, as a fold over the room's message log.
 *
 * There is no host. The rooms service stamps every message with a sequence
 * number, and every browser — including the sender, via echo — applies the
 * messages in that order through {@link reduceTable}. Same messages, same
 * order, same pure function: same table everywhere, with nobody in charge.
 *
 * That also makes the awkward cases simple:
 *
 * - **Races.** Two people claim X at once; the one sequenced first gets it,
 *   and both browsers agree which that was.
 * - **Cheating, of the lazy kind.** A move from someone not seated on the side
 *   to play is ignored by every reducer, so there is nothing to argue about.
 * - **Late joiners and reloads.** The service keeps the log for this game and
 *   replays it on join; folding it rebuilds the board exactly. The log is
 *   never rebased, so the history every browser folds is the same history.
 */

import { applyMove, initialState } from '../game'
import type { GameState, Player } from '../game'

export type TableMessage =
  /** Take a side. Ignored if it is taken or the sender already has one. */
  | { k: 'claim'; side: Player }
  | { k: 'move'; board: number; cell: number }
  /**
   * Start a fresh game once this one is over. Sides swap, so the other player
   * opens. The new seats are derived from the table, never taken from the
   * message, and the log is never rebased: every browser — present from the
   * start or joining later — validates the rematch against the same complete
   * history, so a bogus one is ignored by all of them alike.
   */
  | { k: 'rematch' }

export interface Seats {
  X: string | null
  O: string | null
}

export interface Table {
  seats: Seats
  game: GameState
  /** How many games this table has started, so the UI can tell them apart. */
  round: number
}

export function emptyTable(): Table {
  return { seats: { X: null, O: null }, game: initialState('X'), round: 1 }
}

/** The side a client sits on, or null for a spectator. */
export function sideOf(table: Table, client: string): Player | null {
  if (table.seats.X === client) return 'X'
  if (table.seats.O === client) return 'O'
  return null
}

function isMessage(value: unknown): value is TableMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  if (m.k === 'claim') return m.side === 'X' || m.side === 'O'
  if (m.k === 'move') return typeof m.board === 'number' && typeof m.cell === 'number'
  if (m.k === 'rematch') return true
  return false
}

/**
 * Applies one sequenced message. Anything malformed or not allowed is a no-op,
 * never an exception: a bad message from one client must not be able to stop
 * everyone else's game.
 */
export function reduceTable(table: Table, from: string, data: unknown): Table {
  if (!isMessage(data)) return table

  switch (data.k) {
    case 'claim': {
      if (table.seats[data.side] !== null || sideOf(table, from) !== null) return table
      return { ...table, seats: { ...table.seats, [data.side]: from } }
    }
    case 'move': {
      if (sideOf(table, from) !== table.game.current) return table
      if (!table.seats.X || !table.seats.O) return table // no moves until both sit
      const game = applyMove(table.game, { board: data.board, cell: data.cell })
      return game ? { ...table, game } : table
    }
    case 'rematch': {
      // Only a seated player, and only once the game is over: nobody can reset
      // a game in progress or reseat anyone.
      if (sideOf(table, from) === null || table.game.winner === null) return table
      return { seats: { X: table.seats.O, O: table.seats.X }, game: initialState('X'), round: table.round + 1 }
    }
  }
}

/** The rematch a seated player sends once the game is over. */
export function rematchMessage(): TableMessage {
  return { k: 'rematch' }
}

/** Folds a whole log, oldest first. */
export function replay(log: { from: string; data: unknown }[], start: Table = emptyTable()): Table {
  return log.reduce((table, entry) => reduceTable(table, entry.from, entry.data), start)
}
