import { describe, expect, it, vi } from 'vitest'
import { loadSqlJs } from '../sqlite'
import { runMigrations } from './index'

describe('runMigrations', () => {
  it('brings a fresh database to schema version 1', async () => {
    const SQL = await loadSqlJs()
    const db = new SQL.Database()
    runMigrations(db)
    const result = db.exec('SELECT version FROM schema_version')
    expect(result[0].values).toEqual([[1]])
    // Core tables from schema.sql migration 1 should now exist.
    const tables = db
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]
      .values.map((row) => row[0])
    expect(tables).toEqual(
      expect.arrayContaining(['players', 'preferences', 'word_packs', 'words', 'stats', 'game_history']),
    )
    db.close()
  })

  it('is a no-op against an already-current database', async () => {
    const SQL = await loadSqlJs()
    const db = new SQL.Database()
    runMigrations(db)

    const execSpy = vi.spyOn(db, 'exec')
    runMigrations(db)

    // No migration transaction should have been opened the second time.
    expect(execSpy.mock.calls.some((call) => call[0] === 'BEGIN')).toBe(false)

    const result = db.exec('SELECT version FROM schema_version')
    expect(result[0].values).toEqual([[1]])
    db.close()
  })
})
