export interface TickerProps {
  secondsRemaining: number
  totalSeconds: number
  className?: string
}

const URGENT_THRESHOLD = 10

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * The turn countdown. Ink-on-paper by default; drops into alert orange and
 * pulses once under 10 seconds remaining. `aria-live="polite"` announces the
 * urgent transition without spamming a screen reader every second.
 */
export function Ticker({ secondsRemaining, totalSeconds, className = '' }: TickerProps) {
  const clamped = Math.max(0, secondsRemaining)
  const urgent = clamped <= URGENT_THRESHOLD && clamped > 0
  const done = clamped <= 0
  const percent = totalSeconds > 0 ? Math.min(100, Math.max(0, (clamped / totalSeconds) * 100)) : 0

  return (
    <div
      className={`inline-flex items-center gap-2.5 border-[3px] px-3.5 py-1.5 shadow-ink-sm rounded-doodle ${
        urgent || done ? 'border-alert-deep bg-alert-wash text-alert-deep animate-pulse' : 'border-ink bg-paper-white text-ink'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className="shrink-0">
        <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth={2.2} />
        <path d="M12 13 L12 8 M12 13 L16 15" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M9 2 H15" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      <span className="font-mono text-lg font-semibold tabular-nums">{formatClock(clamped)}</span>
      <span className="sr-only">{urgent ? `${clamped} seconds left, hurry` : `${clamped} seconds left`}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full border border-ink-ghost" aria-hidden>
        <span
          className="block h-full bg-current transition-[width] duration-300 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  )
}
