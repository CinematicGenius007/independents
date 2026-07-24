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
        <button type="button" className={`flex items-center gap-2 rounded-full px-2 py-1 hover:bg-paper-deep ${FOCUS_RING}`} onClick={props.onEditProfile}>
          <Avatar avatar={props.profile.avatar} color={props.profile.color} size={38} label={props.profile.nickname} />
          <span className="font-[family-name:var(--font-display)]">{props.profile.nickname}</span>
        </button>
      }
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel tone="accent" wobbleKey="home-create" className="p-7 sm:p-10">
          <div className="max-w-xl">
            <span className="text-5xl" aria-hidden>✎</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl">Start a fresh page</h2>
            <p className="mb-7 mt-3 text-ink-soft">Create a room, share its short link, and invite up to seven friends.</p>
            <SketchButton size="lg" onClick={props.onCreateRoom}>Create a room</SketchButton>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <TornCard title="Join your friends" wobbleKey="home-join">
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
            {props.error && <p role="alert" className="mt-3 text-sm font-semibold text-alert-deep">{props.error}</p>}
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
