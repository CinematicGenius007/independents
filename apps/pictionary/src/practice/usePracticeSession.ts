import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCanvasState,
  undoLastBy,
  type CanvasOp,
  type CanvasState,
  type ToolSettings,
} from '../canvas'
import type { PlayerStats } from '../shared/types'
import { createPracticeSession, currentPracticePrompt, practiceTimeLeftMs, reducePractice } from './session'
import { completedPracticeStatsDelta } from './stats'
import type { PracticePrompt, PracticeState } from './types'

const DEFAULT_TOOLS: ToolSettings = { tool: 'pencil', color: '#1A1A1A', size: 8 }

export interface UsePracticeSessionOptions {
  seed: string
  prompts: readonly PracticePrompt[]
  turnDurationMs: number
  authorId?: string
  startedAt?: number
  clock?: () => number
  onStatsDelta?: (delta: Partial<PlayerStats>) => void
}

export interface PracticeSessionController {
  state: PracticeState
  prompt: PracticePrompt | null
  secondsRemaining: number
  canvasState: CanvasState
  settings: ToolSettings
  authorId: string
  onCanvasCommit: (op: CanvasOp) => void
  onSettingsChange: (settings: ToolSettings) => void
  onUndo: () => void
  onClear: () => void
  onNextPrompt: () => void
}

/** Owns one offline practice run. Mount a new instance to begin a new run. */
export function usePracticeSession(options: UsePracticeSessionOptions): PracticeSessionController {
  const clock = useRef(options.clock ?? Date.now)
  clock.current = options.clock ?? Date.now
  const initialAt = useRef(options.startedAt ?? clock.current())
  const [state, setState] = useState(() => createPracticeSession({
    seed: options.seed,
    prompts: options.prompts,
    turnDurationMs: options.turnDurationMs,
    startedAt: initialAt.current,
  }))
  const [now, setNow] = useState(initialAt.current)
  const [canvasState, setCanvasState] = useState(createCanvasState)
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOLS)
  const completionSent = useRef(false)
  const onStatsDelta = useRef(options.onStatsDelta)
  onStatsDelta.current = options.onStatsDelta
  const authorId = options.authorId ?? 'local'

  useEffect(() => {
    if (state.phase !== 'drawing') return
    const tick = () => {
      const at = clock.current()
      setNow(at)
      setState((current) => reducePractice(current, { type: 'TICK', at }))
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [state.phase, state.turnStartedAt])

  useEffect(() => {
    const delta = completedPracticeStatsDelta(state)
    if (!delta || completionSent.current) return
    completionSent.current = true
    onStatsDelta.current?.(delta)
  }, [state])

  const onCanvasCommit = useCallback((op: CanvasOp) => {
    setCanvasState((current) => {
      if (current.ops.some((candidate) => candidate.by === op.by && candidate.id === op.id)) return current
      return {
        ops: [...current.ops, op],
        nextId: Math.max(current.nextId, op.id + 1),
      }
    })
  }, [])

  const onUndo = useCallback(() => {
    setCanvasState((current) => undoLastBy(current, authorId))
  }, [authorId])

  const onClear = useCallback(() => {
    setCanvasState((current) => ({
      ops: [...current.ops, { t: 'clear', id: current.nextId, by: authorId }],
      nextId: current.nextId + 1,
    }))
  }, [authorId])

  const onNextPrompt = useCallback(() => {
    if (state.phase !== 'review') return
    const at = clock.current()
    setState(reducePractice(state, { type: 'NEXT_PROMPT', at }))
    setNow(at)
    setCanvasState(createCanvasState())
  }, [state])

  return {
    state,
    prompt: currentPracticePrompt(state),
    secondsRemaining: practiceTimeLeftMs(state, now) / 1000,
    canvasState,
    settings,
    authorId,
    onCanvasCommit,
    onSettingsChange: setSettings,
    onUndo,
    onClear,
    onNextPrompt,
  }
}
