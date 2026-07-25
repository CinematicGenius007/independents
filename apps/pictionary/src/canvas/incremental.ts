import { applyOpToRaster, type Raster } from './renderer'
import type { CanvasHistory } from './history'
import type { CanvasOp } from './types'

/**
 * Keeps a live raster in step with an append-mostly op log.
 *
 * The canvas is the ordered replay of its op log, which made the obvious
 * implementation a full `replayOps` on every change. That is O(all ops) and
 * allocates a fresh 1600x1000 RGBA raster (6.4 MB) each time — measured at
 * 8 ms for a nearly empty canvas and 91 ms once the drawing holds ~400
 * strokes. Remote ink arrives up to 60x a second, so the receiving tab spent
 * far longer redrawing history than it did drawing the new ink, and frames
 * piled up behind it.
 *
 * Almost every change is additive, so this keeps the previous raster and the
 * ops already burned into it, and draws only what is new:
 *
 * - ops appended to an unchanged prefix -> draw just the appended ops
 * - the trailing stroke grew (a partial stroke gaining points, which is what
 *   in-flight remote ink looks like) -> draw just the new segment, starting
 *   from the last point already drawn
 * - anything else (undo, clear, a state sync, a new baseline) -> full rebuild
 *
 * Correctness rests on replay being deterministic and on pencil/eraser
 * stamping being idempotent, so redrawing the seam point is a no-op.
 */
export interface IncrementalRenderer {
  render(history: CanvasHistory): Raster
  /** Drop all memoised state; the next `render` rebuilds from scratch. */
  reset(): void
}

function isStroke(op: CanvasOp): op is Extract<CanvasOp, { t: 'stroke' }> {
  return op.t === 'stroke'
}

/**
 * True when `next` is the same stroke as `previous` with more points on the
 * end. Identity (author + id) plus a non-shrinking point count is enough:
 * stroke ids are unique per author and points are only ever appended.
 */
function isExtensionOf(previous: CanvasOp, next: CanvasOp): boolean {
  if (!isStroke(previous) || !isStroke(next)) return false
  return (
    previous.by === next.by &&
    previous.id === next.id &&
    previous.tool === next.tool &&
    previous.size === next.size &&
    previous.color === next.color &&
    next.pts.length > previous.pts.length
  )
}

export function createIncrementalRenderer(): IncrementalRenderer {
  let raster: Raster | null = null
  let baseline: Raster | null = null
  /** The ops burned into `raster`, in order. Held by reference, not copied. */
  let applied: CanvasOp[] = []

  const rebuild = (history: CanvasHistory): Raster => {
    const next = { ...history.baseline, pixels: history.baseline.pixels.slice() }
    for (const op of history.ops) applyOpToRaster(next, op)
    raster = next
    baseline = history.baseline
    applied = history.ops.slice()
    return next
  }

  return {
    reset() {
      raster = null
      baseline = null
      applied = []
    },

    render(history) {
      if (!raster || baseline !== history.baseline) return rebuild(history)

      const ops = history.ops
      // How much of what we already drew is still an unchanged prefix?
      const shared = Math.min(applied.length, ops.length)
      let common = 0
      while (common < shared && applied[common] === ops[common]) common++

      if (common === applied.length) {
        // Pure append: draw only the ops that are new.
        for (let index = common; index < ops.length; index++) applyOpToRaster(raster, ops[index])
        applied = ops.slice()
        return raster
      }

      // The only non-append change worth optimising is the trailing stroke
      // growing; everything else (an op removed, replaced, or reordered) means
      // pixels may need to disappear, which a forward-only raster cannot do.
      const isTrailingGrowth =
        common === applied.length - 1 &&
        common === ops.length - 1 &&
        isExtensionOf(applied[common], ops[common])

      if (!isTrailingGrowth) return rebuild(history)

      const previous = applied[common] as Extract<CanvasOp, { t: 'stroke' }>
      const next = ops[common] as Extract<CanvasOp, { t: 'stroke' }>
      // Start one point back so the new segment joins the drawn one. Restamping
      // that point is idempotent, and `subarray` is a view — no copy.
      applyOpToRaster(raster, { ...next, pts: next.pts.subarray(previous.pts.length - 2) })
      applied = ops.slice()
      return raster
    },
  }
}
