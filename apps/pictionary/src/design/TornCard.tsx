import { useId, type ReactNode } from 'react'
import { doodleRotation, fallbackKey, tornBottomClipPath } from './utils'
import type { PanelTone } from './Panel'

export interface TornCardProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  wobble?: boolean
  className?: string
  wobbleKey?: string
}

const TONE_CLASSES: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/**
 * A `Panel` whose bottom edge looks torn off a sketchbook page. The jagged
 * edge is a deterministic clip-path polygon (hashed from `wobbleKey`), plus
 * a duplicated ink-colored layer offset behind it to fake a torn outline
 * (clip-path can't stroke itself).
 */
export function TornCard({ children, title, tone = 'paper', wobble = true, className = '', wobbleKey }: TornCardProps) {
  const reactId = useId()
  const key = wobbleKey ?? title ?? fallbackKey('torn', reactId)
  const rotation = wobble ? doodleRotation(key) : 0
  const clip = tornBottomClipPath(key)

  return (
    <div
      className={`relative pb-3 ${className}`}
      style={{ transform: rotation ? `rotate(${rotation.toFixed(2)}deg)` : undefined }}
    >
      {/* Ink layer behind, offset down/right, gives the torn edge an outline. */}
      <div aria-hidden className="absolute inset-0 translate-x-[3px] translate-y-[3px] bg-ink" style={{ clipPath: clip }} />
      <div className={`relative border-[3px] border-ink px-5 py-4 ${TONE_CLASSES[tone]}`} style={{ clipPath: clip }}>
        {title && (
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-base leading-none text-ink">{title}</h3>
        )}
        {children}
      </div>
    </div>
  )
}
