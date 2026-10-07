import type { Room } from './room'

export interface Env {
  ROOMS: DurableObjectNamespace<Room>
  /**
   * Comma-separated origins allowed to open rooms, e.g.
   * `https://azulejo.cinematicgenius007.com,https://ttt.example.com`.
   * Empty means any origin — the API is public for now.
   */
  ALLOWED_ORIGINS?: string
}
