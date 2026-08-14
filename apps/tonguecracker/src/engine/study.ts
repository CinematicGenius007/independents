import { makeLexicon, nameLanguage, say, spokenAtoms, type Features, type Language } from './language'
import { createRng, hashSeed, type Rng } from './rng'
import { randomScene, type Scene } from './scene'
import { TIERS, type Tier, type TierId } from './tiers'

/**
 * A field study, rather than a lesson.
 *
 * The old shape of this game handed the player a fixed set of examples and asked
 * them to read it. That made the generator responsible for choosing good
 * evidence, which is the most interesting decision in the whole problem — so it
 * now belongs to the player. You are shown a rack of scenes and you choose which
 * one to have translated. Every question costs, and the good questions are the
 * ones that could come back either way.
 */

export interface Study {
  readonly seed: string
  readonly tier: Tier
  readonly language: Language
  /** Two translations given free, so there is something to reason from. */
  readonly gifts: readonly Scene[]
  /** Scenes on offer to ask about. */
  readonly rack: readonly Scene[]
  /** The scene the player must describe unaided. */
  readonly test: Scene
  /** Fewest questions a perfect questioner needs to force the test. */
  readonly par: number
}

export function everyGrammar(tier: Tier, language: Language): Language[] {
  const out: Language[] = []
  for (const order of tier.allowed.order) {
    for (const adjectives of tier.allowed.adjectives) {
      for (const number of tier.allowed.number) {
        for (const marking of tier.allowed.case) {
          for (const casePlacement of tier.allowed.casePlacement) {
            for (const adjAgrees of tier.allowed.adjAgrees) {
              for (const verbAgrees of tier.allowed.verbAgrees) {
                const features: Features = {
                  order,
                  adjectives,
                  number,
                  case: marking,
                  casePlacement,
                  adjAgrees,
                  verbAgrees,
                }
                out.push({ ...language, features })
              }
            }
          }
        }
      }
    }
  }
  return out
}

function agreesOn(a: Language, b: Language, scenes: readonly Scene[]): boolean {
  return scenes.every((scene) => say(scene, a).join(' ') === say(scene, b).join(' '))
}

/**
 * Which grammars still fit everything you have been told?
 *
 * This is the number the interface shows, and it is the whole game: it goes down
 * when you ask a question that could have come back two ways, and it does not
 * move at all when you ask something you could have predicted.
 */
export function survivors(study: Study, asked: readonly Scene[]): Language[] {
  const evidence = [...study.gifts, ...asked]
  return everyGrammar(study.tier, study.language).filter((candidate) =>
    agreesOn(candidate, study.language, evidence),
  )
}

/** Is the answer forced by what you know, or would you be guessing? */
export function testIsForced(study: Study, asked: readonly Scene[]): boolean {
  const answer = say(study.test, study.language).join(' ')
  return survivors(study, asked).every((candidate) => say(study.test, candidate).join(' ') === answer)
}

/**
 * Words the player has actually met.
 *
 * A sentence they cannot spell is not a test of grammar, so the interface lists
 * the vocabulary from their own evidence — but never what any of it means.
 */
export function wordsSeen(study: Study, asked: readonly Scene[]): string[] {
  const words = new Set<string>()
  for (const scene of [...study.gifts, ...asked]) {
    for (const word of say(scene, study.language)) words.add(word)
  }
  return [...words].sort()
}

/** Every meaning in the test that the player has never heard named. */
export function unheardAtoms(study: Study, asked: readonly Scene[]): string[] {
  const heard = new Set(
    [...study.gifts, ...asked].flatMap((scene) => spokenAtoms(scene, study.language.features)),
  )
  return spokenAtoms(study.test, study.language.features).filter((atom) => !heard.has(atom))
}

/**
 * Could the player answer right now without guessing?
 *
 * Two different things can be missing: the grammar may still be undetermined, or
 * the sentence may need a word they have never heard. Both are answerable only
 * by asking, so the interface treats them as one readiness signal.
 */
export function canAnswer(study: Study, asked: readonly Scene[]): boolean {
  return testIsForced(study, asked) && unheardAtoms(study, asked).length === 0
}

function greedyPar(study: Study, pool: readonly Scene[]): number {
  const asked: Scene[] = []

  for (let round = 0; round < pool.length; round += 1) {
    if (canAnswer(study, asked)) return asked.length

    let best: { scene: Scene; left: number } | null = null
    for (const scene of pool) {
      if (asked.includes(scene)) continue
      const left = survivors(study, [...asked, scene]).length
      const unheard = unheardAtoms(study, [...asked, scene]).length
      const cost = left + unheard * 4
      if (!best || cost < best.left) best = { scene, left: cost }
    }
    if (!best) break
    asked.push(best.scene)
  }

  return asked.length
}

const RACK_SIZE = 9

export function createStudy(seedText: string, tierId: TierId): Study {
  const tier = TIERS[tierId]
  const rng = createRng(hashSeed(`${seedText}:${tierId}:study`))

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const language: Language = {
      name: nameLanguage(rng),
      lexicon: makeLexicon(rng),
      features: {
        order: rng.pick(tier.allowed.order),
        adjectives: rng.pick(tier.allowed.adjectives),
        number: rng.pick(tier.allowed.number),
        case: rng.pick(tier.allowed.case),
        casePlacement: rng.pick(tier.allowed.casePlacement),
        adjAgrees: rng.pick(tier.allowed.adjAgrees),
        verbAgrees: rng.pick(tier.allowed.verbAgrees),
      },
    }

    /**
     * The free gifts are always singular.
     *
     * Playtests of the first version showed two random captions settling almost
     * the whole grammar before the player asked anything — a full sentence
     * exposes word order, adjective placement, number and case at once. Keeping
     * the gifts singular leaves everything about plurality and agreement open,
     * so the questions are the game rather than the garnish.
     */
    const scene = () => pickScene(rng, tier)
    const singular = (source: Scene): Scene => ({
      ...source,
      subject: { ...source.subject, count: 1 },
      object: { ...source.object, count: 1 },
    })
    const shaped = (subject: 1 | 2 | 3, object: 1 | 2 | 3): Scene => {
      const source = scene()
      if (!tier.allowPlural) return singular(source)
      return {
        ...source,
        subject: { ...source.subject, count: subject },
        object: { ...source.object, count: object },
      }
    }

    const study: Study = {
      seed: seedText,
      tier,
      language,
      gifts: [singular(scene()), singular(scene())],
      // A rack with every shape of plurality on it, so a minimal pair is always
      // available to whoever thinks to look for one.
      rack: [
        shaped(1, 1),
        shaped(2, 1),
        shaped(1, 3),
        shaped(3, 2),
        shaped(1, 1),
        shaped(2, 2),
        shaped(3, 1),
        shaped(1, 2),
        shaped(2, 3),
      ],
      test: tier.allowPlural ? shaped(rng.chance(0.5) ? 2 : 1, rng.chance(0.5) ? 3 : 1) : singular(scene()),
      par: 0,
    }

    // A study is only fair if asking everything on the rack would settle it.
    if (!canAnswer(study, study.rack)) continue

    const par = greedyPar(study, study.rack)
    if (par < 1 || par > RACK_SIZE - 2) continue
    return { ...study, par }
  }

  throw new Error(`could not build a ${tierId} study for seed ${seedText}`)
}

function pickScene(rng: Rng, tier: Tier): Scene {
  const scene = randomScene(rng)
  if (tier.allowPlural) return scene
  return {
    ...scene,
    subject: { ...scene.subject, count: 1 },
    object: { ...scene.object, count: 1 },
  }
}

/** Compare a typed sentence with the one the language would use. */
export function judge(study: Study, typed: string): { right: boolean; marks: boolean[]; answer: string[] } {
  const answer = say(study.test, study.language)
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const marks = answer.map((word, index) => words[index] === word)
  return { right: marks.every(Boolean) && words.length === answer.length, marks, answer }
}
