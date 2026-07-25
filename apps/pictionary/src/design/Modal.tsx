import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton'

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
 * Centered ink panel over a paper-tinted backdrop. Traps focus while open,
 * restores it to whatever triggered the modal on close, and closes on Esc
 * or backdrop click.
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
      <div aria-hidden className="absolute inset-0 bg-ink/55" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-doodle border-[3px] border-ink bg-paper-white p-6 shadow-ink-lg outline-none ${className}`}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          {title && <h2 id={titleId} className="font-[family-name:var(--font-display)] text-xl text-ink">{title}</h2>}
          <IconButton
            label="Close"
            className="ml-auto"
            size="sm"
            onClick={onClose}
            icon={
              <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
                <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
              </svg>
            }
          />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
