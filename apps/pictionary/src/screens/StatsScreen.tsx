import { CATEGORY_LABELS, type GameHistoryEntry, type PlayerProfile, type PlayerStats } from '../shared/types'
import { Avatar, Panel, ProgressBar, SketchButton, NoteCard } from '../design'
import { ScreenFrame } from './ScreenFrame'

export interface StatsScreenProps {
  profile: PlayerProfile
  stats: PlayerStats
  history: GameHistoryEntry[]
  importing?: boolean
  exporting?: boolean
  onBack: () => void
  onExport?: () => void
  onImport?: () => void
  onReset?: () => void
}

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <NoteCard>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </NoteCard>
  )
}

export function StatsScreen(props: StatsScreenProps) {
  const averageGuessSeconds = props.stats.guessCount > 0 ? props.stats.totalGuessTimeMs / props.stats.guessCount / 1000 : 0
  const guessRate = props.stats.wordsDrawn > 0 ? Math.min(100, (props.stats.wordsGuessed / props.stats.wordsDrawn) * 100) : 0

  return (
    <ScreenFrame
      eyebrow="Local notebook"
      title={`${props.profile.nickname}'s stats`}
      subtitle="Stored only in this browser — your friends never receive this history."
      actions={<SketchButton variant="ghost" onClick={props.onBack}>Back</SketchButton>}
    >
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Panel tone="accent" className="h-fit text-center">
          <Avatar avatar={props.profile.avatar} color={props.profile.color} size={104} label={props.profile.nickname} />
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">{props.profile.nickname}</p>
          <p className="font-mono text-sm text-ink-soft">Rating {props.stats.rating}</p>
          <ProgressBar className="mt-5 text-left" label="Guess ratio" value={guessRate} tone="ok" />
        </Panel>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Games" value={props.stats.gamesPlayed} />
            <StatCard label="Guessed" value={props.stats.wordsGuessed} />
            <StatCard label="Drawn" value={props.stats.wordsDrawn} />
            <StatCard label="Best streak" value={props.stats.bestStreak} />
            <StatCard label="Avg. guess" value={props.stats.guessCount ? `${averageGuessSeconds.toFixed(1)}s` : '—'} />
            <StatCard label="Favorite" value={props.stats.favoriteCategory ? CATEGORY_LABELS[props.stats.favoriteCategory] : '—'} />
          </div>

          <Panel title="Recent pages" className="mt-7">
            {props.history.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <caption className="sr-only">Recent game history</caption>
                  <thead className="border-b-2 border-ink text-xs uppercase tracking-wide text-ink-faint">
                    <tr><th scope="col" className="pb-2">Word</th><th scope="col" className="pb-2">Role</th><th scope="col" className="pb-2">Score</th><th scope="col" className="pb-2">Played</th></tr>
                  </thead>
                  <tbody>
                    {props.history.map((entry) => (
                      <tr key={`${entry.gameId}-${entry.timestamp}-${entry.word}`} className="border-b border-dashed border-ink-ghost last:border-0">
                        <td className="py-2 font-semibold">{entry.word}</td>
                        <td className="py-2 capitalize">{entry.role}</td>
                        <td className="py-2 font-mono">{entry.score}</td>
                        <td className="py-2 text-ink-soft">{new Date(entry.timestamp).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-6 text-center text-sm italic text-ink-faint">Your first finished game will appear here.</p>}
          </Panel>

          {(props.onExport || props.onImport || props.onReset) && (
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {props.onImport && <SketchButton variant="ghost" loading={props.importing} onClick={props.onImport}>Import backup</SketchButton>}
              {props.onExport && <SketchButton variant="ghost" loading={props.exporting} onClick={props.onExport}>Export backup</SketchButton>}
              {props.onReset && <SketchButton variant="danger" onClick={props.onReset}>Reset stats</SketchButton>}
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  )
}
