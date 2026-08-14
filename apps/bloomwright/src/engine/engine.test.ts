import { describe, expect, it } from 'vitest'
import { LEVELS, parSymbols } from './levels'
import {
  bracketsBalance,
  descriptionLength,
  expand,
  MAX_EXPANDED,
  sanitize,
  type Grammar,
} from './lsystem'
import { boxDimension, compare, difference, rasterize } from './match'
import { walk } from './turtle'

const draw = (grammar: Grammar) => walk(expand(grammar).text, grammar.angle).segments

describe('expansion', () => {
  it('rewrites every symbol that has a rule, once per generation', () => {
    expect(expand({ axiom: 'F', rules: { F: 'F+F' }, angle: 90, generations: 2 }).text).toBe('F+F+F+F')
  })

  it('leaves symbols without a rule alone', () => {
    expect(expand({ axiom: 'A+A', rules: { A: 'F' }, angle: 90, generations: 1 }).text).toBe('F+F')
  })

  it('stops before a runaway grammar eats the tab', () => {
    const result = expand({ axiom: 'F', rules: { F: 'FFFF' }, angle: 90, generations: 12 })
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(MAX_EXPANDED + 4)
  })

  it('drops characters the turtle cannot read', () => {
    expect(sanitize('F+x[Q]-')).toBe('F+[]-')
  })

  it('measures a description without charging for rules that say nothing', () => {
    const idle: Grammar = { axiom: 'A', rules: { A: 'FA', B: 'B' }, angle: 20, generations: 3 }
    expect(descriptionLength(idle)).toBe(1 + (1 + 2))
  })

  it('knows when brackets are unbalanced', () => {
    expect(bracketsBalance('F[+F]F')).toBe(true)
    expect(bracketsBalance('F[+F')).toBe(false)
    expect(bracketsBalance('F]+F[')).toBe(false)
  })
})

describe('turtle', () => {
  it('draws one segment per F and none for G', () => {
    expect(walk('FFF', 90).segments).toHaveLength(3)
    expect(walk('GGG', 90).segments).toHaveLength(0)
  })

  it('returns to the remembered spot after a branch', () => {
    const [trunk, branch] = walk('F[+F]', 90).segments
    expect(branch.x1).toBeCloseTo(trunk.x2)
    expect(branch.y1).toBeCloseTo(trunk.y2)
  })

  it('normalises any drawing into the unit square', () => {
    for (const text of ['FFFF', 'F+F+F+F', 'F[+F][-F]F']) {
      for (const segment of walk(text, 45).segments) {
        for (const value of [segment.x1, segment.x2, segment.y1, segment.y2]) {
          expect(value).toBeGreaterThanOrEqual(-1e-9)
          expect(value).toBeLessThanOrEqual(1 + 1e-9)
        }
      }
    }
  })

  it('ignores a closing bracket with nothing to return to', () => {
    expect(() => walk(']]F', 45)).not.toThrow()
  })
})

describe('measuring a drawing', () => {
  it('gives a straight line a dimension near one and a bush a higher one', () => {
    const line = draw({ axiom: 'F', rules: { F: 'FF' }, angle: 25, generations: 5 })
    const bush = draw({ axiom: 'A', rules: { A: 'F[+A][-A]FA', F: 'FF' }, angle: 25, generations: 5 })
    expect(boxDimension(line)).toBeLessThan(1.2)
    expect(boxDimension(bush)).toBeGreaterThan(boxDimension(line))
  })

  it('reports nothing missing or extra when a drawing matches itself', () => {
    const target = draw(LEVELS[1].hidden)
    const { missing, extra } = difference(target, target)
    expect(missing.reduce<number>((total, cell) => total + cell, 0)).toBe(0)
    expect(extra.reduce<number>((total, cell) => total + cell, 0)).toBe(0)
  })

  it('marks uncovered specimen as missing and stray ink as extra', () => {
    const target = draw(LEVELS[3].hidden)
    const sparse = draw(LEVELS[3].start)
    const { missing, extra } = difference(sparse, target)
    expect(missing.reduce<number>((total, cell) => total + cell, 0)).toBeGreaterThan(0)
    expect(extra.length).toBe(missing.length)
  })
})

describe('matching', () => {
  it('scores an identical drawing as a perfect match', () => {
    const target = draw(LEVELS[1].hidden)
    expect(compare(target, target).score).toBeCloseTo(1)
  })

  it('scores the starting grammar well below the threshold', () => {
    for (const level of LEVELS) {
      const { score } = compare(draw(level.start), draw(level.hidden))
      expect(score).toBeLessThan(level.threshold)
    }
  })

  it('punishes a scribble that merely covers the target', () => {
    const target = draw({ axiom: 'F', rules: { F: 'F[+F]F' }, angle: 25, generations: 4 })
    const scribble = draw({ axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 89, generations: 4 })
    expect(compare(scribble, target).score).toBeLessThan(0.6)
  })

  it('notices a wrong angle even when the rules are right', () => {
    const level = LEVELS[1]
    const wrongAngle = draw({ ...level.hidden, angle: level.hidden.angle + 12 })
    expect(compare(wrongAngle, draw(level.hidden)).score).toBeLessThan(level.threshold)
  })

  it('rasterises into a grid that is neither empty nor saturated', () => {
    const mask = rasterize(draw(LEVELS[5].hidden))
    const filled = mask.reduce<number>((total, cell) => total + cell, 0)
    expect(filled).toBeGreaterThan(50)
    expect(filled).toBeLessThan(mask.length * 0.9)
  })
})

describe('levels', () => {
  it('are all reachable: the hidden grammar clears its own threshold', () => {
    for (const level of LEVELS) {
      const target = draw(level.hidden)
      expect(target.length).toBeGreaterThan(4)
      expect(compare(target, target).score).toBeGreaterThanOrEqual(level.threshold)
    }
  })

  it('keep every hidden grammar inside the drawing budget', () => {
    for (const level of LEVELS) {
      expect(expand(level.hidden).truncated).toBe(false)
      expect(walk(expand(level.hidden).text, level.hidden.angle).truncated).toBe(false)
    }
  })

  it('carry a symbol budget equal to the grammar that drew them', () => {
    for (const level of LEVELS) {
      expect(parSymbols(level)).toBe(descriptionLength(level.hidden))
      expect(parSymbols(level)).toBeGreaterThan(3)
    }
  })

  it('have unique ids', () => {
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length)
  })
})
