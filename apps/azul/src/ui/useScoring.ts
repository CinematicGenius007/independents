/**
 * Playback of the round's scoring.
 *
 * The position arrives already scored. This hook plays the
 * {@link scoringTimeline} over it on a clock: until a tile's moment comes its
 * wall space still shows unfired, and every score shown counts up a point at a
 * time as each point lands on the track. Nothing here changes the game.
 *
 * Each event is reported exactly once, as the clock passes it, so the table
 * can fly the point and make the sound. Skipping jumps to the end without
 * replaying what was skipped — a skip is for someone who has seen enough.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState } from '../engine/types'
import { frameAt, scoringTimeline } from '../engine/timeline'
import type { Frame, Timeline, TimelineEvent } from '../engine/timeline'
import { prefersReducedMotion } from './useFlight'

export interface ScoringPlayback {
  /** True while the scoring is still being played out. */
  running: boolean
  frame: Frame
  /** The score each seat should show right now. */
  scores: number[]
  skip: () => void
}

export function useScoring(
  state: GameState | null,
  onEvent?: (event: TimelineEvent) => void,
): ScoringPlayback {
  const reports = state?.lastRound ?? null
  const finals = state?.finalReports ?? null

  const timeline = useMemo(
    () => scoringTimeline({ lastRound: reports, finalReports: finals }),
    [reports, finals],
  )

  const startScores = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of reports ?? []) map.set(r.playerIndex, r.scoreBefore)
    // A game that ended this round counts its bonuses from where the round left it.
    for (const f of finals ?? []) if (!map.has(f.playerIndex)) map.set(f.playerIndex, f.scoreBefore)
    return map
  }, [reports, finals])

  // The clock remembers which timeline it is timing. On the render where a
  // new round's scoring first appears, the effect that starts the clock has
  // not run yet; without this, that one frame would show the finished scores
  // and spoil the count before rewinding to zero.
  const [clock, setClock] = useState<{ timeline: Timeline | null; elapsed: number }>({
    timeline: null,
    elapsed: Number.POSITIVE_INFINITY,
  })
  const started = useRef(0)
  const reported = useRef(-1)
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent

  useEffect(() => {
    reported.current = -1
    if (timeline.total === 0 || prefersReducedMotion()) {
      setClock({ timeline, elapsed: Number.POSITIVE_INFINITY })
      reported.current = timeline.events.length - 1
      return
    }
    started.current = performance.now()
    setClock({ timeline, elapsed: 0 })

    let frame = 0
    const tick = () => {
      const now = performance.now() - started.current
      // Report every event the clock has passed since the last tick.
      while (reported.current + 1 < timeline.events.length && timeline.events[reported.current + 1].at <= now) {
        reported.current++
        eventRef.current?.(timeline.events[reported.current])
      }
      setClock({ timeline, elapsed: now })
      if (now < timeline.total) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [timeline])

  const skip = useCallback(() => {
    reported.current = timeline.events.length - 1
    started.current = performance.now() - timeline.total
    setClock({ timeline, elapsed: Number.POSITIVE_INFINITY })
  }, [timeline])

  const elapsed =
    clock.timeline === timeline
      ? clock.elapsed
      : timeline.total === 0 || prefersReducedMotion()
        ? Number.POSITIVE_INFINITY
        : 0

  const frame = useMemo(() => frameAt(timeline, startScores, elapsed), [timeline, startScores, elapsed])
  const running = !frame.done

  const scores =
    state?.players.map((player, seat) => (running ? (frame.scores.get(seat) ?? player.score) : player.score)) ?? []

  return { running, frame, scores, skip }
}
