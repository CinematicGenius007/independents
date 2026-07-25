import { AVATAR_COLORS, LIMITS } from '../shared/types'
import { Avatar, Panel, SketchButton } from '../design'
import { bevelClass, FOCUS_RING } from '../design/utils'
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
          <div className={`flex flex-col items-center justify-center gap-3 bg-chrome p-5 ${bevelClass({ tone: 'chrome', size: 'sm' })}`}>
            <Avatar avatar={props.avatar} color={props.color} size={112} label={`${props.nickname || 'Your'} avatar`} />
            {props.restored && (
              <span className={`pixel-heading bg-gold-lo px-3 py-1 text-[8px] leading-[16px] text-gold-hi ${bevelClass({ tone: 'gold', size: 'sm' })}`}>
                Welcome back!
              </span>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-2 font-semibold text-text">
              What should we call you?
              <input
                autoFocus
                className={inputClassName}
                maxLength={LIMITS.maxNicknameLength}
                value={props.nickname}
                placeholder="Your nickname"
                onChange={(event) => props.onNicknameChange(event.target.value)}
              />
              <span className="self-end font-mono text-xs font-normal text-text-muted">
                {props.nickname.length}/{LIMITS.maxNicknameLength}
              </span>
            </label>

            <fieldset>
              <legend className="pixel-heading mb-2 text-[8px] leading-[16px] text-text-muted">Choose a sprite</legend>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    className={`bg-chrome-panel p-1 ${FOCUS_RING} ${
                      props.avatar === avatar
                        ? `${bevelClass({ tone: 'gold', pressed: true })} outline outline-[2px] outline-offset-2 outline-[color:var(--color-gold)]`
                        : bevelClass({ tone: 'chrome' })
                    }`}
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
              <legend className="pixel-heading mb-2 text-[8px] leading-[16px] text-text-muted">Pick your ink</legend>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Choose color ${color}`}
                    aria-pressed={props.color === color}
                    className={`h-9 w-9 border-2 border-[color:var(--color-chrome-lo)] ${FOCUS_RING} ${
                      props.color === color ? 'outline outline-[2px] outline-offset-2 outline-[color:var(--color-gold)]' : ''
                    }`}
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
