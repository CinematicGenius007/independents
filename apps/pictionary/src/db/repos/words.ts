import type { Category } from '../../shared/types'
import type { WordPack, WordRepo, WordRow } from '../types'
import type { GetDb } from '../sqlHelpers'
import type { PersistedStore } from '../persist'
import { queryAll, queryOne, runStatement } from '../sqlHelpers'

interface WordPackRow {
  pack_id: number
  name: string
  is_builtin: number
  created_at: number
}

interface WordRowRaw {
  word_id: number
  pack_id: number
  word: string
  difficulty: number
  category: string
}

export function createWordRepo(getDb: GetDb, persistence: PersistedStore): WordRepo {
  return {
    packs: async (): Promise<WordPack[]> => {
      const rows = queryAll<WordPackRow>(
        getDb(),
        'SELECT pack_id, name, is_builtin, created_at FROM word_packs ORDER BY pack_id ASC',
      )
      return rows.map((row) => ({
        packId: row.pack_id,
        name: row.name,
        isBuiltin: row.is_builtin !== 0,
        createdAt: row.created_at,
      }))
    },

    byCategories: async (categories: Category[]): Promise<WordRow[]> => {
      if (categories.length === 0) return []
      const placeholders = categories.map(() => '?').join(', ')
      const rows = queryAll<WordRowRaw>(
        getDb(),
        // Ordered explicitly: a promoted host re-derives the game's words from
        // `gameNonce` against this pool, so every peer must build the pool in
        // the same order or a migration would hand the drawer a different word
        // than the shape everyone else is already looking at.
        `SELECT word_id, pack_id, word, difficulty, category
         FROM words
         WHERE category IN (${placeholders})
         ORDER BY word_id ASC`,
        categories,
      )
      return rows.map((row) => ({
        wordId: row.word_id,
        packId: row.pack_id,
        word: row.word,
        difficulty: row.difficulty,
        category: row.category as Category,
      }))
    },

    createPack: async (name: string): Promise<number> => {
      const db = getDb()
      runStatement(
        db,
        'INSERT INTO word_packs (name, is_builtin, created_at) VALUES (?, 0, ?)',
        [name, Date.now()],
      )
      const row = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')
      persistence.scheduleSave()
      return row ? row.id : -1
    },

    addWords: async (
      packId: number,
      words: Array<Pick<WordRow, 'word' | 'category' | 'difficulty'>>,
    ): Promise<void> => {
      if (words.length === 0) return
      const db = getDb()
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO words (pack_id, word, difficulty, category) VALUES (?, ?, ?, ?)',
      )
      try {
        for (const word of words) {
          stmt.run([packId, word.word, word.difficulty, word.category])
        }
      } finally {
        stmt.free()
      }
      persistence.scheduleSave()
    },

    removePack: async (packId: number): Promise<void> => {
      runStatement(getDb(), 'DELETE FROM word_packs WHERE pack_id = ?', [packId])
      persistence.scheduleSave()
    },

    count: async (): Promise<number> => {
      const row = queryOne<{ c: number }>(getDb(), 'SELECT COUNT(*) AS c FROM words')
      return row ? row.c : 0
    },
  }
}
