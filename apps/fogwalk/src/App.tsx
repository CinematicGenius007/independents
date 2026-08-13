import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Direction } from './engine/board'
import { dailySeed, generateLevel, TIERS, type Tier } from './engine/generate'
import { randomSeedText } from './engine/rng'
import { hintFrom } from './engine/solver'
import { isCleanWin, movesLeft, reduce, startGame } from './game/state'
import { BoardView } from './ui/BoardView'
import { Controls } from './ui/Controls'

const TIER_ORDER: Tier[] = ['calm', 'brisk', 'severe']

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  k: 'up',
  h: 'left',
  j: 'down',
  l: 'right',
}

function readHash(): { seed: string; tier: Tier } | null {
  const match = /^#play=([A-Za-z0-9-]+):(calm|brisk|severe)$/.exec(window.location.hash)
  return match ? { seed: match[1].toUpperCase(), tier: match[2] as Tier } : null
}

export default function App() {
  const opening = useMemo(() => readHash() ?? { seed: dailySeed(), tier: 'calm' as Tier }, [])
  const [tier, setTier] = useState<Tier>(opening.tier)
  const [seed, setSeed] = useState(opening.seed)
  const [seedDraft, setSeedDraft] = useState(opening.seed)
  const [hint, setHint] = useState<Direction | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [shaking, setShaking] = useState(false)

  const level = useMemo(() => generateLevel(seed, tier), [seed, tier])
  const [state, dispatch] = useReducer(reduce, level, startGame)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    dispatch({ type: 'load', level })
    setHint(null)
    window.location.hash = `play=${level.seed}:${level.tier}`
  }, [level])

  useEffect(() => {
    if (!state.refusal) return
    setShaking(true)
    const timer = window.setTimeout(() => setShaking(false), 280)
    return () => window.clearTimeout(timer)
  }, [state.refusal, state.moves.length])

  const move = useCallback((direction: Direction) => {
    setHint(null)
    dispatch({ type: 'move', direction })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const direction = KEY_MAP[event.key] ?? KEY_MAP[event.key.toLowerCase()]
      if (direction) {
        event.preventDefault()
        move(direction)
        return
      }
      if (event.key === 'z' || event.key === 'Backspace') dispatch({ type: 'undo' })
      if (event.key === 'r') dispatch({ type: 'reset' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    touchStart.current = null
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left')
    else move(dy > 0 ? 'down' : 'up')
  }

  const askHint = () => {
    setHintBusy(true)
    // Let the button paint its busy state before the search blocks the thread.
    window.setTimeout(() => {
      setHint(hintFrom(level.board, state.belief))
      setHintBusy(false)
    }, 16)
  }

  const newSeed = () => {
    const next = randomSeedText()
    setSeed(next)
    setSeedDraft(next)
  }

  const submitSeed = (event: React.FormEvent) => {
    event.preventDefault()
    const cleaned = seedDraft.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    if (cleaned) setSeed(cleaned)
  }

  const left = movesLeft(state)
  const spec = TIERS[tier]

  return (
    <main
      className="app"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="masthead">
        <h1 className="wordmark">
          Fog<span>walk</span>
        </h1>
        <p className="tagline">
          You do not know where you are. Every possible you moves at once — herd them into one.
        </p>
      </header>

      <div className="rack">
        {TIER_ORDER.map((option) => (
          <button
            key={option}
            className="chip"
            aria-pressed={option === tier}
            onClick={() => setTier(option)}
            title={TIERS[option].blurb}
          >
            {TIERS[option].label}
          </button>
        ))}
        <form className="seed-form" onSubmit={submitSeed}>
          <input
            value={seedDraft}
            onChange={(event) => setSeedDraft(event.target.value)}
            aria-label="Level seed"
            spellCheck={false}
          />
          <button className="chip" type="button" onClick={newSeed}>
            New
          </button>
        </form>
      </div>

      <section className="readout">
        <div>
          <span className="label">Worlds left</span>
          <span className="value">{state.belief.length}</span>
        </div>
        <div>
          <span className="label">Moves left</span>
          <span className={`value${left <= 1 ? ' low' : ''}`}>{left}</span>
        </div>
        <div>
          <span className="label">Par</span>
          <span className="value">{level.solution.length}</span>
        </div>
      </section>

      <BoardView
        board={level.board}
        belief={state.belief}
        doomed={Boolean(state.refusal)}
        shaking={shaking}
      />

      <Controls
        onMove={move}
        onUndo={() => dispatch({ type: 'undo' })}
        onReset={() => dispatch({ type: 'reset' })}
        onHint={askHint}
        canUndo={state.history.length > 0}
        hintBusy={hintBusy}
      />

      <p className={`message${state.refusal ? ' alarm' : ''}${state.status === 'won' ? ' win' : ''}`} role="status">
        {state.status === 'won' ? (
          <>
            <strong>One world left, standing on the mark.</strong> {state.moves.length} moves against a par
            of {level.solution.length}.
          </>
        ) : state.status === 'stranded' ? (
          <>
            <strong>Out of moves.</strong> Undo a step or restart — the fog is still solvable.
          </>
        ) : state.refusal ? (
          <>
            <strong>Refused.</strong> Sliding {state.refusal.direction} drops you into a pit in{' '}
            {state.refusal.doomedWorlds} of {state.belief.length} worlds. The attempt still cost a move.
          </>
        ) : hint ? (
          <>
            <strong>Try {hint}.</strong> That is the first move of a shortest plan from here.
          </>
        ) : (
          <>{spec.blurb}</>
        )}
      </p>

      {state.status === 'won' && (
        <section className="finish">
          {isCleanWin(state) && <span className="badge">Clean — solved at par</span>}
          <h2>Seed {level.seed} cleared</h2>
          <div className="rack">
            <button className="chip" onClick={newSeed}>
              Next fog
            </button>
            <button className="chip" onClick={() => dispatch({ type: 'reset' })}>
              Replay this one
            </button>
            <button
              className="chip"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
            >
              Copy link
            </button>
          </div>
        </section>
      )}

      <div className="help">
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: 'var(--ghost)' }} /> a world you might be in
          </span>
          <span>
            <i className="swatch" style={{ background: 'var(--mud)' }} /> mud stops a slide
          </span>
          <span>
            <i className="swatch" style={{ background: 'var(--danger)' }} /> a pit, fatal in any world
          </span>
          <span>
            <i className="swatch" style={{ border: '1px dashed var(--goal)' }} /> the mark
          </span>
        </div>
        <p>
          Arrow keys, <b>WASD</b>, or swipe to slide. <b>Z</b> undoes, <b>R</b> restarts. You slide until
          something stops you, so walls and mud are what fold two possible yous into one. A move that would
          be fatal in even one world is refused — but the attempt still costs a step, so probe carefully.
        </p>
      </div>
    </main>
  )
}
