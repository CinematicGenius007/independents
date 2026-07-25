import { useEffect, useState, type ReactNode } from 'react'
import { AVATAR_COLORS, type Player } from '../shared/types'
import { Paper } from './Paper'
import { Panel } from './Panel'
import { TornCard } from './TornCard'
import { SketchButton } from './SketchButton'
import { IconButton } from './IconButton'
import { SpeechBubble } from './SpeechBubble'
import { Avatar } from './Avatar'
import { PlayerChip, type PlayerChipStatus } from './PlayerChip'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { Modal } from './Modal'
import { ToastHost, type ToastData } from './Toast'
import { Ticker } from './Ticker'
import { WordBlanks } from './WordBlanks'
import { ProgressBar } from './ProgressBar'
import { Spinner } from './Spinner'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'p-1',
    nickname: 'Ada',
    color: AVATAR_COLORS[0],
    avatar: 0,
    connection: 'connected',
    joinedAt: Date.now(),
    ...overrides,
  }
}

const DEMO_PLAYERS: Array<{ player: Player; score: number; status: PlayerChipStatus }> = [
  { player: makePlayer({ id: 'p1', nickname: 'Ada Lovelace', color: AVATAR_COLORS[0], avatar: 0 }), score: 340, status: 'drawing' },
  { player: makePlayer({ id: 'p2', nickname: 'Grace', color: AVATAR_COLORS[2], avatar: 1 }), score: 210, status: 'guessed' },
  { player: makePlayer({ id: 'p3', nickname: 'Turing', color: AVATAR_COLORS[3], avatar: 2, connection: 'unstable' }), score: 90, status: 'idle' },
  {
    player: makePlayer({ id: 'p4', nickname: 'Hopper', color: AVATAR_COLORS[4], avatar: 3, connection: 'disconnected' }),
    score: 60,
    status: 'idle',
  },
]

/** Renders every design-system component in every state. Mounted at `#kit`. */
export function Showcase() {
  const [sliderValue, setSliderValue] = useState(80)
  const [toggleA, setToggleA] = useState(true)
  const [toggleB, setToggleB] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([
    { id: 't1', message: 'Ada guessed the word!', tone: 'accent' },
    { id: 't2', message: "Time's almost up!", tone: 'alert' },
  ])
  const [seconds, setSeconds] = useState(72)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 0 ? 80 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const dismissToast = (id: string) => setToasts((list) => list.filter((t) => t.id !== id))
  const addToast = () =>
    setToasts((list) => [
      ...list,
      { id: `t${Date.now()}`, message: 'A fresh note lands top-right.', tone: 'paper' },
    ])

  return (
    <Paper className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-14 px-6 py-10 pb-24">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Phase P1</p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl text-ink">Design Kit</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Every component in every state — hand-drawn sketch diorama. Ink on textured paper, one
            saturated yellow, red-orange reserved for urgency.
          </p>
        </header>

        <Section title="Paper &amp; Panel" description="The base surface, plus the bordered ink panel every other surface builds on.">
          <Row label="Tones">
            <Panel title="Lobby" tone="paper" wobbleKey="kit-panel-paper" className="w-56">
              <p className="text-sm text-ink-soft">Paper tone, default.</p>
            </Panel>
            <Panel title="Your turn" tone="accent" wobbleKey="kit-panel-accent" className="w-56">
              <p className="text-sm text-ink-soft">Accent tone.</p>
            </Panel>
            <Panel title="Time's up" tone="alert" wobbleKey="kit-panel-alert" className="w-56">
              <p className="text-sm text-ink-soft">Alert tone.</p>
            </Panel>
          </Row>
          <Row label="Wobble off">
            <Panel title="Perfectly square" wobble={false} className="w-56">
              <p className="text-sm text-ink-soft">No rotation, still hand-drawn corners.</p>
            </Panel>
          </Row>
        </Section>

        <Section title="TornCard" description="Panel variant with a torn bottom edge — deterministic jagged clip-path.">
          <TornCard title="Round 2 recap" wobbleKey="kit-torn-1" className="w-64">
            <p className="text-sm text-ink-soft">Ada scored 90 points this round.</p>
          </TornCard>
          <TornCard title="Alert variant" tone="alert" wobbleKey="kit-torn-2" className="w-64">
            <p className="text-sm text-ink-soft">Time ran out before anyone guessed.</p>
          </TornCard>
        </Section>

        <Section title="SketchButton" description="Primary (yellow-filled), ghost, danger — each in sm/md/lg, plus disabled and loading.">
          <Row label="Primary">
            <SketchButton size="sm">Small</SketchButton>
            <SketchButton size="md">Medium</SketchButton>
            <SketchButton size="lg">Large</SketchButton>
          </Row>
          <Row label="Ghost">
            <SketchButton variant="ghost">Ghost</SketchButton>
          </Row>
          <Row label="Danger">
            <SketchButton variant="danger">Leave room</SketchButton>
          </Row>
          <Row label="States">
            <SketchButton disabled>Disabled</SketchButton>
            <SketchButton loading>Loading</SketchButton>
          </Row>
        </Section>

        <Section title="IconButton" description="Square toolbar buttons. Active state uses the dashed-outline treatment.">
          <Row label="Default / active / disabled">
            <IconButton
              label="Pencil"
              icon={
                <svg viewBox="0 0 24 24" width={18} height={18}>
                  <path d="M4 20 L4 16 L15 5 L19 9 L8 20 Z M13 7 L17 11" stroke="currentColor" strokeWidth={2} fill="none" strokeLinejoin="round" />
                </svg>
              }
            />
            <IconButton
              label="Eraser"
              active
              icon={
                <svg viewBox="0 0 24 24" width={18} height={18}>
                  <rect x="4" y="10" width="16" height="8" rx="2" stroke="currentColor" strokeWidth={2} fill="none" />
                </svg>
              }
            />
            <IconButton
              label="Fill"
              disabled
              icon={
                <svg viewBox="0 0 24 24" width={18} height={18}>
                  <path d="M4 12 L12 4 L20 12 L12 20 Z" stroke="currentColor" strokeWidth={2} fill="none" />
                </svg>
              }
            />
          </Row>
          <Row label="Sizes">
            <IconButton label="Small" size="sm" icon={<span>S</span>} />
            <IconButton label="Medium" size="md" icon={<span>M</span>} />
            <IconButton label="Large" size="lg" icon={<span>L</span>} />
          </Row>
        </Section>

        <Section title="SpeechBubble" description="Tails: left, right, bottom, none.">
          <SpeechBubble tail="left" wobbleKey="kit-bubble-left">
            <span className="text-sm">Left tail</span>
          </SpeechBubble>
          <SpeechBubble tail="right" tone="accent" wobbleKey="kit-bubble-right">
            <span className="text-sm">Right tail, accent</span>
          </SpeechBubble>
          <SpeechBubble tail="bottom" tone="alert" wobbleKey="kit-bubble-bottom">
            <span className="text-sm">Bottom tail, alert</span>
          </SpeechBubble>
          <SpeechBubble tail="none" wobbleKey="kit-bubble-none">
            <span className="text-sm">No tail</span>
          </SpeechBubble>
        </Section>

        <Section title="Avatar" description="8 distinct hand-drawn faces, index 0-7, tinted with the player's color.">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Avatar avatar={i} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} size={52} label={`Avatar ${i}`} />
              <span className="font-mono text-xs text-ink-faint">{i}</span>
            </div>
          ))}
        </Section>

        <Section title="PlayerChip" description="Avatar + nickname + score + status slot. Dims when disconnected.">
          <div className="flex w-full flex-col gap-2.5 sm:max-w-sm">
            {DEMO_PLAYERS.map(({ player, score, status }) => (
              <PlayerChip key={player.id} player={player} score={score} status={status} isSelf={player.id === 'p1'} />
            ))}
          </div>
        </Section>

        <Section title="Slider &amp; Toggle" description="Ink-track range input; hand-drawn checkbox.">
          <div className="w-64">
            <Slider
              label="Turn time"
              value={sliderValue}
              min={30}
              max={180}
              step={10}
              onChange={setSliderValue}
              formatValue={(v) => `${v}s`}
            />
          </div>
          <div className="w-64">
            <Slider label="Disabled" value={45} min={0} max={100} onChange={() => {}} disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Toggle checked={toggleA} onChange={setToggleA} label="Hints enabled" />
            <Toggle checked={toggleB} onChange={setToggleB} label="Custom words only" />
            <Toggle checked disabled onChange={() => {}} label="Disabled, checked" />
          </div>
        </Section>

        <Section title="Modal" description="Focus-trapped, closes on Esc or backdrop click, restores focus on close.">
          <SketchButton onClick={() => setModalOpen(true)}>Open modal</SketchButton>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Leave the room?">
            <p className="mb-4 text-sm text-ink-soft">
              You&rsquo;ll lose your spot in the current game. Everyone else keeps playing.
            </p>
            <div className="flex justify-end gap-2">
              <SketchButton variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </SketchButton>
              <SketchButton variant="danger" onClick={() => setModalOpen(false)}>
                Leave
              </SketchButton>
            </div>
          </Modal>
        </Section>

        <Section title="Toast / ToastHost" description="Transient ink notes, top-right, aria-live polite.">
          <SketchButton variant="ghost" onClick={addToast}>
            Fire a toast
          </SketchButton>
          <ToastHost toasts={toasts} onDismiss={dismissToast} />
        </Section>

        <Section title="Ticker" description="Turn countdown. Alert-orange and pulsing under 10 seconds — this one is live.">
          <Ticker secondsRemaining={seconds} totalSeconds={80} />
          <Ticker secondsRemaining={7} totalSeconds={80} />
          <Ticker secondsRemaining={0} totalSeconds={80} />
        </Section>

        <Section title="WordBlanks" description="Token-length blanks with letter reveal, and full reveal at turn end.">
          <div className="flex w-full flex-col gap-4">
            <WordBlanks shape={[3, 5]} revealed={{}} />
            <WordBlanks shape={[3, 5]} revealed={{ 0: 'I', 4: 'C' }} />
            <WordBlanks shape={[3, 5]} revealed={{}} full="ICE CREAM" />
          </div>
        </Section>

        <Section title="ProgressBar" description="Sketchy fill with a torn leading edge.">
          <div className="flex w-full flex-col gap-4">
            <ProgressBar value={20} tone="accent" label="Round 1 of 3" />
            <ProgressBar value={65} tone="ok" label="4 of 6 guessed" />
            <ProgressBar value={92} tone="alert" label="Time remaining" />
          </div>
        </Section>

        <Section title="Spinner" description="Doodle loading indicator, in context.">
          <Spinner />
          <Spinner size={44} />
          <SketchButton loading>Connecting</SketchButton>
        </Section>
      </div>
    </Paper>
  )
}
