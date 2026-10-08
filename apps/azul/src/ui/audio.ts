/**
 * The sound of glazed ceramic, synthesised.
 *
 * Nothing here is a sample. This app ships no assets and loads nothing from
 * anywhere, so every sound is built out of an oscillator and a burst of noise
 * at the moment it is needed. That constraint suits the material: a fired tile
 * is a short, hard, bright transient with a little pitched body behind it, and
 * that is almost exactly what a filtered noise burst plus a decaying sine is.
 *
 * The rules of the house:
 *
 * - **No sound before a click.** The context is created on the first gesture,
 *   which browsers require anyway, and which means the first thing anyone
 *   hears is the answer to something they did.
 * - **Pitch carries meaning.** A tile scoring seven rings higher than one
 *   scoring one, so the firing is audible as a shape and not as a rattle.
 * - **Quiet by default.** Everything sits under a master gain low enough to
 *   live behind a conversation, and the toggle is in the masthead.
 */

const STORAGE_KEY = 'azulejo:sound'

let context: AudioContext | null = null
let master: GainNode | null = null
let enabled = read()

function read(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function soundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(next: boolean): void {
  enabled = next
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  }
  if (next) void ensure()?.resume()
}

/** The audio context, made on demand. Null when sound is off or unavailable. */
function ensure(): AudioContext | null {
  if (!enabled) return null
  if (context) {
    // A context made outside a gesture, or paused by the browser, stays
    // suspended and silent until somebody resumes it.
    if (context.state === 'suspended') void context.resume().catch(() => {})
    return context
  }
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  master = context.createGain()
  master.gain.value = 0.34
  master.connect(context.destination)
  return context
}

/**
 * Browsers keep audio silent until the page has had a real gesture, and a
 * context created before one stays suspended. Sounds here often start from
 * the network — a bot's move, a guest arriving — so the first click, tap or key
 * press anywhere builds the context and resumes it, whatever it was aimed at.
 */
function unlockOnGesture(): void {
  if (typeof window === 'undefined') return
  const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'] as const
  const unlock = () => {
    const ctx = ensure()
    if (!ctx) return
    // iOS only counts a context as unlocked once something has been played
    // inside the gesture; a one-sample silence does it.
    try {
      const silence = ctx.createBufferSource()
      silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      silence.connect(ctx.destination)
      silence.start(0)
    } catch {
      // nothing to unlock with
    }
    void ctx.resume().then(
      () => {
        if (ctx.state === 'running') events.forEach(e => window.removeEventListener(e, unlock, true))
      },
      () => {},
    )
  }
  events.forEach(e => window.addEventListener(e, unlock, { capture: true, passive: true }))
  // A tab that was in the background comes back with its context suspended.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context?.state === 'suspended') void context.resume().catch(() => {})
  })
}
unlockOnGesture()

/** A short burst of white noise — the strike of one hard thing on another. */
function noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Decaying noise, so the burst has a shape rather than a wall.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  return source
}

interface Strike {
  /** Centre of the noise band, in hertz. The material's brightness. */
  band: number
  /** Pitched body under the strike. Omit for a pure click. */
  tone?: number
  /** Seconds. */
  length: number
  gain: number
  /** Waveform of the body. */
  shape?: OscillatorType
}

function strike(at: number, { band, tone, length, gain, shape = 'sine' }: Strike): void {
  const ctx = ensure()
  if (!ctx || !master) return
  const start = ctx.currentTime + at

  const burst = noise(ctx, length)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = band
  filter.Q.value = 5
  const clickGain = ctx.createGain()
  clickGain.gain.setValueAtTime(gain, start)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  burst.connect(filter).connect(clickGain).connect(master)
  burst.start(start)
  burst.stop(start + length)

  if (tone) {
    const osc = ctx.createOscillator()
    osc.type = shape
    osc.frequency.setValueAtTime(tone, start)
    const body = ctx.createGain()
    body.gain.setValueAtTime(0.0001, start)
    body.gain.exponentialRampToValueAtTime(gain * 0.8, start + 0.006)
    body.gain.exponentialRampToValueAtTime(0.0001, start + length * 2.2)
    osc.connect(body).connect(master)
    osc.start(start)
    osc.stop(start + length * 2.4)
  }
}

/**
 * A pentatonic ladder, so a run of tiles scoring more and more sounds like it
 * is going somewhere instead of like a drawer of cutlery.
 */
const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

export type Cue =
  /** A handful lifted off a display. */
  | 'pick'
  /** Tiles laid on a pattern line. */
  | 'place'
  /** Tiles that would not fit, landing on the floor. */
  | 'floor'
  /** Your turn has come round. */
  | 'turn'
  /** The game is over. */
  | 'finish'

export function play(cue: Cue): void {
  if (!enabled) return
  switch (cue) {
    case 'pick':
      strike(0, { band: 3400, length: 0.03, gain: 0.28 })
      return
    case 'place':
      strike(0, { band: 2100, tone: 540, length: 0.05, gain: 0.34 })
      return
    case 'floor':
      strike(0, { band: 700, tone: 150, length: 0.09, gain: 0.4, shape: 'triangle' })
      return
    case 'turn':
      strike(0, { band: 2600, tone: 659.25, length: 0.05, gain: 0.2 })
      strike(0.12, { band: 2600, tone: 880, length: 0.06, gain: 0.22 })
      return
    case 'finish':
      ;[523.25, 659.25, 880, 1318.51].forEach((tone, i) => {
        strike(i * 0.13, { band: 2400, tone, length: 0.09, gain: 0.26 })
      })
      return
  }
}

/** One tile reaching the wall, pitched by what it just scored. */
export function playScore(points: number): void {
  if (!enabled) return
  const tone = LADDER[Math.min(LADDER.length - 1, Math.max(0, points - 1))]
  strike(0, { band: 3000, tone, length: 0.055, gain: 0.3 })
  // A second, quieter voice a fifth up gives the ping some glaze on it.
  strike(0.015, { band: 4200, tone: tone * 1.5, length: 0.04, gain: 0.12 })
}

/**
 * One point arriving on the score track. Quiet, because there are many of
 * them, and stepping up the ladder with `step` so a tile worth six sounds like
 * six things adding up rather than one thing six times.
 */
export function playPoint(step: number): void {
  if (!enabled) return
  const tone = LADDER[Math.min(LADDER.length - 1, Math.max(0, step))]
  strike(0, { band: 3600, tone: tone * 2, length: 0.03, gain: 0.11 })
}

/** One point the floor takes back: low and short. */
export function playDebit(): void {
  if (!enabled) return
  strike(0, { band: 600, tone: 196, length: 0.05, gain: 0.16, shape: 'triangle' })
}
