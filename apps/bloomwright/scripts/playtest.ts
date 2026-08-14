/**
 * Headless playtest.
 *
 * The question a rule-writing puzzle has to answer is whether the score is a
 * *guide*. If a one-symbol edit toward the answer never raises the number, the
 * player is guessing blind; if a dumb hill climber finds the answer in a few
 * hundred edits, the level is not a puzzle. This measures both.
 *
 * Run with: pnpm tsx scripts/playtest.ts [restarts]
 */
import { LEVELS } from '../src/engine/levels'
import { expand, type Grammar } from '../src/engine/lsystem'
import { compare } from '../src/engine/match'
import { walk } from '../src/engine/turtle'

const EDIT_ALPHABET = [...'FG+-[]AB']
const restarts = Number(process.argv[2] ?? 6)

const draw = (grammar: Grammar) => walk(expand(grammar).text, grammar.angle).segments

function score(candidate: Grammar, target: Grammar): number {
  return compare(draw(candidate), draw(target)).score
}

function mutate(grammar: Grammar, random: () => number): Grammar {
  const keys = Object.keys(grammar.rules)
  const key = keys[Math.floor(random() * keys.length)]
  const rule = grammar.rules[key]
  const roll = random()

  let next = rule
  if (roll < 0.35 && rule.length > 1) {
    const at = Math.floor(random() * rule.length)
    next = rule.slice(0, at) + rule.slice(at + 1)
  } else if (roll < 0.7 && rule.length < 18) {
    const at = Math.floor(random() * (rule.length + 1))
    next = rule.slice(0, at) + EDIT_ALPHABET[Math.floor(random() * EDIT_ALPHABET.length)] + rule.slice(at)
  } else if (rule.length > 0) {
    const at = Math.floor(random() * rule.length)
    next = rule.slice(0, at) + EDIT_ALPHABET[Math.floor(random() * EDIT_ALPHABET.length)] + rule.slice(at + 1)
  }

  const angle =
    random() < 0.2 ? Math.min(120, Math.max(5, grammar.angle + (random() < 0.5 ? -1 : 1) * 5)) : grammar.angle

  return { ...grammar, rules: { ...grammar.rules, [key]: next }, angle }
}

/** A player with no insight: try a random edit, keep it if the number goes up. */
function hillClimb(level: (typeof LEVELS)[number], seed: number, budget = 400) {
  let state = 1103515245 * seed + 12345
  const random = () => {
    state = (1103515245 * state + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }

  let current = level.start
  let best = score(current, level.hidden)
  for (let i = 0; i < budget; i += 1) {
    const candidate = mutate(current, random)
    if (expand(candidate).truncated) continue
    const value = score(candidate, level.hidden)
    if (value >= best) {
      best = value
      current = candidate
    }
    if (best >= level.threshold) return { solved: true, steps: i + 1, best }
  }
  return { solved: false, steps: budget, best }
}

/** Does moving one symbol closer to the answer show up in the score? */
function gradientCheck(level: (typeof LEVELS)[number]): number {
  const keys = Object.keys(level.hidden.rules)
  let informative = 0
  let tried = 0

  for (const key of keys) {
    const answer = level.hidden.rules[key]
    for (let at = 0; at < answer.length; at += 1) {
      const damaged = { ...level.hidden.rules, [key]: answer.slice(0, at) + answer.slice(at + 1) }
      const worse = score({ ...level.hidden, rules: damaged }, level.hidden)
      tried += 1
      if (worse < 0.995) informative += 1
    }
  }

  return tried === 0 ? 0 : informative / tried
}

console.log('level      start  gradient  climber  median steps  best found')
for (const level of LEVELS) {
  const startScore = score(level.start, level.hidden)
  const gradient = gradientCheck(level)

  const runs = Array.from({ length: restarts }, (_, i) => hillClimb(level, i + 1))
  const solved = runs.filter((run) => run.solved)
  const steps = solved.map((run) => run.steps).sort((a, b) => a - b)
  const median = steps.length === 0 ? '—' : `${steps[Math.floor(steps.length / 2)]}`
  const bestFound = Math.max(...runs.map((run) => run.best))

  console.log(
    [
      level.id.padEnd(9),
      startScore.toFixed(2).padStart(5),
      `${Math.round(gradient * 100)}%`.padStart(8),
      `${solved.length}/${restarts}`.padStart(8),
      median.padStart(13),
      bestFound.toFixed(2).padStart(11),
    ].join(' '),
  )
}
