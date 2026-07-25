import { useEffect } from 'react'
import type { PanelTone } from './Panel'
import { bevelClass, FOCUS_RING } from './utils'

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

const TONE_BG: Record<PanelTone, string> = {
  paper: 'bg-parchment',
  accent: 'bg-gold-hi',
  alert: 'bg-red-hi',
}

/** A single transient parchment scroll note, complete with bevelled wooden dowel ends. Presentational — `ToastHost` owns the timer. */
export function Toast({ toast, onDismiss }: ToastProps) {
  const bg = TONE_BG[toast.tone ?? 'paper']
  return (
    <div
      className={`pointer-events-auto relative flex max-w-sm items-stretch ${bevelClass({ tone: 'parchment' })}`}
      style={{ boxShadow: 'var(--shadow-pixel)' }}
    >
      <span
        aria-hidden
        className="w-2.5 shrink-0 bg-wood"
        style={{ boxShadow: 'inset -2px 0 0 0 var(--color-wood-lo), inset 2px 0 0 0 var(--color-wood-hi)' }}
      />
      <div className={`flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 ${bg}`}>
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{toast.message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
          className={`shrink-0 p-0.5 text-ink-faint hover:text-ink ${FOCUS_RING}`}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden shapeRendering="crispEdges">
            <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth={3} strokeLinecap="square" />
          </svg>
        </button>
      </div>
      <span
        aria-hidden
        className="w-2.5 shrink-0 bg-wood"
        style={{ boxShadow: 'inset 2px 0 0 0 var(--color-wood-lo), inset -2px 0 0 0 var(--color-wood-hi)' }}
      />
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
