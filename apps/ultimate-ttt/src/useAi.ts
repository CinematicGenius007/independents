import { useCallback, useEffect, useRef } from 'react'
import type { Level } from './ai'
import type { GameState, Move } from './game'

/**
 * Asks the machine for a move without blocking the page. The search runs in a
 * Web Worker; a reply that arrives after the position has moved on is dropped.
 */
export function useAi() {
  const worker = useRef<Worker | null>(null)
  const waiting = useRef(new Map<number, (move: Move) => void>())
  const counter = useRef(0)

  useEffect(() => {
    const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ id: number; move: Move }>) => {
      const done = waiting.current.get(e.data.id)
      waiting.current.delete(e.data.id)
      done?.(e.data.move)
    }
    worker.current = w
    const pending = waiting.current
    return () => {
      w.terminate()
      worker.current = null
      pending.clear()
    }
  }, [])

  return useCallback((state: GameState, level: Level) => {
    return new Promise<Move>(resolve => {
      const id = ++counter.current
      waiting.current.set(id, resolve)
      worker.current?.postMessage({ id, state, level })
    })
  }, [])
}
