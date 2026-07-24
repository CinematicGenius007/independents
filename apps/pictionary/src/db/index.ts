/**
 * `openDatabase` — the single entry point downstream layers use.
 *
 * Boots sql.js (lazily), restores the persisted IndexedDB blob if one
 * exists, migrates it to the current schema, seeds the builtin word library
 * on a brand-new database, and wires up debounced persistence. Safe to call
 * repeatedly: the same in-flight/resolved promise is shared.
 */

import type { Database as SqlJsDatabase } from 'sql.js'
import type { Database, OpenDatabase } from './types'
import { loadSqlJs } from './sqlite'
import { createPersistence, readBlob } from './persist'
import { runMigrations } from './migrations'
import { seedIfEmpty } from './seed'
import { enableForeignKeys } from './sqlHelpers'
import { createPlayerRepo } from './repos/players'
import { createPreferenceRepo } from './repos/preferences'
import { createWordRepo } from './repos/words'
import { createStatsRepo } from './repos/stats'

let instancePromise: Promise<Database> | null = null

export const openDatabase: OpenDatabase = () => {
  if (!instancePromise) {
    instancePromise = bootstrap().catch((err: unknown) => {
      // Let a later call retry instead of being stuck on a rejected promise.
      instancePromise = null
      throw err
    })
  }
  return instancePromise
}

/** Test-only: forgets the cached instance so the next `openDatabase()` boots fresh. */
export function __resetForTests(): void {
  instancePromise = null
}

async function bootstrap(): Promise<Database> {
  const SQL = await loadSqlJs()
  const existingBlob = await readBlob()

  let currentDb: SqlJsDatabase = existingBlob ? new SQL.Database(existingBlob) : new SQL.Database()
  enableForeignKeys(currentDb)
  runMigrations(currentDb)
  const seeded = seedIfEmpty(currentDb)

  const getDb = (): SqlJsDatabase => currentDb
  const persistence = createPersistence(() => currentDb.export())

  if (!existingBlob || seeded) {
    persistence.scheduleSave()
  }

  const players = createPlayerRepo(getDb, persistence)
  const preferences = createPreferenceRepo(getDb, persistence)
  const words = createWordRepo(getDb, persistence)
  const stats = createStatsRepo(getDb, persistence)

  const database: Database = {
    players,
    preferences,
    words,
    stats,

    exportBytes: async (): Promise<Uint8Array> => currentDb.export(),

    importBytes: async (bytes: Uint8Array): Promise<void> => {
      let candidate: SqlJsDatabase
      try {
        candidate = new SQL.Database(bytes)
        enableForeignKeys(candidate)
        // Validates the file is both parseable SQLite *and* shaped like our
        // schema (or upgradeable to it) before we commit to swapping it in.
        runMigrations(candidate)
        candidate.exec('SELECT player_id FROM players LIMIT 1')
        candidate.exec('SELECT word_id FROM words LIMIT 1')
      } catch (err) {
        throw new Error(
          `Cannot import database: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      const old = currentDb
      currentDb = candidate
      old.close()
      await persistence.flush()
    },

    flush: (): Promise<void> => persistence.flush(),
  }

  return database
}
