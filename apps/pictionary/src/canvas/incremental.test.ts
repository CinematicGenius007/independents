import { describe, expect, it } from 'vitest'
import { createIncrementalRenderer } from './incremental'
import { createCanvasHistory, renderHistory, type CanvasHistory } from './history'
import { createRaster } from './renderer'
import type { CanvasOp } from './types'

/**
 * The incremental renderer exists purely as an optimisation, so the only
 * property that matters is that it is indistinguishable from a full replay.
 * Every case here renders the same history both ways and compares pixels.
 */

function stroke(id: number, by: string, points: number[], color = '#1A1A1A'): CanvasOp {
  return { t: 'stroke', id, by, tool: 'pencil', color, size: 8, pts: Int16Array.from(points) }
}

function extend(op: CanvasOp, points: number[]): CanvasOp {
  if (op.t !== 'stroke') throw new Error('not a stroke')
  const merged = new Int16Array(op.pts.length + points.length)
  merged.set(op.pts, 0)
  merged.set(Int16Array.from(points), op.pts.length)
  return { ...op, pts: merged }
}

/**
 * Tests render into a small raster rather than the production 1600x1000: the
 * quantised coordinate space is resolution independent, so the code paths are
 * identical while the pixel comparison stays cheap.
 */
const TEST_WIDTH = 160
const TEST_HEIGHT = 100

function emptyHistory(): CanvasHistory {
  return createCanvasHistory(TEST_WIDTH, TEST_HEIGHT)
}

function expectMatchesFullReplay(renderer: ReturnType<typeof createIncrementalRenderer>, history: CanvasHistory) {
  const incremental = renderer.render(history)
  const full = renderHistory(history)
  expect(incremental.width).toBe(full.width)
  expect(incremental.height).toBe(full.height)
  // Report the first differing pixel rather than dumping the whole buffer.
  let mismatchAt = -1
  for (let i = 0; i < full.pixels.length; i++) {
    if (incremental.pixels[i] !== full.pixels[i]) {
      mismatchAt = i
      break
    }
  }
  if (mismatchAt >= 0) {
    const pixel = Math.floor(mismatchAt / 4)
    throw new Error(
      `incremental render differs from full replay at pixel ${pixel} ` +
        `(x=${pixel % full.width}, y=${Math.floor(pixel / full.width)}, channel ${mismatchAt % 4}): ` +
        `${incremental.pixels[mismatchAt]} !== ${full.pixels[mismatchAt]}`,
    )
  }
}

describe('incremental renderer', () => {
  it('matches a full replay when ops are appended one at a time', () => {
    const renderer = createIncrementalRenderer()
    let history = emptyHistory()
    for (let id = 0; id < 6; id++) {
      history = { ...history, ops: [...history.ops, stroke(id, 'p1', [1000 + id * 300, 2000, 3000, 4000 + id * 200])] }
      expectMatchesFullReplay(renderer, history)
    }
  })

  it('matches a full replay while the trailing stroke grows point by point', () => {
    const renderer = createIncrementalRenderer()
    let history: CanvasHistory = { ...emptyHistory(), ops: [stroke(0, 'p1', [500, 500])] }
    expectMatchesFullReplay(renderer, history)

    // This is the in-flight remote ink case: same op identity, more points.
    for (const point of [[1500, 900], [2500, 2000], [4000, 1200], [6000, 5000]]) {
      const grown = extend(history.ops[0], point)
      history = { ...history, ops: [grown] }
      expectMatchesFullReplay(renderer, history)
    }
  })

  it('rebuilds rather than smearing when an op is removed (undo)', () => {
    const renderer = createIncrementalRenderer()
    const a = stroke(0, 'p1', [1000, 1000, 5000, 5000])
    const b = stroke(1, 'p2', [2000, 8000, 9000, 3000])
    let history: CanvasHistory = { ...emptyHistory(), ops: [a, b] }
    expectMatchesFullReplay(renderer, history)

    // Removing the *first* op must not leave its pixels behind.
    history = { ...history, ops: [b] }
    expectMatchesFullReplay(renderer, history)
  })

  it('rebuilds when the op log is cleared', () => {
    const renderer = createIncrementalRenderer()
    let history: CanvasHistory = { ...emptyHistory(), ops: [stroke(0, 'p1', [1000, 1000, 8000, 8000])] }
    expectMatchesFullReplay(renderer, history)

    history = { ...history, ops: [] }
    expectMatchesFullReplay(renderer, history)
  })

  it('rebuilds when the baseline is replaced by a state sync', () => {
    const renderer = createIncrementalRenderer()
    const ops = [stroke(0, 'p1', [1000, 1000, 4000, 4000])]
    let history: CanvasHistory = { ...emptyHistory(), ops }
    expectMatchesFullReplay(renderer, history)

    // A sync hands over a different baseline holding the same op list.
    const baseline = createRaster(TEST_WIDTH, TEST_HEIGHT)
    baseline.pixels.fill(200)
    history = { baseline, ops }
    expectMatchesFullReplay(renderer, history)
  })

  it('matches a full replay when a fill lands on top of existing strokes', () => {
    const renderer = createIncrementalRenderer()
    const base: CanvasOp[] = [stroke(0, 'p1', [1000, 1000, 9000, 1000]), stroke(1, 'p1', [1000, 1000, 1000, 9000])]
    let history: CanvasHistory = { ...emptyHistory(), ops: base }
    expectMatchesFullReplay(renderer, history)

    const fill: CanvasOp = { t: 'fill', id: 2, by: 'p1', x: 5000, y: 5000, color: '#F5D311' }
    history = { ...history, ops: [...base, fill] }
    expectMatchesFullReplay(renderer, history)
  })

  it('matches a full replay when an eraser stroke crosses ink', () => {
    const renderer = createIncrementalRenderer()
    const ink = stroke(0, 'p1', [1000, 5000, 9000, 5000])
    let history: CanvasHistory = { ...emptyHistory(), ops: [ink] }
    expectMatchesFullReplay(renderer, history)

    const eraser: CanvasOp = { t: 'stroke', id: 1, by: 'p1', tool: 'eraser', color: '#FFFFFF', size: 20, pts: Int16Array.from([5000, 1000, 5000, 9000]) }
    history = { ...history, ops: [ink, eraser] }
    expectMatchesFullReplay(renderer, history)
  })

  it('starts clean again after reset', () => {
    const renderer = createIncrementalRenderer()
    const history: CanvasHistory = { ...emptyHistory(), ops: [stroke(0, 'p1', [1000, 1000, 6000, 6000])] }
    expectMatchesFullReplay(renderer, history)

    renderer.reset()
    expectMatchesFullReplay(renderer, history)
  })
})
