import type { CSSProperties, ReactNode } from 'react'

export type PanelTone = 'paper' | 'accent' | 'alert'

export interface PanelProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  className?: string
  style?: CSSProperties
}

const TONE_CLASSES: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/**
 * The base bordered ink panel every surface in the kit is built from: 3px
 * near-black border, hard offset shadow, square corners. The title sits on the
 * border itself, like a label written across the edge of a taped-down sheet.
 */
export function Panel({ children, title, tone = 'paper', className = '', style }: PanelProps) {
  return (
    <section
      className={`relative border-[3px] border-ink ${TONE_CLASSES[tone]} shadow-ink px-5 py-4 ${className}`}
      style={style}
    >
      {title && (
        <h3 className="absolute -top-3.5 left-4 bg-paper px-2 font-[family-name:var(--font-display)] text-base leading-none text-ink">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
