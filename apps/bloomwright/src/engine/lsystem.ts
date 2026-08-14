/**
 * The rewriting half of the game.
 *
 * A grammar is an axiom plus a production per symbol. Expansion replaces every
 * symbol that has a production, all at once, once per generation. Nothing about
 * drawing lives here — this file only turns a short string into a long one.
 */

export interface Grammar {
  readonly axiom: string
  /** Symbol -> replacement. Symbols without a production stand for themselves. */
  readonly rules: Readonly<Record<string, string>>
  readonly angle: number
  readonly generations: number
}

/** Symbols the turtle understands, plus the two variables that only expand. */
export const ALPHABET = ['F', 'G', '+', '-', '|', '>', '<', '[', ']', 'A', 'B'] as const
export type Symbol = (typeof ALPHABET)[number]

export const SYMBOL_HELP: Record<string, string> = {
  F: 'draw forward',
  G: 'move forward without drawing',
  '+': 'turn left by the angle',
  '-': 'turn right by the angle',
  '|': 'turn right around',
  '>': 'shorten every step after this',
  '<': 'lengthen every step after this',
  '[': 'remember this spot',
  ']': 'jump back to it',
  A: 'a bud — becomes its rule',
  B: 'a second bud',
}

/** Expansion is exponential, so it is capped rather than trusted. */
export const MAX_EXPANDED = 60_000

export function expand(grammar: Grammar): { text: string; truncated: boolean } {
  let current = grammar.axiom
  let truncated = false

  for (let generation = 0; generation < grammar.generations; generation += 1) {
    let next = ''
    for (const symbol of current) {
      next += grammar.rules[symbol] ?? symbol
      if (next.length > MAX_EXPANDED) {
        truncated = true
        break
      }
    }
    current = next
    if (truncated) break
  }

  return { text: current, truncated }
}

/**
 * How long is the description?
 *
 * The interesting question about a shape is not only whether you can draw it but
 * how briefly you can say it, so every level carries a symbol budget taken from
 * the grammar that made the specimen. Rules that rewrite a symbol to itself cost
 * nothing — they are not saying anything.
 */
export function descriptionLength(grammar: Grammar): number {
  let total = grammar.axiom.length
  for (const [symbol, value] of Object.entries(grammar.rules)) {
    if (value === symbol) continue
    total += 1 + value.length
  }
  return total
}

export function isValidGrammarText(text: string): boolean {
  return [...text].every((symbol) => (ALPHABET as readonly string[]).includes(symbol))
}

/** Strip anything the turtle cannot read, so typing never breaks the preview. */
export function sanitize(text: string): string {
  return [...text].filter((symbol) => (ALPHABET as readonly string[]).includes(symbol)).join('')
}

/** Bracket depth has to return to zero, or the drawing is missing a branch. */
export function bracketsBalance(text: string): boolean {
  let depth = 0
  for (const symbol of text) {
    if (symbol === '[') depth += 1
    if (symbol === ']') depth -= 1
    if (depth < 0) return false
  }
  return depth === 0
}
