import { CanvasSurface, CanvasTools, type CanvasOp, type CanvasState, type ToolSettings } from '../canvas'
import { Panel, SketchButton, Ticker, TornCard } from '../design'
import type { PracticePrompt, PracticeState } from '../practice'
import { CATEGORY_LABELS } from '../shared/types'
import { ScreenFrame } from './ScreenFrame'

export interface PracticeScreenProps {
  state: PracticeState
  prompt: PracticePrompt | null
  secondsRemaining: number
  canvasState: CanvasState
  settings: ToolSettings
  authorId: string
  onCanvasCommit: (op: CanvasOp) => void
  onSettingsChange: (settings: ToolSettings) => void
  onUndo: () => void
  onClear: () => void
  onNextPrompt: () => void
  onExit: () => void
}

export function PracticeScreen(props: PracticeScreenProps) {
  if (props.state.phase === 'complete') {
    const guessed = props.state.results.filter((result) => result.guessed).length
    return (
      <ScreenFrame
        eyebrow="Practice complete"
        title="That sketchbook is full!"
        subtitle="Your local practice session is complete. No room or internet connection was needed."
        actions={<SketchButton onClick={props.onExit}>Done</SketchButton>}
      >
        <div className="mx-auto grid w-full max-w-3xl gap-5 sm:grid-cols-3">
          <TornCard wobbleKey="practice-drawn">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Words drawn</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl">{props.state.results.length}</p>
          </TornCard>
          <TornCard wobbleKey="practice-guessed">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Bot guessed</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl">{guessed}</p>
          </TornCard>
          <TornCard wobbleKey="practice-missed">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Bot missed</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl">{props.state.results.length - guessed}</p>
          </TornCard>
          <Panel title="Your practice pages" wobble={false} className="sm:col-span-3">
            <ol className="grid gap-2 sm:grid-cols-2">
              {props.state.results.map((result, index) => (
                <li key={`${index}:${result.category}:${result.word}`} className="flex justify-between gap-3 border-b border-dashed border-ink-ghost py-2">
                  <span className="font-semibold">{result.word}</span>
                  <span className={result.guessed ? 'text-ok' : 'text-ink-faint'}>{result.guessed ? 'Guessed' : 'Missed'}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </ScreenFrame>
    )
  }

  const reviewing = props.state.phase === 'review'
  const result = reviewing ? props.state.results[props.state.results.length - 1] : null
  const isLastPrompt = props.state.turnIndex === props.state.prompts.length - 1

  return (
    <ScreenFrame
      compact
      eyebrow={`Solo practice · ${props.state.turnIndex + 1} of ${props.state.prompts.length}`}
      title={reviewing ? (result?.guessed ? 'The bot guessed it!' : 'Time is up!') : 'Draw the prompt'}
      subtitle={reviewing ? 'Take a look at your sketch, then turn the page when you are ready.' : 'A lightweight offline guesser is watching your doodle.'}
      actions={<SketchButton variant="ghost" size="sm" onClick={props.onExit}>Exit practice</SketchButton>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-doodle border-[3px] border-ink bg-accent-wash px-4 py-2 shadow-ink-sm">
          <span className="mr-2 text-xs font-bold uppercase tracking-wide text-ink-faint">
            {props.prompt ? CATEGORY_LABELS[props.prompt.category] : 'Prompt'}
          </span>
          <strong className="font-[family-name:var(--font-display)] text-2xl">{props.prompt?.word}</strong>
        </div>
        {!reviewing && <Ticker secondsRemaining={props.secondsRemaining} totalSeconds={props.state.turnDurationMs / 1000} />}
        {reviewing && (
          <SketchButton onClick={props.onNextPrompt}>{isLastPrompt ? 'Finish practice' : 'Next prompt'}</SketchButton>
        )}
      </div>

      {/*
        The canvas is a fixed 8:5 aspect driven by its width, so on short
        viewports it pushed the pencil case below the fold — the drawer had to
        scroll away from their own drawing to change tools. Capping the width by
        the space actually left over (`100dvh` minus the header, the ticker row,
        the pencil case and the gaps) keeps the whole screen reachable, and
        gives back the full 64rem once the viewport is tall enough to afford it.
      */}
      <div className="mx-auto flex w-full max-w-[min(64rem,calc((100dvh-24.5rem)*1.6))] flex-1 flex-col gap-4">
        <CanvasSurface
          ops={props.canvasState.ops}
          nextId={props.canvasState.nextId}
          authorId={props.authorId}
          settings={props.settings}
          disabled={reviewing}
          onCommit={props.onCanvasCommit}
        />
        <Panel title="Pencil case" wobble={false}>
          <CanvasTools
            value={props.settings}
            disabled={reviewing}
            onChange={props.onSettingsChange}
            onUndo={props.onUndo}
            onClear={props.onClear}
          />
        </Panel>
      </div>
    </ScreenFrame>
  )
}
