import type { Player } from '../shared/types'
import { Avatar, Panel, ProgressBar, SketchButton, TornCard } from '../design'
import { bevelClass } from '../design/utils'
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
      subtitle={props.cancelled ? 'The drawer left before the word could be revealed.' : <>The word was <strong className="text-text">{props.word}</strong>.</>}
      actions={<SketchButton variant="danger" size="sm" onClick={props.onLeave}>Leave</SketchButton>}
    >
      <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-[1fr_0.8fr]">
        <Panel title="Standings">
          <ol className="space-y-3">
            {[...props.standings].sort((a, b) => b.score - a.score).map(({ player, score, pointsGained }, index) => (
              <li key={player.id} className="flex items-center gap-3 border-b-2 border-dashed border-[color:var(--color-stone)] pb-2 last:border-0">
                <span className="pixel-heading w-6 text-[16px] leading-[16px] text-text">{index + 1}</span>
                <Avatar avatar={player.avatar} color={player.color} size={40} label={player.nickname} />
                <span className="min-w-0 flex-1 truncate font-semibold text-text">{player.nickname}</span>
                {pointsGained != null && pointsGained > 0 && (
                  <span className={`bg-gold-lo px-2 py-1 font-mono text-xs text-gold-hi ${bevelClass({ tone: 'gold', size: 'sm' })}`}>+{pointsGained}</span>
                )}
                <span className="font-mono font-semibold text-text">{score}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <TornCard tone="accent" title={lastRound ? 'Final scores next' : 'Next page'}>
          <p className="mb-4 text-sm text-ink-soft">
            {props.secondsUntilNext != null ? `Continuing in ${props.secondsUntilNext} seconds…` : 'Waiting for the host…'}
          </p>
          {props.secondsUntilNext != null && (
            <ProgressBar accessibleLabel="Time until next turn" value={(props.secondsUntilNext / 5) * 100} />
          )}
          {props.isHost && props.onContinue && <SketchButton className="mt-5 w-full" onClick={props.onContinue}>{lastRound ? 'See results' : 'Next turn'}</SketchButton>}
        </TornCard>
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
            <h2 className="pixel-heading text-[24px] leading-[24px] text-gold-hi">{winner.player.nickname} wins!</h2>
            <p className="font-mono text-lg text-text">{winner.score.toLocaleString()} points</p>
          </Panel>
        )}
        <ol className="grid gap-3">
          {ordered.map(({ player, score }, index) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 px-4 py-3 ${bevelClass({ tone: 'chrome' })} ${player.id === props.selfId ? 'bg-gold-lo' : 'bg-chrome-panel'}`}
            >
              <span className="pixel-heading w-8 text-[24px] leading-[24px] text-text">#{index + 1}</span>
              <Avatar avatar={player.avatar} color={player.color} size={42} />
              <span className="min-w-0 flex-1 truncate font-semibold text-text">{player.nickname}{player.id === props.selfId ? ' (you)' : ''}</span>
              <span className="font-mono font-bold text-text">{score.toLocaleString()}</span>
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
