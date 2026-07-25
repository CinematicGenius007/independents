import type { ReactNode } from 'react'

/**
 * Inline SVG feTurbulence grain, encoded once as a data URI. No network
 * request, no external asset — works fully offline / under a strict CSP.
 */
const GRAIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#n)'/></svg>"

const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`

export interface PaperProps {
  children?: ReactNode
  className?: string
  /** Set false to render just the tinted surface without the fixed-position grain layer (e.g. nested panels). */
  fixed?: boolean
}

/**
 * Grain-textured page background. Wrap a whole screen in this once; nested
 * panels sit on top of it and don't need their own grain layer.
 */
export function Paper({ children, className = '', fixed = true }: PaperProps) {
  return (
    <div className={`relative isolate min-h-full bg-paper ${className}`}>
      <div
        aria-hidden
        className={`pointer-events-none inset-0 ${fixed ? 'fixed' : 'absolute'}`}
        style={{
          backgroundImage: GRAIN_URL,
          backgroundRepeat: 'repeat',
          opacity: 0.15,
          mixBlendMode: 'multiply',
          zIndex: 0,
        }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
