import { describe, expect, it } from 'vitest'
import { initialState, reduce } from './reducer'
import {
  allGuessed,
  isDrawer,
  nextDrawer,
  remainingMs,
  sortedScores,
  visibleChat,
  wordDisplay,
} from './selectors'
import type { GameConfig, Player } from '../shared/types'
import type { GameState } from './types'

const CONFIG: GameConfig = {
  turnSeconds: 80,
  rounds: 2,
  categories: ['general'],
  customWordsOnly: false,
  customWords: [],
  hintsEnabled: true,
}

function player(id: string): Player {
  return { id, nickname: id, color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 0 }
}

function gameInProgress(selfId = 'p1'): GameState {
  let state = initialState('room1', selfId, CONFIG)
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p1') })
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p2') })
  state = reduce(state, { type: 'PLAYER_JOINED', player: player('p3') })
  state = reduce(state, {
    type: 'GAME_STARTED',
    gameNonce: 'nonce',
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
    startedAt: 0,
    endsAt: 80_000,
  })
  return state
}

describe('visibleChat', () => {
  it('shows "all" audience entries to everyone', () => {
    const state = reduce(gameInProgress(), {
      type: 'SYSTEM_MESSAGE',
      text: 'hello',
      at: 0,
      audience: 'all',
    })
    expect(visibleChat(state, 'p2').some((e) => e.text === 'hello')).toBe(true)
    expect(visibleChat(state, 'p3').some((e) => e.text === 'hello')).toBe(true)
  })

  it('hides "solved" audience entries from players who have not solved', () => {
    let state = gameInProgress()
    state = reduce(state, {
      type: 'GUESS_CORRECT',
      playerId: 'p2',
      elapsedMs: 500,
      points: 90,
      place: 1,
      at: 500,
    })
    state = reduce(state, { type: 'GUESS_POSTED', playerId: 'p2', text: 'nice', at: 600 })

    expect(visibleChat(state, 'p3').some((e) => e.text === 'nice')).toBe(false)
    // The solved guesser sees it.
    expect(visibleChat(state, 'p2').some((e) => e.text === 'nice')).toBe(true)
    // The drawer sees "solved" audience entries too, per the audience contract.
    expect(visibleChat(state, 'p1').some((e) => e.text === 'nice')).toBe(true)
  })

  it('delivers a whisper only to its target player', () => {
    const selfState = reduce(gameInProgress('p2'), { type: 'WHISPER', text: 'so close', at: 10 })
    expect(visibleChat(selfState, 'p2').some((e) => e.text === 'so close')).toBe(true)
    expect(visibleChat(selfState, 'p3').some((e) => e.text === 'so close')).toBe(false)
    expect(visibleChat(selfState, 'p1').some((e) => e.text === 'so close')).toBe(false)
  })
})

describe('sortedScores', () => {
  it('sorts highest score first, tie-broken by id', () => {
    let state = gameInProgress()
    state = { ...state, scores: { p1: 10, p2: 30, p3: 30 } }
    expect(sortedScores(state)).toEqual([
      { playerId: 'p2', score: 30 },
      { playerId: 'p3', score: 30 },
      { playerId: 'p1', score: 10 },
    ])
  })
})

describe('isDrawer', () => {
  it('identifies the current drawer', () => {
    const state = gameInProgress()
    expect(isDrawer(state, 'p1')).toBe(true)
    expect(isDrawer(state, 'p2')).toBe(false)
  })

  it('is false when there is no active turn', () => {
    const state = initialState('room', 'p1', CONFIG)
    expect(isDrawer(state, 'p1')).toBe(false)
  })
})

describe('remainingMs', () => {
  it('computes time left, clamped at 0', () => {
    const state = gameInProgress()
    expect(remainingMs(state, 0)).toBe(80_000)
    expect(remainingMs(state, 79_000)).toBe(1000)
    expect(remainingMs(state, 90_000)).toBe(0)
  })

  it('is 0 with no active turn', () => {
    const state = initialState('room', 'p1', CONFIG)
    expect(remainingMs(state, 1000)).toBe(0)
  })
})

describe('wordDisplay', () => {
  it('shows blanks with spacing preserved when the viewer does not know the word', () => {
    const state = gameInProgress('p2')
    expect(wordDisplay(state, 'p2')).toBe('___ _____')
  })

  it('shows the real word to the drawer', () => {
    let state = gameInProgress('p1')
    state = reduce(state, { type: 'WORD_ASSIGNED', word: 'ice cream', category: 'food' })
    expect(wordDisplay(state, 'p1')).toBe('ice cream')
  })

  it('shows the real word to everyone once the turn has ended', () => {
    let state = gameInProgress('p2')
    state = reduce(state, { type: 'TURN_ENDED', word: 'ice cream', reason: 'timeout', drawerPoints: 0, at: 80_000 })
    expect(wordDisplay(state, 'p2')).toBe('ice cream')
  })

  it('fills in hinted letters for a guesser without revealing the rest', () => {
    let state = gameInProgress('p2')
    // wordShape [3, 5] -> joined positions 0,1,2 ' ' 4,5,6,7,8 -> "___ _____".
    // Index 1 is inside the first token, index 5 inside the second (index 3
    // is the space, never revealed).
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 1: 'c', 5: 'r' } })
    expect(wordDisplay(state, 'p2')).toBe('_c_ _r___')
  })

  it('reveals letters progressively as more HINT_REVEALED actions arrive', () => {
    let state = gameInProgress('p2')
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 0: 'i' } })
    expect(wordDisplay(state, 'p2')).toBe('i__ _____')
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 4: 'r' } })
    expect(wordDisplay(state, 'p2')).toBe('i__ r____')
  })

  it('treats an empty-string (cancelled) word as no reveal, not a blank string', () => {
    let state = gameInProgress('p2')
    state = reduce(state, { type: 'HINT_REVEALED', reveals: { 0: 'i' } })
    state = reduce(state, { type: 'TURN_ENDED', word: '', reason: 'drawer_left', drawerPoints: 0, at: 80_000 })
    // Not '' (that would render as nothing); still shows blanks/hints known so far.
    expect(wordDisplay(state, 'p2')).toBe('i__ _____')
    expect(wordDisplay(state, 'p2')).not.toBe('')
  })

  it('returns an empty string with no active turn', () => {
    const state = initialState('room', 'p1', CONFIG)
    expect(wordDisplay(state, 'p1')).toBe('')
  })
})

describe('allGuessed', () => {
  it('is false until every non-drawer has a correct guess', () => {
    let state = gameInProgress()
    expect(allGuessed(state)).toBe(false)
    state = reduce(state, { type: 'GUESS_CORRECT', playerId: 'p2', elapsedMs: 0, points: 100, place: 1, at: 0 })
    expect(allGuessed(state)).toBe(false)
    state = reduce(state, { type: 'GUESS_CORRECT', playerId: 'p3', elapsedMs: 0, points: 100, place: 2, at: 0 })
    expect(allGuessed(state)).toBe(true)
  })

  it('is false with no active turn', () => {
    const state = initialState('room', 'p1', CONFIG)
    expect(allGuessed(state)).toBe(false)
  })
})

describe('nextDrawer', () => {
  it('cycles through the order based on the current turn index', () => {
    const state = gameInProgress()
    expect(nextDrawer(state)).toBe('p2')
  })

  it('wraps around to the start of the order', () => {
    let state = gameInProgress()
    state = reduce(state, {
      type: 'TURN_STARTED',
      index: 2,
      round: 1,
      drawerId: 'p3',
      wordShape: [3],
      category: 'food',
      startedAt: 0,
      endsAt: 80_000,
    })
    expect(nextDrawer(state)).toBe('p1')
  })

  it('returns the first player when there is no active turn yet', () => {
    let state = initialState('room', 'p1', CONFIG)
    state = reduce(state, {
      type: 'GAME_STARTED',
      gameNonce: 'n',
      order: ['p2', 'p1'],
      config: CONFIG,
      at: 0,
    })
    expect(nextDrawer(state)).toBe('p2')
  })

  it('returns null when there is no order yet', () => {
    const state = initialState('room', 'p1', CONFIG)
    expect(nextDrawer(state)).toBeNull()
  })
})
