/**
 * The wall-tiling, as a script with timestamps.
 *
 * The rules tile every wall at once. Shown that way, scoring is a number that
 * changes. Shown this way, it is the part of the game people lean in for: one
 * player at a time, one tile at a time, and every point carried across the
 * table to the score track on its own, so you can count along.
 *
 * This is a pure function of the round's reports. That matters because two
 * parties read it: the host, which must not deal the next round until the
 * script has finished, and every screen, which plays it. Both compute the same
 * timeline from the same reports, so pacing cannot drift between them.
 */

import type { Color, FinalReport, GameState, RoundReport } from './types'

/** Pause on a player before their tiles start firing. */
export const FOCUS_MS = 800
/** A tile landing on the wall, before its points start to move. */
export const PLACE_MS = 950
/** Between one point leaving and the next. */
export const PIP_INTERVAL_MS = 260
/** How long one point takes to cross to the score track. */
export const PIP_FLIGHT_MS = 700
/** After the last point of a tile has landed. */
export const AFTER_TILE_MS = 450
/** Before floor penalties start coming off. */
export const PENALTY_INTRO_MS = 600
/** Between one player's scoring and the next. */
export const BETWEEN_PLAYERS_MS = 700
/** Before each end-of-game bonus is paid out. */
export const BONUS_INTRO_MS = 900
/** After everything, before the table moves on. */
export const SETTLE_MS = 1400

/**
 * However long a round's scoring would take at full pace, it is compressed to
 * fit this. Slow is the point; a forty-point final round taking two minutes
 * is not.
 */
export const MAX_TIMELINE_MS = 75_000
/** Points never move faster than this, however much there is to count. */
const MIN_PIP_INTERVAL_MS = 90

export type TimelineEvent =
  | { kind: 'focus'; at: number; seat: number }
  | { kind: 'place'; at: number; seat: number; row: number; col: number; color: Color; points: number }
  /** One point moving: onto the track (+1) or off it (−1). */
  | {
      kind: 'pip'
      at: number
      seat: number
      delta: 1 | -1
      /** The score shown once this point has landed. */
      scoreAfter: number
      /** Where the point flies from (or to, for a penalty). */
      source: { kind: 'wall'; row: number; col: number } | { kind: 'floor' } | { kind: 'bonus' }
    }
  | { kind: 'bonus'; at: number; seat: number; label: string; points: number }

export interface Timeline {
  events: TimelineEvent[]
  /** When the last event has finished, in ms from the start. */
  total: number
}

interface Pace {
  pip: number
}

/** The round's scoring, and the final bonuses if the game just ended. */
export function scoringTimeline(state: Pick<GameState, 'lastRound' | 'finalReports'>): Timeline {
  const reports = state.lastRound ?? []
  const finals = state.finalReports ?? []
  const draft = build(reports, finals, { pip: PIP_INTERVAL_MS })
  if (draft.total <= MAX_TIMELINE_MS) return draft

  // Too long at full pace: speed up the counting, never the reveals, until it
  // fits — or until points are moving as fast as they usefully can.
  const pips = draft.events.filter(e => e.kind === 'pip').length
  const fixed = draft.total - pips * PIP_INTERVAL_MS
  const pip = Math.max(MIN_PIP_INTERVAL_MS, Math.floor((MAX_TIMELINE_MS - fixed) / Math.max(1, pips)))
  return build(reports, finals, { pip })
}

function build(reports: RoundReport[], finals: FinalReport[], pace: Pace): Timeline {
  const events: TimelineEvent[] = []
  let t = 0
  let any = false

  const ordered = [...reports].sort((a, b) => a.playerIndex - b.playerIndex)
  for (const report of ordered) {
    const seat = report.playerIndex
    const gained = report.placements.length > 0
    const penalty = report.scoreBefore + report.placements.reduce((s, p) => s + p.points, 0) - report.scoreAfter
    if (!gained && penalty === 0) continue // nothing happened to this player

    if (any) t += BETWEEN_PLAYERS_MS
    any = true
    events.push({ kind: 'focus', at: t, seat })
    t += FOCUS_MS

    let score = report.scoreBefore
    for (const placement of [...report.placements].sort((a, b) => a.row - b.row)) {
      events.push({
        kind: 'place',
        at: t,
        seat,
        row: placement.row,
        col: placement.col,
        color: placement.color,
        points: placement.points,
      })
      t += PLACE_MS
      for (let i = 0; i < placement.points; i++) {
        score++
        events.push({
          kind: 'pip',
          at: t,
          seat,
          delta: 1,
          scoreAfter: score,
          source: { kind: 'wall', row: placement.row, col: placement.col },
        })
        t += pace.pip
      }
      t += PIP_FLIGHT_MS - pace.pip + AFTER_TILE_MS
    }

    // The floor takes back what it costs — but never below zero, so the number
    // of points that come off is what was actually lost, not the raw penalty.
    if (penalty > 0) {
      t += PENALTY_INTRO_MS
      for (let i = 0; i < penalty; i++) {
        score--
        events.push({ kind: 'pip', at: t, seat, delta: -1, scoreAfter: score, source: { kind: 'floor' } })
        t += pace.pip
      }
      t += PIP_FLIGHT_MS - pace.pip
    }
  }

  // The end of the game: rows, columns and full colours, player by player.
  for (const final of [...finals].sort((a, b) => a.playerIndex - b.playerIndex)) {
    if (final.bonus === 0) continue
    const seat = final.playerIndex
    if (any) t += BETWEEN_PLAYERS_MS
    any = true
    events.push({ kind: 'focus', at: t, seat })
    t += FOCUS_MS
    let score = final.scoreBefore
    const parts: [string, number][] = [
      [`${final.rows} row${final.rows === 1 ? '' : 's'}`, final.rows * 2],
      [`${final.columns} column${final.columns === 1 ? '' : 's'}`, final.columns * 7],
      [`${final.colors} colour${final.colors === 1 ? '' : 's'}`, final.colors * 10],
    ]
    for (const [label, points] of parts) {
      if (points === 0) continue
      t += BONUS_INTRO_MS
      events.push({ kind: 'bonus', at: t, seat, label, points })
      for (let i = 0; i < points; i++) {
        score++
        events.push({ kind: 'pip', at: t, seat, delta: 1, scoreAfter: score, source: { kind: 'bonus' } })
        t += pace.pip
      }
      t += PIP_FLIGHT_MS - pace.pip
    }
  }

  return { events, total: any ? t + SETTLE_MS : 0 }
}

/**
 * Where the script stands at `elapsed` ms: the score each seat shows, which
 * wall tiles have fired, and what is happening right now.
 */
export interface Frame {
  /** Score per seat, as far as the counting has got. */
  scores: Map<number, number>
  /** Wall spaces already fired, keyed `seat:row-col`. */
  fired: Set<string>
  /** Wall spaces this round fires but that have not yet been shown. */
  pending: Set<string>
  focus: number | null
  /** The tile being counted, if any. */
  current: Extract<TimelineEvent, { kind: 'place' }> | null
  /** The bonus being paid out, if any. */
  bonus: Extract<TimelineEvent, { kind: 'bonus' }> | null
  done: boolean
}

/**
 * The frame at `elapsed`. A point counts on the score once it has *landed*, a
 * flight's length after it left, so the number ticks up as the piece arrives
 * rather than when it sets off.
 */
export function frameAt(timeline: Timeline, startScores: Map<number, number>, elapsed: number): Frame {
  const scores = new Map(startScores)
  const fired = new Set<string>()
  const pending = new Set<string>()
  let focus: number | null = null
  let current: Frame['current'] = null
  let bonus: Frame['bonus'] = null

  for (const event of timeline.events) {
    if (event.kind === 'place') {
      const key = `${event.seat}:${event.row}-${event.col}`
      if (event.at <= elapsed) {
        fired.add(key)
        current = event
      } else {
        pending.add(key)
      }
      continue
    }
    if (event.at > elapsed) continue
    if (event.kind === 'focus') {
      focus = event.seat
      current = null
      bonus = null
    } else if (event.kind === 'bonus') {
      bonus = event
      current = null
    } else if (event.kind === 'pip' && event.at + PIP_FLIGHT_MS <= elapsed) {
      scores.set(event.seat, event.scoreAfter)
    }
  }

  const done = elapsed >= timeline.total
  return { scores, fired, pending, focus: done ? null : focus, current: done ? null : current, bonus: done ? null : bonus, done }
}
