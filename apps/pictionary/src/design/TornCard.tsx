import type { ReactNode } from 'react'
import { bevelClass } from './utils'
import type { PanelTone } from './Panel'

export interface TornCardProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  className?: string
}

const TONE_BG: Record<PanelTone, string> = {
  paper: 'bg-parchment',
  accent: 'bg-gold-hi',
  alert: 'bg-red-hi',
}

/**
 * A parchment scroll card — the reference's cream/tan alert panel, with
 * bevelled wooden dowel ends standing in for the rolled edges. Dark ink text
 * throughout; this is one of the two bright surfaces in the kit (the other
 * is the drawing canvas).
 */
export function TornCard({ children, title, tone = 'paper', className = '' }: TornCardProps) {
  const bg = TONE_BG[tone]
  return (
    <div className={`relative flex ${bevelClass({ tone: 'parchment' })} ${className}`}>
      <span
        aria-hidden
        className="w-3 shrink-0 bg-wood"
        style={{ boxShadow: 'inset -2px 0 0 0 var(--color-wood-lo), inset 2px 0 0 0 var(--color-wood-hi)' }}
      />
      <div className={`min-w-0 flex-1 px-5 py-4 ${bg}`}>
        {title && <h3 className="pixel-heading mb-2 text-[16px] leading-[16px] text-ink-soft">{title}</h3>}
        {children}
      </div>
      <span
        aria-hidden
        className="w-3 shrink-0 bg-wood"
        style={{ boxShadow: 'inset 2px 0 0 0 var(--color-wood-lo), inset -2px 0 0 0 var(--color-wood-hi)' }}
      />
    </div>
  )
}
