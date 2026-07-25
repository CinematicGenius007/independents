import { useId } from 'react'
import { FOCUS_RING } from './utils'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Hand-drawn checkbox: a real `<input type="checkbox">` (visually hidden but
 * still focusable/operable) driving a wobbly ink box with a hand-sketched
 * checkmark stroke that draws in on check.
 */
export function Toggle({ checked, onChange, label, disabled = false, className = '', id }: ToggleProps) {
  const reactId = useId()
  const inputId = id ?? reactId

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={`peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none disabled:cursor-not-allowed ${FOCUS_RING}`}
        />
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <rect
            x="2.5"
            y="2.5"
            width="19"
            height="19"
            rx="4"
            fill="var(--color-paper-white)"
            stroke="var(--color-ink)"
            strokeWidth={2.5}
          />
          <path
            d="M5.5 12.5 L10 17 L19 6"
            fill="none"
            stroke="var(--color-accent-deep)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="transition-[stroke-dashoffset] duration-200 ease-out"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: checked ? 0 : 1,
            }}
          />
        </svg>
      </span>
      {label && <span className="select-none text-sm text-ink">{label}</span>}
    </label>
  )
}
