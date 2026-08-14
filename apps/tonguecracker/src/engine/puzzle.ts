import {
  makeLexicon,
  nameLanguage,
  say,
  spokenAtoms,
  type AdjectivePlacement,
  type CaseMarking,
  type Features,
  type Language,
  type NumberMarking,
  type Order,
} from './language'
import { createRng, hashSeed, type Rng } from './rng'
import {
  COLORS,
  randomScene,
  SHAPES,
  SIZES,
  twist,
  VERBS,
  vocabularyOf,
  type Color,
  type Scene,
  type Shape,
  type Size,
  type Verb,
} from './scene'

export type TierId = 'order' | 'shapeandshade' | 'many' | 'marked'

export interface Tier {
  readonly id: TierId
  readonly label: string
  readonly blurb: string
  readonly allowed: {
    readonly order: readonly Order[]
    readonly adjectives: readonly AdjectivePlacement[]
    readonly number: readonly NumberMarking[]
    readonly case: readonly CaseMarking[]
    readonly adjAgrees: readonly boolean[]
    readonly verbNumber: readonly boolean[]
  }
  /** Tiers below `many` keep every group singular, so nothing is unmarked. */
  readonly allowPlural: boolean
  readonly examples: number
}

const ORDERS: Order[] = ['SVO', 'SOV', 'VSO']

export const TIERS: Record<TierId, Tier> = {
  order: {
    id: 'order',
    label: 'Word order',
    blurb: 'Three words, one question: which one is doing the chasing?',
    allowed: {
      order: ORDERS,
      adjectives: ['none'],
      number: ['none'],
      case: ['none'],
      adjAgrees: [false],
      verbNumber: [false],
    },
    allowPlural: false,
    examples: 5,
  },
  shapeandshade: {
    id: 'shapeandshade',
    label: 'Describing',
    blurb: 'Now things have colour and size. Which side of the noun do those words take?',
    allowed: {
      order: ORDERS,
      adjectives: ['before', 'after'],
      number: ['none'],
      case: ['none'],
      adjAgrees: [false],
      verbNumber: [false],
    },
    allowPlural: false,
    examples: 6,
  },
  many: {
    id: 'many',
    label: 'One and many',
    blurb: 'Some groups are more than one. The language marks that somewhere.',
    allowed: {
      order: ORDERS,
      adjectives: ['before', 'after'],
      number: ['suffix', 'prefix'],
      case: ['none'],
      adjAgrees: [false],
      verbNumber: [false, true],
    },
    allowPlural: true,
    examples: 8,
  },
  marked: {
    id: 'marked',
    label: 'Marked',
    blurb: 'One of the two participants wears a marker. Work out which, and what copies it.',
    allowed: {
      order: ORDERS,
      adjectives: ['before', 'after'],
      number: ['suffix', 'prefix'],
      case: ['object', 'subject'],
      adjAgrees: [false, true],
      verbNumber: [false, true],
    },
    allowPlural: true,
    examples: 10,
  },
}

export interface Puzzle {
  readonly seed: string
  readonly tier: Tier
  readonly language: Language
  readonly examples: readonly Scene[]
  /** The scene the player has to name, word by word. */
  readonly test: Scene
  /** A second, unseen scene used for the reading question. */
  readonly reading: Scene
  /** Wrong scenes for the comprehension question, in display order with the truth. */
  readonly lineup: readonly Scene[]
  /** Word chips offered for the production question, already shuffled. */
  readonly bank: readonly string[]
  readonly answer: readonly string[]
}

function everyCandidate(tier: Tier, language: Language): Language[] {
  const candidates: Language[] = []
  for (const order of tier.allowed.order) {
    for (const adjectives of tier.allowed.adjectives) {
      for (const number of tier.allowed.number) {
        for (const caseMarking of tier.allowed.case) {
          for (const adjAgrees of tier.allowed.adjAgrees) {
            for (const verbNumber of tier.allowed.verbNumber) {
              const features: Features = {
                order,
                adjectives,
                number,
                case: caseMarking,
                adjAgrees,
                verbNumber,
              }
              candidates.push({ ...language, features })
            }
          }
        }
      }
    }
  }
  return candidates
}

function agrees(a: Language, b: Language, scenes: readonly Scene[]): boolean {
  return scenes.every((scene) => say(scene, a).join(' ') === say(scene, b).join(' '))
}

function singularise(scene: Scene): Scene {
  return {
    ...scene,
    subject: { ...scene.subject, count: 1 },
    object: { ...scene.object, count: 1 },
  }
}

/**
 * Are the words themselves learnable from these examples?
 *
 * A root can only be identified by where it appears. Two meanings that show up in
 * exactly the same examples are indistinguishable no matter how clever the player
 * is, and a meaning that appears once is a guess. Both are rejected here.
 */
export function lexicallyClear(
  examples: readonly Scene[],
  needed: readonly string[],
  features?: Features,
): boolean {
  const mentions = (scene: Scene) =>
    features ? spokenAtoms(scene, features) : vocabularyOf(scene)

  const signatures = new Map<string, string>()
  for (const atom of needed) {
    const signature = examples.map((scene) => (mentions(scene).includes(atom) ? '1' : '0')).join('')
    if (signature.split('1').length - 1 < 2) return false
    if ([...signatures.values()].includes(signature)) return false
    signatures.set(atom, signature)
  }
  return true
}

/**
 * Can the player pin a spelling to every meaning the test needs?
 *
 * Signature matching finds candidate chunks for each meaning; the one-to-one
 * assignment at the end is what stops two meanings from being handed the same
 * spelling. Without this, a puzzle can be perfectly determined at the grammar
 * level and still be unanswerable, because the player cannot tell which word is
 * which.
 */
export function wordsRecoverable(
  examples: readonly Scene[],
  test: Scene,
  language: Language,
): boolean {
  const sentences = examples.map((scene) => say(scene, language).join(' '))
  const signature = (predicate: (index: number) => boolean) =>
    examples.map((_, index) => (predicate(index) ? '1' : '0')).join('')

  const pieces = new Set<string>()
  for (const sentence of sentences) {
    for (const word of sentence.split(' ')) {
      for (let start = 0; start < word.length; start += 1) {
        for (let end = start + 2; end <= word.length; end += 1) pieces.add(word.slice(start, end))
      }
    }
  }

  const options: string[][] = []
  for (const atom of new Set(spokenAtoms(test, language.features))) {
    const wanted = signature((index) => spokenAtoms(examples[index], language.features).includes(atom))
    const matches = [...pieces].filter(
      (piece) => signature((index) => sentences[index].includes(piece)) === wanted,
    )
    if (matches.length === 0) return false
    options.push(matches)
  }

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

function pickScene(rng: Rng, tier: Tier): Scene {
  const scene = randomScene(rng)
  return tier.allowPlural ? scene : singularise(scene)
}

/**
 * Build a puzzle whose examples actually determine the answer.
 *
 * Examples are chosen greedily for how many rival grammars they kill, then topped
 * up until the test sentence is forced: every grammar still consistent with the
 * examples has to produce the same sentence the true one does. A player who reads
 * the examples correctly cannot be wrong for a reason the game did not show them.
 */
export function generatePuzzle(seedText: string, tierId: TierId): Puzzle {
  const tier = TIERS[tierId]
  const rng = createRng(hashSeed(`${seedText}:${tierId}`))

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const lexicon = makeLexicon(rng)
    const truth: Language = {
      name: nameLanguage(rng),
      lexicon,
      features: {
        order: rng.pick(tier.allowed.order),
        adjectives: rng.pick(tier.allowed.adjectives),
        number: rng.pick(tier.allowed.number),
        case: rng.pick(tier.allowed.case),
        adjAgrees: rng.pick(tier.allowed.adjAgrees),
        verbNumber: rng.pick(tier.allowed.verbNumber),
      },
    }

    const test = pickScene(rng, tier)
    const reading = pickScene(rng, tier)
    const probes = [test, reading]
    const needed = [...new Set(probes.flatMap((scene) => spokenAtoms(scene, truth.features)))]
    const candidates = everyCandidate(tier, truth)

    const pool: Scene[] = []
    for (let i = 0; i < 120; i += 1) pool.push(pickScene(rng, tier))
    // Guarantee the pool can cover every root the test relies on.
    for (const atom of needed) {
      for (let i = 0; i < 4; i += 1) {
        const scene = pickScene(rng, tier)
        pool.push(plant(scene, atom, rng, tier))
      }
    }

    const examples: Scene[] = []
    let alive = candidates

    while (examples.length < tier.examples) {
      let best: { scene: Scene; alive: Language[]; gain: number; covers: number } | null = null

      for (const scene of pool) {
        if (examples.some((chosen) => JSON.stringify(chosen) === JSON.stringify(scene))) continue
        const next = alive.filter((candidate) => agrees(candidate, truth, [scene]))
        const gain = alive.length - next.length
        const covers = needed.filter(
          (atom) =>
            spokenAtoms(scene, truth.features).includes(atom) &&
            examples.filter((chosen) => spokenAtoms(chosen, truth.features).includes(atom)).length < 2,
        ).length
        if (!best || gain > best.gain || (gain === best.gain && covers > best.covers)) {
          best = { scene, alive: next, gain, covers }
        }
      }

      if (!best) break
      examples.push(best.scene)
      alive = best.alive

      const forced = alive.every((candidate) => agrees(candidate, truth, probes))
      if (
        forced &&
        examples.length >= 4 &&
        lexicallyClear(examples, needed, truth.features) &&
        probes.every((scene) => wordsRecoverable(examples, scene, truth))
      ) {
        break
      }
    }

    const forced = alive.every((candidate) => agrees(candidate, truth, probes))
    if (!forced || !lexicallyClear(examples, needed, truth.features)) continue
    if (!probes.every((scene) => wordsRecoverable(examples, scene, truth))) continue

    const answer = say(test, truth)
    return {
      seed: seedText,
      tier,
      language: truth,
      examples,
      test,
      reading,
      lineup: rng.shuffle([reading, twist(reading, rng), twist(twist(reading, rng), rng)]),
      bank: buildBank(answer, truth, examples, rng),
      answer,
    }
  }

  throw new Error(`could not build a ${tierId} puzzle for seed ${seedText}`)
}

/** Force a scene to mention a particular meaning, so a root can be covered on demand. */
function plant(scene: Scene, atom: string, rng: Rng, tier: Tier): Scene {
  const target = rng.chance(0.5) ? 'subject' : 'object'
  const thing = scene[target]

  let patched = thing
  if (SHAPES.includes(atom as Shape)) patched = { ...thing, shape: atom as Shape }
  else if (COLORS.includes(atom as Color)) patched = { ...thing, color: atom as Color }
  else if (SIZES.includes(atom as Size)) patched = { ...thing, size: atom as Size }

  const next: Scene = VERBS.includes(atom as Verb)
    ? { ...scene, verb: atom as Verb }
    : { ...scene, [target]: patched }

  return tier.allowPlural ? next : singularise(next)
}

/**
 * The chip bank: the right words, plus the same roots wearing the wrong markers,
 * plus a few words for meanings that are simply not in the picture. Distractors
 * are built from the language rather than from noise, so a wrong answer is always
 * a real misreading of the grammar.
 */
function buildBank(
  answer: readonly string[],
  language: Language,
  examples: readonly Scene[],
  rng: Rng,
): string[] {
  const bank = new Set(answer)
  const { lexicon, features } = language

  for (const word of answer) {
    if (features.case !== 'none') {
      bank.add(word.endsWith(lexicon.caseAffix) ? word.slice(0, -lexicon.caseAffix.length) : word + lexicon.caseAffix)
    }
    if (features.number === 'suffix') {
      bank.add(
        word.endsWith(lexicon.pluralAffix) ? word.slice(0, -lexicon.pluralAffix.length) : word + lexicon.pluralAffix,
      )
    }
    if (features.number === 'prefix') {
      bank.add(
        word.startsWith(lexicon.pluralAffix) ? word.slice(lexicon.pluralAffix.length) : lexicon.pluralAffix + word,
      )
    }
  }

  // A couple of words the player has met before but does not need here.
  const seen = new Set(examples.flatMap((scene) => say(scene, language)))
  const spare = rng.shuffle([...seen].filter((word) => !bank.has(word))).slice(0, 3)
  for (const word of spare) bank.add(word)

  return rng.shuffle([...bank].filter((word) => word.length > 0))
}
