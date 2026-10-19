import { checkInk, presetFor, resolveInk, type Intensity, type Legend, type RoleInk } from './palette'
import { buildRedaction, decoyMark, isBarred, lift, type RedactionConfig, type RedactionMap } from './redaction'
import { randomSeedText } from './rng'
import { candidates, checkWord, hardModeViolations, isWin, resolveGuess, type Guess, type Lexicon, type Mark } from './rules'
import { answersOfLength, type WordList } from './words'

/**
 * A case in progress.
 *
 * The board keeps two versions of every turn: `marks`, which is the truth, and
 * `shown`, which is what the solver is allowed to see. Nothing else in the
 * engine is allowed to read `marks` while a game is live, and the test suite
 * greps the state to keep it that way. The two only converge at the end, when
 * the bars retract.
 *
 * Note what the win does *not* depend on. It is `guess === answer`, decided
 * from the truth, so a case is winnable even on a row where the generator has
 * barred everything it is allowed to. The chrome announces it; the grid is
 * under no obligation to explain.
 */

export type Posture = 'open' | 'sealed' | 'vault' | 'reveal'
export type ShownMark = Mark | 'barred'

/** Off, counting up, or counting down to a loss. */
export type ClockMode = 'off' | 'up' | 'down'

export interface GameConfig {
  readonly seed: string
  readonly length: number
  readonly rows: number
  readonly hard: boolean
  readonly intensity: Intensity
  /**
   * Three colours that override the preset's.
   *
   * `intensity` is the shorthand; this is the whole instrument. The roles stay
   * exact, shifted and absent — what the setter changes is which colour each one
   * wears, and whether the meanings are shuffled on top of that.
   */
  readonly ink?: RoleInk
  readonly scramble: boolean
  readonly legend: Legend
  readonly redaction: RedactionConfig
  readonly lifts: number
  readonly hints: number
  readonly clock: ClockMode
  /** Minutes allowed when the clock counts down. */
  readonly minutes: number
  /** Whether the keyboard carries used-letter heat or stays clean. */
  readonly keyHeat: boolean
  readonly lexicon: Lexicon
  readonly posture: Posture
}

export interface Turn {
  readonly word: string
  readonly marks: readonly Mark[]
}

export type Status = 'playing' | 'won' | 'lost'

export interface GameState {
  readonly config: GameConfig
  readonly answer: string
  /** role -> colour, after any shuffling. The only palette the board is shown in. */
  readonly ink: RoleInk
  readonly map: RedactionMap
  readonly turns: readonly Turn[]
  readonly lifted: readonly string[]
  readonly liftsLeft: number
  /** Positions whose letter the setter gave away, one per free letter spent. */
  readonly hinted: readonly number[]
  readonly hintsLeft: number
  readonly status: Status
  /** One or more looks at the answer. Permanent and unremovable once taken. */
  readonly peeks: number
  readonly nonce: string
}

export const DEFAULT_CONFIG: GameConfig = {
  seed: 'CASE-1',
  length: 6,
  rows: 6,
  hard: false,
  intensity: 'clear',
  scramble: false,
  legend: 'example',
  redaction: { mode: 'pattern', pattern: { kind: 'leading', count: 4, fromRow: 3 } },
  lifts: 2,
  hints: 0,
  clock: 'off',
  minutes: 5,
  keyHeat: true,
  lexicon: 'strict',
  posture: 'open',
}

export function configFor(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

export function newGame(config: GameConfig, answer: string, nonce = randomSeedText()): GameState {
  const word = answer.trim().toLowerCase()
  if (word.length !== config.length) {
    throw new Error(`answer is ${word.length} letters, the case is ${config.length}`)
  }

  const preset = presetFor(config.intensity)
  const source = config.ink ?? preset.ink
  const check = checkInk(source, { scramble: config.scramble, legend: config.legend, seed: config.seed })
  if (!check.ok) {
    throw new Error(`this link cannot be built: ${check.problems.map((problem) => problem.message).join('; ')}`)
  }

  return {
    config,
    answer: word,
    ink: resolveInk(source, config.scramble, config.seed),
    map: buildRedaction(config.redaction, config.length, config.rows, config.seed),
    turns: [],
    lifted: [],
    liftsLeft: config.lifts,
    hinted: [],
    hintsLeft: config.hints,
    status: 'playing',
    peeks: 0,
    nonce,
  }
}

/** What is on screen for one row: the truth, minus anything the map withholds. */
export function visibleMarks(state: GameState, row: number): ShownMark[] {
  const turn = state.turns[row]
  if (!turn) return []
  if (state.peeks > 0) return [...turn.marks]

  return turn.marks.map((mark, cell) => {
    if (state.lifted.includes(`${row}:${cell}`)) return mark
    if (!isBarred(state.map, row, cell)) return mark
    return state.map.decoy ? decoyMark(state.config.seed, row, cell, mark) : 'barred'
  })
}

export function trueMarks(state: GameState, row: number): readonly Mark[] {
  return state.turns[row]?.marks ?? []
}

export function history(state: GameState): Guess[] {
  return state.turns.map((turn) => ({ word: turn.word, marks: turn.marks }))
}

/** Everything the solver can still believe. Answers only: the dictionary is not
 * what you are choosing between. */
export function remaining(state: GameState): string[] {
  return candidates(answersOfLength(state.config.length), history(state))
}

export interface SubmitResult {
  readonly state: GameState
  readonly problem?: string
}

export function submit(state: GameState, guess: string, list: WordList): SubmitResult {
  if (state.status !== 'playing') return { state, problem: 'this puzzle is closed' }

  const problem = checkWord(guess, state.config.length, state.config.lexicon, list)
  if (problem) return { state, problem: problem.message }

  const word = guess.trim().toLowerCase()
  if (state.config.hard) {
    const violations = hardModeViolations(history(state), word)
    if (violations.length > 0) return { state, problem: violations[0] }
  }

  const marks = resolveGuess(state.answer, word)
  const turns = [...state.turns, { word, marks }]
  const won = isWin(marks)
  const lost = !won && turns.length >= state.config.rows

  return {
    state: { ...state, turns, status: won ? 'won' : lost ? 'lost' : 'playing' },
  }
}

export interface LiftOutcome {
  readonly state: GameState
  readonly problem?: string
}

export function spendLift(state: GameState, row: number, cell: number): LiftOutcome {
  if (state.liftsLeft <= 0) return { state, problem: 'no lifts left' }
  const result = lift(state.map, row, cell)
  if (!result.changed) return { state, problem: 'that cell is not barred' }
  return {
    state: {
      ...state,
      map: result.map,
      lifted: [...state.lifted, `${row}:${cell}`],
      liftsLeft: state.liftsLeft - 1,
    },
  }
}

/** Looking at the answer is allowed, and it is recorded. */
export function peek(state: GameState): GameState {
  if (state.peeks > 0) return state
  return { ...state, peeks: state.peeks + 1 }
}

export interface HintOutcome {
  readonly state: GameState
  readonly problem?: string
}

/**
 * Spending a free letter.
 *
 * The setter grants a number of them; the solver spends one to be told the
 * letter at a position. It is a position rather than a letter because a letter
 * the board already contains is usually guessable and a position usually is not,
 * and it is worth less than a lift — a lift shows you heat you were owed, a free
 * letter shows you something you were not.
 */
export function spendHint(state: GameState, cell: number): HintOutcome {
  if (state.status !== 'playing') return { state, problem: 'this puzzle is closed' }
  if (state.hintsLeft <= 0) return { state, problem: 'no free letters left' }
  if (cell < 0 || cell >= state.config.length) return { state, problem: 'that is off the board' }
  if (state.hinted.includes(cell)) return { state, problem: 'that letter is already known' }
  return { state: { ...state, hinted: [...state.hinted, cell], hintsLeft: state.hintsLeft - 1 } }
}

/**
 * The letters the solver has been given, position by position.
 *
 * This reads the answer, which is the one place outside `visibleMarks` that is
 * allowed to — and only for positions a free letter has been spent on, which the
 * solver is entitled to know.
 */
export function knownLetters(state: GameState): (string | null)[] {
  return Array.from({ length: state.config.length }, (_, cell) =>
    state.hinted.includes(cell) ? state.answer[cell] : null,
  )
}

export function reveal(state: GameState): GameState {
  return { ...state, peeks: Math.max(1, state.peeks) }
}

/**
 * The clock ran out.
 *
 * A countdown is the one aid that can end a puzzle by itself, so it is a state
 * transition rather than a decoration: the solver loses, having used fewer rows
 * than they were given, and the sheet says why.
 */
export function expire(state: GameState): GameState {
  if (state.status !== 'playing' || state.config.clock !== 'down') return state
  return { ...state, status: 'lost' }
}

/** Seconds the clock shows, from the moment the puzzle was first opened. */
export function clockSeconds(state: GameState, elapsed: number): number {
  return state.config.clock === 'down' ? Math.max(0, state.config.minutes * 60 - elapsed) : elapsed
}

export function scoreSheet(state: GameState): string {
  const head = `HUSHWORD ${state.config.seed} · ${state.status === 'won' ? `SOLVED IN ${state.turns.length} OF ${state.config.rows}` : `LOST, ${state.config.rows} OF ${state.config.rows}`}`
  const lines = state.turns.map((turn) =>
    turn.marks.map((mark) => (mark === 'exact' ? 'X' : mark === 'shifted' ? 'O' : '.')).join(''),
  )
  const barred = state.map.barred.some((line) => line.some(Boolean)) ? `\n${state.map.mode.toUpperCase()} · ${state.map.visible ? 'MAP SHOWN' : 'MAP WITHHELD'}` : ''
  return [head, ...lines].join('\n') + barred
}
