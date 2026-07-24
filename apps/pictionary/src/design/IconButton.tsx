import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { FOCUS_RING } from './utils'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: ReactNode
  /** Always required — icon-only buttons must have an accessible name. */
  label: string
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_PX: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-lg',
  lg: 'h-14 w-14 text-2xl',
}

/**
 * Square icon-only button for the drawing toolbar. `active` swaps the solid
 * ink border for a dashed accent outline, matching the reference's
 * dashed-diamond "selected target" language.
 */
export function IconButton({ icon, label, active = false, size = 'md', className = '', disabled, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center rounded-[10px] border-[3px] bg-paper-white text-ink',
        'transition-[transform,box-shadow] duration-100 ease-out',
        disabled
          ? 'cursor-not-allowed border-ink-ghost text-ink-faint opacity-60'
          : active
            ? 'border-dashed border-accent-deep bg-accent-wash shadow-ink-sm'
            : 'border-ink shadow-ink-sm hover:-translate-y-0.5 hover:shadow-ink active:translate-y-0.5 active:shadow-none',
        SIZE_PX[size],
        FOCUS_RING,
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
    </button>
  )
}
