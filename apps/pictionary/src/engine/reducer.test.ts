import { describe, expect, it } from 'vitest'
import { initialState, reduce } from './reducer'
import { CHAT_LIMIT } from './types'
import type { GameState, SyncableState } from './types'
import type { GameConfig, Player } from '../shared/types'

const CONFIG: GameConfig = {
  turnSeconds: 80,
  rounds: 2,
  categories: ['general'],
  customWordsOnly: false,
  customWords: [],
  hintsEnabled: true,
}

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    nickname: id,
    color: '#F5D311',
    avatar: 0,
    connection: 'connected',
    joinedAt: 0,
    ...overrides,
  }
}

function toSyncable(state: GameState): SyncableState {
  return {
    phase: state.phase,
    roomId: state.roomId,
    hostId: state.hostId,
    gameNonce: state.gameNonce,
    config: state.config,
    players: state.players,
    order: state.order,
    scores: state.scores,
    chat: state.chat,
    lastGuessAt: state.lastGuessAt,
    nextTurnAt: state.nextTurnAt,
    turn: state.turn ? { ...state.turn, word: null } : null,
  }
}

function baseState(selfId = 'p1'): GameState {
  let state = initialState('room1', selfId, { ...CONFIG, categories: ['general'] })
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p1', { joinedAt: 0 }) })
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p2', { joinedAt: 1 }) })
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p3', { joinedAt: 2 }) })
  return state
}

describe('initialState', () => {
  it('starts in the lobby phase with the given identity', () => {
    const state = initialState('room1', 'me', CONFIG)
    expect(state.phase).toBe('lobby')
    expect(state.roomId).toBe('room1')
    expect(state.selfId).toBe('me')
    expect(state.hostId).toBe('me')
    expect(state.turn).toBeNull()
    expect(state.chat).toEqual([])
    expect(state.players).toEqual({})
    expect(state.scores).toEqual({})
  })
})

describe('PLAYER_JOINED / PLAYER_LEFT / PLAYER_CONNECTION / HOST_CHANGED / CONFIG_CHANGED', () => {
  it('adds a player and seeds their score to 0', () => {
    const state = reduce(initialState('r', 'p1', CONFIG), {
      type: 'PLAYER_JOINED',
      player: player('p1'),
    })
    expect(state.players.p1).toBeDefined()
    expect(state.scores.p1).toBe(0)
  })

  it('is a no-op (same reference) for an identical re-join', () => {
    const p = player('p1')
    const s1 = reduce(initialState('r', 'p1', CONFIG), { type: 'PLAYER_JOINED', player: p })
    const s2 = reduce(s1, { type: 'PLAYER_JOINED', player: p })
    expect(s2).toBe(s1)
  })

  it('removes a player on PLAYER_LEFT', () => {
    const state = baseState()
    const next = reduce(state, { type: 'PLAYER_LEFT', playerId: 'p2' })
    expect(next.players.p2).toBeUndefined()
    expect(next.order).not.toContain('p2')
  })

  it('is a no-op for PLAYER_LEFT on an unknown player', () => {
    const state = baseState()
    const next = reduce(state, { type: 'PLAYER_LEFT', playerId: 'nobody' })
    expect(next).toBe(state)
  })

  it('keeps the seeded turn order immutable after a game starts', () => {
    let state = baseState()
    state = reduce(state, { type: 'GAME_STARTED', gameNonce: 'n', order: ['p1', 'p2', 'p3'], config: state.config, at: 0 })
    const next = reduce(state, { type: 'PLAYER_LEFT', playerId: 'p2' })
    expect(next.order).toEqual(['p1', 'p2', 'p3'])
  })

  it('ends the turn with reason drawer_left when the drawer disconnects mid-turn', () => {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'n',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'general',
      startedAt: 0,
      endsAt: 80_000,
    })
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 1000,
      points: 90,
      place: 1,
      at: 1000,
    })
    const next = reduce(state, { type: 'PLAYER_LEFT', playerId: 'p1' })
    expect(next.phase).toBe('turn_review')
    expect(next.turn?.endReason).toBe('drawer_left')
    // 1 correct guesser -> drawer earns 10
    expect(next.turn?.drawerPoints).toBe(10)
    expect(next.scores.p1).toBe(10)
    expect(next.players.p1).toBeUndefined()
  })

  it('does not end the turn when a non-drawer leaves mid-turn', () => {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'n',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'general',
      startedAt: 0,
      endsAt: 80_000,
    })
    const next = reduce(state, { type: 'PLAYER_LEFT', playerId: 'p2' })
    expect(next.phase).toBe('drawing')
    expect(next.turn?.endReason).toBeNull()
  })

  it('updates connection state and is a no-op when unchanged', () => {
    const state = baseState()
    const changed = reduce(state, {
      type: 'PLAYER_CONNECTION',
      playerId: 'p2',
      connection: 'unstable',
    })
    expect(changed.players.p2.connection).toBe('unstable')

    const noop = reduce(changed, {
      type: 'PLAYER_CONNECTION',
      playerId: 'p2',
      connection: 'unstable',
    })
    expect(noop).toBe(changed)
  })

  it('changes host and is a no-op when unchanged', () => {
    const state = baseState()
    const changed = reduce(state, { type: 'HOST_CHANGED', hostId: 'p2' })
    expect(changed.hostId).toBe('p2')
    const noop = reduce(changed, { type: 'HOST_CHANGED', hostId: 'p2' })
    expect(noop).toBe(changed)
  })

  it('changes config and is a no-op for an identical config', () => {
    const state = baseState()
    const newConfig = { ...state.config, turnSeconds: 120 }
    const changed = reduce(state, { type: 'CONFIG_CHANGED', config: newConfig })
    expect(changed.config.turnSeconds).toBe(120)
    const noop = reduce(changed, { type: 'CONFIG_CHANGED', config: { ...newConfig } })
    expect(noop).toBe(changed)
  })
})

describe('GAME_STARTED / TURN_STARTED', () => {
  it('resets scores to 0 for everyone in order and moves to turn_intro', () => {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p2', 'p1', 'p3'],
      config: state.config,
      at: 100,
    })
    expect(state.phase).toBe('turn_intro')
    expect(state.gameNonce).toBe('abc')
    expect(state.order).toEqual(['p2', 'p1', 'p3'])
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 })
    expect(state.turn).toBeNull()
  })

  it('TURN_STARTED opens the drawing phase with a null word for everyone', () => {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3, 5],
      category: 'food',
      startedAt: 1000,
      endsAt: 81_000,
    })
    expect(state.phase).toBe('drawing')
    expect(state.turn?.drawerId).toBe('p1')
    expect(state.turn?.word).toBeNull()
    expect(state.turn?.wordShape).toEqual([3, 5])
    expect(state.turn?.revealed).toEqual({})
    expect(state.turn?.correct).toEqual({})
  })
})

describe('WORD_ASSIGNED (local)', () => {
  it('sets the word privately on the originating client', () => {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
    const assigned = reduce(state, { type: 'WORD_ASSIGNED', word: 'cat', category: 'food' })
    expect(assigned.turn?.word).toBe('cat')
  })

  it('is a no-op if there is no active turn', () => {
    const state = baseState()
    const next = reduce(state, { type: 'WORD_ASSIGNED', word: 'cat', category: 'food' })
    expect(next).toBe(state)
  })
})

describe('HINT_REVEALED', () => {
  function turnState() {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    return reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
  }

  it('merges revealed characters, keyed by index', () => {
    let state = turnState()
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 2: 't' } })
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 0: 'c' } })
    expect(state.turn?.revealed).toEqual({ 0: 'c', 2: 't' })
  })

  it('is a no-op when the same index/char pair is already revealed', () => {
    let state = turnState()
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 1: 'a' } })
    const noop = reduce(state, { type: 'HINT_REVEALED', reveals: { 1: 'a' } })
    expect(noop).toBe(state)
  })

  it('applies a change when a different character arrives for an already-revealed index', () => {
    let state = turnState()
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 1: 'a' } })
    const changed = reduce(state, { type: 'HINT_REVEALED', reveals: { 1: 'a', 2: 't' } })
    expect(changed.turn?.revealed).toEqual({ 1: 'a', 2: 't' })
  })

  it('is a no-op with no active turn', () => {
    const state = baseState()
    const next = reduce(state, { type: 'HINT_REVEALED', reveals: { 0: 'c' } })
    expect(next).toBe(state)
  })
})

describe('GUESS_POSTED chat masking', () => {
  function turnState() {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    return reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
  }

  it('posts a normal guess visible to all when the guesser has not solved', () => {
    const state = turnState()
    const next = reduce(state, { type: 'GUESS_POSTED', playerId: 'p2', text: 'dog', at: 500 })
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('guess')
    expect(entry.audience).toBe('all')
    expect(entry.text).toBe('dog')
  })

  it('masks a post-solve message as solved-only (spoiler protection)', () => {
    let state = turnState()
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 500,
      points: 90,
      place: 1,
      at: 500,
    })
    const next = reduce(state, { type: 'GUESS_POSTED', playerId: 'p2', text: 'nice round', at: 600 })
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('aside')
    expect(entry.audience).toBe('solved')
  })

  it('never leaks the word text through a masked chat entry beyond what the player typed', () => {
    let state = turnState()
    state = reduce(state, { type: 'WORD_ASSIGNED', word: 'cat', category: 'food' })
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p1',
      elapsedMs: 0,
      points: 100,
      place: 1,
      at: 0,
    })
    const next = reduce(state, { type: 'GUESS_POSTED', playerId: 'p1', text: 'gg', at: 10 })
    const entry = next.chat[next.chat.length - 1]
    expect(entry.text).toBe('gg')
    expect(entry.text).not.toContain('cat')
  })

  it('records lastGuessAt for the guessing player', () => {
    const state = turnState()
    const next = reduce(state, { type: 'GUESS_POSTED', playerId: 'p2', text: 'dog', at: 700 })
    expect(next.lastGuessAt.p2).toBe(700)
  })
})

describe('GUESS_CORRECT', () => {
  function turnState() {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    return reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
  }

  it('records the correct guess, adds points, and posts a correct-kind chat entry', () => {
    const state = turnState()
    const next = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 2000,
      points: 96,
      place: 1,
      at: 2000,
    })
    expect(next.turn?.correct.p2).toEqual({ elapsedMs: 2000, points: 96, place: 1 })
    expect(next.scores.p2).toBe(96)
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('correct')
    expect(entry.audience).toBe('all')
  })

  it('is idempotent for a duplicate GUESS_CORRECT for the same player', () => {
    let state = turnState()
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 2000,
      points: 96,
      place: 1,
      at: 2000,
    })
    const dup = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 5000,
      points: 50,
      place: 1,
      at: 5000,
    })
    expect(dup).toBe(state)
    expect(dup.scores.p2).toBe(96)
  })

  it('is a no-op when there is no active turn', () => {
    const state = baseState()
    const next = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 0,
      points: 100,
      place: 1,
      at: 0,
    })
    expect(next).toBe(state)
  })
})

describe('TURN_ENDED', () => {
  function turnState() {
    let state = baseState()
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    return reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
  }

  it('reveals the word to everyone and finalises drawer points', () => {
    let state = turnState()
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 1000,
      points: 98,
      place: 1,
      at: 1000,
    })
    const next = reduce(state, {
      type: 'TURN_ENDED',
      word: 'cat',
      reason: 'timeout',
      drawerPoints: 10,
      at: 80_000,
    })
    expect(next.phase).toBe('turn_review')
    expect(next.turn?.word).toBe('cat')
    expect(next.turn?.endReason).toBe('timeout')
    expect(next.scores.p1).toBe(10)
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('system')
    expect(entry.text).toContain('cat')
  })

  it('is a no-op once already ended (prevents double-scoring)', () => {
    let state = turnState()
    state = reduce(state, { type: 'TURN_ENDED', word: 'cat', reason: 'timeout', drawerPoints: 10, at: 100 })
    const dup = reduce(state, {
      type: 'TURN_ENDED',
      word: 'cat',
      reason: 'timeout',
      drawerPoints: 10,
      at: 200,
    })
    expect(dup).toBe(state)
    expect(dup.scores.p1).toBe(10)
  })

  it('fills in the word after a drawer_left ending without re-applying drawerPoints or scores', () => {
    let state = turnState()
    state = reduce(state, { type: 'PLAYER_LEFT', playerId: 'p1' })
    expect(state.scores.p1).toBe(0) // 0 correct guessers -> 0 drawer points
    expect(state.turn?.endReason).toBe('drawer_left')
    expect(state.turn?.word).toBeNull()

    const revealed = reduce(state, {
      type: 'TURN_ENDED',
      word: 'cat',
      reason: 'timeout',
      drawerPoints: 999,
      at: 500,
    })
    // Word is published now...
    expect(revealed.turn?.word).toBe('cat')
    // ...but the original drawer_left reason and score are untouched, and the
    // bogus drawerPoints:999 from this late action is never applied.
    expect(revealed.turn?.endReason).toBe('drawer_left')
    expect(revealed.turn?.drawerPoints).toBe(0)
    expect(revealed.scores.p1).toBe(0)
    expect(revealed.phase).toBe('turn_review')
    const entry = revealed.chat[revealed.chat.length - 1]
    expect(entry.kind).toBe('system')
    expect(entry.text).toContain('cat')

    // A further duplicate TURN_ENDED (word already published) is a true no-op.
    const dup = reduce(revealed, {
      type: 'TURN_ENDED',
      word: 'cat',
      reason: 'timeout',
      drawerPoints: 999,
      at: 600,
    })
    expect(dup).toBe(revealed)
  })

  it('treats an empty-string word as a cancellation, not a blank reveal', () => {
    const state = turnState()
    const next = reduce(state, {
      type: 'TURN_ENDED',
      word: '',
      reason: 'drawer_left',
      drawerPoints: 0,
      at: 100,
    })
    expect(next.turn?.word).toBe('')
    const entry = next.chat[next.chat.length - 1]
    expect(entry.text.toLowerCase()).toContain('cancelled')
    expect(entry.text).not.toMatch(/word was\s*\./i)
  })

  it('is a no-op when there is no active turn', () => {
    const state = baseState()
    const next = reduce(state, { type: 'TURN_ENDED', word: 'cat', reason: 'timeout', drawerPoints: 10, at: 0 })
    expect(next).toBe(state)
  })
})

describe('ROUND_ENDED / GAME_ENDED / INTERMISSION', () => {
  it('moves to round_break and is idempotent', () => {
    const state = baseState()
    const next = reduce(state, { type: 'ROUND_ENDED', round: 1, at: 0 })
    expect(next.phase).toBe('round_break')
    const noop = reduce(next, { type: 'ROUND_ENDED', round: 1, at: 0 })
    expect(noop).toBe(next)
  })

  it('moves to game_over, clears nextTurnAt, and is idempotent', () => {
    const state = baseState()
    const next = reduce(state, { type: 'GAME_ENDED', at: 0 })
    expect(next.phase).toBe('game_over')
    expect(next.nextTurnAt).toBeNull()
    const noop = reduce(next, { type: 'GAME_ENDED', at: 0 })
    expect(noop).toBe(next)
  })

  it('INTERMISSION sets nextTurnAt and enters turn_intro', () => {
    const state = baseState()
    const next = reduce(state, { type: 'INTERMISSION', nextTurnAt: 5000 })
    expect(next.phase).toBe('turn_intro')
    expect(next.nextTurnAt).toBe(5000)
  })
})

describe('SYSTEM_MESSAGE', () => {
  it('appends a system chat entry with the given audience', () => {
    const state = baseState()
    const next = reduce(state, {
      type: 'SYSTEM_MESSAGE',
      text: 'Ada is drawing',
      at: 0,
      audience: 'all',
    })
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('system')
    expect(entry.playerId).toBeNull()
    expect(entry.audience).toBe('all')
  })
})

describe('STATE_SYNCED', () => {
  it('adopts the synced state but preserves this client selfId', () => {
    const state = baseState('p1')
    const synced = reduce(state, { type: 'HOST_CHANGED', hostId: 'p3' })
    const next = reduce(state, { type: 'STATE_SYNCED', state: toSyncable(synced) })
    expect(next.selfId).toBe('p1')
    expect(next.hostId).toBe('p3')
  })

  it('preserves a privately-known word for the same turn index across a resync', () => {
    let state = baseState('p1')
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
    state = reduce(state, { type: 'WORD_ASSIGNED', word: 'cat', category: 'food' })
    expect(state.turn?.word).toBe('cat')

    const next = reduce(state, { type: 'STATE_SYNCED', state: toSyncable(state) })
    expect(next.turn?.word).toBe('cat')
  })

  it('drops the privately-known word when the synced turn index differs', () => {
    let state = baseState('p1')
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'abc',
      order: ['p1', 'p2', 'p3'],
      config: state.config,
      at: 0,
    })
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 0,
      round: 1,
      drawerId: 'p1',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
    state = reduce(state, { type: 'WORD_ASSIGNED', word: 'cat', category: 'food' })

    const syncable = toSyncable(state)
    const next = reduce(state, {
      type: 'STATE_SYNCED',
      state: { ...syncable, turn: syncable.turn ? { ...syncable.turn, index: 1 } : null },
    })
    expect(next.turn?.word).toBeNull()
  })
})

describe('SELF_IDENTIFIED / WHISPER (local)', () => {
  it('sets selfId and is a no-op when unchanged', () => {
    const state = baseState('p1')
    const changed = reduce(state, { type: 'SELF_IDENTIFIED', selfId: 'p2' })
    expect(changed.selfId).toBe('p2')
    const noop = reduce(changed, { type: 'SELF_IDENTIFIED', selfId: 'p2' })
    expect(noop).toBe(changed)
  })

  it('appends a close-kind chat entry addressed to selfId only', () => {
    const state = baseState('p2')
    const next = reduce(state, { type: 'WHISPER', text: "You're very close!", at: 100 })
    const entry = next.chat[next.chat.length - 1]
    expect(entry.kind).toBe('close')
    expect(entry.audience).toBe('p2')
  })
})

describe('chat cap', () => {
  it('drops the oldest entries past CHAT_LIMIT', () => {
    let state = baseState()
    for (let i = 0; i < CHAT_LIMIT + 20; i++) {
      state = reduce(state, { type: 'SYSTEM_MESSAGE', text: `msg-${i}`, at: i, audience: 'all' })
    }
    expect(state.chat.length).toBe(CHAT_LIMIT)
    expect(state.chat[0].text).toBe(`msg-20`)
    expect(state.chat[state.chat.length - 1].text).toBe(`msg-${CHAT_LIMIT + 19}`)
  })
})
