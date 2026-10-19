import { readCost, type Legend } from './palette'
import { decoyMark, type RedactionMap } from './redaction'
import { createRng, hashSeed } from './rng'
import { resolveGuess, type Mark } from './rules'

/**
 * How hard a case actually is.
 *
 * Not a label somebody typed. A greedy max-entropy player is run against the
 * case and the guesses it needs are counted, so "moderate, about four" is a
 * measurement rather than a mood. The player is deterministic, so two people
 * rating the same link get the same number.
 *
 * Three things make this a model of a player rather than a model of a solver:
 *
 * 1. It narrows its beliefs among the *answers* and probes among the *guesses*,
 *    which is the position a person is in — the dictionary is what you may type,
 *    not what you are choosing between.
 * 2. It reasons only from what it is *shown*. A barred cell tells it nothing, so
 *    a redacted row partitions its beliefs far more coarsely, and the cost of the
 *    redaction falls out as a measurement instead of a guess.
 * 3. A decoyed cell is a lie, and the honest thing a careful player does with a
 *    lie it cannot detect is treat it as noise. So decoyed cells are modelled as
 *    uninformative. The *deception* is not modelled, only the information loss —
 *    which is why the number for a decoyed map is the same as for a barred one.
 *
 * The remaining approximation is the probe cap. Evaluating every guess against
 * every survivor is quadratic per turn, so the probe set is a deterministic
 * sample. That is the only place this number is not exact, and it is stated here
 * rather than buried.
 */

const PROBE_LIMIT = 60

export type VisibleMark = Mark | 'barred'

/** A row's mask: true where the solver is shown nothing. */
export function maskFor(map: RedactionMap | undefined, row: number): readonly boolean[] | null {
  if (!map || map.mode === 'off') return null
  return map.barred[row] ?? null
}

/** What the solver is shown for a probe, without needing the real answer. */
export function visibleSignature(
  candidate: string,
  probe: string,
  mask: readonly boolean[] | null,
  options: { readonly seed: string; readonly row: number; readonly decoy: boolean; readonly trusting: boolean } = {
    seed: '',
    row: 0,
    decoy: false,
    trusting: false,
  },
): string {
  const marks = resolveGuess(candidate, probe)
  return marks
    .map((mark, index) => {
      const masked = mask?.[index] === true
      // A barred cell says nothing, unless the board lies and the solver believes
      // it — in which case it says something that is not true.
      if (masked && !(options.trusting && options.decoy)) return 'b'
      return mark === 'exact' ? 'e' : mark === 'shifted' ? 's' : 'a'
    })
    .join('')
}

/**
 * What the board actually said.
 *
 * With decoys on, a barred cell reports a mark that is deliberately wrong, and
 * the wrongness is derived from the *answer* — which is why it cannot be modelled
 * as a function of the candidate, and why a solver who believes it narrows to a
 * smaller and wrong set rather than to nothing.
 */
export function observedSignature(
  answer: string,
  probe: string,
  mask: readonly boolean[] | null,
  options: { readonly seed: string; readonly row: number; readonly decoy: boolean; readonly trusting: boolean },
): string {
  const marks = resolveGuess(answer, probe)
  return marks
    .map((mark, index) => {
      const masked = mask?.[index] === true
      if (masked && options.decoy) {
        if (!options.trusting) return 'b'
        const wrong = decoyMark(options.seed, options.row, index, mark)
        return wrong === 'exact' ? 'e' : wrong === 'shifted' ? 's' : 'a'
      }
      if (masked) return 'b'
      return mark === 'exact' ? 'e' : mark === 'shifted' ? 's' : 'a'
    })
    .join('')
}

function probeSet(remaining: readonly string[]): string[] {
  if (remaining.length <= PROBE_LIMIT) return [...remaining]
  return createRng(hashSeed(`probe:${remaining.length}`)).shuffle(remaining).slice(0, PROBE_LIMIT)
}

/**
 * What the solver is looking through.
 *
 * `trusting` is the whole point of a decoy. A cautious player treats a barred
 * cell as silence; a trusting one treats it as a fact, and a decoy is a fact that
 * is not true, so the trusting player narrows to a smaller and wrong set — or to
 * nothing, which is how they find out.
 */
export interface Lens {
  readonly seed: string
  readonly row: number
  readonly decoy: boolean
  readonly trusting: boolean
}

/** The guess that splits the survivors into the most even piles, as shown. */
export function bestGuess(
  remaining: readonly string[],
  guesses: readonly string[],
  mask: readonly boolean[] | null,
  lens: Lens,
): string {
  if (remaining.length === 0) throw new Error('no candidates left')
  if (remaining.length === 1) return remaining[0]

  const fromSurvivors = probeSet(remaining)
  const fromDictionary = remaining.length > 40 ? probeSet(guesses) : []
  const probes = [...new Set([...fromSurvivors, ...fromDictionary])]

  let best = probes[0]
  let bestScore = -1

  for (const probe of probes) {
    const buckets = new Map<string, number>()
    for (const word of remaining) {
      const key = visibleSignature(word, probe, mask, lens)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    let score = 0
    for (const count of buckets.values()) {
      const share = count / remaining.length
      score -= share * Math.log2(share)
    }
    if (score > bestScore) {
      bestScore = score
      best = probe
    }
  }

  return best
}

export interface SolveOptions {
  readonly answers: readonly string[]
  readonly guesses: readonly string[]
  readonly answer: string
  readonly rows: number
  readonly map?: RedactionMap
  readonly seed?: string
  /** A solver who takes the board at its word, even when it lies. */
  readonly trusting?: boolean
}

export interface SolveResult {
  readonly guesses: number
  readonly won: boolean
  readonly trail: readonly string[]
  /** Beliefs surviving after each turn. The shape of the narrowing. */
  readonly surviving: readonly number[]
  /** Rows a trusting solver lost to a board that contradicted itself. */
  readonly wasted: number
}

export function solve(options: SolveOptions): SolveResult {
  const { answers, guesses, answer, rows, map } = options
  const trusting = options.trusting === true
  const seed = options.seed ?? ''
  let remaining = [...answers]
  const trail: string[] = []
  const surviving: number[] = []
  let wasted = 0

  for (let turn = 0; turn < rows; turn += 1) {
    const mask = maskFor(map, turn)
    const lens: Lens = { seed, row: turn, decoy: map?.decoy === true, trusting }
    const guess = remaining.length === 0 ? answers[0] : bestGuess(remaining, guesses, mask, lens)
    const marks = resolveGuess(answer, guess)
    const observed = observedSignature(answer, guess, mask, lens)
    const next = remaining.filter((candidate) => visibleSignature(candidate, guess, mask, lens) === observed)
    trail.push(guess)

    if (trusting && next.length === 0) {
      // The board said something no answer could have said, and they noticed.
      // The row is spent, and nothing is learned from it.
      wasted += 1
    } else {
      remaining = next
    }
    surviving.push(remaining.length)

    if (marks.every((mark) => mark === 'exact')) {
      return { guesses: turn + 1, won: true, trail, surviving, wasted }
    }
  }

  return { guesses: rows, won: false, trail, surviving, wasted }
}

export interface PoolMeasurement {
  readonly played: number
  readonly solved: number
  readonly failed: number
  readonly failRate: number
  readonly averageGuesses: number
  /** Index i is the number of answers solved in exactly i+1 guesses. */
  readonly histogram: readonly number[]
}

export interface MeasureOptions {
  readonly answers: readonly string[]
  readonly guesses: readonly string[]
  readonly rows: number
  readonly sampleSize: number
  readonly seed: string
  readonly map?: RedactionMap
  /** Measure the player who takes the board at its word. */
  readonly trusting?: boolean
}

/** Play a whole sample of answers and report what happened. */
export function measurePool(options: MeasureOptions): PoolMeasurement {
  const { answers, guesses, rows, sampleSize, seed, map, trusting } = options
  const sample = createRng(hashSeed(`sample:${seed}`))
    .shuffle(answers)
    .slice(0, Math.min(sampleSize, answers.length))

  const histogram = new Array<number>(rows).fill(0)
  let solved = 0
  let totalGuesses = 0

  for (const answer of sample) {
    const result = solve({ answers, guesses, answer, rows, map, seed, trusting })
    if (result.won) {
      solved += 1
      histogram[result.guesses - 1] += 1
      totalGuesses += result.guesses
    }
  }

  return {
    played: sample.length,
    solved,
    failed: sample.length - solved,
    failRate: sample.length === 0 ? 0 : (sample.length - solved) / sample.length,
    averageGuesses: solved === 0 ? 0 : totalGuesses / solved,
    histogram,
  }
}

export interface CaseRating {
  /** Guesses the reference player needed, or null if it did not finish. */
  readonly measured: number | null
  readonly won: boolean
  /** Guesses the same case takes with nothing withheld. Measured, not assumed. */
  readonly openMeasured: number | null
  /** What the redaction costs, in guesses. A measurement. */
  readonly redactionCost: number
  /** What a crowded untaught palette costs, in guesses. A model; see palette.ts. */
  readonly inkReadCost: number
  readonly effective: number
  readonly verdict: 'gentle' | 'moderate' | 'sharp' | 'brutal'
  /** What believing a lying board costs, in guesses. Zero when it does not lie. */
  readonly deceptionCost: number
  readonly wastedRows: number
}

export interface RateOptions {
  readonly answers: readonly string[]
  readonly guesses: readonly string[]
  readonly answer: string
  readonly rows: number
  readonly map?: RedactionMap
  readonly seed?: string
  readonly minSeparation: number
  readonly legend: Legend
}

function verdictFor(guesses: number, rows: number): CaseRating['verdict'] {
  const used = guesses / rows
  if (used <= 0.5) return 'gentle'
  if (used <= 0.72) return 'moderate'
  if (used <= 0.95) return 'sharp'
  return 'brutal'
}

export function rateCase(options: RateOptions): CaseRating {
  const { answers, guesses, answer, rows, map, seed, minSeparation, legend } = options

  const withMap = solve({ answers, guesses, answer, rows, map, seed })
  const without = map && map.mode !== 'off' ? solve({ answers, guesses, answer, rows, seed }) : withMap
  // A decoy is only a decoy if somebody believes it. This is the same board seen
  // by a player who takes it at its word.
  const trusting = map?.decoy ? solve({ answers, guesses, answer, rows, map, seed, trusting: true }) : withMap

  const measured = withMap.won ? withMap.guesses : null
  const openMeasured = without.won ? without.guesses : null
  const redactionCost = measured !== null && openMeasured !== null ? measured - openMeasured : 0
  const ink = readCost(minSeparation, legend)
  const effective = (measured ?? rows + 1) + ink

  return {
    measured,
    won: withMap.won,
    openMeasured,
    redactionCost,
    /** What believing the board costs, in guesses. Measured, not assumed. */
    deceptionCost: trusting.guesses - withMap.guesses,
    /** Rows the trusting player lost to a board that contradicted itself. */
    wastedRows: trusting.wasted,
    inkReadCost: ink,
    effective,
    verdict: verdictFor(effective, rows),
  }
}
