/**
 * Persistence contract.
 *
 * OWNED BY THE ORCHESTRATOR. Implemented by the db agent.
 *
 * Everything here is local-only: no sync, no accounts, no network. The database
 * is a sql.js instance in memory whose exported bytes are debounce-written to
 * IndexedDB, which is what makes export/import a one-liner for the user.
 */

import type {
  Category,
  GameConfig,
  GameHistoryEntry,
  PlayerProfile,
  PlayerStats,
} from '../shared/types'

export interface WordRow {
  wordId: number
  packId: number
  word: string
  /** 1 easy, 2 medium, 3 hard. */
  difficulty: number
  category: Category
}

export interface WordPack {
  packId: number
  name: string
  isBuiltin: boolean
  createdAt: number
}

export interface PlayerRepo {
  /** The profile this browser last played as, if any. */
  current(): Promise<PlayerProfile | null>
  save(profile: PlayerProfile): Promise<void>
}

export interface PreferenceRepo {
  get<T>(key: string, fallback: T): Promise<T>
  set<T>(key: string, value: T): Promise<void>
  /** Last-used room settings, restored into the lobby. */
  lastConfig(): Promise<GameConfig | null>
  saveConfig(config: GameConfig): Promise<void>
}

export interface WordRepo {
  packs(): Promise<WordPack[]>
  /** Every word in the given categories, across builtin + enabled custom packs. */
  byCategories(categories: Category[]): Promise<WordRow[]>
  createPack(name: string): Promise<number>
  addWords(packId: number, words: Array<Pick<WordRow, 'word' | 'category' | 'difficulty'>>): Promise<void>
  removePack(packId: number): Promise<void>
  count(): Promise<number>
}

export interface StatsRepo {
  read(): Promise<PlayerStats>
  /** Applies a delta; missing keys are left untouched. */
  bump(delta: Partial<PlayerStats>): Promise<void>
  recordGame(entries: GameHistoryEntry[]): Promise<void>
  history(limit?: number): Promise<GameHistoryEntry[]>
  reset(): Promise<void>
}

export interface Database {
  players: PlayerRepo
  preferences: PreferenceRepo
  words: WordRepo
  stats: StatsRepo
  /** Serialise the whole database for download. */
  exportBytes(): Promise<Uint8Array>
  /** Replace the whole database from an uploaded file. Validates before swapping. */
  importBytes(bytes: Uint8Array): Promise<void>
  /** Force a persistence flush; normally debounced and automatic. */
  flush(): Promise<void>
}

/**
 * Lazily boots sql.js, restores the persisted blob (or seeds a fresh database
 * with the builtin word packs) and resolves the repositories. Safe to call more
 * than once — the same instance is returned.
 */
export type OpenDatabase = () => Promise<Database>

export const DB_NAME = 'scribble-club'
export const DB_STORE = 'sqlite'
export const DB_KEY = 'main'
export const SCHEMA_VERSION = 1
export const BUILTIN_PACK_NAME = 'Builtin'
/** Minimum seeded word count; asserted by the db agent's tests. */
export const MIN_SEED_WORDS = 500
