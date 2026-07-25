import { AVATAR_COLORS, LIMITS } from '../shared/types'
import { Avatar, Panel, SketchButton } from '../design'
import { FOCUS_RING } from '../design/utils'
import { ScreenFrame, inputClassName } from './ScreenFrame'

export interface OnboardingScreenProps {
  nickname: string
  avatar: number
  color: string
  restored?: boolean
  saving?: boolean
  onNicknameChange: (nickname: string) => void
  onAvatarChange: (avatar: number) => void
  onColorChange: (color: string) => void
  onContinue: () => void
}

export function OnboardingScreen(props: OnboardingScreenProps) {
  const valid = props.nickname.trim().length > 0 && props.nickname.trim().length <= LIMITS.maxNicknameLength

  return (
    <ScreenFrame
      eyebrow="Welcome to"
      title="Scribble Club"
      subtitle="Pick a face for the sketchbook. No account, no password — this stays on your device."
    >
      <Panel className="mx-auto w-full max-w-2xl p-5 sm:p-8">
        <form
          className="grid gap-7 sm:grid-cols-[180px_1fr]"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) props.onContinue()
          }}
        >
          <div className="flex flex-col items-center justify-center gap-3 rounded-doodle bg-paper-deep p-5">
            <Avatar avatar={props.avatar} color={props.color} size={112} label={`${props.nickname || 'Your'} avatar`} />
            {props.restored && <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-semibold">Welcome back!</span>}
          </div>

          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-2 font-semibold">
              What should we call you?
              <input
                autoFocus
                className={inputClassName}
                maxLength={LIMITS.maxNicknameLength}
                value={props.nickname}
                placeholder="Your nickname"
                onChange={(event) => props.onNicknameChange(event.target.value)}
              />
              <span className="self-end font-mono text-xs font-normal text-ink-faint">
                {props.nickname.length}/{LIMITS.maxNicknameLength}
              </span>
            </label>

            <fieldset>
              <legend className="mb-2 font-semibold">Choose a doodle</legend>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    className={`rounded-doodle border-[3px] p-1 ${FOCUS_RING} ${props.avatar === avatar ? 'border-accent-deep bg-accent-wash' : 'border-transparent hover:border-ink-ghost'}`}
                    aria-label={`Choose avatar ${avatar + 1}`}
                    aria-pressed={props.avatar === avatar}
                    onClick={() => props.onAvatarChange(avatar)}
                  >
                    <Avatar avatar={avatar} color={props.color} size={46} />
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-semibold">Pick your ink</legend>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Choose color ${color}`}
                    aria-pressed={props.color === color}
                    className={`h-9 w-9 rounded-full border-[3px] border-ink ${FOCUS_RING} ${props.color === color ? 'outline outline-2 outline-offset-2 outline-accent-deep' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => props.onColorChange(color)}
                  />
                ))}
              </div>
            </fieldset>

            <SketchButton type="submit" size="lg" disabled={!valid} loading={props.saving}>
              Open the sketchbook
            </SketchButton>
          </div>
        </form>
      </Panel>
    </ScreenFrame>
  )
}
