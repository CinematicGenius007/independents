import { useId, type CSSProperties, type ReactNode } from 'react'
import { doodleRadius, doodleRotation, fallbackKey } from './utils'

export type PanelTone = 'paper' | 'accent' | 'alert'

export interface PanelProps {
  children?: ReactNode
  title?: string
  tone?: PanelTone
  /** Apply a tiny, stable per-instance rotation so the panel doesn't look machine-cut. Default true. */
  wobble?: boolean
  className?: string
  style?: CSSProperties
  /** Stable key used to derive rotation/corner jitter. Defaults to `title`, else a per-instance id. */
  wobbleKey?: string
}

const TONE_CLASSES: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/**
 * The base bordered ink panel every surface in the kit is built from: 3px
 * near-black border, hard offset shadow, hand-drawn corner radius, and a
 * whisper of per-instance rotation.
 */
export function Panel({
  children,
  title,
  tone = 'paper',
  wobble = true,
  className = '',
  style,
  wobbleKey,
}: PanelProps) {
  const reactId = useId()
  const key = wobbleKey ?? title ?? fallbackKey('panel', reactId)
  const rotation = wobble ? doodleRotation(key) : 0

  return (
    <section
      className={`relative border-[3px] border-ink ${TONE_CLASSES[tone]} shadow-ink px-5 py-4 ${className}`}
      style={{
        borderRadius: doodleRadius(key),
        transform: rotation ? `rotate(${rotation.toFixed(2)}deg)` : undefined,
        ...style,
      }}
    >
      {title && (
        <h3
          className="absolute -top-3.5 left-4 bg-paper px-2 font-[family-name:var(--font-display)] text-base leading-none text-ink"
          style={{ transform: rotation ? `rotate(${(-rotation * 0.6).toFixed(2)}deg)` : undefined }}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
