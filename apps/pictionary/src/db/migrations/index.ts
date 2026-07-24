/**
 * Forward-only migration runner, keyed on the `schema_version` table.
 *
 * Migration 1 applies `schema.sql` verbatim (frozen, owned by the
 * orchestrator). To ship migration 2+: append a new entry to `migrations`
 * below with SQL/JS that transforms the schema from N-1 to N, and bump
 * `SCHEMA_VERSION` in `db/types.ts`. Never edit an already-shipped
 * migration's `apply` — earlier migrations must stay byte-for-byte stable so
 * a database that has already run them is never re-run.
 */

import type { Database as SqlJsDatabase } from 'sql.js'
import schemaSql from '../schema.sql?raw'

interface Migration {
  version: number
  apply: (db: SqlJsDatabase) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    apply: (db) => {
      db.exec(schemaSql)
      db.run('DELETE FROM schema_version')
      db.run('INSERT INTO schema_version (version) VALUES (?)', [1])
    },
  },
  // Append migration 2+ here — do not touch migration 1 above.
]

function tableExists(db: SqlJsDatabase, name: string): boolean {
  const result = db.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`,
  )
  return result.length > 0 && result[0].values.length > 0
}

function currentVersion(db: SqlJsDatabase): number {
  if (!tableExists(db, 'schema_version')) return 0
  const result = db.exec('SELECT version FROM schema_version LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) return 0
  const raw = result[0].values[0][0]
  const version = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(version) ? version : 0
}

/**
 * Brings `db` up to the latest known schema version. Running this against an
 * already-current database is a no-op (no pending migrations => nothing
 * executes, no transaction opened).
 */
export function runMigrations(db: SqlJsDatabase): void {
  const startVersion = currentVersion(db)
  const pending = migrations
    .filter((migration) => migration.version > startVersion)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    db.exec('BEGIN')
    try {
      migration.apply(db)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}
