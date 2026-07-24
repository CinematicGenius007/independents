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
  resumeGame(): boolean
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

  const selectGameWords = (gameNonce: string, count: number) => {
    const picked = pickWords(options.words.map((entry) => entry.word), count, gameNonce)
    selectedWords = picked.map((word) => options.words.find((entry) => entry.word === word) as HostWord)
  }

  const scheduleHints = (index: number, choice: HostWord, startedAt: number, endsAt: number) => {
    const state = options.controller.state()
    if (!state.config.hintsEnabled) return
    const firstHintAt = startedAt + (endsAt - startedAt) * LIMITS.hintStartFraction
    const letterCount = choice.word.replace(/\s/g, '').length
    let latestElapsedCount = 0
    for (let revealCount = 1; revealCount <= letterCount; revealCount++) {
      const revealAt = firstHintAt + (revealCount - 1) * LIMITS.hintIntervalMs
      if (revealAt <= now()) {
        latestElapsedCount = revealCount
        continue
      }
      schedule(() => {
        const current = options.controller.state()
        if (current.selfId !== current.hostId || current.phase !== 'drawing' || current.turn?.index !== index) return
        options.controller.dispatchShared({ type: 'HINT_REVEALED', reveals: hintReveals(choice.word, revealCount, current.gameNonce, index) })
      }, revealAt - now())
    }
    if (latestElapsedCount > 0) {
      options.controller.dispatchShared({ type: 'HINT_REVEALED', reveals: hintReveals(choice.word, latestElapsedCount, state.gameNonce, index) })
    }
  }

  const startTurn = (index: number) => {
    const state = options.controller.state()
    if (state.selfId !== state.hostId) return
    const totalTurns = state.order.length * state.config.rounds
    if (index >= totalTurns) {
      options.controller.dispatchShared({ type: 'GAME_ENDED', at: now() })
      return
    }
    const choice = selectedWords[index]
    if (!choice) return
    const startedAt = now()
    const drawerId = state.order[index % state.order.length]
    const drawer = state.players[drawerId]
    if (!drawer || drawer.connection === 'disconnected') {
      startTurn(index + 1)
      return
    }
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

    scheduleHints(index, choice, startedAt, startedAt + state.config.turnSeconds * 1_000)
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
      schedule(() => {
        const current = options.controller.state()
        if (current.selfId === current.hostId) options.controller.dispatchShared({ type: 'GAME_ENDED', at: now() })
      }, LIMITS.intermissionMs)
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
      if (state.selfId !== state.hostId || (state.phase !== 'lobby' && state.phase !== 'game_over') || options.words.length === 0) return false
      const playerIds = Object.keys(state.players).filter((id) => state.players[id].connection !== 'disconnected')
      if (playerIds.length < LIMITS.minPlayers) return false
      clearTimers()
      ending = false
      const gameNonce = `${state.roomId}:${now()}`
      const order = deriveOrder(playerIds, gameNonce)
      selectGameWords(gameNonce, order.length * state.config.rounds)
      options.controller.dispatchShared({ type: 'GAME_STARTED', gameNonce, order, config: state.config, at: now() })
      startTurn(0)
      return true
    },
    resumeGame: () => {
      const state = options.controller.state()
      if (state.selfId !== state.hostId || !state.gameNonce || state.phase === 'lobby' || state.phase === 'game_over') return false
      clearTimers()
      ending = false
      selectGameWords(state.gameNonce, state.order.length * state.config.rounds)
      if (state.phase === 'drawing' && state.turn) {
        const choice = selectedWords[state.turn.index]
        if (!choice) return false
        options.controller.setSecretWord(choice.word)
        scheduleHints(state.turn.index, choice, state.turn.startedAt, state.turn.endsAt)
        schedule(() => endTurn('timeout'), state.turn.endsAt - now())
      } else if (state.nextTurnAt !== null) {
        schedule(() => startTurn((state.turn?.index ?? -1) + 1), state.nextTurnAt - now())
      }
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
