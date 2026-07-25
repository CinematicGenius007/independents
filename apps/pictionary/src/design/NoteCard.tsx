import type { ReactNode } from 'react'
import type { PanelTone } from './Panel'

export interface NoteCardProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  className?: string
}

const TONE_CLASSES: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/**
 * A card for content that reads as a page out of the sketchbook.
 *
 * This was `TornCard`, whose bottom edge was a jagged clip-path polygon. The
 * jag fought every layout it sat in and read as damage rather than craft, so
 * the card is now square and distinguishes itself from {@link Panel} by where
 * the title sits: `Panel` writes it across the border, a `NoteCard` keeps it
 * inside, over the ruled line of a notebook page.
 */
export function NoteCard({ children, title, tone = 'paper', className = '' }: NoteCardProps) {
  return (
    <div className={`border-[3px] border-ink px-5 py-4 shadow-ink ${TONE_CLASSES[tone]} ${className}`}>
      {title && (
        <h3 className="mb-3 border-b-2 border-dashed border-ink-ghost pb-2 font-[family-name:var(--font-display)] text-base leading-none text-ink">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
