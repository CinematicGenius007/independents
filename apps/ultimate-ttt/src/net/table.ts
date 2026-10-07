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
 *   replays it on join; folding it rebuilds the board exactly.
 */

import { applyMove, initialState } from '../game'
import type { GameState, Player } from '../game'

export type TableMessage =
  /** Take a side. Ignored if it is taken or the sender already has one. */
  | { k: 'claim'; side: Player }
  | { k: 'move'; board: number; cell: number }
  /**
   * Start a fresh game. Sent with `rebase`, so the service drops the old log;
   * it therefore carries the seats, which are otherwise only in the old log.
   * Sides swap, so the other player opens.
   */
  | { k: 'rematch'; seats: Seats }

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
  if (m.k === 'rematch') {
    const s = m.seats as Record<string, unknown> | undefined
    return !!s && (s.X === null || typeof s.X === 'string') && (s.O === null || typeof s.O === 'string')
  }
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
      // Only a seated player may call one. On a rebased log this message is
      // the first entry, so a fresh table has no seats yet: trust the payload,
      // which every client receives identically.
      const seated = sideOf(table, from) !== null
      const fresh = table.seats.X === null && table.seats.O === null && table.game.moveCount === 0
      if (!seated && !fresh) return table
      const seats = data.seats
      if (sideOf({ ...table, seats }, from) === null) return table
      return { seats, game: initialState('X'), round: table.round + 1 }
    }
  }
}

/** The rematch a seated player sends: same two people, sides swapped. */
export function rematchMessage(table: Table): TableMessage {
  return { k: 'rematch', seats: { X: table.seats.O, O: table.seats.X } }
}

/** Folds a whole log, oldest first. */
export function replay(log: { from: string; data: unknown }[], start: Table = emptyTable()): Table {
  return log.reduce((table, entry) => reduceTable(table, entry.from, entry.data), start)
}
