/**
 * Scoring formulas, exactly per INIT_PLAN §6.
 */

/** Guesser score: `max(10, 100 - floor(elapsedMs / 1000) * 2)`. */
export function guesserPoints(elapsedMs: number): number {
  const elapsedSeconds = Math.floor(Math.max(0, elapsedMs) / 1000)
  return Math.max(10, 100 - elapsedSeconds * 2)
}

/** Drawer score: `10 * numberOfCorrectGuessers`. */
export function drawerPoints(correctCount: number): number {
  return 10 * Math.max(0, correctCount)
}
