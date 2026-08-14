import type { Rng } from './rng'
import { COLORS, isPlural, SHAPES, SIZES, VERBS, type Scene, type Thing } from './scene'

/**
 * A generated language.
 *
 * Every feature here is something a player can notice from examples alone: where
 * the verb sits, which side an adjective takes, whether "many" is marked at the
 * front or the back of a word, whether the thing being acted on wears a marker,
 * and whether adjectives and verbs copy those markers.
 */

export type Order = 'SVO' | 'SOV' | 'VSO'
export type AdjectivePlacement = 'none' | 'before' | 'after'
export type NumberMarking = 'none' | 'suffix' | 'prefix'
export type CaseMarking = 'none' | 'object' | 'subject'

export interface Features {
  readonly order: Order
  readonly adjectives: AdjectivePlacement
  readonly number: NumberMarking
  readonly case: CaseMarking
  /** Adjectives repeat the case marker of the noun they describe. */
  readonly adjAgrees: boolean
  /** The verb takes the plural marker when its subject is many. */
  readonly verbNumber: boolean
}

export interface Lexicon {
  readonly shapes: Record<string, string>
  readonly colors: Record<string, string>
  readonly sizes: Record<string, string>
  readonly verbs: Record<string, string>
  readonly pluralAffix: string
  readonly caseAffix: string
}

export interface Language {
  readonly name: string
  readonly features: Features
  readonly lexicon: Lexicon
}

const ONSETS = ['t', 'k', 'm', 'n', 's', 'l', 'r', 'v', 'h', 'd', 'p', 'z', 'th', 'sh', 'ng']
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ai', 'ei', 'ou']

/**
 * Each language draws from its own small sound inventory, so its words hang
 * together and two languages never feel like the same word list reshuffled.
 */
function makeSyllableSource(rng: Rng) {
  const onsets = rng.shuffle(ONSETS).slice(0, 8)
  const nuclei = rng.shuffle(NUCLEI).slice(0, 5)
  const used = new Set<string>()
  const openings = new Set<string>()

  return (syllables: number): string => {
    // Two passes: first insist on a distinct opening syllable, then settle for
    // merely distinct. A language whose words all began with the same syllable was
    // miserable to scan in playtests, and scanning is the whole game.
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const opening = rng.pick(onsets) + rng.pick(nuclei)
      let word = opening
      for (let i = 1; i < syllables; i += 1) word += rng.pick(onsets) + rng.pick(nuclei)
      if (used.has(word) || (attempt < 200 && openings.has(opening))) continue
      used.add(word)
      openings.add(opening)
      return word
    }
    const fallback = `${rng.pick(onsets)}${rng.pick(nuclei)}${used.size}`
    used.add(fallback)
    return fallback
  }
}

export function makeLexicon(rng: Rng): Lexicon {
  const syllable = makeSyllableSource(rng)
  const build = (keys: readonly string[], syllables: number) =>
    Object.fromEntries(keys.map((key) => [key, syllable(syllables)]))

  return {
    shapes: build(SHAPES, 2),
    colors: build(COLORS, 2),
    sizes: build(SIZES, 2),
    verbs: build(VERBS, 2),
    pluralAffix: syllable(1),
    caseAffix: syllable(1),
  }
}

function affixed(root: string, affix: string, placement: NumberMarking): string {
  if (placement === 'prefix') return affix + root
  if (placement === 'suffix') return root + affix
  return root
}

function nounPhrase(thing: Thing, role: 'subject' | 'object', language: Language): string[] {
  const { features, lexicon } = language
  const marked =
    (features.case === 'object' && role === 'object') ||
    (features.case === 'subject' && role === 'subject')

  let head = lexicon.shapes[thing.shape]
  if (features.number !== 'none' && isPlural(thing)) {
    head = affixed(head, lexicon.pluralAffix, features.number)
  }
  if (marked) head += lexicon.caseAffix

  if (features.adjectives === 'none') return [head]

  const adjectives = [lexicon.colors[thing.color], lexicon.sizes[thing.size]].map((word) =>
    marked && features.adjAgrees ? word + lexicon.caseAffix : word,
  )

  return features.adjectives === 'before' ? [...adjectives, head] : [head, ...adjectives]
}

/** Render a scene as the sentence this language would use for it. */
export function say(scene: Scene, language: Language): string[] {
  const subject = nounPhrase(scene.subject, 'subject', language)
  const object = nounPhrase(scene.object, 'object', language)

  let verb = language.lexicon.verbs[scene.verb]
  if (language.features.verbNumber && isPlural(scene.subject)) {
    verb = affixed(verb, language.lexicon.pluralAffix, language.features.number === 'prefix' ? 'prefix' : 'suffix')
  }

  switch (language.features.order) {
    case 'SVO':
      return [...subject, verb, ...object]
    case 'SOV':
      return [...subject, ...object, verb]
    case 'VSO':
      return [verb, ...subject, ...object]
  }
}

/**
 * The meanings this language actually pronounces for a scene.
 *
 * Colour and size exist in every picture, but a language that has no adjectives
 * never says them, so requiring the player to learn those words would be asking
 * for something the examples cannot teach.
 */
export function spokenAtoms(scene: Scene, features: Features): string[] {
  const atoms: string[] = [scene.verb, scene.subject.shape, scene.object.shape]
  if (features.adjectives !== 'none') {
    atoms.push(
      scene.subject.color,
      scene.subject.size,
      scene.object.color,
      scene.object.size,
    )
  }
  return atoms
}

export function sentenceOf(scene: Scene, language: Language): string {
  return say(scene, language).join(' ')
}

const LANGUAGE_NAMES = [
  'Oru',
  'Semmel',
  'Vashti',
  'Kelor',
  'Thanne',
  'Mirek',
  'Anseth',
  'Dolu',
  'Ferrin',
  'Nalka',
]

export function nameLanguage(rng: Rng): string {
  return rng.pick(LANGUAGE_NAMES)
}
