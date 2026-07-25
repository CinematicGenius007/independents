import { useId } from 'react'
import { bevelClass, FOCUS_RING } from './utils'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Pixel checkbox: a real `<input type="checkbox">` (visually hidden but
 * still focusable/operable) driving a square bevelled box. Checked inverts
 * the bevel (reads as "pressed in") and reveals a blocky pixel checkmark.
 */
export function Toggle({ checked, onChange, label, disabled = false, className = '', id }: ToggleProps) {
  const reactId = useId()
  const inputId = id ?? reactId

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <span
        className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center bg-chrome-panel ${bevelClass({ tone: 'gold', pressed: checked })}`}
      >
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
          viewBox="0 0 8 8"
          shapeRendering="crispEdges"
          className="pointer-events-none h-3.5 w-3.5"
          style={{ opacity: checked ? 1 : 0, transition: 'opacity var(--dur-fast) linear' }}
        >
          <rect x={1} y={4} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={2} y={5} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={3} y={6} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={4} y={5} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={5} y={4} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={6} y={3} width={1} height={1} fill="var(--color-gold-hi)" />
          <rect x={7} y={2} width={1} height={1} fill="var(--color-gold-hi)" />
        </svg>
      </span>
      {label && <span className="select-none text-sm text-text">{label}</span>}
    </label>
  )
}
