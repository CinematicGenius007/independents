import { applyOpToRaster, createRaster, type Raster } from './renderer'
import { OP_HISTORY_LIMIT, type CanvasOp } from './types'

export interface CanvasHistory {
  baseline: Raster
  ops: CanvasOp[]
}

function cloneRaster(raster: Raster): Raster {
  return { ...raster, pixels: raster.pixels.slice() }
}

export function createCanvasHistory(width?: number, height?: number): CanvasHistory {
  return { baseline: createRaster(width, height), ops: [] }
}

export function appendToHistory(
  history: CanvasHistory,
  op: CanvasOp,
  limit = OP_HISTORY_LIMIT,
): CanvasHistory {
  if (limit < 1) throw new Error('Canvas history: limit must be at least one')
  const ops = [...history.ops, op]
  if (ops.length <= limit) return { ...history, ops }

  const foldCount = ops.length - limit
  const baseline = cloneRaster(history.baseline)
  for (let index = 0; index < foldCount; index++) applyOpToRaster(baseline, ops[index])
  return { baseline, ops: ops.slice(foldCount) }
}

export function undoHistoryBy(history: CanvasHistory, authorId: string): CanvasHistory {
  let index = -1
  for (let i = history.ops.length - 1; i >= 0; i--) {
    if (history.ops[i].by === authorId) {
      index = i
      break
    }
  }
  if (index < 0) return history
  return { ...history, ops: [...history.ops.slice(0, index), ...history.ops.slice(index + 1)] }
}

export function renderHistory(history: CanvasHistory): Raster {
  const raster = cloneRaster(history.baseline)
  for (const op of history.ops) applyOpToRaster(raster, op)
  return raster
}

