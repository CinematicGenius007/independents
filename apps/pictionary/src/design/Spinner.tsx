export interface SpinnerProps {
  size?: number
  className?: string
  /** Accessible label; spinner is decorative by default with a visually-hidden status text. */
  label?: string
}

const DOTS: Array<[number, number, number]> = [
  [7, 1, 1],
  [11, 3, 0.85],
  [13, 7, 0.7],
  [11, 12, 0.55],
  [7, 13, 0.4],
  [3, 12, 0.3],
  [2, 7, 0.2],
  [3, 3, 0.15],
]

/**
 * A pixel-dot loading ring — 8 blocky squares fading around a circle,
 * spinning as a group. `prefers-reduced-motion` is handled globally
 * (animation durations are zeroed and iteration count is forced to 1), so
 * this degrades to a static ring rather than an infinite spin.
 */
export function Spinner({ size = 28, className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={`inline-flex ${className}`}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="animate-spin"
        style={{ transformOrigin: '50% 50%' }}
        aria-hidden
      >
        {DOTS.map(([x, y, opacity]) => (
          <rect key={`${x},${y}`} x={x} y={y} width={2} height={2} fill="var(--color-gold)" opacity={opacity} />
        ))}
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
