import type { ReactNode } from 'react'
import type { PanelTone } from './Panel'

export type SpeechBubbleTail = 'left' | 'right' | 'bottom' | 'none'

export interface SpeechBubbleProps {
  children?: ReactNode
  tail?: SpeechBubbleTail
  tone?: PanelTone
  className?: string
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

export function SpeechBubble({ children, tail = 'bottom', tone = 'paper', className = '' }: SpeechBubbleProps) {
  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`relative border-[3px] border-ink px-3 py-2 shadow-ink-sm ${TONE_BG[tone]}`}>
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
