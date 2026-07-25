import type { CSSProperties, ReactNode } from 'react'
import { bevelClass, type BevelTone } from './utils'

export type PanelTone = 'paper' | 'accent' | 'alert'

export interface PanelProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  className?: string
  style?: CSSProperties
}

const TONE: Record<PanelTone, { bevel: BevelTone; barBg: string; barLine: string; label: string }> = {
  paper: { bevel: 'chrome', barBg: 'bg-chrome', barLine: 'var(--color-chrome-lo)', label: 'text-text' },
  accent: { bevel: 'gold', barBg: 'bg-gold-lo', barLine: 'var(--color-gold-lo)', label: 'text-gold-hi' },
  alert: { bevel: 'red', barBg: 'bg-red-lo', barLine: 'var(--color-red-lo)', label: 'text-red-hi' },
}

/**
 * The base bevelled chrome panel every surface in the kit is built from. A
 * titled panel gets reference-A's segmented title bar: two small bevelled
 * end-cap tiles bracketing an uppercase label plate.
 */
export function Panel({ children, title, tone = 'paper', className = '', style }: PanelProps) {
  const t = TONE[tone]
  return (
    <section className={`relative bg-chrome-panel ${bevelClass({ tone: t.bevel })} ${className}`} style={style}>
      {title && (
        <header
          className={`flex items-center gap-2 px-2 py-1 ${t.barBg}`}
          style={{ borderBottom: `3px solid ${t.barLine}` }}
        >
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 ${bevelClass({ tone: t.bevel, size: 'sm' })}`} />
          <h3 className={`pixel-heading min-w-0 flex-1 truncate text-[16px] leading-[16px] ${t.label}`}>{title}</h3>
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 ${bevelClass({ tone: t.bevel, size: 'sm' })}`} />
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}
