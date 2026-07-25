import type { ReactNode } from 'react'
import { Paper } from '../design'

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
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-faint">{eyebrow}</p>}
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none text-ink sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </main>
    </Paper>
  )
}

export const inputClassName =
  'w-full rounded-doodle border-[3px] border-ink bg-paper-white px-3 py-2.5 text-ink shadow-ink-sm outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
