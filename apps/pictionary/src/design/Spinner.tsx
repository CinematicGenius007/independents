export interface SpinnerProps {
  size?: number
  className?: string
  /** Accessible label; spinner is decorative by default with a visually-hidden status text. */
  label?: string
}

/**
 * A hand-drawn "scribbled circle" loading indicator — an imperfect stroked
 * arc that spins. `prefers-reduced-motion` is handled globally (animation
 * durations are zeroed and iteration count is forced to 1), so this degrades
 * to a static doodle rather than an infinite spin.
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
        viewBox="0 0 40 40"
        fill="none"
        className="animate-spin"
        aria-hidden
      >
        <path
          d="M20 4 C 29.5 4 37 11.2 36.5 20.5 C 36 29.6 28.8 36.3 20.2 36 C 11.4 35.7 4.3 28.5 4.5 19.8 C 4.6 14.7 7.4 9.7 11 6.8"
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
