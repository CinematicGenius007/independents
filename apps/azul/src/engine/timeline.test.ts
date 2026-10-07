import { describe, expect, it } from 'vitest'
import { FOCUS_MS, MAX_TIMELINE_MS, PIP_FLIGHT_MS, PLACE_MS, frameAt, scoringTimeline } from './timeline'
import type { FinalReport, RoundReport } from './types'

function report(partial: Partial<RoundReport> & { playerIndex: number }): RoundReport {
  return { placements: [], penalty: 0, floor: [], scoreBefore: 0, scoreAfter: 0, ...partial }
}

const place = (playerIndex: number, row: number, col: number, points: number) => ({
  playerIndex,
  row,
  col,
  color: 'cobalt' as const,
  points,
  horizontal: 1,
  vertical: 1,
})

describe('the scoring timeline', () => {
  it('scores players one at a time, tiles one at a time, points one at a time', () => {
    const tl = scoringTimeline({
      lastRound: [
        report({ playerIndex: 0, placements: [place(0, 0, 0, 1), place(0, 1, 1, 3)], scoreBefore: 5, scoreAfter: 9 }),
        report({ playerIndex: 1, placements: [place(1, 2, 2, 2)], scoreBefore: 0, scoreAfter: 2 }),
      ],
      finalReports: null,
    })
    const kinds = tl.events.map(e => `${e.kind}:${e.seat}`)
    expect(kinds).toEqual([
      'focus:0', 'place:0', 'pip:0', 'place:0', 'pip:0', 'pip:0', 'pip:0',
      'focus:1', 'place:1', 'pip:1', 'pip:1',
    ])
    const times = tl.events.map(e => e.at)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    // Seat 1 does not start until seat 0 is entirely done.
    const lastOfZero = Math.max(...tl.events.filter(e => e.seat === 0).map(e => e.at))
    expect(tl.events.find(e => e.seat === 1)!.at).toBeGreaterThan(lastOfZero + PIP_FLIGHT_MS - 1)
  })

  it('takes points off for the floor, but only as many as were really lost', () => {
    // 1 point scored, penalty -4, floored at zero: only 1 point actually comes off.
    const tl = scoringTimeline({
      lastRound: [report({ playerIndex: 0, placements: [place(0, 0, 0, 1)], penalty: -4, scoreBefore: 0, scoreAfter: 0 })],
      finalReports: null,
    })
    const pips = tl.events.filter(e => e.kind === 'pip')
    expect(pips.map(p => (p as { delta: number }).delta)).toEqual([1, -1])
    expect(pips.map(p => (p as { scoreAfter: number }).scoreAfter)).toEqual([1, 0])
  })

  it('skips players to whom nothing happened, and is empty for an empty round', () => {
    const tl = scoringTimeline({
      lastRound: [report({ playerIndex: 0 }), report({ playerIndex: 1, placements: [place(1, 0, 0, 1)], scoreAfter: 1 })],
      finalReports: null,
    })
    expect(tl.events.some(e => e.seat === 0)).toBe(false)
    expect(scoringTimeline({ lastRound: [report({ playerIndex: 0 })], finalReports: null })).toEqual({ events: [], total: 0 })
  })

  it('pays the end-of-game bonuses as their own steps', () => {
    const finals: FinalReport[] = [
      { playerIndex: 0, rows: 1, columns: 1, colors: 0, bonus: 9, scoreBefore: 30, scoreAfter: 39 },
    ]
    const tl = scoringTimeline({ lastRound: [], finalReports: finals })
    const bonuses = tl.events.filter(e => e.kind === 'bonus')
    expect(bonuses.map(b => (b as { label: string; points: number }).label)).toEqual(['1 row', '1 column'])
    const last = tl.events.filter(e => e.kind === 'pip').at(-1) as { scoreAfter: number }
    expect(last.scoreAfter).toBe(39)
  })

  it('compresses the heaviest real round to fit, without dropping a point', () => {
    // A tile scores at most 10 (a full row and a full column through it), and
    // a player fires at most five tiles in a round: four players, all maxed.
    const heavy = Array.from({ length: 5 }, (_, row) => place(0, row, row, 10))
    const reports = [0, 1, 2, 3].map(seat =>
      report({ playerIndex: seat, placements: heavy.map(p => ({ ...p, playerIndex: seat })), scoreAfter: 50 }),
    )
    const tl = scoringTimeline({ lastRound: reports, finalReports: null })
    expect(tl.total).toBeLessThanOrEqual(MAX_TIMELINE_MS + 2000)
    expect(tl.events.filter(e => e.kind === 'pip')).toHaveLength(200)
  })

  it('never counts faster than the floor, even for impossible input', () => {
    const absurd = Array.from({ length: 5 }, (_, row) => place(0, row, row, 60))
    const tl = scoringTimeline({ lastRound: [report({ playerIndex: 0, placements: absurd, scoreAfter: 300 })], finalReports: null })
    const pips = tl.events.filter(e => e.kind === 'pip')
    expect(pips).toHaveLength(300)
    const gaps = pips.slice(1).map((p, i) => p.at - pips[i].at).filter(g => g > 0)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(90)
  })
})

describe('a frame of the timeline', () => {
  const tl = scoringTimeline({
    lastRound: [report({ playerIndex: 0, placements: [place(0, 0, 0, 2)], scoreBefore: 10, scoreAfter: 12 })],
    finalReports: null,
  })
  const start = new Map([[0, 10]])

  it('hides tiles that have not fired yet', () => {
    const f = frameAt(tl, start, 0)
    expect(f.pending.has('0:0-0')).toBe(true)
    expect(f.fired.size).toBe(0)
    expect(f.focus).toBe(0)
  })

  it('counts a point only once it has landed', () => {
    const firstPip = FOCUS_MS + PLACE_MS
    expect(frameAt(tl, start, firstPip).scores.get(0)).toBe(10)
    expect(frameAt(tl, start, firstPip + PIP_FLIGHT_MS).scores.get(0)).toBe(11)
  })

  it('ends on the real score', () => {
    const f = frameAt(tl, start, tl.total)
    expect(f.done).toBe(true)
    expect(f.scores.get(0)).toBe(12)
    expect(f.pending.size).toBe(0)
  })
})
