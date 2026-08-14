import { describe, expect, it } from 'vitest'
import { makeLexicon, say, type Features, type Language } from './language'
import { generatePuzzle, lexicallyClear, TIERS, wordsRecoverable, type TierId } from './puzzle'
import { createRng } from './rng'
import { sameScene, vocabularyOf, type Scene } from './scene'

const lexicon = makeLexicon(createRng(7))

function speak(features: Features): Language {
  return { name: 'Test', lexicon, features }
}

const plain: Features = {
  order: 'SVO',
  adjectives: 'none',
  number: 'none',
  case: 'none',
  adjAgrees: false,
  verbNumber: false,
}

const scene: Scene = {
  subject: { shape: 'circle', color: 'red', size: 'big', count: 1 },
  verb: 'chases',
  object: { shape: 'square', color: 'blue', size: 'small', count: 2 },
}

describe('saying a scene', () => {
  it('puts the words where the order says', () => {
    const [subject, verb, object] = say(scene, speak(plain))
    expect(say(scene, speak({ ...plain, order: 'SOV' }))).toEqual([subject, object, verb])
    expect(say(scene, speak({ ...plain, order: 'VSO' }))).toEqual([verb, subject, object])
  })

  it('places adjectives on the side the language chose', () => {
    const before = say(scene, speak({ ...plain, adjectives: 'before' }))
    const after = say(scene, speak({ ...plain, adjectives: 'after' }))
    expect(before).toHaveLength(7)
    expect(after).toHaveLength(7)
    // Same three words per phrase; only the head noun changes side.
    expect(before.slice(0, 2)).toEqual(after.slice(1, 3))
    expect(before[2]).toEqual(after[0])
  })

  it('marks many at the end or the front, as chosen', () => {
    const suffix = say(scene, speak({ ...plain, number: 'suffix' }))
    const prefix = say(scene, speak({ ...plain, number: 'prefix' }))
    expect(suffix[2].endsWith(lexicon.pluralAffix)).toBe(true)
    expect(prefix[2].startsWith(lexicon.pluralAffix)).toBe(true)
  })

  it('leaves a single thing unmarked', () => {
    const words = say(scene, speak({ ...plain, number: 'suffix' }))
    expect(words[0].endsWith(lexicon.pluralAffix)).toBe(false)
  })

  it('marks whichever participant the language marks', () => {
    const objectMarked = say(scene, speak({ ...plain, case: 'object' }))
    const subjectMarked = say(scene, speak({ ...plain, case: 'subject' }))
    expect(objectMarked[2].endsWith(lexicon.caseAffix)).toBe(true)
    expect(objectMarked[0].endsWith(lexicon.caseAffix)).toBe(false)
    expect(subjectMarked[0].endsWith(lexicon.caseAffix)).toBe(true)
  })

  it('copies the marker onto adjectives only when they agree', () => {
    const agreeing = say(scene, speak({ ...plain, adjectives: 'before', case: 'object', adjAgrees: true }))
    const aloof = say(scene, speak({ ...plain, adjectives: 'before', case: 'object', adjAgrees: false }))
    expect(agreeing.filter((word) => word.endsWith(lexicon.caseAffix))).toHaveLength(3)
    expect(aloof.filter((word) => word.endsWith(lexicon.caseAffix))).toHaveLength(1)
  })

  it('marks the verb for a plural subject only when the language does that', () => {
    const plural: Scene = { ...scene, subject: { ...scene.subject, count: 3 } }
    const marking = say(plural, speak({ ...plain, number: 'suffix', verbNumber: true }))
    const not = say(plural, speak({ ...plain, number: 'suffix', verbNumber: false }))
    expect(marking[1].endsWith(lexicon.pluralAffix)).toBe(true)
    expect(not[1].endsWith(lexicon.pluralAffix)).toBe(false)
  })
})

describe('lexical clarity', () => {
  const withShape = (shape: 'circle' | 'square'): Scene => ({ ...scene, subject: { ...scene.subject, shape } })

  it('rejects a meaning that appears only once', () => {
    expect(lexicallyClear([withShape('circle'), withShape('square')], ['circle'])).toBe(false)
  })

  it('rejects two meanings that always appear together', () => {
    const examples = [scene, scene, { ...scene, verb: 'watches' as const }]
    expect(lexicallyClear(examples, ['circle', 'red'])).toBe(false)
  })
})

describe('generated puzzles', () => {
  const tiers: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

  for (const tier of tiers) {
    it(`forces a single answer for ${tier}`, () => {
      for (const seed of ['ORU-1', 'ORU-2', 'ORU-3']) {
        const puzzle = generatePuzzle(seed, tier)
        expect(puzzle.answer).toEqual(say(puzzle.test, puzzle.language))
        expect(puzzle.examples.length).toBeGreaterThanOrEqual(4)
        expect(puzzle.examples.length).toBeLessThanOrEqual(TIERS[tier].examples)
      }
    })

    it(`only tests words the examples already used for ${tier}`, () => {
      const puzzle = generatePuzzle(`SEEN-${tier}`, tier)
      const seen = new Set(puzzle.examples.flatMap(vocabularyOf))
      for (const atom of vocabularyOf(puzzle.test)) expect(seen.has(atom)).toBe(true)
    })

    it(`leaves every needed word findable in the examples for ${tier}`, () => {
      for (const seed of ['WORD-1', 'WORD-2']) {
        const puzzle = generatePuzzle(seed, tier)
        expect(wordsRecoverable(puzzle.examples, puzzle.test, puzzle.language)).toBe(true)
        expect(wordsRecoverable(puzzle.examples, puzzle.reading, puzzle.language)).toBe(true)
      }
    })
  }

  it('offers every needed chip in the bank, and some wrong ones', () => {
    const puzzle = generatePuzzle('BANK-1', 'marked')
    for (const word of puzzle.answer) expect(puzzle.bank).toContain(word)
    expect(puzzle.bank.length).toBeGreaterThan(puzzle.answer.length)
  })

  it('lines up the reading scene with two near misses', () => {
    const puzzle = generatePuzzle('LINE-1', 'many')
    expect(puzzle.lineup).toHaveLength(3)
    expect(puzzle.lineup.filter((candidate) => sameScene(candidate, puzzle.reading))).toHaveLength(1)
  })

  it('is deterministic for a seed', () => {
    const first = generatePuzzle('SAME-9', 'many')
    const second = generatePuzzle('SAME-9', 'many')
    expect(second.answer).toEqual(first.answer)
    expect(second.examples).toEqual(first.examples)
  })

  it('keeps every tier singular until plurals are the lesson', () => {
    for (const tier of ['order', 'shapeandshade'] as TierId[]) {
      const puzzle = generatePuzzle('SING-2', tier)
      for (const example of [...puzzle.examples, puzzle.test]) {
        expect(example.subject.count).toBe(1)
        expect(example.object.count).toBe(1)
      }
    }
  })
})
