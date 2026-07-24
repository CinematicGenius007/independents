/**
 * Game engine contract — pure, transport-free, React-free.
 *
 * OWNED BY THE ORCHESTRATOR. Implemented by the engine agent in sibling files.
 *
 * Determinism rule: every action in {@link SharedAction} is broadcast to all
 * peers and applied by all peers in the same order, so `reduce()` MUST be a
 * pure function of `(state, action)` — no `Date.now()`, no `Math.random()`, no
 * DOM. Anything time- or randomness-dependent arrives pre-stamped inside the
 * action payload (the host stamps it). {@link LocalAction}s are applied only on
 * the client that produced them and intentionally diverge (e.g. the drawer
 * knowing the secret word).
 */

import type {
  Category,
  ConnectionState,
  GameConfig,
  Player,
  PlayerId,
  RoomId,
} from '../shared/types'

export type Phase =
  /** In the room, no game running. Host can change config. */
  | 'lobby'
  /** Short "X is drawing" beat before the timer starts. */
  | 'turn_intro'
  /** Timer running, drawer drawing, guessers guessing. */
  | 'drawing'
  /** Word revealed, per-turn scores shown. */
  | 'turn_review'
  /** All players have drawn this round; cumulative scoreboard shown. */
  | 'round_break'
  /** Final scores. Host may start another game. */
  | 'game_over'

export interface CorrectGuess {
  /** Ms elapsed from turn start to the correct guess, host-stamped. */
  elapsedMs: number
  points: number
  /** Finish position among correct guessers, 1-based. */
  place: number
}

export interface TurnState {
  /** Global turn counter across the whole game, 0-based. */
  index: number
  /** 1-based round number. */
  round: number
  drawerId: PlayerId
  /**
   * The secret word. Non-null only for the drawer (delivered privately) or for
   * everyone once the turn has ended. Guessers see `null` while drawing.
   */
  word: string | null
  /** Token lengths, e.g. "ICE CREAM" -> [3, 5]. Known to everyone from turn start. */
  wordShape: number[]
  /** Category the word came from, shown as a hint chip. */
  category: Category | null
  /** Host-stamped epoch ms. */
  startedAt: number
  /** Host-stamped epoch ms. `startedAt + config.turnSeconds * 1000`. */
  endsAt: number
  /**
   * Letters the hint system has revealed, keyed by index into the joined word
   * (spaces included).
   *
   * Carries the actual characters, not just positions: guessers never hold the
   * secret word (`word` stays `null` for them until the reveal), so a
   * position-only payload would leave them structurally unable to render a
   * hint. The host stamps the characters when it emits `HINT_REVEALED`.
   */
  revealed: Record<number, string>
  correct: Record<PlayerId, CorrectGuess>
  /** Points the drawer earned this turn; finalised at turn end. */
  drawerPoints: number
  endReason: 'timeout' | 'all_guessed' | 'drawer_left' | 'skipped' | null
}

export type ChatKind =
  /** A normal guess, visible to everyone. */
  | 'guess'
  /** Engine-generated notice ("Ada is drawing", "Time's up!"). */
  | 'system'
  /** "You're very close!" — private to one player. */
  | 'close'
  /** "Ada guessed the word!" */
  | 'correct'
  /** Chatter between players who have already guessed, hidden from those who haven't. */
  | 'aside'

export interface ChatEntry {
  id: string
  kind: ChatKind
  /** Null for system messages. */
  playerId: PlayerId | null
  text: string
  /** Host- or sender-stamped epoch ms. */
  at: number
  /**
   * Visibility filter applied at render time:
   * - `'all'` — everyone
   * - `'solved'` — only players who already guessed correctly this turn, plus the drawer
   * - a PlayerId — only that player (whispers)
   */
  audience: 'all' | 'solved' | PlayerId
}

export interface GameState {
  phase: Phase
  roomId: RoomId
  /** This client's own id. Never changes for the session. */
  selfId: PlayerId
  /** Current host. Recomputed deterministically on peer churn. */
  hostId: PlayerId
  /** Regenerated per game; seeds turn order and word selection. */
  gameNonce: string
  config: GameConfig
  players: Record<PlayerId, Player>
  /** Deterministic drawing order for the current game, derived from `gameNonce`. */
  order: PlayerId[]
  /** Cumulative scores for the current game. */
  scores: Record<PlayerId, number>
  turn: TurnState | null
  /** Capped ring buffer; oldest entries dropped past `CHAT_LIMIT`. */
  chat: ChatEntry[]
  /** Epoch ms of each player's last guess, for the client-side rate limit. */
  lastGuessAt: Record<PlayerId, number>
  /** Set when the next turn should auto-start, host-stamped. Null outside intermissions. */
  nextTurnAt: number | null
}

/**
 * Actions replicated to every peer. Serialised straight onto the wire, so keep
 * payloads JSON-safe and small.
 */
export type SharedAction =
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: PlayerId }
  | { type: 'PLAYER_CONNECTION'; playerId: PlayerId; connection: ConnectionState }
  | { type: 'HOST_CHANGED'; hostId: PlayerId }
  | { type: 'CONFIG_CHANGED'; config: GameConfig }
  | {
      type: 'GAME_STARTED'
      gameNonce: string
      order: PlayerId[]
      config: GameConfig
      at: number
    }
  | {
      type: 'TURN_STARTED'
      index: number
      round: number
      drawerId: PlayerId
      wordShape: number[]
      category: Category | null
      startedAt: number
      endsAt: number
    }
  /** Host-stamped. Keys are indices into the joined word, values the letters at them. */
  | { type: 'HINT_REVEALED'; reveals: Record<number, string> }
  | { type: 'GUESS_POSTED'; playerId: PlayerId; text: string; at: number }
  | {
      type: 'GUESS_CORRECT'
      playerId: PlayerId
      elapsedMs: number
      points: number
      place: number
      at: number
    }
  /**
   * Ends the turn and reveals the word to everyone.
   *
   * Must be idempotent. A turn can already be in `turn_review` when this
   * arrives — `PLAYER_LEFT` ends a turn immediately when the drawer vanishes,
   * before the host has had a chance to publish the word. In that case this
   * action only fills in `word`; scores must NOT be applied a second time.
   *
   * `word` may be an empty string in the one unrecoverable case: the drawer was
   * also the host, so nobody left in the room ever knew the word. The UI shows
   * the turn as cancelled rather than inventing a reveal.
   */
  | {
      type: 'TURN_ENDED'
      word: string
      reason: NonNullable<TurnState['endReason']>
      drawerPoints: number
      at: number
    }
  | { type: 'ROUND_ENDED'; round: number; at: number }
  | { type: 'GAME_ENDED'; at: number }
  | { type: 'INTERMISSION'; nextTurnAt: number }
  | { type: 'SYSTEM_MESSAGE'; text: string; at: number; audience: ChatEntry['audience'] }
  /** Full-state adoption used for late joins and host migration. */
  | { type: 'STATE_SYNCED'; state: SyncableState }

/** Actions applied only on the originating client; never broadcast. */
export type LocalAction =
  /** The host privately tells the drawer their word. */
  | { type: 'WORD_ASSIGNED'; word: string; category: Category | null }
  | { type: 'SELF_IDENTIFIED'; selfId: PlayerId }
  | { type: 'WHISPER'; text: string; at: number }

export type EngineAction = SharedAction | LocalAction

/**
 * The slice of {@link GameState} that travels on the wire during a resync.
 * Excludes `selfId` and any privately-known word, which are per-client.
 */
export type SyncableState = Omit<GameState, 'selfId' | 'turn'> & {
  turn: (Omit<TurnState, 'word'> & { word: null }) | null
}

/** The reducer the engine agent implements. Pure. Returns a new object on change. */
export type Reduce = (state: GameState, action: EngineAction) => GameState

/** Max chat entries retained in state. */
export const CHAT_LIMIT = 200
