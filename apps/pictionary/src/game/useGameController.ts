import { useSyncExternalStore } from 'react'
import type { GameState } from '../engine'
import type { GameController } from './controller'

/** React adapter kept separate from the transport-free controller for deterministic tests. */
export function useGameController(controller: GameController): GameState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.state,
    controller.state,
  )
}
