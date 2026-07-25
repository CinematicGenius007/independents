import { ditherStyle } from './utils'

export interface ProgressBarProps {
  /** 0-100. */
  value: number
  label?: string
  /** Accessible name when the visible label is intentionally omitted. */
  accessibleLabel?: string
  tone?: 'accent' | 'alert' | 'ok'
  className?: string
}

const TONE_BG: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-gold',
  alert: 'bg-red',
  ok: 'bg-moss',
}

/** A pixel fill bar in a recessed groove — the leading edge dithers instead of fading. */
export function ProgressBar({ value, label, accessibleLabel, tone = 'accent', className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-baseline justify-between text-xs text-text-muted">
          <span>{label}</span>
          <span className="font-mono">{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className="h-4 w-full overflow-hidden bg-chrome-lo"
        style={{ boxShadow: 'inset 2px 2px 0 0 var(--color-chrome-deep)' }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleLabel ?? label}
      >
        <div className={`relative h-full origin-left transition-[width] duration-300 ease-out ${TONE_BG[tone]}`} style={{ width: `${clamped}%` }}>
          {clamped > 0 && clamped < 100 && (
            <span
              aria-hidden
              className="pixel-dither absolute inset-y-0 right-0 w-2"
              style={ditherStyle({ colorA: 'transparent', colorB: 'rgb(0 0 0 / 0.3)', cell: 2 })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
