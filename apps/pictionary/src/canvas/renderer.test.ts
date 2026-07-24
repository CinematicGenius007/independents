import { describe, expect, it } from 'vitest'
import type { CanvasOp } from './types'
import { applyOpToRaster, createRaster, replayOps } from './renderer'

function quantize(value: number, extent: number): number {
  return Math.round((value / (extent - 1)) * 10_000)
}

function pixel(raster: ReturnType<typeof createRaster>, x: number, y: number): number[] {
  const offset = (y * raster.width + x) * 4
  return Array.from(raster.pixels.slice(offset, offset + 4))
}

describe('canvas renderer', () => {
  it('replays the same op log to byte-identical pixels', () => {
    const ops: CanvasOp[] = [
      {
        t: 'stroke',
        id: 0,
        by: 'drawer',
        tool: 'pencil',
        color: '#1A1A1A',
        size: 3,
        pts: new Int16Array([0, 0, 10_000, 10_000]),
      },
      { t: 'fill', id: 1, by: 'drawer', x: 0, y: 10_000, color: '#F5D311' },
    ]
    expect(replayOps(ops, 32, 20).pixels).toEqual(replayOps(ops, 32, 20).pixels)
  })

  it('fills only the bounded region', () => {
    const raster = createRaster(12, 12)
    const border = (x1: number, y1: number, x2: number, y2: number): CanvasOp => ({
      t: 'stroke',
      id: x1 + y1,
      by: 'drawer',
      tool: 'pencil',
      color: '#1A1A1A',
      size: 1,
      pts: new Int16Array([
        quantize(x1, raster.width),
        quantize(y1, raster.height),
        quantize(x2, raster.width),
        quantize(y2, raster.height),
      ]),
    })
    applyOpToRaster(raster, border(3, 3, 8, 3))
    applyOpToRaster(raster, border(8, 3, 8, 8))
    applyOpToRaster(raster, border(8, 8, 3, 8))
    applyOpToRaster(raster, border(3, 8, 3, 3))
    applyOpToRaster(raster, {
      t: 'fill',
      id: 5,
      by: 'drawer',
      x: quantize(5, raster.width),
      y: quantize(5, raster.height),
      color: '#F5D311',
    })
    expect(pixel(raster, 5, 5)).toEqual([245, 211, 17, 255])
    expect(pixel(raster, 1, 1)).toEqual([255, 255, 255, 255])
  })

  it('supports erasing and clear', () => {
    const raster = createRaster(10, 10)
    applyOpToRaster(raster, {
      t: 'stroke',
      id: 0,
      by: 'drawer',
      tool: 'pencil',
      color: '#1A1A1A',
      size: 3,
      pts: new Int16Array([5_000, 5_000]),
    })
    expect(pixel(raster, 5, 5)).toEqual([26, 26, 26, 255])
    applyOpToRaster(raster, {
      t: 'stroke',
      id: 1,
      by: 'drawer',
      tool: 'eraser',
      color: '#1A1A1A',
      size: 3,
      pts: new Int16Array([5_000, 5_000]),
    })
    expect(pixel(raster, 5, 5)).toEqual([255, 255, 255, 255])
    raster.pixels[0] = 0
    applyOpToRaster(raster, { t: 'clear', id: 2, by: 'drawer' })
    expect(raster.pixels.every((value) => value === 255)).toBe(true)
  })
})

