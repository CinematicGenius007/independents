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

/** One tile crossing the table: long enough to follow, short enough to feel like a hand. */
export const FLIGHT_MS = 1150
/** Gap between tiles of one handful leaving, so they read as separate pieces. */
export const FLIGHT_STAGGER_MS = 140
/** Leftovers sweep into the centre once the taken tiles are on their way. */
export const LEFTOVER_DELAY_MS = 260

function nodeOf(root: ParentNode, name: string): HTMLElement | SVGElement | null {
  return root.querySelector<HTMLElement | SVGElement>(`[data-flight="${CSS.escape(name)}"]`)
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Display tiles are this fraction of a pattern-line tile; flights grow from one to the other. */
const POCKET_SCALE = 0.5

export interface PieceFlight {
  from: string
  to: string
  tint: string
  duration: number
  delay?: number
  /** Size the piece takes: the source's, the target's, or a fixed square. */
  size?: 'from' | 'to' | number
  /** Width the piece starts at, when it should grow or shrink on the way. */
  startSize?: number
  /** Starting width as a fraction of the end width, for pieces leaving a smaller thing. */
  startScale?: number
  /**
   * Draw the piece as a copy of the tile already drawn at the target, motif
   * and all, and keep that tile hidden until the copy arrives — so the tile
   * is seen to *travel*, not to appear at its end while a ghost chases it.
   */
  carry?: boolean
  /** Fade out on arrival instead of handing over to the tile underneath. */
  dissolve?: boolean
  /** Where in the target's box the piece lands, 0–1 on each axis. Defaults to the middle. */
  lands?: { x: number; y: number }
}

/** Flies one piece. Returns false if either endpoint is missing. */
export function flyPiece(root: ParentNode, flight: PieceFlight): boolean {
  if (prefersReducedMotion()) return false
  const fromNode = nodeOf(root, flight.from)
  const toNode = nodeOf(root, flight.to)
  if (!fromNode || !toNode) return false
  const from = fromNode.getBoundingClientRect()
  // A target may be a wrapper around the tile; measure and copy the tile.
  const tileNode = toNode instanceof SVGElement ? toNode : (toNode.querySelector('svg') ?? toNode)
  const to = tileNode.getBoundingClientRect()

  const endSize = typeof flight.size === 'number' ? flight.size : flight.size === 'from' ? from.width : to.width
  const startSize = flight.startSize ?? (flight.startScale ? endSize * flight.startScale : endSize)
  const x0 = from.left + from.width / 2 - startSize / 2
  const y0 = from.top + from.height / 2 - startSize / 2
  const lx = flight.lands?.x ?? 0.5
  const ly = flight.lands?.y ?? 0.5
  const x1 = to.left + to.width * lx - startSize / 2
  const y1 = to.top + to.height * ly - startSize / 2

  let piece: HTMLElement | SVGElement
  if (flight.carry && tileNode instanceof SVGElement) {
    piece = tileNode.cloneNode(true) as SVGElement
    piece.removeAttribute('data-flight')
    piece.removeAttribute('id')
    piece.classList.remove('tile--fresh', 'slot--incoming')
  } else {
    piece = document.createElement('div')
    piece.style.background = flight.tint
  }
  piece.classList.add('flight')
  piece.setAttribute('aria-hidden', 'true')
  piece.style.cssText += `
    position: fixed; left: ${x0}px; top: ${y0}px;
    width: ${startSize}px; height: ${startSize}px;
    pointer-events: none; z-index: 60; transform-origin: 50% 50%;
  `
  document.body.append(piece)

  const hidden = flight.carry ? flight.to : null
  const hide = (on: boolean) => {
    if (!hidden) return
    const node = nodeOf(root, hidden)
    const target = node instanceof SVGElement ? node : (node?.querySelector('svg') ?? node)
    if (on) target?.setAttribute('data-arriving', '')
    else target?.removeAttribute('data-arriving')
  }
  hide(true)

  const dx = x1 - x0
  const dy = y1 - y0
  const scale = endSize / Math.max(1, startSize)
  const distance = Math.hypot(dx, dy)
  // The tile is lifted off its pile, carried over the table on a shallow arc,
  // and set down: three moves, not one slide.
  const arc = Math.min(64, Math.max(14, distance * 0.1))
  const lift = 1.14
  const frames: Keyframe[] = [
    { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0, easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
    {
      transform: `translate(0px, -6px) scale(${lift})`,
      opacity: 1,
      offset: 0.16,
      easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
    },
    {
      transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${lift * (1 + (scale - 1) * 0.5)})`,
      opacity: 1,
      offset: 0.58,
      easing: 'cubic-bezier(0.25, 0.6, 0.3, 1)',
    },
    {
      transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
      opacity: flight.dissolve ? 0 : 1,
      offset: 1,
    },
  ]
  const shadowed = flight.carry || flight.dissolve
  const plain: Keyframe[] = [
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 },
  ]

  const animation = piece.animate(shadowed ? frames : plain, {
    duration: flight.duration,
    delay: flight.delay ?? 0,
    easing: shadowed ? 'linear' : 'cubic-bezier(0.45, 0.05, 0.25, 1)',
    fill: 'both',
  })
  const done = () => {
    piece.remove()
    hide(false)
  }
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
  /** Tiles of the same display that were not taken, swept into the centre. */
  leftovers?: { color: Color; to: string }[]
  /** The starting marker, if this move claimed it. */
  marker?: { to: string }
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
      startScale: POCKET_SCALE,
      size: 'to',
      carry: true,
    }),
  )
  const base = request.to.length * FLIGHT_STAGGER_MS * 0.5 + LEFTOVER_DELAY_MS
  request.leftovers?.forEach((leftover, index) =>
    flyPiece(root, {
      from: request.from,
      to: leftover.to,
      tint: 'transparent',
      duration: FLIGHT_MS,
      delay: base + index * FLIGHT_STAGGER_MS,
      startScale: POCKET_SCALE,
      size: 'to',
      carry: true,
    }),
  )
  if (request.marker) {
    flyPiece(root, {
      from: 'pile:-1',
      to: request.marker.to,
      tint: 'transparent',
      duration: FLIGHT_MS,
      delay: 0,
      startScale: POCKET_SCALE,
      size: 'to',
      carry: true,
    })
  }
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
