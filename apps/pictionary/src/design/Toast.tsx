import { useEffect } from 'react'
import type { PanelTone } from './Panel'
import { FOCUS_RING } from './utils'

export interface ToastData {
  id: string
  message: string
  tone?: PanelTone
  /** Ms before auto-dismiss. 0 disables auto-dismiss. Default 4000. */
  durationMs?: number
}

export interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

const TONE_CLASSES: Record<PanelTone, string> = {
  paper: 'bg-paper-white',
  accent: 'bg-accent-wash',
  alert: 'bg-alert-wash',
}

/** A single transient ink note. Presentational — `ToastHost` owns the timer. */
export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div
      className={`pointer-events-auto flex max-w-sm items-start gap-2 border-[3px] border-ink px-3.5 py-2.5 shadow-ink-sm ${TONE_CLASSES[toast.tone ?? 'paper']}`}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 rounded-full p-1 text-ink-faint hover:text-ink ${FOCUS_RING}`}
      >
        <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden>
          <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

export interface ToastHostProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
  className?: string
}

/**
 * Fixed top-right stack. `aria-live="polite"` so screen readers announce new
 * toasts without interrupting. Owns per-toast auto-dismiss timers (a UI
 * concern, not game logic) — callers just supply/remove entries.
 */
export function ToastHost({ toasts, onDismiss, className = '' }: ToastHostProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={`pointer-events-none fixed right-4 top-4 z-[var(--z-toast)] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 ${className}`}
    >
      {toasts.map((toast) => (
        <TimedToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function TimedToast({ toast, onDismiss }: ToastProps) {
  const duration = toast.durationMs ?? 4000
  useEffect(() => {
    if (duration <= 0) return
    const t = window.setTimeout(() => onDismiss(toast.id), duration)
    return () => window.clearTimeout(t)
  }, [toast.id, duration, onDismiss])

  return <Toast toast={toast} onDismiss={onDismiss} />
}
