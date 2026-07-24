/**
 * Small shared helpers used by every repo: prepared-statement plumbing and
 * the indirection that lets `importBytes` swap the underlying sql.js
 * `Database` instance out from under already-constructed repos.
 */

import type { BindParams, Database as SqlJsDatabase } from 'sql.js'

/**
 * Repos never hold a `Database` reference directly — they call `getDb()`
 * fresh on every statement. That indirection is what allows `importBytes`
 * to atomically swap in a new sql.js instance without repos needing to know.
 */
export type GetDb = () => SqlJsDatabase

/** Runs a statement for its side effects (INSERT/UPDATE/DELETE/DDL). Always frees the statement. */
export function runStatement(db: SqlJsDatabase, sql: string, params?: BindParams): void {
  const stmt = db.prepare(sql)
  try {
    stmt.run(params)
  } finally {
    stmt.free()
  }
}

/** Runs a query and returns every row as a plain object. Always frees the statement. */
export function queryAll<T>(db: SqlJsDatabase, sql: string, params?: BindParams): T[] {
  const stmt = db.prepare(sql)
  const rows: T[] = []
  try {
    if (params !== undefined) {
      stmt.bind(params)
    }
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T)
    }
  } finally {
    stmt.free()
  }
  return rows
}

/** Runs a query and returns the first row, or `null` if there were none. */
export function queryOne<T>(db: SqlJsDatabase, sql: string, params?: BindParams): T | null {
  const rows = queryAll<T>(db, sql, params)
  return rows.length > 0 ? rows[0] : null
}

/** Enables SQLite foreign-key enforcement (and thus `ON DELETE CASCADE`) for a connection. */
export function enableForeignKeys(db: SqlJsDatabase): void {
  db.run('PRAGMA foreign_keys = ON')
}
