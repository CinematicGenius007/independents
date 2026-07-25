import type { PlayerProfile } from '../shared/types'
import { Avatar, Panel, SketchButton, TornCard } from '../design'
import { FOCUS_RING } from '../design/utils'
import { ScreenFrame, inputClassName } from './ScreenFrame'

export interface HomeScreenProps {
  profile: PlayerProfile
  roomCode: string
  joining?: boolean
  error?: string
  onRoomCodeChange: (code: string) => void
  onCreateRoom: () => void
  onJoinRoom: () => void
  onPractice: () => void
  onStats: () => void
  onEditProfile: () => void
}

export function HomeScreen(props: HomeScreenProps) {
  const canJoin = props.roomCode.trim().length > 0
  return (
    <ScreenFrame
      eyebrow="A tiny drawing game"
      title="Scribble Club"
      subtitle="Draw badly. Guess brilliantly. Everything happens peer-to-peer."
      actions={
        <button type="button" className={`flex items-center gap-2 bg-chrome-panel px-2 py-1 hover:bg-chrome ${FOCUS_RING}`} onClick={props.onEditProfile}>
          <Avatar avatar={props.profile.avatar} color={props.profile.color} size={38} label={props.profile.nickname} />
          <span className="text-sm font-semibold text-text">{props.profile.nickname}</span>
        </button>
      }
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel tone="accent" className="p-7 sm:p-10">
          <div className="max-w-xl">
            {/* Drawn as rects on a 16x16 grid rather than a text glyph: the
                unicode pencil renders as a thin antialiased outline in the
                system font, which is the one thing this skin can't have. */}
            <svg viewBox="0 0 16 16" width={48} height={48} shapeRendering="crispEdges" aria-hidden>
              <rect x={5} y={1} width={6} height={3} fill="var(--color-red)" />
              <rect x={5} y={4} width={6} height={1} fill="var(--color-stone-hi)" />
              <rect x={5} y={5} width={6} height={6} fill="var(--color-gold)" />
              <rect x={5} y={5} width={2} height={6} fill="var(--color-gold-hi)" />
              <rect x={5} y={11} width={6} height={1} fill="var(--color-parchment)" />
              <rect x={6} y={12} width={4} height={1} fill="var(--color-parchment)" />
              <rect x={7} y={13} width={2} height={2} fill="var(--color-ink)" />
            </svg>
            <h2 className="pixel-heading mt-3 text-[32px] leading-[32px] text-gold-hi">Start a fresh page</h2>
            <p className="mb-7 mt-3 text-text-muted">Create a room, share its short link, and invite up to seven friends.</p>
            <SketchButton size="lg" onClick={props.onCreateRoom}>Create a room</SketchButton>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <TornCard title="Join your friends">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                if (canJoin) props.onJoinRoom()
              }}
            >
              <label className="sr-only" htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                className={`${inputClassName} font-mono uppercase tracking-[0.25em]`}
                value={props.roomCode}
                placeholder="ROOM CODE"
                autoCapitalize="characters"
                onChange={(event) => props.onRoomCodeChange(event.target.value.toUpperCase())}
              />
              <SketchButton type="submit" disabled={!canJoin} loading={props.joining}>Join</SketchButton>
            </form>
            {props.error && <p role="alert" className="mt-3 text-sm font-semibold text-red-deep">{props.error}</p>}
          </TornCard>

          <div className="grid grid-cols-2 gap-3">
            <SketchButton variant="ghost" onClick={props.onPractice}>Practice solo</SketchButton>
            <SketchButton variant="ghost" onClick={props.onStats}>My stats</SketchButton>
          </div>
        </div>
      </div>
    </ScreenFrame>
  )
}
