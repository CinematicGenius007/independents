import { bevelClass } from './utils'

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
 * The turn countdown. Chrome by default; drops into a pulsing red bevel
 * under 10 seconds remaining. The timer itself is not live so it does not
 * interrupt a screen reader every second; urgency is announced once.
 */
export function Ticker({ secondsRemaining, totalSeconds, className = '' }: TickerProps) {
  const clamped = Math.max(0, secondsRemaining)
  const urgent = clamped <= URGENT_THRESHOLD && clamped > 0
  const done = clamped <= 0
  const alert = urgent || done
  const percent = totalSeconds > 0 ? Math.min(100, Math.max(0, (clamped / totalSeconds) * 100)) : 0

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 ${bevelClass({ tone: alert ? 'red' : 'chrome' })} ${
        alert ? 'bg-red-lo text-red-hi motion-safe:animate-pulse' : 'bg-chrome-panel text-text'
      } ${className}`}
      role="timer"
      aria-label={`Time remaining: ${formatClock(clamped)}`}
    >
      <div aria-hidden className="contents">
        <svg viewBox="0 0 8 8" width={16} height={16} shapeRendering="crispEdges" className="shrink-0">
          <rect x={1} y={1} width={6} height={6} fill="none" stroke="currentColor" strokeWidth={1} />
          <rect x={3.5} y={2} width={1} height={2} fill="currentColor" />
          <rect x={3.5} y={3.5} width={1.5} height={1} fill="currentColor" />
        </svg>
        <span className="pixel-heading text-[16px] leading-[16px] tabular-nums">{formatClock(clamped)}</span>
        <span
          className="h-2 w-14 shrink-0 overflow-hidden bg-chrome-lo"
          style={{ boxShadow: 'inset 1px 1px 0 0 var(--color-chrome-deep)' }}
        >
          <span className="block h-full bg-current transition-[width] duration-300 ease-linear" style={{ width: `${percent}%` }} />
        </span>
      </div>
      {urgent && (
        <span className="sr-only" role="status">
          Ten seconds or less remain.
        </span>
      )}
      {done && (
        <span className="sr-only" role="status">
          Time is up.
        </span>
      )}
    </div>
  )
}
