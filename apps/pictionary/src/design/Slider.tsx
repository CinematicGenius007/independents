import { useId } from 'react'
import { FOCUS_RING } from './utils'

export interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: string
  /** Formats the value shown next to the label, e.g. `(v) => \`${v}s\`` . */
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Range input styled as a recessed pixel groove with a square gold bevelled
 * thumb. Real `<input type="range">` underneath — full keyboard support
 * (arrows, Home/End, Page Up/Down) comes free.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  formatValue,
  disabled = false,
  className = '',
  id,
}: SliderProps) {
  const reactId = useId()
  const inputId = id ?? reactId

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-baseline justify-between">
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
          </label>
          <span className="font-mono text-xs text-text-muted">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={[
          'h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed',
          FOCUS_RING,
          '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-none [&::-webkit-slider-runnable-track]:bg-chrome-lo',
          '[&::-webkit-slider-runnable-track]:shadow-[inset_2px_2px_0_0_var(--color-chrome-deep),inset_-2px_-2px_0_0_var(--color-chrome-hi)]',
          '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-none [&::-moz-range-track]:bg-chrome-lo',
          '[&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-t-[color:var(--color-gold-hi)] [&::-webkit-slider-thumb]:border-l-[color:var(--color-gold-hi)]',
          '[&::-webkit-slider-thumb]:border-b-[color:var(--color-gold-lo)] [&::-webkit-slider-thumb]:border-r-[color:var(--color-gold-lo)] [&::-webkit-slider-thumb]:bg-gold',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-t-[color:var(--color-gold-hi)] [&::-moz-range-thumb]:border-l-[color:var(--color-gold-hi)]',
          '[&::-moz-range-thumb]:border-b-[color:var(--color-gold-lo)] [&::-moz-range-thumb]:border-r-[color:var(--color-gold-lo)] [&::-moz-range-thumb]:bg-gold',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      />
    </div>
  )
}
