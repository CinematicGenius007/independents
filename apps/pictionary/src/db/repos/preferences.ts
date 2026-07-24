import type { GameConfig } from '../../shared/types'
import type { PreferenceRepo } from '../types'
import type { GetDb } from '../sqlHelpers'
import type { PersistedStore } from '../persist'
import { queryOne, runStatement } from '../sqlHelpers'

const CONFIG_KEY = 'lastConfig'

interface PreferenceRow {
  value: string
}

export function createPreferenceRepo(getDb: GetDb, persistence: PersistedStore): PreferenceRepo {
  const get = async <T>(key: string, fallback: T): Promise<T> => {
    const row = queryOne<PreferenceRow>(getDb(), 'SELECT value FROM preferences WHERE key = ?', [key])
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  }

  const set = async <T>(key: string, value: T): Promise<void> => {
    runStatement(
      getDb(),
      `INSERT INTO preferences (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)],
    )
    persistence.scheduleSave()
  }

  return {
    get,
    set,
    lastConfig: (): Promise<GameConfig | null> => get<GameConfig | null>(CONFIG_KEY, null),
    saveConfig: (config: GameConfig): Promise<void> => set(CONFIG_KEY, config),
  }
}
