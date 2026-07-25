import type { ReactNode } from 'react'
import { Paper } from '../design'
import { bevelClass, FOCUS_RING } from '../design/utils'

export interface ScreenFrameProps {
  children: ReactNode
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

/** Shared page chrome for the prop-driven screens. */
export function ScreenFrame({ children, eyebrow, title, subtitle, actions, compact = false }: ScreenFrameProps) {
  return (
    <Paper className="min-h-screen">
      <main className={`mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 sm:px-6 ${compact ? 'py-4' : 'py-7 sm:py-10'}`}>
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && <p className="pixel-heading text-[8px] leading-[16px] text-gold-hi">{eyebrow}</p>}
            <h1 className="pixel-heading text-[32px] leading-[32px] text-text">{title}</h1>
            {subtitle && <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-base">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </main>
    </Paper>
  )
}

export const inputClassName = `w-full bg-chrome-panel px-3 py-2.5 text-text outline-none placeholder:text-text-muted ${FOCUS_RING} ${bevelClass({ tone: 'chrome' })}`
