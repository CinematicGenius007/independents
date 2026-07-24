/**
 * Cross-layer domain contract.
 *
 * OWNED BY THE ORCHESTRATOR. Layer agents (design/db/net/engine/canvas/screens)
 * import from here and MUST NOT edit this file. If something is missing, report
 * it rather than adding it locally — silent divergence here breaks every layer.
 */

/** Peer identity. In multiplayer this is the Trystero peer id; in solo play it is `'local'`. */
export type PlayerId = string

/** Short, human-shareable room code (also the Trystero room name). */
export type RoomId = string

/** What a player picks once and keeps, persisted in SQLite. */
export interface PlayerProfile {
  id: PlayerId
  nickname: string
  /** Hex string drawn from {@link AVATAR_COLORS}. */
  color: string
  /** Index into the doodle-avatar sprite set (0-based). */
  avatar: number
}

export type ConnectionState = 'connected' | 'unstable' | 'disconnected'

/** A profile plus its live session status inside a room. */
export interface Player extends PlayerProfile {
  connection: ConnectionState
  /** Host-stamped epoch ms of first join. Ties broken by `id`. Used for host election ordering. */
  joinedAt: number
}

export type Category =
  | 'general'
  | 'animals'
  | 'food'
  | 'places'
  | 'objects'
  | 'idioms'
  | 'popculture'
  | 'hard'

export const CATEGORIES: readonly Category[] = [
  'general',
  'animals',
  'food',
  'places',
  'objects',
  'idioms',
  'popculture',
  'hard',
] as const

export const CATEGORY_LABELS: Record<Category, string> = {
  general: 'General',
  animals: 'Animals',
  food: 'Food',
  places: 'Places',
  objects: 'Objects',
  idioms: 'Idioms',
  popculture: 'Pop Culture',
  hard: 'Hard Mode',
}

/** Room settings. Host-owned; broadcast to everyone on change. */
export interface GameConfig {
  /** Seconds per drawing turn. See {@link LIMITS.turnSeconds}. */
  turnSeconds: number
  /** Number of full rounds; every player draws once per round. */
  rounds: number
  /** Categories the word pool is drawn from. Never empty. */
  categories: Category[]
  /** When true the pool is `customWords` only and `categories` is ignored. */
  customWordsOnly: boolean
  /** Host-supplied words, editable in the lobby. */
  customWords: string[]
  /** Letter reveals after half the turn elapses. */
  hintsEnabled: boolean
}

export const LIMITS = {
  minPlayers: 2,
  maxPlayers: 8,
  turnSeconds: { min: 30, max: 180, step: 10 },
  rounds: { min: 1, max: 10 },
  /** Client-enforced anti-spam window between guesses, in ms. */
  guessCooldownMs: 3000,
  /** A guess within this Levenshtein distance triggers a private "so close" whisper. */
  closeGuessDistance: 2,
  /** Fraction of turn time that elapses before the first letter is revealed. */
  hintStartFraction: 0.5,
  /** Gap between subsequent letter reveals, in ms. */
  hintIntervalMs: 10_000,
  /** Pause between the word reveal and the next turn, in ms. */
  intermissionMs: 5000,
  /** Silence past this is shown as a shaky connection, in ms. */
  peerGraceMs: 8000,
  /** Silence past this marks the peer disconnected. They are greyed out, never removed. */
  peerDisconnectMs: 16_000,
  maxChatLength: 120,
  maxNicknameLength: 16,
} as const

/** Ink-on-paper avatar colors. Index-stable — persisted profiles reference these values. */
export const AVATAR_COLORS: readonly string[] = [
  '#F5D311', // accent yellow
  '#F2603C', // alert orange
  '#3C7DF2', // ink blue
  '#3CB371', // moss
  '#B45FD1', // violet
  '#E86FA8', // rose
  '#7A5C3E', // sepia
  '#1A1A1A', // ink black
] as const

export const DEFAULT_CONFIG: GameConfig = {
  turnSeconds: 80,
  rounds: 3,
  categories: ['general', 'animals', 'food', 'objects'],
  customWordsOnly: false,
  customWords: [],
  hintsEnabled: true,
}

/** Aggregate lifetime stats, persisted locally. Purely personal — never synced. */
export interface PlayerStats {
  gamesPlayed: number
  wordsGuessed: number
  wordsDrawn: number
  bestStreak: number
  totalGuessTimeMs: number
  guessCount: number
  favoriteCategory: Category | null
  rating: number
}

export interface GameHistoryEntry {
  gameId: string
  playerName: string
  score: number
  role: 'drawer' | 'guesser'
  word: string
  timestamp: number
}

export type Unsubscribe = () => void
