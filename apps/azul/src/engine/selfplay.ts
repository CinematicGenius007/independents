/**
 * Bots playing themselves, start to finish.
 *
 * Used by the tests and by `scripts/playtest.ts`. It is deliberately the same
 * loop the host runs in a real match — deal, take turns, tile the wall, deal
 * again — so anything that would deadlock a real game deadlocks here first.
 */

import type { BotStyle } from './bot'
import { chooseMove } from './bot'
import { Game } from './game'
import { legalMoves } from './rules'
import { createRng } from './rng'
import type { Color, GameState } from './types'
import { COLORS, TILES_PER_COLOR, WALL_SIZE, wallColor } from './types'

export interface PlaythroughOptions {
  styles: BotStyle[]
  seed: number
  /** Safety net: a real game ends in well under this many turns. */
  maxTurns?: number
}

export interface Playthrough {
  state: GameState
  turns: number
  rounds: number
}

/** Random legal play, as a floor to measure the bots against. */
export function randomMove(state: GameState, rng: () => number) {
  const moves = legalMoves(state)
  return moves.length === 0 ? null : moves[Math.floor(rng() * moves.length)]
}

export function playGame({ styles, seed, maxTurns = 400 }: PlaythroughOptions): Playthrough {
  const rng = createRng(seed ^ 0x5bf03635)
  const game = Game.create(
    styles.map((style, i) => ({ id: `bot${i}`, name: `${style} ${i + 1}` })),
    seed,
  )

  let turns = 0
  while (game.state.phase !== 'over') {
    if (game.needsDeal()) {
      game.deal()
      // A bag and lid both empty leave nothing to play with: the game is done.
      if (game.needsDeal()) break
      continue
    }
    if (game.state.phase === 'tiling') {
      game.tile()
      continue
    }
    const move = chooseMove(game.state, rng, styles[game.state.current])
    if (!move) throw new Error('a player to act with no legal move')
    game.play(move)
    if (++turns > maxTurns) throw new Error(`game did not end within ${maxTurns} turns`)
  }

  return { state: game.state, turns, rounds: game.state.round }
}

/**
 * Every tile visible in a position, by colour.
 *
 * The invariant worth checking after any transition: no colour ever exceeds
 * its twenty tiles. Tiles in the bag and lid are invisible here, so the count
 * is a ceiling, not an equality.
 */
export function visibleTiles(state: GameState): Map<Color, number> {
  const counts = new Map<Color, number>(COLORS.map(c => [c, 0]))
  const add = (color: Color, n = 1) => counts.set(color, (counts.get(color) ?? 0) + n)

  for (const player of state.players) {
    player.wall.forEach((row, r) =>
      row.forEach((filled, c) => {
        if (filled) add(wallColor(r, c))
      }),
    )
    for (const line of player.lines) if (line.color) add(line.color, line.count)
    for (const tile of player.floor) if (tile !== 'first') add(tile)
  }
  for (const display of state.factories) for (const tile of display) add(tile)
  for (const tile of state.center) add(tile)
  return counts
}

/** Throws if a position holds more tiles of a colour than the game contains. */
export function assertTileConservation(state: GameState): void {
  for (const [color, count] of visibleTiles(state)) {
    if (count > TILES_PER_COLOR) {
      throw new Error(`${count} ${color} tiles are in play; there are only ${TILES_PER_COLOR}`)
    }
  }
  for (const player of state.players) {
    for (let row = 0; row < WALL_SIZE; row++) {
      const line = player.lines[row]
      if (line.count > row + 1) throw new Error(`pattern line ${row} overfilled`)
      if (line.count > 0 && line.color === null) throw new Error(`pattern line ${row} has tiles of no colour`)
    }
  }
}
