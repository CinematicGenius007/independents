import type { Segment } from './turtle'

/**
 * How close is this plant to that plant?
 *
 * Both drawings are burned into a coarse occupancy grid and compared in both
 * directions: how much of yours is near the target, and how much of the target is
 * near yours. The two are combined as a harmonic mean, so covering the target with
 * a scribble scores as badly as drawing a fragment of it — which is the failure
 * mode a plain overlap score rewards.
 */

export const GRID = 64
const TOLERANCE = 1 // cells of slack, so a near-miss stroke still counts

export type Mask = Uint8Array

export function rasterize(segments: readonly Segment[], grid = GRID): Mask {
  const mask = new Uint8Array(grid * grid)
  const step = 0.5 / grid

  for (const segment of segments) {
    const dx = segment.x2 - segment.x1
    const dy = segment.y2 - segment.y1
    const length = Math.hypot(dx, dy)
    const samples = Math.max(1, Math.ceil(length / step))
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples
      const cx = Math.min(grid - 1, Math.max(0, Math.floor((segment.x1 + dx * t) * grid)))
      const cy = Math.min(grid - 1, Math.max(0, Math.floor((segment.y1 + dy * t) * grid)))
      mask[cy * grid + cx] = 1
    }
  }

  return mask
}

export function dilate(mask: Mask, radius = TOLERANCE, grid = GRID): Mask {
  if (radius <= 0) return mask
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (!mask[y * grid + x]) continue
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) continue
          out[ny * grid + nx] = 1
        }
      }
    }
  }
  return out
}

function coverage(subject: Mask, near: Mask): number {
  let total = 0
  let covered = 0
  for (let i = 0; i < subject.length; i += 1) {
    if (!subject[i]) continue
    total += 1
    if (near[i]) covered += 1
  }
  return total === 0 ? 0 : covered / total
}

/**
 * Box-counting dimension.
 *
 * A branching plant is not a line and not a region; it fills space at some rate
 * between the two, and that rate is a number you can measure. Count how many
 * boxes of side s the drawing touches at several scales, and the slope of
 * log N against log 1/s is the dimension. It gives the player a second, entirely
 * different way to be close: you can match a specimen's density before you match
 * its shape.
 */
export function boxDimension(segments: readonly Segment[]): number {
  const scales = [8, 16, 32, 64]
  const points: { x: number; y: number }[] = []

  for (const grid of scales) {
    const mask = rasterize(segments, grid)
    let filled = 0
    for (const cell of mask) filled += cell
    if (filled === 0) return 0
    points.push({ x: Math.log(grid), y: Math.log(filled) })
  }

  const meanX = points.reduce((total, point) => total + point.x, 0) / points.length
  const meanY = points.reduce((total, point) => total + point.y, 0) / points.length
  let top = 0
  let bottom = 0
  for (const point of points) {
    top += (point.x - meanX) * (point.y - meanY)
    bottom += (point.x - meanX) ** 2
  }
  return bottom === 0 ? 0 : top / bottom
}

/**
 * Where the two drawings disagree, as a coarse map.
 *
 * `missing` is specimen the player has not covered, `extra` is ink with nothing
 * under it. Showing this was the single biggest usability gap: without it a
 * score of 61% tells you that you are wrong but not where.
 */
export function difference(
  mine: readonly Segment[],
  target: readonly Segment[],
  grid = GRID,
): { missing: Mask; extra: Mask } {
  const mineMask = rasterize(mine, grid)
  const targetMask = rasterize(target, grid)
  const mineNear = dilate(mineMask, TOLERANCE, grid)
  const targetNear = dilate(targetMask, TOLERANCE, grid)

  const missing = new Uint8Array(mineMask.length)
  const extra = new Uint8Array(mineMask.length)
  for (let i = 0; i < mineMask.length; i += 1) {
    if (targetMask[i] && !mineNear[i]) missing[i] = 1
    if (mineMask[i] && !targetNear[i]) extra[i] = 1
  }
  return { missing, extra }
}

export interface Score {
  /** Share of the player's ink that lands on the target. */
  readonly precision: number
  /** Share of the target that the player covered. */
  readonly recall: number
  /** Harmonic mean of the two, 0 to 1. */
  readonly score: number
}

export function compare(mine: readonly Segment[], target: readonly Segment[]): Score {
  const mineMask = rasterize(mine)
  const targetMask = rasterize(target)
  const precision = coverage(mineMask, dilate(targetMask))
  const recall = coverage(targetMask, dilate(mineMask))
  const score = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, score }
}
