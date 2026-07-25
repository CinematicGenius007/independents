export interface WordBlanksProps {
  /** Token lengths, e.g. "ICE CREAM" -> `[3, 5]`. */
  shape: number[]
  /**
   * Revealed letters keyed by index into the joined word (spaces included),
   * matching `TurnState.revealed` semantics.
   */
  revealed: Record<number, string>
  /** When provided, reveals every letter (turn-end state) regardless of `revealed`. */
  full?: string
  className?: string
}

interface Slot {
  charIndex: number
  isSpace: boolean
}

function buildSlots(shape: number[]): Slot[][] {
  let charIndex = 0
  return shape.map((len) => {
    const word: Slot[] = []
    for (let i = 0; i < len; i++) {
      word.push({ charIndex, isSpace: false })
      charIndex++
    }
    // account for the joining space between this token and the next
    charIndex++
    return word
  })
}

/**
 * The `_ _ _ _` word display. Each letter is its own recessed pixel slot;
 * known letters (from `revealed` or a turn-end `full` reveal) sit on top of
 * the blank instead of replacing it, so the shape never jumps. Plain
 * monospace, not the chrome pixel face — this is running content, not a UI
 * label, and needs to stay legible at small sizes.
 */
export function WordBlanks({ shape, revealed, full, className = '' }: WordBlanksProps) {
  const words = buildSlots(shape)
  const label = full ?? words
    .map((word) => word.map((slot) => revealed[slot.charIndex] ?? '_').join(''))
    .join(' ')

  return (
    <div className={`flex flex-wrap items-end justify-center gap-x-4 gap-y-2 ${className}`} aria-label={`Word: ${label}`}>
      {words.map((word, wordIndex) => (
        <div key={wordIndex} className="flex gap-1">
          {word.map((slot) => {
            const letter = full ? full[slot.charIndex] : revealed[slot.charIndex]
            return (
              <span
                key={slot.charIndex}
                aria-hidden
                className="flex h-9 w-6 items-end justify-center pb-0.5 font-mono text-xl uppercase leading-none text-text sm:h-10 sm:w-7"
                style={{ borderBottom: '3px solid var(--color-stone-hi)' }}
              >
                {letter ?? ''}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
