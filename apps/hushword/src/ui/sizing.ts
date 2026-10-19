import { useEffect, useState } from 'react'

/**
 * How big the board and the keyboard can be, and how much room there is.
 *
 * This lives outside the component module on purpose. A module that exports a
 * component *and* something else cannot be hot-reloaded — Vite says so, once per
 * edit, in the console — and a helper that exists to be tested is exactly the
 * kind of export that causes it. The sizes are measured, so they are also the
 * part most likely to be edited, which is the worst place to lose fast refresh.
 *
 * A six-letter board and a twelve-letter board want different tiles, and so does
 * the same board on a phone and on a desk. Rather than a fixed size per length
 * with a breakpoint that is wrong somewhere, this works it out once: the rails
 * take 620px above 60rem and nothing below it, and whatever is left is divided.
 *
 * The keyboard is the reason this has to be a measurement rather than a
 * breakpoint. Ten keys at their comfortable 34px plus two wide keys are 403px
 * across, which does not fit the 342px a 390px phone leaves — so the keys give
 * way when the tiles do, in step, and stop at 22px rather than shrinking to
 * nothing. Below that the page scrolls, which is the honest answer.
 */

export interface Sizes {
  readonly tile: string
  readonly key: string
  readonly gap: string
  /** The width the board and keyboard must both fit inside. */
  readonly room: number
}

/** The key width at which the widest row — nine letters and a wide key — fits. */
export function keyWidthFor(room: number): number {
  for (let key = 34; key >= 22; key -= 1) {
    const gap = Math.max(3, Math.round(key * 0.147))
    if (10 * key + 18 + 9 * gap <= room) return key
  }
  return 22
}

/** The gap that goes with a key width, at the ratio the shipped layout uses. */
export function gapFor(key: number): number {
  return Math.max(3, Math.round(key * 0.147))
}

export function useSizes(columns: number): Sizes {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const room = width >= 960 ? Math.min(width - 620, 840) : width - 48
  const tile = Math.max(20, Math.min(54, Math.floor((room - (columns - 1) * 6) / columns)))
  const key = keyWidthFor(room)
  return { tile: `${tile}px`, key: `${key}px`, gap: `${gapFor(key)}px`, room }
}
