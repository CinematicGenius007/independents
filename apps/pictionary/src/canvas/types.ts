/**
 * Drawing surface contract.
 *
 * OWNED BY THE ORCHESTRATOR. Implemented by the canvas agent.
 *
 * Coordinate system: everything is expressed in a fixed *logical* space so that
 * peers on a phone and on a 4K monitor render identical pictures. On the wire,
 * coordinates are quantised to Int16 in the range 0..{@link QUANT} and mapped
 * onto {@link LOGICAL_WIDTH}/{@link LOGICAL_HEIGHT} at render time.
 */

import type { PlayerId } from '../shared/types'

export const LOGICAL_WIDTH = 1600
export const LOGICAL_HEIGHT = 1000
export const ASPECT = LOGICAL_WIDTH / LOGICAL_HEIGHT

/** Quantisation ceiling for wire coordinates. Both axes use the same scale. */
export const QUANT = 10_000

export type ToolKind = 'pencil' | 'eraser' | 'fill'

export interface ToolSettings {
  tool: ToolKind
  /** Hex color. Ignored by the eraser. */
  color: string
  /** Brush diameter in logical px, 1..50. */
  size: number
}

export const BRUSH_SIZES = { min: 1, max: 50, default: 8 } as const

/** Ink palette offered in the tool bar. Hex strings. */
export const INK_PALETTE: readonly string[] = [
  '#1A1A1A',
  '#6E6E6E',
  '#B3B3B3',
  '#FFFFFF',
  '#F5D311',
  '#F2A93B',
  '#F2603C',
  '#C1392B',
  '#3CB371',
  '#1E7A4C',
  '#3C7DF2',
  '#1B3A8A',
  '#B45FD1',
  '#E86FA8',
  '#7A5C3E',
  '#3E2A19',
] as const

/**
 * A single drawing operation. The canvas is the ordered replay of its op log —
 * there is no other source of truth, which is what makes late-join and undo
 * exact rather than approximate.
 */
export type CanvasOp =
  | {
      t: 'stroke'
      /** Monotonic per-author id. `(by, id)` is globally unique. */
      id: number
      by: PlayerId
      tool: 'pencil' | 'eraser'
      color: string
      /** Logical px. */
      size: number
      /** Flat [x0, y0, x1, y1, ...] quantised to 0..QUANT. */
      pts: Int16Array
    }
  | {
      t: 'fill'
      id: number
      by: PlayerId
      /** Quantised seed point. */
      x: number
      y: number
      color: string
    }
  | { t: 'clear'; id: number; by: PlayerId }

export type CanvasOpKind = CanvasOp['t']

export interface CanvasState {
  ops: CanvasOp[]
  /** Next op id this client will emit. */
  nextId: number
}

/** Ops retained per turn before the oldest are folded into a baseline raster. */
export const OP_HISTORY_LIMIT = 400

/**
 * Live stroke streaming. A stroke is announced once, then extended with point
 * batches flushed on animation frames, then sealed. Receivers render partial
 * strokes immediately and commit them to the op log on `end`.
 */
export type InkFrame =
  | { f: 'begin'; id: number; tool: 'pencil' | 'eraser'; color: string; size: number; pts: Int16Array }
  | { f: 'append'; id: number; pts: Int16Array }
  | { f: 'end'; id: number }
  | { f: 'op'; op: CanvasOp }
  | { f: 'undo'; id: number }
  | { f: 'clear' }

/** Binary codec implemented by the canvas agent; used by the net layer verbatim. */
export interface InkCodec {
  encodeFrame(frame: InkFrame): Uint8Array
  decodeFrame(bytes: Uint8Array): InkFrame
  /** Whole-log serialisation for late-join snapshots. */
  encodeLog(ops: CanvasOp[]): Uint8Array
  decodeLog(bytes: Uint8Array): CanvasOp[]
}
