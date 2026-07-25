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
 * Range input styled as a hand-drawn ink track with a circular thumb. Real
 * `<input type="range">` underneath — full keyboard support (arrows,
 * Home/End, Page Up/Down) comes free.
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
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
          <span className="font-mono text-xs text-ink-soft">{formatValue ? formatValue(value) : value}</span>
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
          '[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-ink',
          '[&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ink',
          '[&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-ink-sm',
          '[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-ink-sm',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      />
    </div>
  )
}
