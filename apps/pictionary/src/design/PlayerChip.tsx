import type { Player } from '../shared/types'
import { Avatar } from './Avatar'
import { bevelClass } from './utils'

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
  drawing: `bg-gold-lo text-gold-hi ${bevelClass({ tone: 'gold', size: 'sm' })}`,
  guessed: `bg-moss-lo text-moss-hi ${bevelClass({ tone: 'moss', size: 'sm' })}`,
  disconnected: `bg-stone-lo text-stone-hi ${bevelClass({ tone: 'stone', size: 'sm' })}`,
  idle: 'hidden',
}

/**
 * Avatar + nickname + score, with a bevelled status tag tucked at the
 * corner. Dims and desaturates when the player's connection has dropped,
 * independent of the in-turn `status`.
 */
export function PlayerChip({ player, score, status = 'idle', isSelf = false, className = '' }: PlayerChipProps) {
  const offline = player.connection === 'disconnected'
  return (
    <div
      className={`relative flex items-center gap-2.5 bg-chrome-panel px-3 py-2 ${bevelClass({ tone: 'chrome' })} ${
        offline ? 'opacity-55 grayscale' : ''
      } ${className}`}
    >
      <div className="relative shrink-0">
        <Avatar avatar={player.avatar} color={player.color} size={36} label={player.nickname} />
        {player.connection === 'unstable' && (
          <>
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-red" style={{ boxShadow: '0 0 0 2px var(--color-chrome-panel)' }} />
            <span className="sr-only">Unstable connection.</span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 truncate text-base font-semibold leading-tight text-text">
          {player.nickname}
          {isSelf && <span className="text-xs font-normal text-text-muted">(you)</span>}
        </span>
        {typeof score === 'number' && (
          <span className="font-mono text-xs text-text-muted">{score.toLocaleString()} pts</span>
        )}
      </div>

      {!offline && status !== 'idle' && (
        <span className={`pixel-heading ml-auto shrink-0 px-2 py-0.5 text-[8px] leading-[16px] ${STATUS_CLASSES[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      )}

      {offline && (
        <span className={`pixel-heading ml-auto shrink-0 px-2 py-0.5 text-[8px] leading-[16px] text-stone-hi ${bevelClass({ tone: 'stone', size: 'sm' })}`}>
          Offline
        </span>
      )}
    </div>
  )
}
