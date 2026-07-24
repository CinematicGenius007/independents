import type { Player } from '../shared/types'
import { Avatar } from './Avatar'
import { doodleRadius } from './utils'

export type PlayerChipStatus = 'drawing' | 'guessed' | 'disconnected' | 'idle'

export interface PlayerChipProps {
  player: Player
  score?: number
  status?: PlayerChipStatus
  /** Highlights the chip as "this is you". */
  isSelf?: boolean
  className?: string
}

const STATUS_LABEL: Record<PlayerChipStatus, string> = {
  drawing: 'Drawing',
  guessed: 'Guessed!',
  disconnected: 'Disconnected',
  idle: '',
}

const STATUS_CLASSES: Record<PlayerChipStatus, string> = {
  drawing: 'border-accent-deep bg-accent-wash text-ink',
  guessed: 'border-ok bg-paper-white text-ink',
  disconnected: 'border-ink-ghost bg-paper text-ink-faint',
  idle: 'hidden',
}

/**
 * Avatar + nickname + score, with a speech-bubble-style status tag tucked
 * under the corner. Dims and desaturates when the player's connection has
 * dropped, independent of the in-turn `status`.
 */
export function PlayerChip({ player, score, status = 'idle', isSelf = false, className = '' }: PlayerChipProps) {
  const offline = player.connection === 'disconnected'
  const key = `chip:${player.id}`

  return (
    <div
      className={`relative flex items-center gap-2.5 border-[3px] border-ink bg-paper-white px-3 py-2 shadow-ink-sm ${
        offline ? 'opacity-55 grayscale' : ''
      } ${className}`}
      style={{ borderRadius: doodleRadius(key) }}
    >
      <div className="relative shrink-0">
        <Avatar avatar={player.avatar} color={player.color} size={36} label={player.nickname} />
        {player.connection === 'unstable' && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper-white bg-alert"
            title="Unstable connection"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 truncate font-[family-name:var(--font-display)] text-base leading-tight text-ink">
          {player.nickname}
          {isSelf && <span className="text-xs font-normal text-ink-faint">(you)</span>}
        </span>
        {typeof score === 'number' && (
          <span className="font-mono text-xs text-ink-soft">{score.toLocaleString()} pts</span>
        )}
      </div>

      {!offline && status !== 'idle' && (
        <span
          className={`ml-auto shrink-0 rounded-full border-2 px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      )}

      {offline && (
        <span className="ml-auto shrink-0 rounded-full border-2 border-ink-ghost px-2 py-0.5 text-xs font-semibold text-ink-faint">
          Offline
        </span>
      )}
    </div>
  )
}
