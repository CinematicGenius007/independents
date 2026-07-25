import type { FormEvent, ReactNode } from 'react'
import type { Player } from '../shared/types'
import { Panel, PlayerChip, SketchButton, SpeechBubble, Ticker, WordBlanks } from '../design'
import { bevelClass, FOCUS_RING } from '../design/utils'
import { ScreenFrame, inputClassName } from './ScreenFrame'

export type ChatMessageTone = 'chat' | 'system' | 'success' | 'whisper' | 'masked'

export interface ChatMessageView {
  id: string
  author?: string
  text: string
  tone: ChatMessageTone
}

export interface ScoreboardPlayer {
  player: Player
  score: number
  status?: 'drawing' | 'guessed' | 'disconnected' | 'idle'
}

export interface GameScreenProps {
  round: number
  totalRounds: number
  drawerName: string
  isDrawer: boolean
  secretWord?: string
  wordShape: number[]
  revealed: Record<number, string>
  secondsRemaining: number
  totalSeconds: number
  canvas: ReactNode
  players: ScoreboardPlayer[]
  selfId: string
  messages: ChatMessageView[]
  guess: string
  guessDisabled?: boolean
  chatExpanded: boolean
  onGuessChange: (guess: string) => void
  onSubmitGuess: () => void
  onChatExpandedChange: (expanded: boolean) => void
  onLeave: () => void
}

const messageTone: Record<ChatMessageTone, string> = {
  chat: 'text-text',
  system: 'italic text-text-muted',
  success: 'bg-moss-lo px-2 py-1 font-semibold text-moss-hi',
  whisper: 'bg-chrome px-2 py-1 italic text-text-muted',
  masked: 'italic text-text-muted',
}

export function GameScreen(props: GameScreenProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (props.guess.trim() && !props.guessDisabled) props.onSubmitGuess()
  }

  return (
    <ScreenFrame
      compact
      eyebrow={`Round ${props.round} of ${props.totalRounds}`}
      title={props.isDrawer ? 'Your turn to draw!' : `${props.drawerName} is drawing`}
      actions={<SketchButton variant="danger" size="sm" onClick={props.onLeave}>Leave</SketchButton>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Ticker secondsRemaining={props.secondsRemaining} totalSeconds={props.totalSeconds} />
        {props.isDrawer && props.secretWord ? (
          <SpeechBubble tone="accent" tail="bottom">
            <span className="text-sm text-gold-hi">
              Draw <strong className="pixel-heading text-[24px] leading-[24px]">{props.secretWord}</strong>
            </span>
          </SpeechBubble>
        ) : (
          <WordBlanks shape={props.wordShape} revealed={props.revealed} />
        )}
        <button
          type="button"
          className={`bg-chrome-panel px-3 py-2 text-sm font-semibold text-text lg:hidden ${bevelClass({ tone: 'chrome', size: 'sm' })} ${FOCUS_RING}`}
          aria-expanded={props.chatExpanded}
          onClick={() => props.onChatExpandedChange(!props.chatExpanded)}
        >
          {props.chatExpanded ? 'Hide chat' : `Chat · ${props.messages.length}`}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <Panel title="Scoreboard" className="order-2 h-fit lg:order-1">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {[...props.players].sort((a, b) => b.score - a.score).map(({ player, score, status }) => (
              <PlayerChip key={player.id} player={player} score={score} status={status} isSelf={player.id === props.selfId} />
            ))}
          </div>
        </Panel>

        <section
          className={`order-1 min-h-[45vh] overflow-hidden bg-chrome-panel p-2 lg:order-2 lg:min-h-0 ${bevelClass({ tone: 'chrome' })}`}
          aria-label="Drawing canvas"
        >
          <div className={`h-full bg-parchment p-2 ${bevelClass({ tone: 'parchment' })}`}>{props.canvas}</div>
        </section>

        <Panel title="Guesses" className={`${props.chatExpanded ? 'flex' : 'hidden'} order-3 min-h-72 flex-col lg:flex`}>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Game chat">
            {props.messages.map((message) => (
              <p key={message.id} className={`text-sm ${messageTone[message.tone]}`}>
                {message.author && <strong className="text-text">{message.author}: </strong>}{message.text}
              </p>
            ))}
            {props.messages.length === 0 && <p className="text-sm italic text-text-muted">Guesses will land here.</p>}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={submit}>
            <label className="sr-only" htmlFor="game-guess">Your guess</label>
            <input
              id="game-guess"
              className={`${inputClassName} min-w-0`}
              value={props.guess}
              maxLength={120}
              disabled={props.isDrawer || props.guessDisabled}
              placeholder={props.isDrawer ? 'Drawers cannot guess' : 'Type a guess…'}
              onChange={(event) => props.onGuessChange(event.target.value)}
            />
            <SketchButton type="submit" size="sm" disabled={props.isDrawer || props.guessDisabled || !props.guess.trim()}>Send</SketchButton>
          </form>
        </Panel>
      </div>
    </ScreenFrame>
  )
}
