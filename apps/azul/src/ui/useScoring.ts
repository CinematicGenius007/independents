/**
 * Playback of the wall-tiling.
 *
 * The engine fires every complete line at once, in a single call, because that
 * is what the rules say happens. Watching it that way is a number changing.
 * The best part of a round of Azul is the count itself — this tile touches
 * those three, so it is worth four — and an interface that skips it throws
 * away the game's best moment.
 *
 * So the position arrives finished and is *unwound*: this hook hands back the
 * wall as it was before the firing, then reveals the placements one at a time
 * on a clock the host has already budgeted for, with the running score at each
 * step. Nothing here changes the game; it only decides what has been shown yet.
 */

import { useEffect, useState } from 'react'
import type { GameState, Placement, RoundReport } from '../engine/types'
import { SCORING_STEP_MS } from '../net/protocol'

export interface ScoringPlayback {
  /** True while tiles are still being shown reaching the wall. */
  running: boolean
  /** Wall spaces not yet revealed, keyed `seat:row-col`. */
  hidden: Set<string>
  /** The tile being counted right now. */
  current: Placement | null
  /** Score to display per seat, counting up as tiles are revealed. */
  scores: number[]
  /** Placements already shown, keyed `seat:row-col`, for the fired look. */
  revealed: Set<string>
}

function key(seat: number, row: number, col: number): string {
  return `${seat}:${row}-${col}`
}

/** Every placement of the round, in the order they should be counted. */
function ordered(reports: RoundReport[]): Placement[] {
  return reports
    .flatMap(report => report.placements)
    .sort((a, b) => a.row - b.row || a.playerIndex - b.playerIndex)
}

export function useScoring(state: GameState | null): ScoringPlayback {
  const reports = state?.lastRound ?? null
  const round = state?.round ?? 0
  const [step, setStep] = useState(0)

  const placements = reports ? ordered(reports) : []
  const total = placements.length

  useEffect(() => {
    if (!reports) return
    setStep(0)
    if (total === 0) return
    const timer = setInterval(() => {
      setStep(previous => {
        if (previous >= total) {
          clearInterval(timer)
          return previous
        }
        return previous + 1
      })
    }, SCORING_STEP_MS)
    return () => clearInterval(timer)
    // Keyed on the round rather than the reports array so a re-render caused by
    // something else — a peer joining, a name change — does not restart it.
  }, [round, total, reports])

  const shown = reports ? Math.min(step, total) : total
  const hidden = new Set<string>()
  const revealed = new Set<string>()
  placements.forEach((placement, index) => {
    const id = key(placement.playerIndex, placement.row, placement.col)
    if (index < shown) revealed.add(id)
    else hidden.add(id)
  })

  const scores =
    state?.players.map((player, seat) => {
      const report = reports?.find(r => r.playerIndex === seat)
      if (!report) return player.score
      // Count the tiles shown so far, then apply the floor once they are all up.
      const gained = placements
        .slice(0, shown)
        .filter(p => p.playerIndex === seat)
        .reduce((sum, p) => sum + p.points, 0)
      // Once everything is up, the player's own score is the truth — it also
      // carries the end-of-game bonuses, which the round report does not.
      if (shown >= total) return player.score
      return Math.max(0, report.scoreBefore + gained)
    }) ?? []

  return {
    running: Boolean(reports) && shown < total,
    hidden,
    revealed,
    current: shown > 0 && shown <= total ? placements[shown - 1] : null,
    scores,
  }
}
