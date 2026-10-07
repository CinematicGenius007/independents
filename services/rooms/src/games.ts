/**
 * Every game the service will host, and how.
 *
 * Adding an app to the platform is adding an entry here — the room itself is
 * game-agnostic. The settings are the only things that genuinely differ
 * between games: how crowded a room may get, and whether the room should
 * remember what was said in it.
 */

export interface GameConfig {
  /**
   * Most clients connected at once, players and spectators together. A
   * client that drops and reconnects inside the grace window keeps its place.
   */
  maxPeers: number
  /**
   * Keep every broadcast and replay it to anyone who joins.
   *
   * Right for games with no hidden information, which can then run in
   * lockstep with no host: the log *is* the game. Wrong for games where one
   * peer deals from a private bag, because the log would outlive the deal.
   */
  log: boolean
  /** Entries kept before the oldest are dropped. Only meaningful with `log`. */
  logLimit: number
}

export const GAMES: Record<string, GameConfig> = {
  // Host-authoritative: one peer holds the bag and replicates its own
  // sequenced events, and snapshots catch up anyone who missed some.
  azul: { maxPeers: 12, log: false, logLimit: 0 },

  // Lockstep: no hidden state, no randomness. Clients replay the room log in
  // sequence and agree on the board without anyone being in charge, so the
  // log must stay whole: a game is at most ~85 entries, and this keeps about
  // twenty of them. Rooms are wiped hours after they empty in any case.
  'ultimate-ttt': { maxPeers: 10, log: true, logLimit: 2000 },
}

export function gameConfig(game: string): GameConfig | null {
  return Object.hasOwn(GAMES, game) ? GAMES[game] : null
}
