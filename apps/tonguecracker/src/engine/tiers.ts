import type {
  AdjectivePlacement,
  AffixPlacement,
  CaseMarking,
  NumberMarking,
  Order,
  VerbAgreement,
} from './language'

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
    readonly casePlacement: readonly AffixPlacement[]
    readonly adjAgrees: readonly boolean[]
    readonly verbAgrees: readonly VerbAgreement[]
  }
  /** Tiers below `many` keep every group singular, so nothing is unmarked. */
  readonly allowPlural: boolean
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
      casePlacement: ['suffix'],
      adjAgrees: [false],
      verbAgrees: ['none'],
    },
    allowPlural: false,
  },
  shapeandshade: {
    id: 'shapeandshade',
    label: 'Describing',
    blurb: 'Things have colour and size now. Which side of the noun do those words take?',
    allowed: {
      order: ORDERS,
      adjectives: ['before', 'after'],
      number: ['none'],
      case: ['none'],
      casePlacement: ['suffix'],
      adjAgrees: [false],
      verbAgrees: ['none'],
    },
    allowPlural: false,
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
      casePlacement: ['suffix'],
      adjAgrees: [false],
      verbAgrees: ['none', 'subject', 'object'],
    },
    allowPlural: true,
  },
  marked: {
    id: 'marked',
    label: 'Marked',
    blurb: 'One participant wears a marker. Work out which, which end it sits on, and what copies it.',
    allowed: {
      order: ORDERS,
      adjectives: ['before', 'after'],
      number: ['suffix', 'prefix'],
      case: ['object', 'subject'],
      casePlacement: ['suffix', 'prefix'],
      adjAgrees: [false, true],
      verbAgrees: ['none', 'subject', 'object', 'both'],
    },
    allowPlural: true,
  },
}

/** How many grammars a tier allows before any evidence at all. */
export function hypothesisCount(tier: Tier): number {
  const { allowed } = tier
  return (
    allowed.order.length *
    allowed.adjectives.length *
    allowed.number.length *
    allowed.case.length *
    allowed.casePlacement.length *
    allowed.adjAgrees.length *
    allowed.verbAgrees.length
  )
}
