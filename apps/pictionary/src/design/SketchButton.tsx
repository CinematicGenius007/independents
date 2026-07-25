import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { bevelClass, FOCUS_RING, type BevelTone } from './utils'
import { Spinner } from './Spinner'

export type SketchButtonVariant = 'primary' | 'ghost' | 'danger'
export type SketchButtonSize = 'sm' | 'md' | 'lg'

export interface SketchButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant?: SketchButtonVariant
  size?: SketchButtonSize
  disabled?: boolean
  loading?: boolean
  children?: ReactNode
  className?: string
}

const VARIANT: Record<SketchButtonVariant, { bevel: BevelTone; bg: string; text: string }> = {
  primary: { bevel: 'gold', bg: 'bg-gold', text: 'text-ink' },
  ghost: { bevel: 'chrome', bg: 'bg-chrome-panel', text: 'text-text' },
  danger: { bevel: 'red', bg: 'bg-red', text: 'text-text' },
}

/* Silkscreen (backing --font-display) is drawn on an 8px grid: pin sizes to
   8/16/24/32 or the glyphs fringe. */
const SIZE_CLASSES: Record<SketchButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[16px] leading-[16px] gap-1.5',
  md: 'px-4 py-2.5 text-[16px] leading-[16px] gap-2',
  lg: 'px-6 py-3.5 text-[24px] leading-[24px] gap-2.5',
}

/**
 * The workhorse button: chunky hard bevel, physically presses in on
 * `:active` (the bevel inverts — see `.pixel-bevel` in theme.css — plus a
 * 1px nudge so the label seems to touch the frame).
 */
export function SketchButton({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  type = 'button',
  ...rest
}: SketchButtonProps) {
  const isDisabled = disabled || loading
  const v = VARIANT[variant]
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'pixel-heading relative inline-flex select-none items-center justify-center',
        bevelClass({ tone: v.bevel }),
        v.bg,
        v.text,
        SIZE_CLASSES[size],
        isDisabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer active:translate-x-px active:translate-y-px',
        FOCUS_RING,
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} label="" />}
      <span className={loading ? 'opacity-70' : undefined}>{children}</span>
    </button>
  )
}
