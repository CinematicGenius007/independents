import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { FOCUS_RING } from './utils'
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

const VARIANT_CLASSES: Record<SketchButtonVariant, string> = {
  primary: 'bg-accent text-ink',
  ghost: 'bg-paper-white text-ink',
  danger: 'bg-alert text-paper-white',
}

const SIZE_CLASSES: Record<SketchButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-6 py-3.5 text-lg gap-2.5',
}

/**
 * The workhorse button. Ink border, hard offset shadow, and a genuine press:
 * on `:active` it translates into its own shadow and the shadow disappears,
 * like the shape got pushed flat against the paper.
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
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'relative inline-flex select-none items-center justify-center rounded-doodle border-[3px] border-ink font-[family-name:var(--font-display)]',
        'shadow-ink transition-[transform,box-shadow] duration-100 ease-out',
        'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
        isDisabled
          ? 'cursor-not-allowed opacity-50 shadow-ink-sm'
          : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-ink-lg active:hover:translate-y-[4px]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
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
