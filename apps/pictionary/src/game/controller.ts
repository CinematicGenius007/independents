import { canGuess, classifyGuess, guesserPoints, reduce } from '../engine'
import type { EngineAction, GameState, SharedAction, SyncableState } from '../engine'
import type { PlayerId, Unsubscribe } from '../shared/types'
import type { Mesh } from '../net/mesh'

export interface GameControllerOptions {
  initialState: GameState
  mesh: Mesh
  now?: () => number
  getInkSnapshot?: () => Uint8Array
  applyInkSnapshot?: (bytes: Uint8Array) => void
}

export interface GameController {
  state(): GameState
  subscribe(listener: (state: GameState) => void): Unsubscribe
  dispatchLocal(action: EngineAction): void
  dispatchShared(action: SharedAction): void
  setSecretWord(word: string | null): void
  submitGuess(text: string): boolean
  requestSync(to?: PlayerId): void
  stop(): void
}

function syncableState(state: GameState): SyncableState {
  const { selfId: _selfId, turn, ...shared } = state
  return {
    ...shared,
    turn: turn ? { ...turn, word: null } : null,
  }
}

export function createGameController(options: GameControllerOptions): GameController {
  const now = options.now ?? Date.now
  let state = options.initialState
  let secretWord: string | null = null
  let stopped = false
  const listeners = new Set<(state: GameState) => void>()

  const apply = (action: EngineAction) => {
    if (stopped) return
    const next = reduce(state, action)
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener(state))
  }

  const dispatchShared = (action: SharedAction) => {
    apply(action)
    options.mesh.broadcastAction(action)
  }

  const adjudicateGuess = (text: string, playerId: PlayerId, at: number): boolean => {
    if (state.selfId !== state.hostId || !secretWord || !canGuess(state, playerId, at)) return false
    dispatchShared({ type: 'GUESS_POSTED', playerId, text, at })
    const result = classifyGuess(text, secretWord)
    if (result === 'close') {
      options.mesh.sendWhisper(playerId, "You're very close!", at)
    } else if (result === 'correct' && state.turn) {
      const elapsedMs = Math.max(0, at - state.turn.startedAt)
      dispatchShared({
        type: 'GUESS_CORRECT',
        playerId,
        elapsedMs,
        points: guesserPoints(elapsedMs),
        place: Object.keys(state.turn.correct).length + 1,
        at,
      })
    }
    return true
  }

  const unsubs: Unsubscribe[] = [
    options.mesh.onAction((action, from) => {
      if (from === state.hostId) apply(action)
    }),
    options.mesh.onWord((word, category, turnIndex, from) => {
      if (from === state.hostId && state.turn?.index === turnIndex && state.selfId === state.turn.drawerId) {
        apply({ type: 'WORD_ASSIGNED', word, category })
      }
    }),
    options.mesh.onWhisper((text, at, from) => {
      if (from === state.hostId) apply({ type: 'WHISPER', text, at })
    }),
    options.mesh.onGuess((text, at, from) => {
      adjudicateGuess(text, from, at)
    }),
    options.mesh.onSyncRequest((from) => {
      if (state.selfId !== state.hostId) return
      options.mesh.serveSyncState(
        from,
        syncableState(state),
        options.getInkSnapshot?.() ?? new Uint8Array(),
      )
    }),
    options.mesh.onSyncState((synced, ink, from) => {
      if (from !== state.hostId) return
      apply({ type: 'STATE_SYNCED', state: synced })
      options.applyInkSnapshot?.(ink)
    }),
  ]

  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatchLocal: apply,
    dispatchShared,
    setSecretWord: (word) => {
      secretWord = word
    },
    submitGuess: (text) => {
      const at = now()
      if (!canGuess(state, state.selfId, at)) return false
      if (state.selfId === state.hostId) return adjudicateGuess(text, state.selfId, at)
      options.mesh.sendGuess(text, at, state.hostId)
      return true
    },
    requestSync: (to) => options.mesh.requestSync(to),
    stop: () => {
      if (stopped) return
      stopped = true
      unsubs.forEach((unsubscribe) => unsubscribe())
      listeners.clear()
    },
  }
}

