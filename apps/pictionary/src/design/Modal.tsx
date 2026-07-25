import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { bevelClass, FOCUS_RING } from './utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A window-frame panel over a dimmed backdrop: segmented title bar with a
 * gold end-cap and the reference's red close box, chrome body. Traps focus
 * while open, restores it to whatever triggered the modal on close, and
 * closes on Esc or backdrop click.
 */
export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(focusables?.[0] ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (n) => n.offsetParent !== null,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-chrome-deep/80" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full max-w-lg overflow-auto bg-chrome-panel outline-none ${bevelClass({ tone: 'chrome', size: 'lg' })} ${className}`}
        style={{ boxShadow: 'var(--shadow-pixel-lg)' }}
      >
        <header className="flex items-center gap-2 bg-chrome px-3 py-2" style={{ borderBottom: '3px solid var(--color-chrome-lo)' }}>
          <span aria-hidden className={`h-3 w-3 shrink-0 ${bevelClass({ tone: 'gold', size: 'sm' })}`} />
          {title ? (
            <h2 id={titleId} className="pixel-heading min-w-0 flex-1 truncate text-[16px] leading-[16px] text-text">
              {title}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`flex h-6 w-6 shrink-0 items-center justify-center bg-red text-text ${bevelClass({ tone: 'red', size: 'sm' })} ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden shapeRendering="crispEdges">
              <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth={3} strokeLinecap="square" />
            </svg>
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
