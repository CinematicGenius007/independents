import { hashString } from '../engine/rng'
import type {
  CreatePracticeSessionOptions,
  PracticeAction,
  PracticePrompt,
  PracticeResult,
  PracticeState,
} from './types'

function randomFraction(key: string): number {
  return hashString(key) / 0x1_0000_0000
}

function guessTime(
  seed: string,
  prompt: PracticePrompt,
  turnIndex: number,
  startedAt: number,
  durationMs: number,
): number | null {
  const key = `${seed}:${turnIndex}:${prompt.category}:${prompt.word}`
  // Missing occasionally makes the offline guesser feel less mechanical.
  if (randomFraction(`${key}:success`) >= 0.8) return null
  const delayFraction = 0.35 + randomFraction(`${key}:delay`) * 0.5
  return startedAt + Math.floor(durationMs * delayFraction)
}

function startTurn(state: PracticeState, turnIndex: number, at: number): PracticeState {
  const prompt = state.prompts[turnIndex]
  if (!prompt) {
    return {
      ...state,
      phase: 'complete',
      completedAt: at,
      simulatedGuessAt: null,
    }
  }

  return {
    ...state,
    phase: 'drawing',
    turnIndex,
    turnStartedAt: at,
    turnEndsAt: at + state.turnDurationMs,
    simulatedGuessAt: guessTime(state.seed, prompt, turnIndex, at, state.turnDurationMs),
  }
}

export function createPracticeSession(options: CreatePracticeSessionOptions): PracticeState {
  if (options.prompts.length === 0) throw new Error('Practice requires at least one prompt')
  if (!Number.isFinite(options.turnDurationMs) || options.turnDurationMs <= 0) {
    throw new Error('Practice turn duration must be positive')
  }
  for (const prompt of options.prompts) {
    if (prompt.word.trim().length === 0) throw new Error('Practice prompts cannot be blank')
  }

  const initial: PracticeState = {
    id: `${options.seed}:${options.startedAt}`,
    seed: options.seed,
    phase: 'drawing',
    prompts: options.prompts.map((prompt) => ({ ...prompt, word: prompt.word.trim() })),
    turnDurationMs: options.turnDurationMs,
    turnIndex: 0,
    turnStartedAt: options.startedAt,
    turnEndsAt: options.startedAt + options.turnDurationMs,
    simulatedGuessAt: null,
    results: [],
    completedAt: null,
  }
  return startTurn(initial, 0, options.startedAt)
}

function finishTurn(state: PracticeState, at: number, guessed: boolean): PracticeState {
  const prompt = state.prompts[state.turnIndex]
  if (!prompt) return state
  const result: PracticeResult = {
    ...prompt,
    startedAt: state.turnStartedAt,
    endedAt: at,
    guessed,
  }
  return {
    ...state,
    phase: 'review',
    results: [...state.results, result],
  }
}

export function reducePractice(state: PracticeState, action: PracticeAction): PracticeState {
  if (state.phase === 'complete') return state

  if (action.type === 'NEXT_PROMPT') {
    if (state.phase !== 'review' || action.at < state.results[state.results.length - 1]!.endedAt) {
      return state
    }
    return startTurn(state, state.turnIndex + 1, action.at)
  }

  if (state.phase !== 'drawing' || action.at < state.turnStartedAt) return state
  if (state.simulatedGuessAt !== null && action.at >= state.simulatedGuessAt) {
    return finishTurn(state, state.simulatedGuessAt, true)
  }
  if (action.at >= state.turnEndsAt) return finishTurn(state, state.turnEndsAt, false)
  return state
}

export function currentPracticePrompt(state: PracticeState): PracticePrompt | null {
  return state.phase === 'complete' ? null : (state.prompts[state.turnIndex] ?? null)
}

export function practiceTimeLeftMs(state: PracticeState, at: number): number {
  if (state.phase !== 'drawing') return 0
  return Math.max(0, state.turnEndsAt - at)
}
