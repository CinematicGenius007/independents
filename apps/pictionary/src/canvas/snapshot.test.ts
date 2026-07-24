import { describe, expect, it } from 'vitest'
import { appendToHistory, createCanvasHistory, renderHistory } from './history'
import type { CanvasOp } from './types'
import { decodeCanvasSnapshot, encodeCanvasSnapshot } from './snapshot'

const stroke = (id: number, color: string): CanvasOp => ({
  t: 'stroke',
  id,
  by: 'drawer',
  tool: 'pencil',
  color,
  size: 3,
  pts: new Int16Array([id * 1_000, 0, id * 1_000, 10_000]),
})

describe('canvas snapshots', () => {
  it('round-trips a folded baseline and retained ops', () => {
    let history = createCanvasHistory(24, 16)
    history = appendToHistory(history, stroke(0, '#1A1A1A'), 2)
    history = appendToHistory(history, stroke(1, '#F2603C'), 2)
    history = appendToHistory(history, stroke(2, '#3C7DF2'), 2)

    const restored = decodeCanvasSnapshot(encodeCanvasSnapshot(history))

    expect(restored.baseline).toEqual(history.baseline)
    expect(restored.ops).toEqual(history.ops)
    expect(renderHistory(restored).pixels).toEqual(renderHistory(history).pixels)
  })

  it('does not share snapshot storage with the input bytes', () => {
    const snapshot = encodeCanvasSnapshot(createCanvasHistory(2, 2))
    const restored = decodeCanvasSnapshot(snapshot)
    snapshot[16] = 0
    expect(restored.baseline.pixels[0]).toBe(255)
  })

  it('rejects malformed envelopes and nested ink logs', () => {
    const valid = encodeCanvasSnapshot(createCanvasHistory(2, 2))
    const wrongHeader = valid.slice()
    wrongHeader[0] = 0
    expect(() => decodeCanvasSnapshot(wrongHeader)).toThrow(/invalid header/)
    expect(() => decodeCanvasSnapshot(valid.slice(0, -1))).toThrow(/truncated payload/)

    const wrongPixelLength = valid.slice()
    new DataView(wrongPixelLength.buffer).setUint32(12, 15, true)
    expect(() => decodeCanvasSnapshot(wrongPixelLength)).toThrow(/dimensions do not match/)

    const trailing = new Uint8Array(valid.length + 1)
    trailing.set(valid)
    expect(() => decodeCanvasSnapshot(trailing)).toThrow(/trailing bytes/)

    const corruptLog = valid.slice()
    corruptLog[36] = 0
    expect(() => decodeCanvasSnapshot(corruptLog)).toThrow(/invalid log header/)
  })

  it('rejects inconsistent raster input', () => {
    expect(() =>
      encodeCanvasSnapshot({
        baseline: { width: 2, height: 2, pixels: new Uint8ClampedArray(15) },
        ops: [],
      }),
    ).toThrow(/dimensions do not match/)
  })
})
