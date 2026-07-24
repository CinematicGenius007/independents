import type { Category } from '../shared/types'

export interface PracticePrompt {
  word: string
  category: Category
}

export interface PracticeResult extends PracticePrompt {
  startedAt: number
  endedAt: number
  guessed: boolean
}

export type PracticePhase = 'drawing' | 'review' | 'complete'

export interface PracticeState {
  id: string
  seed: string
  phase: PracticePhase
  prompts: readonly PracticePrompt[]
  turnDurationMs: number
  turnIndex: number
  turnStartedAt: number
  turnEndsAt: number
  simulatedGuessAt: number | null
  results: readonly PracticeResult[]
  completedAt: number | null
}

export type PracticeAction =
  | { type: 'TICK'; at: number }
  | { type: 'NEXT_PROMPT'; at: number }

export interface CreatePracticeSessionOptions {
  seed: string
  prompts: readonly PracticePrompt[]
  turnDurationMs: number
  startedAt: number
}
