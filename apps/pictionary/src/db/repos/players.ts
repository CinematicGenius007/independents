import type { PlayerProfile } from '../../shared/types'
import type { PlayerRepo } from '../types'
import type { GetDb } from '../sqlHelpers'
import type { PersistedStore } from '../persist'
import { queryOne, runStatement } from '../sqlHelpers'

interface PlayerRow {
  player_id: string
  nickname: string
  color: string
  avatar: number
}

export function createPlayerRepo(getDb: GetDb, persistence: PersistedStore): PlayerRepo {
  return {
    current: async (): Promise<PlayerProfile | null> => {
      const row = queryOne<PlayerRow>(
        getDb(),
        'SELECT player_id, nickname, color, avatar FROM players ORDER BY last_used_at DESC LIMIT 1',
      )
      if (!row) return null
      return {
        id: row.player_id,
        nickname: row.nickname,
        color: row.color,
        avatar: row.avatar,
      }
    },

    save: async (profile: PlayerProfile): Promise<void> => {
      const now = Date.now()
      runStatement(
        getDb(),
        `INSERT INTO players (player_id, nickname, color, avatar, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           nickname = excluded.nickname,
           color = excluded.color,
           avatar = excluded.avatar,
           last_used_at = excluded.last_used_at`,
        [profile.id, profile.nickname, profile.color, profile.avatar, now, now],
      )
      persistence.scheduleSave()
    },
  }
}
