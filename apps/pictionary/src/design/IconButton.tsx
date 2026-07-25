import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { bevelClass, FOCUS_RING } from './utils'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: ReactNode
  /** Always required — icon-only buttons must have an accessible name. */
  label: string
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_PX: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
}

/**
 * A single bevelled chrome tile — the undecorated version of the reference's
 * icon-tile toolbar buttons (see `CanvasTools` for the captioned variant).
 * `active` swaps to a pressed-in bevel plus a gold outline ring.
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
        'inline-flex items-center justify-center bg-chrome-panel text-text',
        bevelClass({ tone: 'chrome', pressed: active }),
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        active ? 'outline outline-[2px] outline-offset-2 outline-[color:var(--color-gold)]' : '',
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
