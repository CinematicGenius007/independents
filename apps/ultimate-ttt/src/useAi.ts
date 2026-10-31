import { useCallback, useEffect, useRef } from 'react'
import { chooseMove } from './ai'
import type { Level } from './ai'
import type { GameState, Move } from './game'

interface Pending {
  resolve: (move: Move) => void
  state: GameState
  level: Level
}

/**
 * Asks the machine for a move without blocking the page. The search runs in a
 * Web Worker. If the worker cannot start or crashes, the move is worked out on
 * the page instead — slower, but the game never hangs waiting for a reply.
 */
export function useAi() {
  const worker = useRef<Worker | null>(null)
  const waiting = useRef(new Map<number, Pending>())
  const counter = useRef(0)

  useEffect(() => {
    const pending = waiting.current
    let w: Worker | null = null
    try {
      w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      worker.current = null
    }
    if (w) {
      w.onmessage = (e: MessageEvent<{ id: number; move: Move }>) => {
        const done = pending.get(e.data.id)
        pending.delete(e.data.id)
        done?.resolve(e.data.move)
      }
      const fail = () => {
        worker.current = null
        for (const [id, p] of [...pending]) {
          pending.delete(id)
          p.resolve(chooseMove(p.state, p.level, Math.random, 300))
        }
      }
      w.onerror = fail
      w.onmessageerror = fail
      worker.current = w
    }
    return () => {
      w?.terminate()
      worker.current = null
      pending.clear()
    }
  }, [])

  return useCallback((state: GameState, level: Level) => {
    return new Promise<Move>(resolve => {
      if (!worker.current) return resolve(chooseMove(state, level, Math.random, 300))
      const id = ++counter.current
      waiting.current.set(id, { resolve, state, level })
      worker.current.postMessage({ id, state, level })
    })
  }, [])
}
