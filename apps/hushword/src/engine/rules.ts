import { isGuess, type WordList } from './words'

/**
 * The marks, and what a guess is worth.
 *
 * The resolution is the ordinary two-pass one, which means a repeated letter
 * consumes a repeated letter: guessing two R's against a word with one R earns
 * one shifted and one absent, in that order. Everything downstream — the
 * candidate pool, the difficulty rating, hard mode — is built on this being
 * exactly right, because a solver that disagrees with the board is unplayable.
 */

export type Mark = 'exact' | 'shifted' | 'absent'

export interface Guess {
  readonly word: string
  readonly marks: readonly Mark[]
}

export function resolveGuess(answer: string, guess: string): Mark[] {
  const target = answer.toLowerCase()
  const attempt = guess.toLowerCase()
  if (target.length !== attempt.length) {
    throw new Error(`resolveGuess: ${target.length} and ${attempt.length} do not match`)
  }

  const marks: Mark[] = new Array(attempt.length).fill('absent')
  const unclaimed = new Map<string, number>()

  for (let i = 0; i < attempt.length; i += 1) {
    if (attempt[i] === target[i]) {
      marks[i] = 'exact'
    } else {
      unclaimed.set(target[i], (unclaimed.get(target[i]) ?? 0) + 1)
    }
  }

  for (let i = 0; i < attempt.length; i += 1) {
    if (marks[i] === 'exact') continue
    const left = unclaimed.get(attempt[i]) ?? 0
    if (left > 0) {
      marks[i] = 'shifted'
      unclaimed.set(attempt[i], left - 1)
    }
  }

  return marks
}

export function isWin(marks: readonly Mark[]): boolean {
  return marks.every((mark) => mark === 'exact')
}

/** A compact key, so two guesses that say the same thing group together. */
export function signature(marks: readonly Mark[]): string {
  return marks.map((mark) => (mark === 'exact' ? 'e' : mark === 'shifted' ? 's' : 'a')).join('')
}

function sameMarks(a: readonly Mark[], b: readonly Mark[]): boolean {
  return a.length === b.length && a.every((mark, index) => mark === b[index])
}

export function consistentWith(word: string, history: readonly Guess[]): boolean {
  return history.every((guess) => sameMarks(resolveGuess(word, guess.word), guess.marks))
}

/** Everything the solver can still believe, given what they have been shown. */
export function candidates(pool: readonly string[], history: readonly Guess[]): string[] {
  if (history.length === 0) return [...pool]
  return pool.filter((word) => consistentWith(word, history))
}

/**
 * Hard mode: a proven letter has to be used again.
 *
 * Two complaints are possible — an exact letter moved, and a shifted letter
 * dropped — and they are reported separately because they are different
 * mistakes and the message should say which one it was.
 */
export function hardModeViolations(history: readonly Guess[], guess: string): string[] {
  const problems: string[] = []
  const attempt = guess.toLowerCase()

  for (const previous of history) {
    previous.marks.forEach((mark, index) => {
      if (mark !== 'exact') return
      const letter = previous.word[index]
      if (attempt[index] !== letter) {
        problems.push(`${letter.toUpperCase()} belongs in position ${index + 1}`)
      }
    })
  }

  const required = new Set<string>()
  for (const previous of history) {
    previous.marks.forEach((mark, index) => {
      if (mark === 'shifted') required.add(previous.word[index])
    })
  }
  for (const letter of required) {
    if (!attempt.includes(letter)) problems.push(`${letter.toUpperCase()} has to appear somewhere`)
  }

  return problems
}

export type Lexicon = 'strict' | 'free'

export interface WordProblem {
  readonly kind: 'length' | 'unknown'
  readonly message: string
}

export function checkWord(word: string, length: number, lexicon: Lexicon, list: WordList): WordProblem | null {
  const attempt = word.trim().toLowerCase()
  if (attempt.length !== length) {
    return { kind: 'length', message: `that is ${attempt.length} letters, and this case is ${length}` }
  }
  if (!/^[a-z]+$/.test(attempt)) {
    return { kind: 'length', message: 'letters only' }
  }
  if (lexicon === 'strict' && !isGuess(list, attempt)) {
    return { kind: 'unknown', message: `"${attempt.toUpperCase()}" is not in the lexicon` }
  }
  return null
}
