import { useEffect, useRef } from 'react'
import type { Segment } from '../engine/turtle'

interface Props {
  plant: readonly Segment[]
  target: readonly Segment[]
  showTarget: boolean
}

/**
 * Two drawings on one plate: the target as a faint pressed specimen underneath,
 * the player's grammar as wet ink on top. Branch depth thins and lightens the
 * stroke, which is what makes an L-system read as a plant rather than a graph.
 *
 * Painting is driven by a ResizeObserver rather than by the effect alone, because
 * the canvas has no measured width on its first pass through layout.
 */
export function PlantCanvas({ plant, target, showTarget }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ plant, target, showTarget })
  latest.current = { plant, target, showTarget }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const paint = () => {
      const context = canvas.getContext('2d')
      const size = canvas.clientWidth
      if (!context || size === 0) return

      const ratio = window.devicePixelRatio || 1
      canvas.width = size * ratio
      canvas.height = size * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, size, size)

      const pad = size * 0.07
      const span = size - pad * 2
      const project = (value: number) => pad + value * span

      const stroke = (segments: readonly Segment[], color: string, width: number, alpha: number) => {
        context.lineCap = 'round'
        context.strokeStyle = color
        for (const segment of segments) {
          context.globalAlpha = alpha * Math.max(0.35, 1 - segment.depth * 0.11)
          context.lineWidth = Math.max(0.5, width - segment.depth * 0.35)
          context.beginPath()
          context.moveTo(project(segment.x1), project(segment.y1))
          context.lineTo(project(segment.x2), project(segment.y2))
          context.stroke()
        }
        context.globalAlpha = 1
      }

      const current = latest.current
      if (current.showTarget) stroke(current.target, '#b9743f', 3.4, 0.3)
      stroke(current.plant, '#1f4733', 2.1, 0.95)
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [plant, target, showTarget])

  return <canvas className="plate" ref={canvasRef} aria-label="the plant your grammar grows" />
}
