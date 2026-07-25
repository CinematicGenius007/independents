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
 * pulses once under 10 seconds remaining. The timer itself is not live so it
 * does not interrupt a screen reader every second; urgency is announced once.
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
      role="timer"
      aria-label={`Time remaining: ${formatClock(clamped)}`}
    >
      <div aria-hidden className="contents">
        <svg viewBox="0 0 24 24" width={18} height={18} className="shrink-0">
          <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth={2.2} />
          <path d="M12 13 L12 8 M12 13 L16 15" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M9 2 H15" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
        </svg>
        <span className="font-mono text-lg font-semibold tabular-nums">{formatClock(clamped)}</span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full border border-ink-ghost">
          <span
            className="block h-full bg-current transition-[width] duration-300 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
      {urgent && <span className="sr-only" role="status">Ten seconds or less remain.</span>}
      {done && <span className="sr-only" role="status">Time is up.</span>}
    </div>
  )
}
