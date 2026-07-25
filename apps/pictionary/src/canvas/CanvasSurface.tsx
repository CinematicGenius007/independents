import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { applyOpToRaster, replayOps, type Raster } from './renderer'
import { renderHistory } from './history'
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

function paint(canvas: HTMLCanvasElement, raster: Raster): void {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const source = document.createElement('canvas')
  source.width = raster.width
  source.height = raster.height
  const image = new ImageData(raster.width, raster.height)
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
  const raster = useMemo(
    () => baseline ? renderHistory({ baseline, ops }) : replayOps(ops),
    [baseline, ops],
  )

  const repaint = useCallback(() => {
    if (canvasRef.current) paint(canvasRef.current, raster)
  }, [raster])

  useEffect(() => {
    repaint()
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(repaint)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
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
      const preview = { ...raster, pixels: raster.pixels.slice() }
      applyOpToRaster(preview, op)
      paint(event.currentTarget, preview)
      onFrame?.({ f: 'op', op })
      onCommit(op)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    const tool = settings.tool === 'eraser' ? 'eraser' : 'pencil'
    const preview = { ...raster, pixels: raster.pixels.slice() }
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
