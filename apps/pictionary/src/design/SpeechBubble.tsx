import type { ReactNode } from 'react'
import { bevelClass, type BevelTone } from './utils'
import type { PanelTone } from './Panel'

export type SpeechBubbleTail = 'left' | 'right' | 'bottom' | 'none'

export interface SpeechBubbleProps {
  children?: ReactNode
  tail?: SpeechBubbleTail
  tone?: PanelTone
  className?: string
}

const TONE_BG: Record<PanelTone, string> = {
  paper: 'bg-chrome-panel',
  accent: 'bg-gold-lo',
  alert: 'bg-red-lo',
}
const TONE_TEXT: Record<PanelTone, string> = {
  paper: 'text-text',
  accent: 'text-gold-hi',
  alert: 'text-red-hi',
}
const TONE_BEVEL: Record<PanelTone, BevelTone> = { paper: 'chrome', accent: 'gold', alert: 'red' }

/** A stepped pixel staircase — right angles only, no diagonal antialiasing. */
const STAIR_CLIP =
  'polygon(0% 0%, 100% 0%, 100% 25%, 75% 25%, 75% 50%, 50% 50%, 50% 75%, 25% 75%, 25% 100%, 0% 100%)'

const TAIL_POSITION: Record<Exclude<SpeechBubbleTail, 'none'>, string> = {
  left: 'left-[-9px] top-1/2 -translate-y-1/2 rotate-90',
  right: 'right-[-9px] top-1/2 -translate-y-1/2 -rotate-90',
  bottom: 'bottom-[-9px] left-6 rotate-180',
}

/** A dialogue plate with a stepped pixel tail — reads as chrome UI, not a soft cartoon bubble. */
export function SpeechBubble({ children, tail = 'bottom', tone = 'paper', className = '' }: SpeechBubbleProps) {
  const bevel = TONE_BEVEL[tone]
  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`relative px-3 py-2 ${TONE_BG[tone]} ${TONE_TEXT[tone]} ${bevelClass({ tone: bevel })}`}>
        {children}
      </div>
      {tail !== 'none' && (
        <span
          aria-hidden
          className={`absolute h-3 w-3 ${TONE_BG[tone]} ${TAIL_POSITION[tail]}`}
          style={{ clipPath: STAIR_CLIP }}
        />
      )}
    </div>
  )
}
