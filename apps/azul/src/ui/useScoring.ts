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
import { PIP_FLIGHT_MS, frameAt, scoringTimeline } from '../engine/timeline'
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

  // Keyed by content, not identity: a snapshot that re-sends the same round
  // (a reconnect, a late join) must not restart a count already under way.
  const key = useMemo(() => JSON.stringify([reports, finals]), [reports, finals])
  const timeline = useMemo(
    () => scoringTimeline({ lastRound: reports, finalReports: finals }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  /**
   * The only moments the picture changes: a tile firing, a point leaving, a
   * point landing, the end. The clock wakes at these and nowhere else, rather
   * than re-rendering the whole table every animation frame for a minute.
   */
  const boundaries = useMemo(() => {
    const set = new Set<number>([timeline.total])
    for (const event of timeline.events) {
      set.add(event.at)
      if (event.kind === 'pip') set.add(event.at + PIP_FLIGHT_MS)
    }
    return [...set].sort((a, b) => a - b)
  }, [timeline])

  const startScores = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of reports ?? []) map.set(r.playerIndex, r.scoreBefore)
    // A game that ended this round counts its bonuses from where the round left it.
    for (const f of finals ?? []) if (!map.has(f.playerIndex)) map.set(f.playerIndex, f.scoreBefore)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

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

    let timer: ReturnType<typeof setTimeout> | undefined
    const step = () => {
      const now = performance.now() - started.current
      // Report every event the clock has passed since it last woke.
      while (reported.current + 1 < timeline.events.length && timeline.events[reported.current + 1].at <= now) {
        reported.current++
        eventRef.current?.(timeline.events[reported.current])
      }
      setClock({ timeline, elapsed: now })
      const next = boundaries.find(b => b > now)
      if (next !== undefined) timer = setTimeout(step, next - now + 1)
    }
    timer = setTimeout(step, (boundaries[0] ?? 0) + 1)
    return () => clearTimeout(timer)
  }, [timeline, boundaries])

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
