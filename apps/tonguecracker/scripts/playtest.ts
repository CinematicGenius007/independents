/**
 * Headless playtest.
 *
 * The game claims something strong: a player who reads the examples correctly
 * cannot be wrong for a reason the game never showed them. This checks the claim
 * from the player's side rather than the generator's.
 *
 * Three readers are simulated:
 *   - a *word finder*, which only knows that meanings recur, and tries to locate a
 *     spelling for every meaning the test needs by matching where things appear;
 *   - a *perfect reader*, which keeps every grammar consistent with all examples
 *     and checks they all produce the same test sentence;
 *   - a *skimmer*, which reads the first three examples and stops.
 *
 * Run with: pnpm tsx scripts/playtest.ts [seedsPerTier]
 */
import { say, spokenAtoms, type Features, type Language } from '../src/engine/language'
import { generatePuzzle, TIERS, type Puzzle, type TierId } from '../src/engine/puzzle'
import type { Scene } from '../src/engine/scene'

const perTier = Number(process.argv[2] ?? 25)
const tiers: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

function candidates(puzzle: Puzzle): Language[] {
  const { allowed } = puzzle.tier
  const out: Language[] = []
  for (const order of allowed.order)
    for (const adjectives of allowed.adjectives)
      for (const number of allowed.number)
        for (const marking of allowed.case)
          for (const adjAgrees of allowed.adjAgrees)
            for (const verbNumber of allowed.verbNumber) {
              const features: Features = { order, adjectives, number, case: marking, adjAgrees, verbNumber }
              out.push({ ...puzzle.language, features })
            }
  return out
}

function consistent(puzzle: Puzzle, examples: readonly Scene[]): Language[] {
  return candidates(puzzle).filter((candidate) =>
    examples.every(
      (scene) => say(scene, candidate).join(' ') === say(scene, puzzle.language).join(' '),
    ),
  )
}

/** Can each meaning the test needs be pinned to a spelling, just by where it recurs? */
function wordsRecoverable(puzzle: Puzzle): boolean {
  const sentences = puzzle.examples.map((scene) => say(scene, puzzle.language).join(' '))
  const signatureOf = (predicate: (index: number) => boolean) =>
    puzzle.examples.map((_, index) => (predicate(index) ? '1' : '0')).join('')

  const pieces = new Set<string>()
  for (const sentence of sentences) {
    for (const word of sentence.split(' ')) {
      for (let start = 0; start < word.length; start += 1) {
        for (let end = start + 2; end <= word.length; end += 1) pieces.add(word.slice(start, end))
      }
    }
  }

  const options: string[][] = []
  for (const atom of new Set(spokenAtoms(puzzle.test, puzzle.language.features))) {
    const wanted = signatureOf((index) =>
      spokenAtoms(puzzle.examples[index], puzzle.language.features).includes(atom),
    )
    const matches = [...pieces].filter(
      (piece) => signatureOf((index) => sentences[index].includes(piece)) === wanted,
    )
    if (matches.length === 0) return false
    options.push(matches)
  }

  // Every meaning needs its own spelling, so this is an assignment problem: a
  // player is only stuck if no consistent one-to-one reading exists at all.
  const taken = new Set<string>()
  const assign = (index: number): boolean => {
    if (index === options.length) return true
    for (const spelling of options[index]) {
      if (taken.has(spelling)) continue
      taken.add(spelling)
      if (assign(index + 1)) return true
      taken.delete(spelling)
    }
    return false
  }
  return assign(0)
}

function forced(puzzle: Puzzle, examples: readonly Scene[]): boolean {
  const answer = puzzle.answer.join(' ')
  const reading = say(puzzle.reading, puzzle.language).join(' ')
  return consistent(puzzle, examples).every(
    (candidate) =>
      say(puzzle.test, candidate).join(' ') === answer &&
      say(puzzle.reading, candidate).join(' ') === reading,
  )
}

console.log('tier            examples  survivors  words found  forced  skimmer  bank  answer')
for (const tier of tiers) {
  let exampleTotal = 0
  let survivorTotal = 0
  let recoverable = 0
  let forcedCount = 0
  let skimmer = 0
  let bankTotal = 0
  let answerTotal = 0

  for (let i = 0; i < perTier; i += 1) {
    const puzzle = generatePuzzle(`PLAYTEST-${i}`, tier)
    exampleTotal += puzzle.examples.length
    survivorTotal += consistent(puzzle, puzzle.examples).length
    if (wordsRecoverable(puzzle)) recoverable += 1
    if (forced(puzzle, puzzle.examples)) forcedCount += 1
    if (forced(puzzle, puzzle.examples.slice(0, 3))) skimmer += 1
    bankTotal += puzzle.bank.length
    answerTotal += puzzle.answer.length
  }

  const mean = (total: number) => (total / perTier).toFixed(1)
  const pct = (count: number) => `${Math.round((count / perTier) * 100)}%`

  console.log(
    [
      TIERS[tier].label.padEnd(14),
      mean(exampleTotal).padStart(8),
      mean(survivorTotal).padStart(10),
      pct(recoverable).padStart(12),
      pct(forcedCount).padStart(7),
      pct(skimmer).padStart(8),
      mean(bankTotal).padStart(5),
      mean(answerTotal).padStart(7),
    ].join(' '),
  )
}
