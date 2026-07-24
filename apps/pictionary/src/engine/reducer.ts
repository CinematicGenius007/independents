/**
 * The pure game-state reducer. See types.ts for the determinism contract
 * this must uphold: no `Date.now()`, no `Math.random()`, no DOM, no network.
 */

import type { GameConfig, PlayerId, RoomId } from '../shared/types'
import { drawerPoints } from './scoring'
import type { ChatEntry, EngineAction, GameState, Reduce, TurnState } from './types'
import { CHAT_LIMIT } from './types'

export function initialState(roomId: RoomId, selfId: PlayerId, config: GameConfig): GameState {
  return {
    phase: 'lobby',
    roomId,
    selfId,
    hostId: selfId,
    gameNonce: '',
    config,
    players: {},
    order: [],
    scores: {},
    turn: null,
    chat: [],
    lastGuessAt: {},
    nextTurnAt: null,
  }
}

/** Appends a chat entry, dropping the oldest once past {@link CHAT_LIMIT}. */
function pushChat(chat: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  const next = chat.length >= CHAT_LIMIT ? chat.slice(chat.length - CHAT_LIMIT + 1) : chat.slice()
  next.push(entry)
  return next
}

/**
 * Deterministic chat-entry id, derived purely from state shape and the
 * action's own stamped time — never `Math.random()`.
 */
function chatId(state: GameState, at: number): string {
  return `c${state.chat.length}-${at}`
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj
  const copy: Record<string, unknown> = { ...obj }
  delete copy[key]
  return copy as T
}

/**
 * `word` is `''` in the one unrecoverable case (the drawer was also the
 * host, so nobody left in the room ever knew the word) — that reads as a
 * cancellation, never as "the word was ."
 */
function reasonText(reason: NonNullable<TurnState['endReason']>, word: string): string {
  if (word === '') return "The turn was cancelled — nobody left in the room knew the word."
  switch (reason) {
    case 'timeout':
      return `Time's up! The word was ${word}.`
    case 'all_guessed':
      return `Everyone guessed it! The word was ${word}.`
    case 'drawer_left':
      return `The drawer left. The word was ${word}.`
    case 'skipped':
      return `Turn skipped. The word was ${word}.`
  }
}

export const reduce: Reduce = (state: GameState, action: EngineAction): GameState => {
  switch (action.type) {
    case 'PLAYER_JOINED': {
      const existing = state.players[action.player.id]
      if (existing && JSON.stringify(existing) === JSON.stringify(action.player)) return state
      const players = { ...state.players, [action.player.id]: action.player }
      const scores =
        action.player.id in state.scores ? state.scores : { ...state.scores, [action.player.id]: 0 }
      return { ...state, players, scores }
    }

    case 'PLAYER_LEFT': {
      if (!(action.playerId in state.players)) return state
      const players = omit(state.players, action.playerId)
      const order = state.order.filter((id) => id !== action.playerId)
      const lastGuessAt = omit(state.lastGuessAt, action.playerId)

      let turn = state.turn
      let scores = state.scores
      let phase = state.phase

      const drawerLeftMidTurn =
        turn !== null &&
        turn.drawerId === action.playerId &&
        turn.endReason === null &&
        (state.phase === 'turn_intro' || state.phase === 'drawing')

      if (drawerLeftMidTurn && turn) {
        const correctCount = Object.keys(turn.correct).length
        const points = drawerPoints(correctCount)
        scores = { ...scores, [turn.drawerId]: (scores[turn.drawerId] ?? 0) + points }
        turn = { ...turn, endReason: 'drawer_left', drawerPoints: points }
        phase = 'turn_review'
      }

      return { ...state, players, order, lastGuessAt, turn, scores, phase }
    }

    case 'PLAYER_CONNECTION': {
      const player = state.players[action.playerId]
      if (!player || player.connection === action.connection) return state
      return {
        ...state,
        players: { ...state.players, [action.playerId]: { ...player, connection: action.connection } },
      }
    }

    case 'HOST_CHANGED': {
      if (state.hostId === action.hostId) return state
      return { ...state, hostId: action.hostId }
    }

    case 'CONFIG_CHANGED': {
      if (JSON.stringify(state.config) === JSON.stringify(action.config)) return state
      return { ...state, config: action.config }
    }

    case 'GAME_STARTED': {
      const scores: Record<PlayerId, number> = {}
      for (const id of action.order) scores[id] = 0
      return {
        ...state,
        phase: 'turn_intro',
        gameNonce: action.gameNonce,
        order: action.order,
        config: action.config,
        scores,
        turn: null,
        chat: [],
        lastGuessAt: {},
        nextTurnAt: null,
      }
    }

    case 'TURN_STARTED': {
      // NOTE: the controller MUST dispatch this action before the drawer's
      // client applies WORD_ASSIGNED for the new turn. This case always
      // resets `turn.word` to null (a fresh turn starts unknown to
      // everyone), so an out-of-order WORD_ASSIGNED delivered first would be
      // silently clobbered.
      const turn: TurnState = {
        index: action.index,
        round: action.round,
        drawerId: action.drawerId,
        word: null,
        wordShape: action.wordShape,
        category: action.category,
        startedAt: action.startedAt,
        endsAt: action.endsAt,
        revealed: {},
        correct: {},
        drawerPoints: 0,
        endReason: null,
      }
      return { ...state, phase: 'drawing', turn, nextTurnAt: null }
    }

    case 'HINT_REVEALED': {
      if (!state.turn) return state
      let changed = false
      const revealed = { ...state.turn.revealed }
      for (const [key, char] of Object.entries(action.reveals)) {
        const index = Number(key)
        if (revealed[index] !== char) {
          revealed[index] = char
          changed = true
        }
      }
      if (!changed) return state
      return { ...state, turn: { ...state.turn, revealed } }
    }

    case 'GUESS_POSTED': {
      const alreadySolved = state.turn ? action.playerId in state.turn.correct : false
      const entry: ChatEntry = {
        id: chatId(state, action.at),
        kind: alreadySolved ? 'aside' : 'guess',
        playerId: action.playerId,
        text: action.text,
        at: action.at,
        audience: alreadySolved ? 'solved' : 'all',
      }
      const lastGuessAt = { ...state.lastGuessAt, [action.playerId]: action.at }
      const chat = pushChat(state.chat, entry)
      return { ...state, lastGuessAt, chat }
    }

    case 'GUESS_CORRECT': {
      if (!state.turn) return state
      if (action.playerId in state.turn.correct) return state
      const correct = {
        ...state.turn.correct,
        [action.playerId]: { elapsedMs: action.elapsedMs, points: action.points, place: action.place },
      }
      const turn = { ...state.turn, correct }
      const scores = {
        ...state.scores,
        [action.playerId]: (state.scores[action.playerId] ?? 0) + action.points,
      }
      const nickname = state.players[action.playerId]?.nickname ?? 'A player'
      const chat = pushChat(state.chat, {
        id: chatId(state, action.at),
        kind: 'correct',
        playerId: action.playerId,
        text: `${nickname} guessed the word!`,
        at: action.at,
        audience: 'all',
      })
      return { ...state, turn, scores, chat }
    }

    case 'TURN_ENDED': {
      if (!state.turn) return state
      const turn = state.turn

      if (turn.endReason !== null) {
        // The turn was already closed out early (PLAYER_LEFT ends it the
        // instant the drawer vanishes, before the host has a word to
        // publish). This action's only remaining job here is to fill in the
        // word — drawerPoints/scores were already finalised and must not be
        // re-applied.
        if (turn.word !== null) return state // word already published; true duplicate, full no-op
        const nextTurn: TurnState = {
          ...turn,
          word: action.word,
          endReason: turn.endReason ?? action.reason,
        }
        const chat = pushChat(state.chat, {
          id: chatId(state, action.at),
          kind: 'system',
          playerId: null,
          text: reasonText(nextTurn.endReason as NonNullable<TurnState['endReason']>, action.word),
          at: action.at,
          audience: 'all',
        })
        return { ...state, turn: nextTurn, chat }
      }

      const scores = {
        ...state.scores,
        [turn.drawerId]: (state.scores[turn.drawerId] ?? 0) + action.drawerPoints,
      }
      const nextTurn: TurnState = {
        ...turn,
        word: action.word,
        endReason: action.reason,
        drawerPoints: action.drawerPoints,
      }
      const chat = pushChat(state.chat, {
        id: chatId(state, action.at),
        kind: 'system',
        playerId: null,
        text: reasonText(action.reason, action.word),
        at: action.at,
        audience: 'all',
      })
      return { ...state, phase: 'turn_review', turn: nextTurn, scores, chat }
    }

    case 'ROUND_ENDED': {
      if (state.phase === 'round_break') return state
      return { ...state, phase: 'round_break' }
    }

    case 'GAME_ENDED': {
      if (state.phase === 'game_over') return state
      return { ...state, phase: 'game_over', nextTurnAt: null }
    }

    case 'INTERMISSION': {
      if (state.phase === 'turn_intro' && state.nextTurnAt === action.nextTurnAt) return state
      return { ...state, phase: 'turn_intro', nextTurnAt: action.nextTurnAt }
    }

    case 'SYSTEM_MESSAGE': {
      const chat = pushChat(state.chat, {
        id: chatId(state, action.at),
        kind: 'system',
        playerId: null,
        text: action.text,
        at: action.at,
        audience: action.audience,
      })
      return { ...state, chat }
    }

    case 'STATE_SYNCED': {
      const synced = action.state
      const preservedWord =
        synced.turn && state.turn && state.turn.index === synced.turn.index ? state.turn.word : null
      const turn: TurnState | null = synced.turn ? { ...synced.turn, word: preservedWord } : null
      return { ...synced, selfId: state.selfId, turn }
    }

    case 'WORD_ASSIGNED': {
      if (!state.turn) return state
      if (state.turn.word === action.word && state.turn.category === action.category) return state
      return { ...state, turn: { ...state.turn, word: action.word, category: action.category } }
    }

    case 'SELF_IDENTIFIED': {
      if (state.selfId === action.selfId) return state
      return { ...state, selfId: action.selfId }
    }

    case 'WHISPER': {
      const chat = pushChat(state.chat, {
        id: chatId(state, action.at),
        kind: 'close',
        playerId: null,
        text: action.text,
        at: action.at,
        audience: state.selfId,
      })
      return { ...state, chat }
    }

    default:
      return state
  }
}
