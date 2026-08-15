/**
 * The owner's side of a game: rules plus the bag they draw from.
 *
 * Exactly one participant holds a `Game` — the host of a room, or the local
 * player in a solo match. Everyone else holds a bare {@link GameState} and is
 * told what came out of the bag. Every method here returns the state so the
 * caller can broadcast it or hand it to React without reaching inside.
 */

import type { Rng } from './rng'
import { createRng, randomSeed } from './rng'
import { createSupply, dealFactories, discard, reconstructSupply } from './supply'
import { applyMove, createGame, needsDeal, startRound, tileWall } from './rules'
import type { Color, GameState, Move, Supply } from './types'
import { factoryCount } from './types'

export class Game {
  state: GameState
  private supply: Supply
  private rng: Rng

  private constructor(state: GameState, supply: Supply, rng: Rng) {
    this.state = state
    this.supply = supply
    this.rng = rng
  }

  /** A new game with fresh boards and a full bag. */
  static create(players: { id: string; name: string }[], seed: number = randomSeed()): Game {
    const rng = createRng(seed)
    return new Game(createGame(players), createSupply(rng), rng)
  }

  /**
   * Picks up a game already in progress — used when a host leaves and another
   * player takes over the bag.
   *
   * The new host cannot be handed the old one's bag, so it derives one: every
   * tile not visible on a board or on the table is still unplayed, and that
   * set, shuffled, is the bag. The one thing lost is the bag/lid ordering,
   * which no player could observe anyway.
   */
  static adopt(state: GameState, seed: number = randomSeed()): Game {
    const rng = createRng(seed)
    return new Game(state, reconstructSupply(state, rng), rng)
  }

  /** Deals the next round. Returns the tiles dealt, for replication. */
  deal(): { state: GameState; factories: Color[][] } {
    const factories = dealFactories(this.supply, factoryCount(this.state.players.length), this.rng)
    this.state = startRound(this.state, factories)
    return { state: this.state, factories }
  }

  /** Plays a move, throwing if it is not legal in the current position. */
  play(move: Move): GameState {
    const { state, discarded } = applyMove(this.state, move)
    discard(this.supply, discarded)
    this.state = state
    return state
  }

  /** Runs the wall-tiling phase and the end-of-game check with it. */
  tile(): GameState {
    const { state, discarded } = tileWall(this.state)
    discard(this.supply, discarded)
    this.state = state
    return state
  }

  /** True when the table is bare and the next round is waiting to be dealt. */
  needsDeal(): boolean {
    return needsDeal(this.state)
  }
}
