import { describe, expect, it } from 'vitest'
import type { CanvasOp, InkFrame } from './types'
import { inkCodec } from './codec'

const points = new Int16Array([0, 10_000, 5_000, 42])

const ops: CanvasOp[] = [
  { t: 'stroke', id: 1, by: 'drawer-α', tool: 'pencil', color: '#F2603C', size: 12, pts: points },
  { t: 'stroke', id: 2, by: 'drawer-α', tool: 'eraser', color: '#FFFFFF', size: 50, pts: points },
  { t: 'fill', id: 3, by: 'drawer-α', x: 10_000, y: 0, color: '#3C7DF2' },
  { t: 'clear', id: 4, by: 'drawer-α' },
]

const frames: InkFrame[] = [
  { f: 'begin', id: 8, tool: 'pencil', color: '#1A1A1A', size: 8, pts: points },
  { f: 'begin', id: 9, tool: 'eraser', color: '#FFFFFF', size: 50, pts: points },
  { f: 'append', id: 8, pts: points },
  { f: 'end', id: 8 },
  ...ops.map((op): InkFrame => ({ f: 'op', op })),
  { f: 'undo', id: 8 },
  { f: 'clear' },
]

describe('ink codec', () => {
  for (const frame of frames) {
    it(`round-trips ${frame.f}`, () => {
      expect(inkCodec.decodeFrame(inkCodec.encodeFrame(frame))).toEqual(frame)
    })
  }

  it('round-trips complete logs', () => {
    expect(inkCodec.decodeLog(inkCodec.encodeLog(ops))).toEqual(ops)
  })

  it('rejects malformed payloads', () => {
    expect(() => inkCodec.decodeFrame(new Uint8Array([255]))).toThrow(/unknown frame tag/)
    expect(() => inkCodec.decodeLog(new Uint8Array([0, 0, 0, 0]))).toThrow(/invalid log header/)
    expect(() =>
      inkCodec.encodeFrame({
        f: 'begin',
        id: 1,
        tool: 'pencil',
        color: 'red',
        size: 8,
        pts: new Int16Array([1, 2]),
      }),
    ).toThrow(/invalid color/)
  })
})
