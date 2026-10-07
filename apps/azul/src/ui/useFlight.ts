/**
 * Things that travel across the table.
 *
 * Two kinds: a handful of tiles going from the pile they came off to the
 * slots they land in, and single score points going from a fired tile to the
 * score track. Both are the same move — a copy of a piece crossing from one
 * named element to another — and both exist for the same reason: a change you
 * cannot see happen is a change you have to go and find.
 *
 * Elements are named with `data-flight`. Positions are measured after the
 * position has changed, copies are tweened with the Web Animations API and
 * appended to the document rather than to React's tree, so a re-render
 * mid-flight cannot interrupt them. A missing endpoint just skips that piece.
 */

import { useEffect, useRef } from 'react'
import type { Color } from '../engine/types'
import type { LastMove } from '../net/session'

/** Names an element as a flight endpoint: `data-flight="pile:2"`. */
export function flightId(name: string): { 'data-flight': string } {
  return { 'data-flight': name }
}

/** A handful of tiles crossing the table. Slow enough to follow. */
export const FLIGHT_MS = 900
/** Gap between tiles of one handful leaving, so they read as separate pieces. */
export const FLIGHT_STAGGER_MS = 130

function rectOf(root: ParentNode, name: string): DOMRect | null {
  const node = root.querySelector<HTMLElement | SVGElement>(`[data-flight="${CSS.escape(name)}"]`)
  return node ? node.getBoundingClientRect() : null
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface PieceFlight {
  from: string
  to: string
  tint: string
  duration: number
  delay?: number
  /** Size the piece takes: the source's, the target's, or a fixed square. */
  size?: 'from' | 'to' | number
  /** A tile copy dissolves into the tile already drawn where it lands. */
  dissolve?: boolean
}

/** Flies one piece. Returns false if either endpoint is missing. */
export function flyPiece(root: ParentNode, flight: PieceFlight): boolean {
  if (prefersReducedMotion()) return false
  const from = rectOf(root, flight.from)
  const to = rectOf(root, flight.to)
  if (!from || !to) return false

  const startSize =
    typeof flight.size === 'number' ? flight.size : flight.size === 'to' ? to.width : from.width
  const endSize = typeof flight.size === 'number' ? flight.size : to.width
  const x0 = from.left + from.width / 2 - startSize / 2
  const y0 = from.top + from.height / 2 - startSize / 2
  const x1 = to.left + to.width / 2 - startSize / 2
  const y1 = to.top + to.height / 2 - startSize / 2

  const piece = document.createElement('div')
  piece.className = 'flight'
  piece.style.cssText = `
    position: fixed; left: ${x0}px; top: ${y0}px;
    width: ${startSize}px; height: ${startSize}px;
    background: ${flight.tint}; pointer-events: none; z-index: 60;
  `
  document.body.append(piece)

  const scale = endSize / Math.max(1, startSize)
  const keyframes: Keyframe[] = flight.dissolve
    ? [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.78 },
        { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(${scale})`, opacity: 0, offset: 1 },
      ]
    : [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(${scale})`, opacity: 1 },
      ]

  const animation = piece.animate(keyframes, {
    duration: flight.duration,
    delay: flight.delay ?? 0,
    // Leaves gently, arrives decisively — the shape of a hand placing a tile.
    easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
    fill: 'both',
  })
  const done = () => piece.remove()
  animation.onfinish = done
  animation.oncancel = done
  return true
}

export interface FlightRequest {
  color: Color
  /** Where the handful came from. */
  from: string
  /** One name per tile, in the order they land. */
  to: string[]
}

/** Flies every tile of a handful from its pile to the slots it lands in. */
export function flyTiles(root: ParentNode, request: FlightRequest, tint: string): void {
  request.to.forEach((to, index) =>
    flyPiece(root, {
      from: request.from,
      to,
      tint,
      duration: FLIGHT_MS,
      delay: index * FLIGHT_STAGGER_MS,
      // Tile-sized from the start: the source is a whole display or the centre
      // strip, and a piece the size of its container is not a tile.
      size: 'to',
      dissolve: true,
    }),
  )
}

/**
 * Runs a flight whenever a new move lands. The caller works out endpoints,
 * since only it knows the layout; this only notices that a move happened and
 * has not been shown yet.
 */
export function useFlight(
  lastMove: LastMove | null,
  build: (move: LastMove) => { request: FlightRequest; tint: string } | null,
  root: React.RefObject<HTMLElement | null>,
): void {
  const shown = useRef(0)
  useEffect(() => {
    if (!lastMove || lastMove.serial === shown.current) return
    shown.current = lastMove.serial
    const node = root.current
    if (!node) return
    const plan = build(lastMove)
    if (plan) flyTiles(node, plan.request, plan.tint)
    // `build` is rebuilt every render by design; the serial guard is what keeps
    // this from firing twice for one move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove?.serial])
}
