/**
 * Headless playtest.
 *
 * The game is now about *choosing* evidence, so the question is whether choosing
 * well is different from choosing at random. Two questioners are simulated: a
 * greedy one that always asks whatever cuts the hypothesis space most, and a
 * random one. If they need the same number of questions, the choice is not a
 * decision and the game has no spine.
 *
 * Run with: pnpm tsx scripts/playtest.ts [seedsPerTier]
 */
import { createStudy, canAnswer, survivors, type Study } from '../src/engine/study'
import { hypothesisCount, TIERS, type TierId } from '../src/engine/tiers'
import type { Scene } from '../src/engine/scene'
import { createRng } from '../src/engine/rng'

const perTier = Number(process.argv[2] ?? 20)
const tiers: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

function randomQuestioner(study: Study, seed: number): number {
  const rng = createRng(seed)
  const pool = rng.shuffle(study.rack)
  const asked: Scene[] = []
  for (const scene of pool) {
    if (canAnswer(study, asked)) break
    asked.push(scene)
  }
  return asked.length
}

/** Bits of grammar the first question removes, when chosen greedily. */
function firstQuestionBits(study: Study): number {
  const before = survivors(study, []).length
  let best = before
  for (const scene of study.rack) {
    const left = survivors(study, [scene]).length
    if (left < best) best = left
  }
  return Math.log2(before / Math.max(1, best))
}

console.log('tier            grammars   after gifts   par   random   best first question')
for (const tier of tiers) {
  let survivorsAfterGifts = 0
  let par = 0
  let random = 0
  let bits = 0

  for (let i = 0; i < perTier; i += 1) {
    const study = createStudy(`PLAYTEST-${i}`, tier)
    survivorsAfterGifts += survivors(study, []).length
    par += study.par
    random += randomQuestioner(study, i + 1)
    bits += firstQuestionBits(study)
  }

  const mean = (total: number) => (total / perTier).toFixed(1)
  console.log(
    [
      TIERS[tier].label.padEnd(14),
      `${hypothesisCount(TIERS[tier])}`.padStart(8),
      mean(survivorsAfterGifts).padStart(13),
      mean(par).padStart(5),
      mean(random).padStart(8),
      `${(bits / perTier).toFixed(2)} bits`.padStart(20),
    ].join(' '),
  )
}
