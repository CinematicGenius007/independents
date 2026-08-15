/**
 * The bag and the lid.
 *
 * Kept apart from {@link GameState} on purpose. Only the player running the
 * game holds a {@link Supply}; everyone else receives the tiles that came out
 * of it, already dealt. A peer cannot look ahead at a bag it does not have.
 */

import type { Rng } from './rng'
import { shuffle } from './rng'
import type { Color, GameState, Supply } from './types'
import { COLORS, TILES_PER_COLOR, TILES_PER_FACTORY, wallColor } from './types'

/** A full bag of 100 tiles, shuffled, and an empty lid. */
export function createSupply(rng: Rng): Supply {
  const bag: Color[] = []
  for (const color of COLORS) {
    for (let i = 0; i < TILES_PER_COLOR; i++) bag.push(color)
  }
  return { bag: shuffle(bag, rng), lid: [] }
}

/**
 * Draws one tile, refilling the bag from the lid if it has run out.
 *
 * Returns null only when bag and lid are both empty, which is the rules' own
 * corner case: the round is played with whatever the displays could be given.
 */
export function drawTile(supply: Supply, rng: Rng): Color | null {
  if (supply.bag.length === 0) {
    if (supply.lid.length === 0) return null
    supply.bag = shuffle(supply.lid, rng)
    supply.lid = []
  }
  return supply.bag.pop() ?? null
}

/**
 * Deals a round: `count` displays of up to four tiles each.
 *
 * Short displays at the bottom of the bag are legal and are left short.
 */
export function dealFactories(supply: Supply, count: number, rng: Rng): Color[][] {
  const factories: Color[][] = []
  for (let i = 0; i < count; i++) {
    const display: Color[] = []
    for (let t = 0; t < TILES_PER_FACTORY; t++) {
      const tile = drawTile(supply, rng)
      if (tile === null) break
      display.push(tile)
    }
    factories.push(display)
  }
  return factories
}

/** Puts discarded tiles into the lid, where they wait to be reshuffled. */
export function discard(supply: Supply, tiles: Color[]): void {
  supply.lid.push(...tiles)
}

/**
 * Derives a supply from a position, by subtracting every tile you can see from
 * the full set of a hundred.
 *
 * This is how a player who takes over a broken host gets a bag: the tiles on
 * the walls, in the pattern lines, on the floors, on the displays and in the
 * centre are all accounted for, and whatever is left over is unplayed. Bag and
 * lid are merged into one shuffled bag, which is the only detail lost, and no
 * player could have known that ordering to begin with.
 */
export function reconstructSupply(state: GameState, rng: Rng): Supply {
  const remaining = new Map<Color, number>(COLORS.map(c => [c, TILES_PER_COLOR]))
  const take = (color: Color, n = 1) => remaining.set(color, (remaining.get(color) ?? 0) - n)

  for (const player of state.players) {
    player.wall.forEach((row, r) => {
      row.forEach((filled, c) => {
        if (filled) take(wallColor(r, c))
      })
    })
    for (const line of player.lines) {
      if (line.color) take(line.color, line.count)
    }
    for (const tile of player.floor) {
      if (tile !== 'first') take(tile)
    }
  }
  for (const display of state.factories) {
    for (const tile of display) take(tile)
  }
  for (const tile of state.center) take(tile)

  const bag: Color[] = []
  for (const [color, count] of remaining) {
    for (let i = 0; i < Math.max(0, count); i++) bag.push(color)
  }
  return { bag: shuffle(bag, rng), lid: [] }
}
