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
import { bevelClass, ditherStyle } from './utils'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="pixel-heading text-[24px] leading-[24px] text-gold-hi">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="pixel-heading text-[8px] leading-[16px] text-text-muted">{label}</span>
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
      { id: `t${Date.now()}`, message: 'A fresh scroll unrolls top-right.', tone: 'paper' },
    ])

  return (
    <Paper className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-14 px-6 py-10 pb-24">
        <header>
          <p className="pixel-heading text-[8px] leading-[16px] text-text-muted">Phase P1</p>
          <h1 className="pixel-heading text-[32px] leading-[32px] text-gold-hi">Design Kit</h1>
          <p className="mt-3 max-w-2xl text-text-muted">
            Every component in every state — cozy pixel-art RPG HUD. Dark navy-green chrome with hard
            bevels around a bright canvas, warm parchment for alerts, one saturated gold, red reserved
            for urgency.
          </p>
        </header>

        <Section title="Window chrome" description="The segmented title bar: bevelled end-caps bracketing a label plate.">
          <Panel title="Lobby" tone="paper" className="w-56">
            <p className="text-sm text-text-muted">Chrome tone, default.</p>
          </Panel>
          <Panel title="Your turn" tone="accent" className="w-56">
            <p className="text-sm text-text-muted">Gold accent tone.</p>
          </Panel>
          <Panel title="Time's up" tone="alert" className="w-56">
            <p className="text-sm text-text-muted">Red alert tone.</p>
          </Panel>
        </Section>

        <Section title="Parchment scroll" description="The reference's cream alert panel, with bevelled wooden dowel ends — used for Toast and turn-end reveals.">
          <TornCard title="Round 2 recap" className="w-64">
            <p className="text-sm text-ink-soft">Ada scored 90 points this round.</p>
          </TornCard>
          <TornCard title="Alert variant" tone="alert" className="w-64">
            <p className="text-sm text-ink-soft">Time ran out before anyone guessed.</p>
          </TornCard>
        </Section>

        <Section title="SketchButton" description="Primary (gold), ghost, danger — each in sm/md/lg, plus disabled and loading. Presses in on click.">
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
            <SketchButton loading>Connecting</SketchButton>
          </Row>
        </Section>

        <Section title="IconButton &amp; toolbar tiles" description="Square bevelled chrome tiles. Active state: pressed-in bevel plus a gold outline ring.">
          <Row label="Default / active / disabled">
            <IconButton
              label="Pencil"
              icon={
                <svg viewBox="0 0 16 16" width={18} height={18} shapeRendering="crispEdges">
                  <path d="M3 13 L3 11 L10 4 L12 6 L5 13 Z M9 5 L11 7" stroke="currentColor" strokeWidth={1.5} fill="none" />
                </svg>
              }
            />
            <IconButton
              label="Eraser"
              active
              icon={
                <svg viewBox="0 0 16 16" width={18} height={18} shapeRendering="crispEdges">
                  <rect x={3} y={7} width={10} height={5} fill="none" stroke="currentColor" strokeWidth={1.5} />
                </svg>
              }
            />
            <IconButton
              label="Fill"
              disabled
              icon={
                <svg viewBox="0 0 16 16" width={18} height={18} shapeRendering="crispEdges">
                  <path d="M3 8 L8 3 L13 8 L8 13 Z" fill="none" stroke="currentColor" strokeWidth={1.5} />
                </svg>
              }
            />
          </Row>
          <Row label="Sizes">
            <IconButton label="Small" size="sm" icon={<span className="pixel-heading text-[16px] leading-[16px]">S</span>} />
            <IconButton label="Medium" size="md" icon={<span className="pixel-heading text-[16px] leading-[16px]">M</span>} />
            <IconButton label="Large" size="lg" icon={<span className="pixel-heading text-[24px] leading-[24px]">L</span>} />
          </Row>
        </Section>

        <Section title="SpeechBubble" description="A dialogue plate with a stepped pixel tail — right angles only. Tails: left, right, bottom, none.">
          <SpeechBubble tail="left"><span className="text-sm">Left tail</span></SpeechBubble>
          <SpeechBubble tail="right" tone="accent"><span className="text-sm">Right tail, accent</span></SpeechBubble>
          <SpeechBubble tail="bottom" tone="alert"><span className="text-sm">Bottom tail, alert</span></SpeechBubble>
          <SpeechBubble tail="none"><span className="text-sm">No tail</span></SpeechBubble>
        </Section>

        <Section title="Avatar" description="8 distinct pixel-grid faces, index 0-7, tinted with the player's color, each with its own bevel frame.">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Avatar avatar={i} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} size={52} label={`Avatar ${i}`} />
              <span className="font-mono text-xs text-text-muted">{i}</span>
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

        <Section title="Slider &amp; Toggle" description="Recessed pixel groove with a square gold thumb; a square checkbox that presses in when checked.">
          <div className="w-64">
            <Slider label="Turn time" value={sliderValue} min={30} max={180} step={10} onChange={setSliderValue} formatValue={(v) => `${v}s`} />
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

        <Section title="Modal" description="Window frame with a red close box. Focus-trapped, closes on Esc or backdrop click, restores focus on close.">
          <SketchButton onClick={() => setModalOpen(true)}>Open modal</SketchButton>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Leave the room?">
            <p className="mb-4 text-sm text-text-muted">
              You&rsquo;ll lose your spot in the current game. Everyone else keeps playing.
            </p>
            <div className="flex justify-end gap-2">
              <SketchButton variant="ghost" onClick={() => setModalOpen(false)}>Cancel</SketchButton>
              <SketchButton variant="danger" onClick={() => setModalOpen(false)}>Leave</SketchButton>
            </div>
          </Modal>
        </Section>

        <Section title="Toast / ToastHost" description="Transient parchment scrolls, top-right, aria-live polite.">
          <SketchButton variant="ghost" onClick={addToast}>Fire a toast</SketchButton>
          <ToastHost toasts={toasts} onDismiss={dismissToast} />
        </Section>

        <Section title="Ticker" description="Turn countdown. Pulses red under 10 seconds — this one is live.">
          <Ticker secondsRemaining={seconds} totalSeconds={80} />
          <Ticker secondsRemaining={7} totalSeconds={80} />
          <Ticker secondsRemaining={0} totalSeconds={80} />
        </Section>

        <Section title="WordBlanks" description="Token-length blanks with letter reveal, and full reveal at turn end. Plain monospace — never the chrome pixel face.">
          <div className="flex w-full flex-col gap-4">
            <WordBlanks shape={[3, 5]} revealed={{}} />
            <WordBlanks shape={[3, 5]} revealed={{ 0: 'I', 4: 'C' }} />
            <WordBlanks shape={[3, 5]} revealed={{}} full="ICE CREAM" />
          </div>
        </Section>

        <Section title="ProgressBar" description="Recessed groove fill with a dithered leading edge instead of a smooth gradient.">
          <div className="flex w-full flex-col gap-4">
            <ProgressBar value={20} tone="accent" label="Round 1 of 3" />
            <ProgressBar value={65} tone="ok" label="4 of 6 guessed" />
            <ProgressBar value={92} tone="alert" label="Time remaining" />
          </div>
        </Section>

        <Section title="Spinner" description="Pixel-dot loading ring, in context.">
          <Spinner />
          <Spinner size={44} />
          <SketchButton loading>Connecting</SketchButton>
        </Section>

        <Section title="Dither texture" description="Ordered 2x2 checkerboard dither, tiled — stands in for smooth gradient shading everywhere in the kit.">
          <div className={`h-20 w-40 bg-chrome-panel ${bevelClass({ tone: 'chrome' })}`} style={{ ...ditherStyle({ colorB: 'rgb(255 255 255 / 0.08)', cell: 3 }), backgroundColor: 'var(--color-chrome-panel)' }} />
          <div className={`h-20 w-40 bg-parchment ${bevelClass({ tone: 'parchment' })}`} style={{ ...ditherStyle({ colorB: 'rgb(0 0 0 / 0.08)', cell: 3 }), backgroundColor: 'var(--color-parchment)' }} />
        </Section>

        <Section title="Canvas contrast" description="The one deliberate rule: the drawing canvas stays bright and near-white, wrapped in a parchment mat, inside dark chrome.">
          <div className={`p-3 ${bevelClass({ tone: 'chrome' })} bg-chrome-panel`}>
            <div className={`p-3 bg-parchment ${bevelClass({ tone: 'parchment' })}`}>
              <div className={`h-24 w-56 bg-canvas ${bevelClass({ tone: 'canvas' })}`} />
            </div>
          </div>
        </Section>
      </div>
    </Paper>
  )
}
