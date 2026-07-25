import type { Player } from '../shared/types'
import { Avatar, Panel, ProgressBar, SketchButton, NoteCard } from '../design'
import { ScreenFrame } from './ScreenFrame'

export interface StandingView {
  player: Player
  score: number
  pointsGained?: number
}

export interface RoundSummaryScreenProps {
  round: number
  totalRounds: number
  word: string
  cancelled?: boolean
  standings: StandingView[]
  secondsUntilNext?: number
  isHost?: boolean
  onContinue?: () => void
  onLeave: () => void
}

export function RoundSummaryScreen(props: RoundSummaryScreenProps) {
  const lastRound = props.round >= props.totalRounds
  return (
    <ScreenFrame
      eyebrow={`Round ${props.round} of ${props.totalRounds}`}
      title={props.cancelled ? 'Turn cancelled' : "Pencils down!"}
      subtitle={props.cancelled ? 'The drawer left before the word could be revealed.' : <>The word was <strong className="text-ink">{props.word}</strong>.</>}
      actions={<SketchButton variant="danger" size="sm" onClick={props.onLeave}>Leave</SketchButton>}
    >
      <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-[1fr_0.8fr]">
        <Panel title="Standings">
          <ol className="space-y-3">
            {[...props.standings].sort((a, b) => b.score - a.score).map(({ player, score, pointsGained }, index) => (
              <li key={player.id} className="flex items-center gap-3 border-b-2 border-dashed border-ink-ghost pb-2 last:border-0">
                <span className="w-6 font-[family-name:var(--font-display)] text-2xl">{index + 1}</span>
                <Avatar avatar={player.avatar} color={player.color} size={40} label={player.nickname} />
                <span className="min-w-0 flex-1 truncate font-semibold">{player.nickname}</span>
                {pointsGained != null && pointsGained > 0 && <span className="rounded-full bg-accent-wash px-2 py-1 font-mono text-xs">+{pointsGained}</span>}
                <span className="font-mono font-semibold">{score}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <NoteCard tone="accent" title={lastRound ? 'Final scores next' : 'Next page'}>
          <p className="mb-4 text-sm text-ink-soft">
            {props.secondsUntilNext != null ? `Continuing in ${props.secondsUntilNext} seconds…` : 'Waiting for the host…'}
          </p>
          {props.secondsUntilNext != null && (
            <ProgressBar accessibleLabel="Time until next turn" value={(props.secondsUntilNext / 5) * 100} />
          )}
          {props.isHost && props.onContinue && <SketchButton className="mt-5 w-full" onClick={props.onContinue}>{lastRound ? 'See results' : 'Next turn'}</SketchButton>}
        </NoteCard>
      </div>
    </ScreenFrame>
  )
}

export interface ResultsScreenProps {
  standings: StandingView[]
  selfId: string
  isHost: boolean
  onPlayAgain: () => void
  onHome: () => void
  onStats: () => void
}

export function ResultsScreen(props: ResultsScreenProps) {
  const ordered = [...props.standings].sort((a, b) => b.score - a.score)
  const winner = ordered[0]
  return (
    <ScreenFrame eyebrow="Game over" title="The final scribble" subtitle="The page is full and the points are counted.">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
        {winner && (
          <Panel tone="accent" className="flex flex-col items-center py-7 text-center">
            <span className="text-4xl" aria-hidden>★</span>
            <Avatar avatar={winner.player.avatar} color={winner.player.color} size={92} label={winner.player.nickname} />
            <h2 className="font-[family-name:var(--font-display)] text-3xl">{winner.player.nickname} wins!</h2>
            <p className="font-mono text-lg">{winner.score.toLocaleString()} points</p>
          </Panel>
        )}
        <ol className="grid gap-3">
          {ordered.map(({ player, score }, index) => (
            <li key={player.id} className={`flex items-center gap-3 rounded-doodle border-[3px] border-ink px-4 py-3 shadow-ink-sm ${player.id === props.selfId ? 'bg-accent-wash' : 'bg-paper-white'}`}>
              <span className="w-8 font-[family-name:var(--font-display)] text-2xl">#{index + 1}</span>
              <Avatar avatar={player.avatar} color={player.color} size={42} />
              <span className="min-w-0 flex-1 truncate font-semibold">{player.nickname}{player.id === props.selfId ? ' (you)' : ''}</span>
              <span className="font-mono font-bold">{score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {props.isHost && <SketchButton size="lg" onClick={props.onPlayAgain}>Play again</SketchButton>}
          <SketchButton variant="ghost" size="lg" onClick={props.onStats}>View stats</SketchButton>
          <SketchButton variant="ghost" size="lg" onClick={props.onHome}>Home</SketchButton>
        </div>
      </div>
    </ScreenFrame>
  )
}
