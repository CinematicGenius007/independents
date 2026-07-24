import { describe, expect, it } from 'vitest'
import { initialState, reduce } from '../engine'
import { DEFAULT_CONFIG } from '../shared/types'
import { localTurnRecord } from './localStats'

function completed(selfId: string, drawerId = 'drawer') {
  let state = initialState('ROOM01', selfId, DEFAULT_CONFIG)
  for (const id of ['drawer', 'guesser']) {
    state = reduce(state, { type: 'PLAYER_JOINED', player: { id, nickname: id, avatar: 0, color: '#000', connection: 'connected', joinedAt: 1 } })
  }
  state = reduce(state, { type: 'GAME_STARTED', gameNonce: 'game-1', order: ['drawer', 'guesser'], config: DEFAULT_CONFIG, at: 100 })
  state = reduce(state, { type: 'TURN_STARTED', index: 0, round: 1, drawerId, wordShape: [3], category: 'animals', startedAt: 100, endsAt: 1000 })
  state = reduce(state, { type: 'GUESS_CORRECT', playerId: 'guesser', elapsedMs: 400, points: 80, place: 1, at: 500 })
  return reduce(state, { type: 'TURN_ENDED', word: 'cat', reason: 'all_guessed', drawerPoints: 25, at: 600 })
}

describe('localTurnRecord', () => {
  it('records drawer progress without leaking another player into local stats', () => {
    expect(localTurnRecord(completed('drawer'), 'Ada')).toMatchObject({
      delta: { wordsDrawn: 1 },
      entry: { gameId: 'game-1', playerName: 'Ada', role: 'drawer', word: 'cat', score: 25 },
    })
  })

  it('records a correct guess and its elapsed time', () => {
    expect(localTurnRecord(completed('guesser'), 'Bo')).toMatchObject({
      delta: { wordsGuessed: 1, totalGuessTimeMs: 400, guessCount: 1 },
      entry: { role: 'guesser', score: 80 },
      guessed: true,
    })
  })
})
