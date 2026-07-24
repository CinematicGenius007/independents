/**
 * Deterministic turn order derivation.
 */

import type { PlayerId } from '../shared/types'
import { hashString, mulberry32, shuffle } from './rng'

/**
 * Derives the drawing order for a game. Sorts the input ids first so the
 * result never depends on `Record`/`Map`/`Set` iteration order (which is
 * insertion-order-dependent and can differ between peers that joined in
 * different sequences before reconciling their roster), then shuffles with a
 * PRNG seeded from `gameNonce`. Every peer computes the identical result.
 */
export function deriveOrder(players: readonly PlayerId[], gameNonce: string): PlayerId[] {
  const sorted = players.slice().sort()
  const rand = mulberry32(hashString(gameNonce))
  return shuffle(sorted, rand)
}
