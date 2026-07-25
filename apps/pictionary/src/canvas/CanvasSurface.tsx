import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { applyOpToRaster, createRaster, type Raster } from './renderer'
import { createIncrementalRenderer, type IncrementalRenderer } from './incremental'
import { QUANT, type CanvasOp, type InkFrame, type ToolSettings } from './types'

interface ActiveStroke {
  id: number
  pointerId: number
  points: number[]
  pending: number[]
  frame: number | null
  tool: 'pencil' | 'eraser'
  color: string
  size: number
  preview: Raster
  renderedPoint: [number, number]
}

export interface CanvasSurfaceProps {
  ops: CanvasOp[]
  baseline?: Raster
  nextId: number
  authorId: string
  settings: ToolSettings
  disabled?: boolean
  onCommit(op: CanvasOp): void
  onFrame?(frame: InkFrame): void
  className?: string
}

/**
 * Scratch buffers for {@link paint}, kept alive between calls.
 *
 * Painting used to allocate a fresh offscreen canvas and a fresh `ImageData`
 * every time — at the logical 1600x1000 that is two 6.4 MB allocations plus a
 * 6.4 MB copy, on a path that runs on every incoming ink frame. The garbage
 * alone was enough to make remote strokes arrive in stutters. One canvas and
 * one `ImageData` per raster size are reused instead; only the pixel copy
 * remains, which is unavoidable.
 */
let scratchCanvas: HTMLCanvasElement | null = null
let scratchImage: ImageData | null = null

function scratchFor(width: number, height: number): { canvas: HTMLCanvasElement; image: ImageData } {
  if (!scratchCanvas || scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas = document.createElement('canvas')
    scratchCanvas.width = width
    scratchCanvas.height = height
    scratchImage = null
  }
  if (!scratchImage || scratchImage.width !== width || scratchImage.height !== height) {
    scratchImage = new ImageData(width, height)
  }
  return { canvas: scratchCanvas, image: scratchImage }
}

function paint(canvas: HTMLCanvasElement, raster: Raster): void {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const { canvas: source, image } = scratchFor(raster.width, raster.height)
  image.data.set(raster.pixels)
  source.getContext('2d')?.putImageData(image, 0, 0)
  const context = canvas.getContext('2d')
  if (!context) return
  context.imageSmoothingEnabled = true
  context.clearRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
}

function pointerPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const x = Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * QUANT)
  const y = Math.round(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) * QUANT)
  return [x, y]
}

export function CanvasSurface({
  ops,
  baseline,
  nextId,
  authorId,
  settings,
  disabled = false,
  onCommit,
  onFrame,
  className = '',
}: CanvasSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef<ActiveStroke | null>(null)
  const rendererRef = useRef<IncrementalRenderer | null>(null)
  if (rendererRef.current === null) rendererRef.current = createIncrementalRenderer()

  // The op log rendered against a stable baseline, so the renderer can tell an
  // append from a rewrite. Without a baseline of its own the canvas starts blank.
  const emptyBaselineRef = useRef<Raster | null>(null)
  if (emptyBaselineRef.current === null) emptyBaselineRef.current = createRaster()
  const history = useMemo(
    () => ({ baseline: baseline ?? emptyBaselineRef.current!, ops }),
    [baseline, ops],
  )

  const currentRaster = useCallback(() => rendererRef.current!.render(history), [history])

  /**
   * Repaint at most once per animation frame.
   *
   * Ink frames arrive far faster than the display refreshes, and painting once
   * per message meant the tab did the same work several times for a single
   * visible update. Coalescing to a frame makes the cost track the screen
   * rather than the network.
   */
  const paintFrameRef = useRef<number | null>(null)
  const repaint = useCallback(() => {
    if (paintFrameRef.current !== null) return
    paintFrameRef.current = requestAnimationFrame(() => {
      paintFrameRef.current = null
      // A stroke in progress owns the canvas: its preview already includes the
      // committed history, so repainting the committed raster under it would
      // drop the part of the stroke that has not been committed yet.
      if (activeRef.current) return
      if (canvasRef.current) paint(canvasRef.current, currentRaster())
    })
  }, [currentRaster])

  useEffect(() => {
    repaint()
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(repaint)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      if (paintFrameRef.current !== null) cancelAnimationFrame(paintFrameRef.current)
      paintFrameRef.current = null
      const active = activeRef.current
      if (active && active.frame !== null) cancelAnimationFrame(active.frame)
      activeRef.current = null
    }
  }, [repaint])

  useEffect(() => {
    if (!disabled) return
    const active = activeRef.current
    if (active && active.frame !== null) cancelAnimationFrame(active.frame)
    activeRef.current = null
    repaint()
  }, [disabled, repaint])

  const flushPending = useCallback(() => {
    const active = activeRef.current
    if (!active || active.pending.length === 0) return
    onFrame?.({ f: 'append', id: active.id, pts: Int16Array.from(active.pending) })
    const finalPoint: [number, number] = [
      active.pending[active.pending.length - 2],
      active.pending[active.pending.length - 1],
    ]
    applyOpToRaster(active.preview, {
      t: 'stroke',
      id: active.id,
      by: authorId,
      tool: active.tool,
      color: active.color,
      size: active.size,
      pts: Int16Array.from([...active.renderedPoint, ...active.pending]),
    })
    active.renderedPoint = finalPoint
    if (canvasRef.current) paint(canvasRef.current, active.preview)
    active.pending = []
    active.frame = null
  }, [authorId, onFrame])

  const finishStroke = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== event.pointerId) return
    if (active.frame !== null) cancelAnimationFrame(active.frame)
    flushPending()
    onFrame?.({ f: 'end', id: active.id })
    onCommit({
      t: 'stroke',
      id: active.id,
      by: authorId,
      tool: active.tool,
      color: active.color,
      size: active.size,
      pts: Int16Array.from(active.points),
    })
    activeRef.current = null
  }, [authorId, flushPending, onCommit, onFrame, settings])

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || activeRef.current) return
    const point = pointerPoint(event.currentTarget, event.clientX, event.clientY)
    if (settings.tool === 'fill') {
      const op: CanvasOp = { t: 'fill', id: nextId, by: authorId, x: point[0], y: point[1], color: settings.color }
      const committed = currentRaster()
      const preview = { ...committed, pixels: committed.pixels.slice() }
      applyOpToRaster(preview, op)
      paint(event.currentTarget, preview)
      onFrame?.({ f: 'op', op })
      onCommit(op)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    const tool = settings.tool === 'eraser' ? 'eraser' : 'pencil'
    const committed = currentRaster()
    const preview = { ...committed, pixels: committed.pixels.slice() }
    applyOpToRaster(preview, {
      t: 'stroke', id: nextId, by: authorId, tool, color: settings.color, size: settings.size,
      pts: Int16Array.from(point),
    })
    paint(event.currentTarget, preview)
    activeRef.current = {
      id: nextId,
      pointerId: event.pointerId,
      points: point,
      pending: [],
      frame: null,
      tool,
      color: settings.color,
      size: settings.size,
      preview,
      renderedPoint: point,
    }
    onFrame?.({
      f: 'begin',
      id: nextId,
      tool,
      color: settings.color,
      size: settings.size,
      pts: Int16Array.from(point),
    })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    if (!active || active.pointerId !== event.pointerId) return
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]
    for (const sample of samples) {
      const point = pointerPoint(event.currentTarget, sample.clientX, sample.clientY)
      active.points.push(...point)
      active.pending.push(...point)
    }
    if (active.frame === null) active.frame = requestAnimationFrame(flushPending)
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="Shared drawing canvas"
      aria-disabled={disabled || undefined}
      role="img"
      className={`block aspect-[8/5] w-full rounded-[var(--radius-doodle)] border-[3px] border-ink bg-white shadow-ink ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      style={{ touchAction: 'none' }}
    />
  )
}
