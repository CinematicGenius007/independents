import { canGuess, classifyGuess, guesserPoints, reduce } from '../engine'
import type { EngineAction, GameState, SharedAction, SyncableState } from '../engine'
import { LIMITS, type PlayerId, type Unsubscribe } from '../shared/types'
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
  let expectedSyncFrom: PlayerId | null = null
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
    // Queue on the wire before notifying local subscribers. A subscriber may
    // synchronously dispatch a follow-up (for example TURN_ENDED after the
    // final correct guess); every peer must observe the initiating action first.
    options.mesh.broadcastAction(action)
    apply(action)
  }

  const adjudicateGuess = (text: string, playerId: PlayerId, at: number): boolean => {
    const player = state.players[playerId]
    if (state.selfId !== state.hostId || !secretWord || !player || player.connection === 'disconnected' || !canGuess(state, playerId, at)) return false
    const safeText = text.slice(0, LIMITS.maxChatLength)
    dispatchShared({ type: 'GUESS_POSTED', playerId, text: safeText, at })
    const result = classifyGuess(safeText, secretWord)
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
    options.mesh.onGuess((text, _at, from) => {
      adjudicateGuess(text, from, now())
    }),
    options.mesh.onSyncRequest((from) => {
      if (state.selfId !== state.hostId && from !== state.hostId) return
      options.mesh.serveSyncState(
        from,
        syncableState(state),
        options.getInkSnapshot?.() ?? new Uint8Array(),
      )
    }),
    options.mesh.onSyncState((synced, ink, from) => {
      if (from !== state.hostId && from !== expectedSyncFrom) return
      expectedSyncFrom = null
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
    requestSync: (to) => {
      expectedSyncFrom = to ?? null
      options.mesh.requestSync(to)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      unsubs.forEach((unsubscribe) => unsubscribe())
      listeners.clear()
    },
  }
}
