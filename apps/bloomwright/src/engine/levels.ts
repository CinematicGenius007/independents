import { descriptionLength, type Grammar } from './lsystem'

export interface Level {
  readonly id: string
  readonly name: string
  /** What the level is teaching, in one line, without giving the answer away. */
  readonly brief: string
  /** The grammar that drew the target. Revealed only after a win. */
  readonly hidden: Grammar
  /** Where the player starts: legal, alive, and wrong. */
  readonly start: Grammar
  /** Match score needed to clear it. */
  readonly threshold: number
}

/**
 * The symbol budget for a level: the length of the grammar that drew it.
 *
 * Beating the score is one thing; saying it as briefly as the specimen was said
 * is another, and it is the part that rewards understanding rather than fiddling.
 */
export function parSymbols(level: Level): number {
  return descriptionLength(level.hidden)
}

/**
 * Levels are ordered by the vocabulary they need, not by how big the plant is.
 * Turning comes first, then branching, then buds that rewrite into whole limbs.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 'kink',
    name: 'Kink',
    brief: 'One rule, one angle. Find how far it turns and how often.',
    hidden: { axiom: 'F', rules: { F: 'F+F-F' }, angle: 60, generations: 4 },
    start: { axiom: 'F', rules: { F: 'F+F' }, angle: 45, generations: 4 },
    threshold: 0.9,
  },
  {
    id: 'comb',
    name: 'Comb',
    brief: 'Square brackets remember a spot and jump back to it. That is a branch.',
    hidden: { axiom: 'F', rules: { F: 'F[+F]F' }, angle: 25, generations: 4 },
    start: { axiom: 'F', rules: { F: 'F+F' }, angle: 25, generations: 4 },
    threshold: 0.88,
  },
  {
    id: 'edge',
    name: 'Edge',
    brief: 'A rule that turns both ways folds a straight line into a coastline.',
    hidden: { axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 90, generations: 3 },
    start: { axiom: 'F', rules: { F: 'F+F-F' }, angle: 90, generations: 3 },
    threshold: 0.85,
  },
  {
    id: 'thicket',
    name: 'Thicket',
    brief: 'Two branches, mirrored. Watch what the leading FF does to the trunk.',
    hidden: { axiom: 'F', rules: { F: 'FF-[-F+F]+[+F-F]' }, angle: 22, generations: 4 },
    start: { axiom: 'F', rules: { F: 'F[-F]+F' }, angle: 22, generations: 4 },
    threshold: 0.82,
  },
  {
    id: 'sapling',
    name: 'Sapling',
    brief: 'A is a bud: it draws nothing itself, it becomes whatever its rule says.',
    hidden: { axiom: 'A', rules: { A: 'F[+A]F[-A]+A', F: 'FF' }, angle: 20, generations: 5 },
    start: { axiom: 'A', rules: { A: 'F[+A]A', F: 'FF' }, angle: 20, generations: 5 },
    threshold: 0.8,
  },
  {
    id: 'fern',
    name: 'Fern',
    brief: 'The classic. A bud that leans, with the trunk doubling every generation.',
    hidden: { axiom: 'A', rules: { A: 'F[+A][-A]FA', F: 'FF' }, angle: 25, generations: 5 },
    start: { axiom: 'A', rules: { A: 'F[+A]FA', F: 'FF' }, angle: 25, generations: 5 },
    threshold: 0.8,
  },
  {
    id: 'weave',
    name: 'Weave',
    brief: 'Two buds that call each other. Neither rule makes sense alone.',
    hidden: { axiom: 'A', rules: { A: 'F[+B][-B]A', B: 'FF[-A]', F: 'F' }, angle: 32, generations: 6 },
    start: { axiom: 'A', rules: { A: 'F[+B]A', B: 'FF', F: 'F' }, angle: 32, generations: 6 },
    threshold: 0.8,
  },
  {
    id: 'crown',
    name: 'Crown',
    brief: 'Three limbs from one bud, and a gap where the turtle lifts its pen.',
    hidden: { axiom: 'A', rules: { A: 'F[+A][A][-A]', F: 'FG' }, angle: 28, generations: 5 },
    start: { axiom: 'A', rules: { A: 'F[+A][-A]', F: 'F' }, angle: 28, generations: 5 },
    threshold: 0.78,
  },
]

export const SANDBOX: Grammar = {
  axiom: 'A',
  rules: { A: 'F[+A][-A]FA', F: 'FF' },
  angle: 25,
  generations: 4,
}
