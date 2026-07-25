import type { RelayStatus } from '../net/protocol'
import { CATEGORY_LABELS, CATEGORIES, LIMITS, type GameConfig, type Player } from '../shared/types'
import { Panel, PlayerChip, SketchButton, Slider, Toggle } from '../design'
import { ScreenFrame, inputClassName } from './ScreenFrame'

export interface LobbyScreenProps {
  roomId: string
  inviteUrl: string
  players: Player[]
  selfId: string
  hostId: string
  config: GameConfig
  customWordsText: string
  copied?: boolean
  starting?: boolean
  relayStatus?: RelayStatus
  onCopyInvite: () => void
  onConfigChange: (config: GameConfig) => void
  onCustomWordsTextChange: (text: string) => void
  onStart: () => void
  onLeave: () => void
}

export function LobbyScreen(props: LobbyScreenProps) {
  const isHost = props.selfId === props.hostId
  const update = (patch: Partial<GameConfig>) => props.onConfigChange({ ...props.config, ...patch })
  const canStart = isHost && props.players.length >= LIMITS.minPlayers

  return (
    <ScreenFrame
      eyebrow="Waiting room"
      title={`Room ${props.roomId}`}
      subtitle={isHost ? 'You are the host. Tune the rules while everyone finds a seat.' : 'The host is setting up the next game.'}
      actions={<SketchButton variant="danger" size="sm" onClick={props.onLeave}>Leave room</SketchButton>}
    >
      {props.relayStatus && props.relayStatus !== 'connected' && (
        <div
          className={`mb-5 border-2 border-ink px-4 py-3 text-sm shadow-ink-sm ${props.relayStatus === 'failed' ? 'bg-alert-wash' : 'bg-accent-wash'}`}
          role="status"
        >
          {props.relayStatus === 'failed'
            ? 'Could not reach a signaling relay. Check your network or privacy settings, then reload to try again.'
            : 'Connecting to a signaling relay… You can share the link while we find a route.'}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-6">
          <Panel title={`Players · ${props.players.length}/${LIMITS.maxPlayers}`}>
            <div className="flex flex-col gap-3">
              {props.players.map((player) => (
                <PlayerChip
                  key={player.id}
                  player={player}
                  isSelf={player.id === props.selfId}
                  status={player.connection === 'disconnected' ? 'disconnected' : 'idle'}
                />
              ))}
            </div>
          </Panel>
          <Panel tone="accent" title="Invite link">
            <p className="mb-3 break-all font-mono text-xs text-ink-soft">{props.inviteUrl}</p>
            <SketchButton size="sm" onClick={props.onCopyInvite}>{props.copied ? 'Copied!' : 'Copy invite'}</SketchButton>
          </Panel>
        </div>

        <Panel title="House rules" className={!isHost ? 'opacity-80' : ''}>
          <fieldset disabled={!isHost} className="grid gap-6 sm:grid-cols-2 disabled:opacity-65">
            <Slider
              label="Drawing time"
              value={props.config.turnSeconds}
              min={LIMITS.turnSeconds.min}
              max={LIMITS.turnSeconds.max}
              step={LIMITS.turnSeconds.step}
              formatValue={(value) => `${value}s`}
              onChange={(turnSeconds) => update({ turnSeconds })}
            />
            <Slider
              label="Rounds"
              value={props.config.rounds}
              min={LIMITS.rounds.min}
              max={LIMITS.rounds.max}
              formatValue={(value) => String(value)}
              onChange={(rounds) => update({ rounds })}
            />
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Word categories</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((category) => (
                  <Toggle
                    key={category}
                    label={CATEGORY_LABELS[category]}
                    disabled={props.config.customWordsOnly}
                    checked={props.config.categories.includes(category)}
                    onChange={(checked) => {
                      const categories = checked
                        ? [...props.config.categories, category]
                        : props.config.categories.filter((item) => item !== category)
                      if (categories.length > 0) update({ categories })
                    }}
                  />
                ))}
              </div>
            </div>
            <Toggle checked={props.config.hintsEnabled} onChange={(hintsEnabled) => update({ hintsEnabled })} label="Reveal letter hints" />
            <Toggle checked={props.config.customWordsOnly} onChange={(customWordsOnly) => update({ customWordsOnly })} label="Use custom words only" />
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">Custom words <span className="font-normal text-ink-faint">(one per line)</span></span>
              <textarea
                className={`${inputClassName} min-h-28 resize-y`}
                value={props.customWordsText}
                placeholder={'moon boots\nspaghetti western\nrubber duck'}
                onChange={(event) => props.onCustomWordsTextChange(event.target.value)}
              />
            </label>
          </fieldset>

          <div className="mt-7 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!isHost && <p className="mr-auto text-sm text-ink-faint">Only the host can change these.</p>}
            {isHost && props.players.length < LIMITS.minPlayers && <p className="mr-auto text-sm text-ink-faint">Waiting for one more player…</p>}
            <SketchButton size="lg" disabled={!canStart} loading={props.starting} onClick={props.onStart}>Start drawing</SketchButton>
          </div>
        </Panel>
      </div>
    </ScreenFrame>
  )
}
