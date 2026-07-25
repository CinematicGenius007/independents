import type { ReactNode } from 'react'
import { ditherStyle } from './utils'

export interface PaperProps {
  children?: ReactNode
  className?: string
  /** Set false to render just the tinted surface without the fixed-position texture layer (e.g. nested panels). */
  fixed?: boolean
}

/**
 * The outer chrome surface every screen sits on: deep navy-green with a
 * whisper of ordered dither instead of a smooth gradient. Nested panels sit
 * on top and don't need their own texture layer.
 */
export function Paper({ children, className = '', fixed = true }: PaperProps) {
  return (
    <div className={`relative isolate min-h-full bg-chrome-deep ${className}`}>
      <div
        aria-hidden
        className={`pixel-dither pointer-events-none inset-0 ${fixed ? 'fixed' : 'absolute'}`}
        style={{ ...ditherStyle({ colorB: 'rgb(255 255 255 / 0.035)', cell: 4 }), zIndex: 0 }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
