import { describe, expect, it } from 'vitest'
import type { CanvasOp } from './types'
import { appendToHistory, createCanvasHistory, renderHistory, undoHistoryBy } from './history'
import { replayOps } from './renderer'

const stroke = (id: number, by = 'drawer'): CanvasOp => ({
  t: 'stroke',
  id,
  by,
  tool: 'pencil',
  color: id % 2 === 0 ? '#1A1A1A' : '#F2603C',
  size: 2,
  pts: new Int16Array([id * 1_000, 0, id * 1_000, 10_000]),
})

describe('canvas history', () => {
  it('folds old ops into a baseline without changing pixels', () => {
    const allOps = [stroke(0), stroke(1), stroke(2), stroke(3), stroke(4)]
    let history = createCanvasHistory(24, 16)
    for (const op of allOps) history = appendToHistory(history, op, 3)
    expect(history.ops.map((op) => op.id)).toEqual([2, 3, 4])
    expect(renderHistory(history).pixels).toEqual(replayOps(allOps, 24, 16).pixels)
  })

  it('undoes the latest retained operation by author', () => {
    let history = createCanvasHistory(16, 10)
    history = appendToHistory(history, stroke(0, 'a'))
    history = appendToHistory(history, stroke(1, 'b'))
    history = appendToHistory(history, stroke(2, 'a'))
    expect(undoHistoryBy(history, 'a').ops.map((op) => op.id)).toEqual([0, 1])
    expect(undoHistoryBy(history, 'missing')).toBe(history)
  })

  it('retains and renders a 5,000-point stroke', () => {
    const points = new Int16Array(10_000)
    for (let index = 0; index < points.length; index += 2) {
      points[index] = index % 10_001
      points[index + 1] = (index * 7) % 10_001
    }
    const op: CanvasOp = {
      t: 'stroke', id: 0, by: 'drawer', tool: 'pencil', color: '#1A1A1A', size: 1, pts: points,
    }
    const history = appendToHistory(createCanvasHistory(160, 100), op)
    expect(history.ops[0]).toMatchObject({ t: 'stroke' })
    expect(history.ops[0].t === 'stroke' ? history.ops[0].pts : null).toHaveLength(10_000)
    expect(renderHistory(history).pixels.some((value) => value !== 255)).toBe(true)
  })
})
