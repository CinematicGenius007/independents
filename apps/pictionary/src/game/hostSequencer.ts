import { allGuessed, deriveOrder, drawerPoints, hintReveals, pickWords, wordShape } from '../engine'
import type { Category, Unsubscribe } from '../shared/types'
import { LIMITS } from '../shared/types'
import type { Mesh } from '../net/mesh'
import type { GameController } from './controller'

export interface HostWord {
  word: string
  category: Category | null
}

export interface HostSequencerOptions {
  controller: GameController
  mesh: Mesh
  words: HostWord[]
  now?: () => number
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

export interface HostSequencer {
  startGame(): boolean
  endTurn(reason?: 'timeout' | 'all_guessed' | 'skipped'): void
  stop(): void
}

export function createHostSequencer(options: HostSequencerOptions): HostSequencer {
  const now = options.now ?? Date.now
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let selectedWords: HostWord[] = []
  let ending = false
  let stopped = false

  const schedule = (callback: () => void, delayMs: number) => {
    const timer = setTimer(() => {
      timers.delete(timer)
      if (!stopped) callback()
    }, Math.max(0, delayMs))
    timers.add(timer)
  }

  const clearTimers = () => {
    timers.forEach((timer) => clearTimer(timer))
    timers.clear()
  }

  const startTurn = (index: number) => {
    const state = options.controller.state()
    const totalTurns = state.order.length * state.config.rounds
    if (index >= totalTurns) {
      options.controller.dispatchShared({ type: 'GAME_ENDED', at: now() })
      return
    }
    const choice = selectedWords[index]
    if (!choice) return
    const startedAt = now()
    const drawerId = state.order[index % state.order.length]
    options.controller.dispatchShared({
      type: 'TURN_STARTED',
      index,
      round: Math.floor(index / state.order.length) + 1,
      drawerId,
      wordShape: wordShape(choice.word),
      category: choice.category,
      startedAt,
      endsAt: startedAt + state.config.turnSeconds * 1_000,
    })
    options.controller.setSecretWord(choice.word)
    if (drawerId === state.selfId) {
      options.controller.dispatchLocal({ type: 'WORD_ASSIGNED', word: choice.word, category: choice.category })
    } else {
      options.mesh.sendWord(drawerId, choice.word, choice.category, index)
    }

    if (state.config.hintsEnabled) {
      const firstHintAt = state.config.turnSeconds * 1_000 * LIMITS.hintStartFraction
      const letterCount = choice.word.replace(/\s/g, '').length
      for (let revealCount = 1; revealCount <= letterCount; revealCount++) {
        schedule(() => {
          const current = options.controller.state()
          if (current.phase !== 'drawing' || current.turn?.index !== index) return
          options.controller.dispatchShared({
            type: 'HINT_REVEALED',
            reveals: hintReveals(choice.word, revealCount, current.gameNonce, index),
          })
        }, firstHintAt + (revealCount - 1) * LIMITS.hintIntervalMs)
      }
    }
    schedule(() => endTurn('timeout'), state.config.turnSeconds * 1_000)
  }

  const endTurn = (reason: 'timeout' | 'all_guessed' | 'skipped' = 'skipped') => {
    const state = options.controller.state()
    if (ending || state.selfId !== state.hostId || state.phase !== 'drawing' || !state.turn) return
    ending = true
    clearTimers()
    const choice = selectedWords[state.turn.index]
    options.controller.dispatchShared({
      type: 'TURN_ENDED',
      word: choice?.word ?? '',
      reason,
      drawerPoints: drawerPoints(Object.keys(state.turn.correct).length),
      at: now(),
    })
    const nextIndex = state.turn.index + 1
    const totalTurns = state.order.length * state.config.rounds
    if (nextIndex >= totalTurns) {
      schedule(() => options.controller.dispatchShared({ type: 'GAME_ENDED', at: now() }), LIMITS.intermissionMs)
    } else {
      const nextTurnAt = now() + LIMITS.intermissionMs
      options.controller.dispatchShared({ type: 'INTERMISSION', nextTurnAt })
      schedule(() => {
        ending = false
        startTurn(nextIndex)
      }, LIMITS.intermissionMs)
    }
  }

  const unsubscribe: Unsubscribe = options.controller.subscribe((state) => {
    if (!ending && state.selfId === state.hostId && allGuessed(state)) endTurn('all_guessed')
  })

  return {
    startGame: () => {
      const state = options.controller.state()
      if (state.selfId !== state.hostId || options.words.length === 0) return false
      const playerIds = Object.keys(state.players).filter((id) => state.players[id].connection !== 'disconnected')
      if (playerIds.length < LIMITS.minPlayers) return false
      clearTimers()
      ending = false
      const gameNonce = `${state.roomId}:${now()}`
      const order = deriveOrder(playerIds, gameNonce)
      const picked = pickWords(options.words.map((entry) => entry.word), order.length * state.config.rounds, gameNonce)
      selectedWords = picked.map((word) => options.words.find((entry) => entry.word === word) as HostWord)
      options.controller.dispatchShared({ type: 'GAME_STARTED', gameNonce, order, config: state.config, at: now() })
      startTurn(0)
      return true
    },
    endTurn,
    stop: () => {
      if (stopped) return
      stopped = true
      clearTimers()
      unsubscribe()
    },
  }
}

