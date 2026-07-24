/**
 * Builtin word library bootstrap. Seeds the `words` table (via a single
 * "Builtin" word pack) the first time a database is created; a no-op on any
 * database that already has words (e.g. one restored from IndexedDB, or one
 * imported from a user's backup file).
 */

import type { Database as SqlJsDatabase } from 'sql.js'
import type { Category } from '../../shared/types'
import { BUILTIN_PACK_NAME } from '../types'
import wordsData from './words.json'

interface SeedWord {
  word: string
  category: Category
  difficulty: number
}

const seedWords = wordsData as SeedWord[]

/**
 * Seeds the builtin word pack when `db` has no words yet. Returns `true` if
 * it seeded anything (so callers know to persist immediately), `false` if it
 * was a no-op.
 */
export function seedIfEmpty(db: SqlJsDatabase): boolean {
  const countResult = db.exec('SELECT COUNT(*) AS c FROM words')
  const existing = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0
  if (existing > 0) return false

  const now = Date.now()
  db.exec('BEGIN')
  try {
    db.run('INSERT INTO word_packs (name, is_builtin, created_at) VALUES (?, 1, ?)', [
      BUILTIN_PACK_NAME,
      now,
    ])
    const packIdResult = db.exec('SELECT last_insert_rowid() AS id')
    const packId = Number(packIdResult[0].values[0][0])

    const stmt = db.prepare(
      'INSERT INTO words (pack_id, word, difficulty, category) VALUES (?, ?, ?, ?)',
    )
    try {
      for (const entry of seedWords) {
        stmt.run([packId, entry.word, entry.difficulty, entry.category])
      }
    } finally {
      stmt.free()
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return true
}

export { seedWords }
