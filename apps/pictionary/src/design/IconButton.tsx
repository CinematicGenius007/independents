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
 * Square icon-only button for the drawing toolbar.
 *
 * `active` reads as pressed into the page: the ink border stays (a dashed
 * accent outline alone was too faint to find at a glance while drawing), the
 * fill goes to the accent wash, and the offset shadow collapses so the tile
 * sits lower than its neighbours. Shape, fill and elevation all move together,
 * so the selected tool is legible without relying on color.
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
        // No `bg-*` or `border-*` in the base: Tailwind resolves conflicting
        // utilities by their order in the generated stylesheet, not by their
        // order in this string, so a base colour here can silently beat the
        // state colour below. Each state owns its own background and border.
        'inline-flex items-center justify-center rounded-doodle border-[3px] text-ink',
        'transition-[transform,box-shadow] duration-100 ease-out',
        disabled
          ? 'cursor-not-allowed border-ink-ghost bg-paper-white text-ink-faint opacity-60'
          : active
            ? 'translate-x-[2px] translate-y-[2px] border-ink bg-accent-wash shadow-none'
            : 'border-ink bg-paper-white shadow-ink-sm hover:-translate-y-0.5 hover:shadow-ink active:translate-y-0.5 active:shadow-none',
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
