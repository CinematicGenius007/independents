import { chooseMove } from './ai'
import type { Level } from './ai'
import type { GameState } from './game'

interface Request {
  id: number
  state: GameState
  level: Level
}

const scope = self as unknown as {
  addEventListener(type: 'message', listener: (e: MessageEvent<Request>) => void): void
  postMessage(message: unknown): void
}

scope.addEventListener('message', e => {
  const { id, state, level } = e.data
  scope.postMessage({ id, move: chooseMove(state, level) })
})
