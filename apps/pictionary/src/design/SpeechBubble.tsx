import { useId, type ReactNode } from 'react'
import { doodleRadius, doodleRotation, fallbackKey } from './utils'
import type { PanelTone } from './Panel'

export type SpeechBubbleTail = 'left' | 'right' | 'bottom' | 'none'

export interface SpeechBubbleProps {
  children?: ReactNode
  tail?: SpeechBubbleTail
  tone?: PanelTone
  wobble?: boolean
  className?: string
  wobbleKey?: string
}

const TONE_BG: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/** Tail is a rotated square, border-matched on two edges, tucked half under the bubble. */
const TAIL_POSITION: Record<Exclude<SpeechBubbleTail, 'none'>, string> = {
  left: 'left-[-9px] top-1/2 -translate-y-1/2 border-r-0 border-t-0',
  right: 'right-[-9px] top-1/2 -translate-y-1/2 border-l-0 border-b-0',
  bottom: 'bottom-[-9px] left-6 border-t-0 border-l-0',
}

export function SpeechBubble({ children, tail = 'bottom', tone = 'paper', wobble = false, className = '', wobbleKey }: SpeechBubbleProps) {
  const reactId = useId()
  const key = wobbleKey ?? fallbackKey('bubble', reactId)
  const rotation = wobble ? doodleRotation(key, 0.6) : 0

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ transform: rotation ? `rotate(${rotation.toFixed(2)}deg)` : undefined }}
    >
      <div
        className={`relative border-[3px] border-ink px-3 py-2 shadow-ink-sm ${TONE_BG[tone]}`}
        style={{ borderRadius: doodleRadius(key) }}
      >
        {children}
      </div>
      {tail !== 'none' && (
        <span
          aria-hidden
          className={`absolute h-4 w-4 rotate-45 border-[3px] border-ink ${TONE_BG[tone]} ${TAIL_POSITION[tail]}`}
        />
      )}
    </div>
  )
}
