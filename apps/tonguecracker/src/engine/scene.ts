import type { Rng } from './rng'

/**
 * The world the language talks about.
 *
 * It is kept deliberately small — four shapes, four colours, two sizes, one or
 * many, three relations — because every distinction here has to be visible at a
 * glance in the drawing. If a player cannot see it, the language cannot teach it.
 */

export const SHAPES = ['circle', 'square', 'triangle', 'star'] as const
export const COLORS = ['red', 'blue', 'green', 'gold'] as const
export const SIZES = ['big', 'small'] as const
export const VERBS = ['chases', 'watches', 'carries'] as const

export type Shape = (typeof SHAPES)[number]
export type Color = (typeof COLORS)[number]
export type Size = (typeof SIZES)[number]
export type Verb = (typeof VERBS)[number]

export interface Thing {
  readonly shape: Shape
  readonly color: Color
  readonly size: Size
  /** Rendered exactly, but the language only ever marks one versus many. */
  readonly count: 1 | 2 | 3
}

export interface Scene {
  readonly subject: Thing
  readonly verb: Verb
  readonly object: Thing
}

export function isPlural(thing: Thing): boolean {
  return thing.count > 1
}

export function randomThing(rng: Rng): Thing {
  return {
    shape: rng.pick(SHAPES),
    color: rng.pick(COLORS),
    size: rng.pick(SIZES),
    count: rng.pick([1, 1, 2, 3] as const),
  }
}

export function randomScene(rng: Rng): Scene {
  return { subject: randomThing(rng), verb: rng.pick(VERBS), object: randomThing(rng) }
}

export function sameThing(a: Thing, b: Thing): boolean {
  return a.shape === b.shape && a.color === b.color && a.size === b.size && a.count === b.count
}

export function sameScene(a: Scene, b: Scene): boolean {
  return a.verb === b.verb && sameThing(a.subject, b.subject) && sameThing(a.object, b.object)
}

/** Every word-bearing feature in a scene, used to check a test says nothing new. */
export function vocabularyOf(scene: Scene): string[] {
  return [
    scene.verb,
    scene.subject.shape,
    scene.subject.color,
    scene.subject.size,
    scene.object.shape,
    scene.object.color,
    scene.object.size,
  ]
}

/** A near-miss of a scene: one feature changed, so telling them apart needs the grammar. */
export function twist(scene: Scene, rng: Rng): Scene {
  const swap = <T>(items: readonly T[], current: T): T => {
    const others = items.filter((item) => item !== current)
    return others[rng.int(others.length)]
  }

  switch (rng.int(6)) {
    case 0:
      return { ...scene, subject: scene.object, object: scene.subject }
    case 1:
      return { ...scene, verb: swap(VERBS, scene.verb) }
    case 2:
      return { ...scene, subject: { ...scene.subject, color: swap(COLORS, scene.subject.color) } }
    case 3:
      return { ...scene, object: { ...scene.object, shape: swap(SHAPES, scene.object.shape) } }
    case 4:
      return {
        ...scene,
        subject: { ...scene.subject, count: scene.subject.count === 1 ? 2 : 1 },
      }
    default:
      return { ...scene, object: { ...scene.object, size: swap(SIZES, scene.object.size) } }
  }
}
