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
  accent: 'bg-accent',
  alert: 'bg-alert',
  ok: 'bg-ok',
}

/** A fill bar drawn as ink on paper: straight track, flat leading edge. */
export function ProgressBar({ value, label, accessibleLabel, tone = 'accent', className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-baseline justify-between text-xs text-ink-soft">
          <span>{label}</span>
          <span className="font-mono">{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className="h-4 w-full overflow-hidden border-[3px] border-ink bg-paper-white"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleLabel ?? label}
      >
        <div
          className={`h-full origin-left transition-[width] duration-300 ease-out ${TONE_BG[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
