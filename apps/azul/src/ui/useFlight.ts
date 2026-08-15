/**
 * Tiles that travel.
 *
 * Before this, a turn was a diff: tiles vanished from a display and appeared
 * on a board, and a player who blinked — or who was watching an opponent's
 * side of the table — had no idea what had happened. Motion here is not
 * decoration, it is the only record of the move.
 *
 * The technique is deliberately dumb and therefore robust: the elements
 * involved carry `data-flight` names, the hook measures the source and the
 * destinations after the position has changed, and it tweens copies of the
 * tile between the two with the Web Animations API. Nothing in the layout has
 * to cooperate, and if an element is missing the animation is simply skipped.
 */

import { useEffect, useRef } from 'react'
import type { Color } from '../engine/types'
import type { LastMove } from '../net/session'

/** Names an element as a flight endpoint: `data-flight="pile:f2"`. */
export function flightId(name: string): { 'data-flight': string } {
  return { 'data-flight': name }
}

export const FLIGHT_MS = 380

function rectOf(root: HTMLElement, name: string): DOMRect | null {
  const node = root.querySelector<HTMLElement>(`[data-flight="${CSS.escape(name)}"]`)
  return node ? node.getBoundingClientRect() : null
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface FlightRequest {
  color: Color
  /** Where the handful came from. */
  from: string
  /** One name per tile, in the order they land. */
  to: string[]
}

/**
 * Flies `request.to.length` tiles from the source to each destination.
 *
 * The copies are appended to the document, not to React's tree, so a re-render
 * mid-flight cannot interrupt them, and they clean themselves up on finish.
 */
export function flyTiles(root: HTMLElement, request: FlightRequest, tint: string): void {
  if (prefersReducedMotion()) return
  const from = rectOf(root, request.from)
  if (!from) return

  request.to.forEach((name, index) => {
    const to = rectOf(root, name)
    if (!to) return

    const ghost = document.createElement('div')
    ghost.className = 'flight'
    ghost.style.cssText = `
      position: fixed;
      left: ${from.left}px;
      top: ${from.top}px;
      width: ${from.width}px;
      height: ${from.height}px;
      background: ${tint};
      border-radius: 2px;
      pointer-events: none;
      z-index: 60;
    `
    document.body.append(ghost)

    const animation = ghost.animate(
      // The tile is already drawn at the destination by the time this runs, so
      // the copy dissolves as it lands rather than popping out of existence.
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.72 },
        {
          transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${
            to.width / Math.max(1, from.width)
          })`,
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: FLIGHT_MS,
        delay: index * 55,
        easing: 'cubic-bezier(0.3, 0.8, 0.35, 1)',
        fill: 'forwards',
      },
    )
    animation.onfinish = () => ghost.remove()
    animation.oncancel = () => ghost.remove()
  })
}

/**
 * Runs a flight whenever a new move lands.
 *
 * The caller works out the endpoints, because only it knows how the board is
 * laid out; this hook only notices that a move happened and that it has not
 * been shown yet.
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
