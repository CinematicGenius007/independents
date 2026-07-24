import type { Category, GameHistoryEntry, PlayerStats } from '../../shared/types'
import type { StatsRepo } from '../types'
import type { GetDb } from '../sqlHelpers'
import type { PersistedStore } from '../persist'
import { queryAll, queryOne, runStatement } from '../sqlHelpers'

/** Starting Elo-like rating for a player with no games played yet. */
const DEFAULT_RATING = 1000

/** Stats keys that are summed on `bump`. `bestStreak` is handled separately (max, not sum). */
const ADDITIVE_KEYS = [
  'gamesPlayed',
  'wordsGuessed',
  'wordsDrawn',
  'totalGuessTimeMs',
  'guessCount',
  'rating',
] as const

type AdditiveKey = (typeof ADDITIVE_KEYS)[number]

const DEFAULTS: Record<AdditiveKey, number> = {
  gamesPlayed: 0,
  wordsGuessed: 0,
  wordsDrawn: 0,
  totalGuessTimeMs: 0,
  guessCount: 0,
  rating: DEFAULT_RATING,
}

interface StatRow {
  stat_name: string
  stat_value: number
}

interface HistoryRow {
  game_id: string
  player_name: string
  score: number
  role: 'drawer' | 'guesser'
  word: string
  timestamp: number
}

function toEntry(row: HistoryRow): GameHistoryEntry {
  return {
    gameId: row.game_id,
    playerName: row.player_name,
    score: row.score,
    role: row.role,
    word: row.word,
    timestamp: row.timestamp,
  }
}

export function createStatsRepo(getDb: GetDb, persistence: PersistedStore): StatsRepo {
  return {
    read: async (): Promise<PlayerStats> => {
      const db = getDb()
      const rows = queryAll<StatRow>(db, 'SELECT stat_name, stat_value FROM stats')
      const values: Record<string, number> = { ...DEFAULTS, bestStreak: 0 }
      for (const row of rows) {
        values[row.stat_name] = row.stat_value
      }

      // favoriteCategory is derived from game_history joined against the word
      // library, never stored redundantly in `stats`.
      const favoriteRow = queryOne<{ category: string }>(
        db,
        `SELECT w.category AS category
         FROM game_history gh
         JOIN words w ON lower(w.word) = lower(gh.word)
         GROUP BY w.category
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
      )

      return {
        gamesPlayed: values.gamesPlayed,
        wordsGuessed: values.wordsGuessed,
        wordsDrawn: values.wordsDrawn,
        bestStreak: values.bestStreak,
        totalGuessTimeMs: values.totalGuessTimeMs,
        guessCount: values.guessCount,
        favoriteCategory: (favoriteRow?.category as Category | undefined) ?? null,
        rating: values.rating,
      }
    },

    bump: async (delta: Partial<PlayerStats>): Promise<void> => {
      const db = getDb()
      db.exec('BEGIN')
      try {
        for (const key of ADDITIVE_KEYS) {
          const value = delta[key]
          if (typeof value !== 'number') continue
          runStatement(
            db,
            `INSERT INTO stats (stat_name, stat_value) VALUES (?, ?)
             ON CONFLICT(stat_name) DO UPDATE SET stat_value = stat_value + excluded.stat_value`,
            [key, value],
          )
        }
        if (typeof delta.bestStreak === 'number') {
          runStatement(
            db,
            `INSERT INTO stats (stat_name, stat_value) VALUES ('bestStreak', ?)
             ON CONFLICT(stat_name) DO UPDATE SET stat_value = MAX(stat_value, excluded.stat_value)`,
            [delta.bestStreak],
          )
        }
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      persistence.scheduleSave()
    },

    recordGame: async (entries: GameHistoryEntry[]): Promise<void> => {
      if (entries.length === 0) return
      const db = getDb()
      const stmt = db.prepare(
        `INSERT INTO game_history (game_id, player_name, score, role, word, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      try {
        for (const entry of entries) {
          stmt.run([entry.gameId, entry.playerName, entry.score, entry.role, entry.word, entry.timestamp])
        }
      } finally {
        stmt.free()
      }
      persistence.scheduleSave()
    },

    history: async (limit = 50): Promise<GameHistoryEntry[]> => {
      const rows = queryAll<HistoryRow>(
        getDb(),
        'SELECT game_id, player_name, score, role, word, timestamp FROM game_history ORDER BY timestamp DESC LIMIT ?',
        [limit],
      )
      return rows.map(toEntry)
    },

    reset: async (): Promise<void> => {
      const db = getDb()
      db.exec('BEGIN')
      try {
        db.run('DELETE FROM stats')
        db.run('DELETE FROM game_history')
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      persistence.scheduleSave()
    },
  }
}
