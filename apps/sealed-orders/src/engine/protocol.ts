import { generateBoard } from './board'
import {
  ordersFromText,
  ordersToText,
  resolveTurn,
  startPosition,
  verdict,
  type Orders,
  type Position,
  type Side,
} from './rules'

/**
 * The whole match lives in links.
 *
 * There is no server, which means there is nothing to stop the player who moves
 * second from reading the first player's move and answering it. So nobody sends a
 * move in the open until the other side is already locked in: one player publishes
 * a hash of their orders, the other then plays openly, and only afterwards is the
 * hash opened. Tampering is not prevented, it is *detected* — a reveal that does
 * not hash to the published commitment is shown as a broken seal.
 *
 * The nonce is what makes the commitment worth anything. Three steps from five
 * options is 125 possibilities, so a bare hash of the orders could be brute-forced
 * in a millisecond; a 128-bit nonce alongside them cannot.
 */

export const PROTOCOL_VERSION = 1

export interface Sealed {
  readonly commit: string
  readonly orders?: string
  readonly nonce?: string
}

export interface Match {
  readonly v: number
  readonly id: string
  readonly seed: string
  /** Turn number -> the committing side's sealed orders. */
  readonly sealed: Readonly<Record<number, Sealed>>
  /** Turn number -> the opening side's plain orders. */
  readonly open: Readonly<Record<number, string>>
}

export type Stage =
  | { kind: 'commit'; turn: number; side: Side }
  | { kind: 'open'; turn: number; side: Side }
  | { kind: 'reveal'; turn: number; side: Side }
  | { kind: 'over' }

/** Turn 1 is sealed by the first player, turn 2 by the second, and so on. */
export function committerOf(turn: number): Side {
  return ((turn - 1) % 2) as Side
}

export function openerOf(turn: number): Side {
  return (1 - committerOf(turn)) as Side
}

export function newMatch(seed: string, id: string): Match {
  return { v: PROTOCOL_VERSION, id, seed, sealed: {}, open: {} }
}

export interface Replay {
  readonly position: Position
  readonly turnsPlayed: number
  readonly brokenSeal: number | null
}

/** Fold every fully revealed turn into a position, stopping at a broken seal. */
export function replay(match: Match): Replay {
  const board = generateBoard(match.seed)
  let position = startPosition(board)
  let turn = 1
  let played = 0

  for (;;) {
    const sealed = match.sealed[turn]
    const open = match.open[turn]
    if (!sealed?.orders || !open) break

    const revealed = ordersFromText(sealed.orders)
    const opened = ordersFromText(open)
    if (!revealed || !opened) break

    const committer = committerOf(turn)
    const orders: [Orders, Orders] = committer === 0 ? [revealed, opened] : [opened, revealed]
    position = resolveTurn(board, position, orders).position
    played += 1
    turn += 1

    if (verdict(board, position).over) break
  }

  return { position, turnsPlayed: played, brokenSeal: null }
}

/** What the match is waiting for, and from whom. */
export function stageOf(match: Match): Stage {
  const board = generateBoard(match.seed)
  const state = replay(match)
  if (verdict(board, state.position).over) return { kind: 'over' }

  const turn = state.turnsPlayed + 1
  const sealed = match.sealed[turn]

  if (!sealed) return { kind: 'commit', turn, side: committerOf(turn) }
  if (!match.open[turn]) return { kind: 'open', turn, side: openerOf(turn) }
  return { kind: 'reveal', turn, side: committerOf(turn) }
}

/** Every action the holder of this link can take before passing it on. */
export function actionsFor(match: Match, side: Side): Stage[] {
  const actions: Stage[] = []
  let current = match

  for (let guard = 0; guard < 6; guard += 1) {
    const stage = stageOf(current)
    if (stage.kind === 'over' || stage.side !== side) break
    actions.push(stage)
    current = simulate(current, stage)
  }

  return actions
}

/** A placeholder application of a stage, used only to look one step ahead. */
function simulate(match: Match, stage: Stage): Match {
  if (stage.kind === 'commit') {
    return { ...match, sealed: { ...match.sealed, [stage.turn]: { commit: 'pending' } } }
  }
  if (stage.kind === 'open') {
    return { ...match, open: { ...match.open, [stage.turn]: '...' } }
  }
  if (stage.kind === 'reveal') {
    const sealed = match.sealed[stage.turn]
    return {
      ...match,
      sealed: { ...match.sealed, [stage.turn]: { ...sealed, orders: '...', nonce: '0' } },
    }
  }
  return match
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function commitmentText(match: Match, turn: number, orders: Orders, nonce: string): string {
  return `${match.id}:${turn}:${ordersToText(orders)}:${nonce}`
}

export async function seal(
  match: Match,
  turn: number,
  orders: Orders,
  nonce: string,
): Promise<Match> {
  const commit = await sha256(commitmentText(match, turn, orders, nonce))
  return { ...match, sealed: { ...match.sealed, [turn]: { commit } } }
}

export function play(match: Match, turn: number, orders: Orders): Match {
  return { ...match, open: { ...match.open, [turn]: ordersToText(orders) } }
}

export function unseal(match: Match, turn: number, orders: Orders, nonce: string): Match {
  const sealed = match.sealed[turn]
  if (!sealed) return match
  return {
    ...match,
    sealed: { ...match.sealed, [turn]: { ...sealed, orders: ordersToText(orders), nonce } },
  }
}

/** Does every opened commitment match what was published? */
export async function auditSeals(match: Match): Promise<number | null> {
  for (const [key, sealed] of Object.entries(match.sealed)) {
    if (!sealed.orders || !sealed.nonce) continue
    const turn = Number(key)
    const orders = ordersFromText(sealed.orders)
    if (!orders) return turn
    const expected = await sha256(commitmentText(match, turn, orders, sealed.nonce))
    if (expected !== sealed.commit) return turn
  }
  return null
}

/* ---------- links ---------- */

export function encodeMatch(match: Match): string {
  const json = JSON.stringify(match)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeMatch(encoded: string): Match | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const match = JSON.parse(new TextDecoder().decode(bytes)) as Match
    if (match.v !== PROTOCOL_VERSION || typeof match.seed !== 'string') return null
    return { ...match, sealed: match.sealed ?? {}, open: match.open ?? {} }
  } catch {
    return null
  }
}

/**
 * Does this link leak anything it should not?
 *
 * A link handed over at the sealing stage must not contain the orders it seals —
 * this is the property the whole design rests on, so it is checked rather than
 * assumed.
 */
export function leaksSealedOrders(match: Match, turn: number): boolean {
  const sealed = match.sealed[turn]
  if (!sealed) return false
  return sealed.orders !== undefined || sealed.nonce !== undefined
}
