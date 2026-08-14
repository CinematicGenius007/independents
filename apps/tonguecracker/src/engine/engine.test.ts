import { describe, expect, it } from 'vitest'
import { makeLexicon, say, type Features, type Language } from './language'
import { createRng } from './rng'
import type { Scene } from './scene'
import {
  canAnswer,
  createStudy,
  everyGrammar,
  judge,
  survivors,
  testIsForced,
  unheardAtoms,
  wordsSeen,
} from './study'
import { hypothesisCount, TIERS, type TierId } from './tiers'

const lexicon = makeLexicon(createRng(7))

function speak(features: Features): Language {
  return { name: 'Test', lexicon, features }
}

const plain: Features = {
  order: 'SVO',
  adjectives: 'none',
  number: 'none',
  case: 'none',
  casePlacement: 'suffix',
  adjAgrees: false,
  verbAgrees: 'none',
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
    expect(before.slice(0, 2)).toEqual(after.slice(1, 3))
    expect(before[2]).toEqual(after[0])
  })

  it('marks many at the end or the front, as chosen', () => {
    expect(say(scene, speak({ ...plain, number: 'suffix' }))[2].endsWith(lexicon.pluralAffix)).toBe(true)
    expect(say(scene, speak({ ...plain, number: 'prefix' }))[2].startsWith(lexicon.pluralAffix)).toBe(
      true,
    )
  })

  it('puts the case marker on whichever end the language uses', () => {
    const suffixed = say(scene, speak({ ...plain, case: 'object', casePlacement: 'suffix' }))
    const prefixed = say(scene, speak({ ...plain, case: 'object', casePlacement: 'prefix' }))
    expect(suffixed[2].endsWith(lexicon.caseAffix)).toBe(true)
    expect(prefixed[2].startsWith(lexicon.caseAffix)).toBe(true)
  })

  it('copies the marker onto adjectives only when they agree', () => {
    const agreeing = say(scene, speak({ ...plain, adjectives: 'before', case: 'object', adjAgrees: true }))
    const aloof = say(scene, speak({ ...plain, adjectives: 'before', case: 'object', adjAgrees: false }))
    expect(agreeing.filter((word) => word.endsWith(lexicon.caseAffix))).toHaveLength(3)
    expect(aloof.filter((word) => word.endsWith(lexicon.caseAffix))).toHaveLength(1)
  })

  it('agrees with whichever participant the language agrees with', () => {
    const pluralSubject: Scene = {
      ...scene,
      subject: { ...scene.subject, count: 3 },
      object: { ...scene.object, count: 1 },
    }
    const marked = (features: Partial<Features>) =>
      say(pluralSubject, speak({ ...plain, number: 'suffix', ...features }))[1].endsWith(
        lexicon.pluralAffix,
      )

    // Subject and object agreement are only distinguishable in a scene like this
    // one, where exactly one of the two participants is plural.
    expect(marked({ verbAgrees: 'subject' })).toBe(true)
    expect(marked({ verbAgrees: 'object' })).toBe(false)
    expect(marked({ verbAgrees: 'both' })).toBe(true)
    expect(marked({ verbAgrees: 'none' })).toBe(false)
  })

  it('cannot be told apart when both participants are plural', () => {
    const bothPlural: Scene = {
      ...scene,
      subject: { ...scene.subject, count: 2 },
      object: { ...scene.object, count: 3 },
    }
    const subject = say(bothPlural, speak({ ...plain, number: 'suffix', verbAgrees: 'subject' }))
    const object = say(bothPlural, speak({ ...plain, number: 'suffix', verbAgrees: 'object' }))
    expect(subject).toEqual(object)
  })
})

describe('the hypothesis space', () => {
  const tiers: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

  for (const tier of tiers) {
    it(`enumerates exactly the grammars ${tier} allows`, () => {
      const study = createStudy(`SPACE-${tier}`, tier)
      expect(everyGrammar(study.tier, study.language)).toHaveLength(hypothesisCount(TIERS[tier]))
    })
  }

  it('grows as tiers add features', () => {
    expect(hypothesisCount(TIERS.order)).toBeLessThan(hypothesisCount(TIERS.shapeandshade))
    expect(hypothesisCount(TIERS.shapeandshade)).toBeLessThan(hypothesisCount(TIERS.many))
    expect(hypothesisCount(TIERS.many)).toBeLessThan(hypothesisCount(TIERS.marked))
  })

  it('always keeps the true grammar among the survivors', () => {
    const study = createStudy('TRUTH-1', 'marked')
    const left = survivors(study, study.rack)
    expect(left.some((candidate) => candidate.features.order === study.language.features.order)).toBe(
      true,
    )
  })

  it('never grows the survivor set by asking more questions', () => {
    const study = createStudy('MONOTONE-1', 'many')
    let previous = survivors(study, []).length
    for (let asked = 1; asked <= study.rack.length; asked += 1) {
      const now = survivors(study, study.rack.slice(0, asked)).length
      expect(now).toBeLessThanOrEqual(previous)
      previous = now
    }
  })
})

describe('a study', () => {
  const tiers: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

  for (const tier of tiers) {
    it(`can always be settled by its own rack for ${tier}`, () => {
      for (const seed of ['ORU-1', 'ORU-2', 'ORU-3']) {
        const study = createStudy(seed, tier)
        expect(testIsForced(study, study.rack)).toBe(true)
        expect(unheardAtoms(study, study.rack)).toHaveLength(0)
      }
    })
  }

  it('never lets the free gifts alone be enough to answer', () => {
    for (const seed of ['GIFT-1', 'GIFT-2', 'GIFT-3']) {
      const study = createStudy(seed, 'marked')
      expect(study.par).toBeGreaterThan(0)
      expect(canAnswer(study, [])).toBe(false)
    }
  })

  it('is answerable once the greedy questioner has spent par', () => {
    for (const tier of ['order', 'many'] as TierId[]) {
      const study = createStudy(`PARWALK-${tier}`, tier)
      expect(canAnswer(study, study.rack)).toBe(true)
      expect(study.par).toBeLessThanOrEqual(study.rack.length)
    }
  })

  it('quotes a par a perfect questioner could actually reach', () => {
    const study = createStudy('PAR-1', 'many')
    expect(study.par).toBeLessThanOrEqual(study.rack.length)
    expect(testIsForced(study, study.rack.slice(0, study.rack.length))).toBe(true)
  })

  it('lists every word it has shown the player and no others', () => {
    const study = createStudy('WORDS-1', 'shapeandshade')
    const seen = wordsSeen(study, [study.rack[0]])
    const shown = new Set([...study.gifts, study.rack[0]].flatMap((s) => say(s, study.language)))
    expect(new Set(seen)).toEqual(shown)
  })

  it('is deterministic for a seed', () => {
    expect(createStudy('SAME-9', 'many').test).toEqual(createStudy('SAME-9', 'many').test)
  })

  it('keeps every scene singular until plurals are the lesson', () => {
    for (const tier of ['order', 'shapeandshade'] as TierId[]) {
      const study = createStudy('SING-2', tier)
      for (const item of [...study.gifts, ...study.rack, study.test]) {
        expect(item.subject.count).toBe(1)
        expect(item.object.count).toBe(1)
      }
    }
  })
})

describe('judging an answer', () => {
  const study = createStudy('JUDGE-1', 'order')
  const answer = say(study.test, study.language)

  it('accepts the sentence the language would use', () => {
    expect(judge(study, answer.join(' ')).right).toBe(true)
  })

  it('forgives spacing and capitals', () => {
    expect(judge(study, `  ${answer.join('   ').toUpperCase()} `).right).toBe(true)
  })

  it('marks which words landed in the right place', () => {
    const swapped = [answer[1], answer[0], ...answer.slice(2)]
    const verdict = judge(study, swapped.join(' '))
    expect(verdict.right).toBe(false)
    expect(verdict.marks.slice(0, 2)).toEqual([false, false])
  })

  it('rejects a sentence that is merely too long', () => {
    expect(judge(study, `${answer.join(' ')} ${answer[0]}`).right).toBe(false)
  })
})
