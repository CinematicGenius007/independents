import { useEffect, useRef } from 'react'
import { difference, GRID } from '../engine/match'
import type { Segment } from '../engine/turtle'

export type PlateView = 'overlay' | 'difference' | 'mine'

interface Props {
  plant: readonly Segment[]
  target: readonly Segment[]
  view: PlateView
}

const PAPER = '#efe3cc'
const SPECIMEN = '#b07a44'
const GRAPHITE = '#1c1814'
const MISSING = '#b2402c'
const EXTRA = '#4a6f92'

/**
 * The plate.
 *
 * Two drawings on one sheet: the specimen pressed underneath in sepia, the
 * player's grammar over it in graphite. The third view is the one that teaches —
 * a coarse map of exactly where the two disagree, because a score of 61% says
 * you are wrong without saying where.
 */
export function PlantCanvas({ plant, target, view }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ plant, target, view })
  latest.current = { plant, target, view }

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
      context.fillStyle = PAPER
      context.fillRect(0, 0, size, size)

      const pad = size * 0.08
      const span = size - pad * 2
      const project = (value: number) => pad + value * span
      const current = latest.current

      // Faint plate ruling, like a herbarium sheet.
      context.strokeStyle = 'rgba(47, 43, 38, 0.07)'
      context.lineWidth = 1
      for (let i = 1; i < 4; i += 1) {
        context.beginPath()
        context.moveTo(pad, pad + (span / 4) * i)
        context.lineTo(size - pad, pad + (span / 4) * i)
        context.moveTo(pad + (span / 4) * i, pad)
        context.lineTo(pad + (span / 4) * i, size - pad)
        context.stroke()
      }

      const stroke = (segments: readonly Segment[], color: string, width: number, alpha: number) => {
        context.lineCap = 'round'
        context.strokeStyle = color
        for (const segment of segments) {
          context.globalAlpha = alpha * Math.max(0.35, 1 - segment.depth * 0.1)
          context.lineWidth = Math.max(0.5, width - segment.depth * 0.3)
          context.beginPath()
          context.moveTo(project(segment.x1), project(segment.y1))
          context.lineTo(project(segment.x2), project(segment.y2))
          context.stroke()
        }
        context.globalAlpha = 1
      }

      if (current.view === 'difference') {
        const { missing, extra } = difference(current.plant, current.target)
        const box = span / GRID
        for (let index = 0; index < missing.length; index += 1) {
          const x = pad + (index % GRID) * box
          const y = pad + Math.floor(index / GRID) * box
          if (missing[index]) {
            context.fillStyle = MISSING
            context.globalAlpha = 0.5
            context.fillRect(x, y, box + 0.6, box + 0.6)
          } else if (extra[index]) {
            context.fillStyle = EXTRA
            context.globalAlpha = 0.45
            context.fillRect(x, y, box + 0.6, box + 0.6)
          }
        }
        context.globalAlpha = 1
        stroke(current.target, SPECIMEN, 1.6, 0.35)
        stroke(current.plant, GRAPHITE, 1.4, 0.7)
      } else {
        if (current.view === 'overlay') stroke(current.target, SPECIMEN, 3.2, 0.34)
        stroke(current.plant, GRAPHITE, 2.3, 0.95)
      }
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [plant, target, view])

  return <canvas className="plate" ref={canvasRef} aria-label="the plant your grammar grows" />
}
