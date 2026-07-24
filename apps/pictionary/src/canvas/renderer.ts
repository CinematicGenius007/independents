import { LOGICAL_HEIGHT, LOGICAL_WIDTH, QUANT, type CanvasOp } from './types'

export interface Raster {
  width: number
  height: number
  pixels: Uint8ClampedArray
}

const WHITE = [255, 255, 255, 255] as const

export function createRaster(width = LOGICAL_WIDTH, height = LOGICAL_HEIGHT): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Canvas renderer: raster dimensions must be positive integers')
  }
  const raster = { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
  clearRaster(raster)
  return raster
}

export function clearRaster(raster: Raster): void {
  raster.pixels.fill(255)
}

function parseColor(hex: string): readonly [number, number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`Canvas renderer: invalid color "${hex}"`)
  const rgb = Number.parseInt(match[1], 16)
  return [rgb >>> 16, (rgb >>> 8) & 0xff, rgb & 0xff, 255]
}

function quantizedToPixel(value: number, extent: number): number {
  return Math.max(0, Math.min(extent - 1, Math.round((value / QUANT) * (extent - 1))))
}

function pixelOffset(raster: Raster, x: number, y: number): number {
  return (y * raster.width + x) * 4
}

function setPixel(raster: Raster, x: number, y: number, color: readonly number[]): void {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return
  const offset = pixelOffset(raster, x, y)
  raster.pixels[offset] = color[0]
  raster.pixels[offset + 1] = color[1]
  raster.pixels[offset + 2] = color[2]
  raster.pixels[offset + 3] = color[3]
}

function stampCircle(
  raster: Raster,
  centerX: number,
  centerY: number,
  diameter: number,
  color: readonly number[],
): void {
  const radius = Math.max(0.5, diameter / 2)
  const radiusSquared = radius * radius
  const minX = Math.floor(centerX - radius)
  const maxX = Math.ceil(centerX + radius)
  const minY = Math.floor(centerY - radius)
  const maxY = Math.ceil(centerY + radius)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX
      const dy = y - centerY
      if (dx * dx + dy * dy <= radiusSquared) setPixel(raster, x, y, color)
    }
  }
}

function drawSegment(
  raster: Raster,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  diameter: number,
  color: readonly number[],
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
  for (let step = 0; step <= steps; step++) {
    const progress = step / steps
    stampCircle(raster, Math.round(fromX + dx * progress), Math.round(fromY + dy * progress), diameter, color)
  }
}

function drawStroke(raster: Raster, op: Extract<CanvasOp, { t: 'stroke' }>): void {
  if (op.pts.length < 2 || op.pts.length % 2 !== 0) return
  const color = op.tool === 'eraser' ? WHITE : parseColor(op.color)
  let previousX = quantizedToPixel(op.pts[0], raster.width)
  let previousY = quantizedToPixel(op.pts[1], raster.height)
  stampCircle(raster, previousX, previousY, op.size, color)
  for (let index = 2; index < op.pts.length; index += 2) {
    const x = quantizedToPixel(op.pts[index], raster.width)
    const y = quantizedToPixel(op.pts[index + 1], raster.height)
    drawSegment(raster, previousX, previousY, x, y, op.size, color)
    previousX = x
    previousY = y
  }
}

function colorAt(raster: Raster, x: number, y: number): readonly [number, number, number, number] {
  const offset = pixelOffset(raster, x, y)
  return [
    raster.pixels[offset],
    raster.pixels[offset + 1],
    raster.pixels[offset + 2],
    raster.pixels[offset + 3],
  ]
}

function colorsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

/** Deterministic scanline flood fill. It reads and writes only the logical raster. */
function floodFill(raster: Raster, seedX: number, seedY: number, color: readonly number[]): void {
  const target = colorAt(raster, seedX, seedY)
  if (colorsEqual(target, color)) return
  const stack: number[] = [seedX, seedY]

  while (stack.length > 0) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    if (!colorsEqual(colorAt(raster, x, y), target)) continue

    let left = x
    while (left > 0 && colorsEqual(colorAt(raster, left - 1, y), target)) left--
    let right = x
    while (right + 1 < raster.width && colorsEqual(colorAt(raster, right + 1, y), target)) right++

    let queuedAbove = false
    let queuedBelow = false
    for (let fillX = left; fillX <= right; fillX++) {
      setPixel(raster, fillX, y, color)
      const matchesAbove = y > 0 && colorsEqual(colorAt(raster, fillX, y - 1), target)
      if (matchesAbove && !queuedAbove) {
        stack.push(fillX, y - 1)
      }
      queuedAbove = matchesAbove

      const matchesBelow =
        y + 1 < raster.height && colorsEqual(colorAt(raster, fillX, y + 1), target)
      if (matchesBelow && !queuedBelow) {
        stack.push(fillX, y + 1)
      }
      queuedBelow = matchesBelow
    }
  }
}

export function applyOpToRaster(raster: Raster, op: CanvasOp): void {
  if (op.t === 'clear') {
    clearRaster(raster)
  } else if (op.t === 'stroke') {
    drawStroke(raster, op)
  } else {
    floodFill(
      raster,
      quantizedToPixel(op.x, raster.width),
      quantizedToPixel(op.y, raster.height),
      parseColor(op.color),
    )
  }
}

export function replayOps(ops: CanvasOp[], width = LOGICAL_WIDTH, height = LOGICAL_HEIGHT): Raster {
  const raster = createRaster(width, height)
  for (const op of ops) applyOpToRaster(raster, op)
  return raster
}
