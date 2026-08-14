import { useEffect, useMemo, useState } from 'react'
import { say, type Features } from './engine/language'
import { generatePuzzle, TIERS, type TierId } from './engine/puzzle'
import { randomSeedText } from './engine/rng'
import { sameScene } from './engine/scene'
import { SceneView } from './ui/SceneView'

const TIER_ORDER: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

/** The grammar, in plain words, shown only once the player is done guessing. */
function explain(features: Features): string[] {
  const lines: string[] = []
  lines.push(
    {
      SVO: 'The doer comes first, then the action, then the thing acted on.',
      SOV: 'Both participants come first, and the action closes the sentence.',
      VSO: 'The action opens the sentence, then the doer, then the thing acted on.',
    }[features.order],
  )

  if (features.adjectives !== 'none') {
    lines.push(`Colour and size words go ${features.adjectives} the word for the shape.`)
  }
  if (features.number === 'suffix') lines.push('More than one is marked by an ending on the word.')
  if (features.number === 'prefix') lines.push('More than one is marked by a piece stuck on the front.')
  if (features.case === 'object') lines.push('The thing being acted on wears an extra marker.')
  if (features.case === 'subject') lines.push('The doer wears an extra marker.')
  if (features.adjAgrees) lines.push('Adjectives copy that marker from the noun they describe.')
  if (features.verbNumber) lines.push('The action word also takes the many-marker when its doer is many.')

  return lines
}

export default function App() {
  const [tier, setTier] = useState<TierId>('order')
  const [seed, setSeed] = useState('ORU-101')
  const [phase, setPhase] = useState<'reading' | 'writing' | 'done'>('reading')
  const [readingPick, setReadingPick] = useState<number | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [verdict, setVerdict] = useState<boolean[] | null>(null)
  const [attempts, setAttempts] = useState(0)

  const puzzle = useMemo(() => generatePuzzle(seed, tier), [seed, tier])

  useEffect(() => {
    setPhase('reading')
    setReadingPick(null)
    setDraft([])
    setVerdict(null)
    setAttempts(0)
  }, [puzzle])

  const readingSentence = say(puzzle.reading, puzzle.language).join(' ')
  const readingRight = readingPick !== null && sameScene(puzzle.lineup[readingPick], puzzle.reading)

  const used = new Map<string, number>()
  for (const word of draft) used.set(word, (used.get(word) ?? 0) + 1)

  const submit = () => {
    const marks = puzzle.answer.map((word, index) => draft[index] === word)
    const right = marks.every(Boolean) && draft.length === puzzle.answer.length
    setVerdict(marks)
    setAttempts((count) => count + 1)
    if (right) setPhase('done')
  }

  const newLanguage = () => setSeed(randomSeedText())

  return (
    <main className="app">
      <header className="masthead">
        <h1 className="wordmark">Tonguecracker</h1>
        <p className="tagline">
          Nobody will explain the language to you. Watch it being used, then use it.
        </p>
      </header>

      <div className="rack">
        {TIER_ORDER.map((option) => (
          <button
            key={option}
            className="chip"
            aria-pressed={option === tier}
            onClick={() => setTier(option)}
          >
            {TIERS[option].label}
          </button>
        ))}
        <button className="chip ghost" onClick={newLanguage}>
          New language
        </button>
        <span className="seed">{puzzle.language.name} · {puzzle.seed}</span>
      </div>

      <p className="brief">{puzzle.tier.blurb}</p>

      <section className="corpus">
        <h2 className="section-label">What you have been shown</h2>
        <ul className="examples">
          {puzzle.examples.map((example, index) => (
            <li key={index}>
              <SceneView scene={example} />
              <p className="sentence">{say(example, puzzle.language).join(' ')}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="task">
        <h2 className="section-label">Which picture is this sentence about?</h2>
        <p className="sentence big">{readingSentence}</p>
        <ul className="lineup">
          {puzzle.lineup.map((candidate, index) => (
            <li key={index}>
              <button
                className={`choice${readingPick === index ? (readingRight ? ' right' : ' wrong') : ''}`}
                onClick={() => setReadingPick(index)}
                disabled={readingRight}
              >
                <SceneView scene={candidate} muted={readingPick !== null && readingPick !== index} />
              </button>
            </li>
          ))}
        </ul>
        {readingPick !== null && (
          <p className={`verdict${readingRight ? ' good' : ' bad'}`}>
            {readingRight ? (
              <>Right. Now say something yourself.</>
            ) : (
              <>Not that one. Something in the sentence marks who is doing what — look again.</>
            )}
          </p>
        )}
        {readingRight && phase === 'reading' && (
          <button className="chip solid" onClick={() => setPhase('writing')}>
            Continue
          </button>
        )}
      </section>

      {(phase === 'writing' || phase === 'done') && (
        <section className="task">
          <h2 className="section-label">Now describe this one</h2>
          <div className="target">
            <SceneView scene={puzzle.test} size={260} />
          </div>

          <div className="answer-line" aria-label="your sentence">
            {draft.length === 0 && <span className="hint">tap words below to build a sentence</span>}
            {draft.map((word, index) => (
              <button
                key={`${word}-${index}`}
                className={`word${verdict ? (verdict[index] ? ' right' : ' wrong') : ''}`}
                onClick={() => {
                  setDraft(draft.filter((_, at) => at !== index))
                  setVerdict(null)
                }}
                disabled={phase === 'done'}
              >
                {word}
              </button>
            ))}
          </div>

          <div className="bank">
            {puzzle.bank.map((word) => (
              <button
                key={word}
                className="word"
                onClick={() => {
                  setDraft([...draft, word])
                  setVerdict(null)
                }}
                disabled={phase === 'done'}
              >
                {word}
              </button>
            ))}
          </div>

          {phase === 'writing' && (
            <div className="rack">
              <button className="chip solid" onClick={submit} disabled={draft.length === 0}>
                Say it
              </button>
              <button className="chip" onClick={() => { setDraft([]); setVerdict(null) }}>
                Clear
              </button>
              {attempts >= 2 && (
                <button className="chip ghost" onClick={() => setPhase('done')}>
                  Give up and see it
                </button>
              )}
            </div>
          )}

          {verdict && phase === 'writing' && (
            <p className="verdict bad">
              Not yet. {verdict.filter(Boolean).length} of {puzzle.answer.length} words are in the right
              place.
              {attempts >= 2 && ' The examples do settle this — every one of them is evidence.'}
            </p>
          )}
        </section>
      )}

      {phase === 'done' && (
        <section className="finish">
          <h2>{puzzle.language.name}, cracked open</h2>
          <p className="sentence big">{puzzle.answer.join(' ')}</p>
          <ul className="rules">
            {explain(puzzle.language.features).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="rack">
            <button className="chip solid" onClick={newLanguage}>
              Another language
            </button>
            {TIER_ORDER.indexOf(tier) < TIER_ORDER.length - 1 && (
              <button
                className="chip"
                onClick={() => {
                  setTier(TIER_ORDER[TIER_ORDER.indexOf(tier) + 1])
                  setSeed(randomSeedText())
                }}
              >
                Harder language
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="legend">
        <span>
          <svg viewBox="0 0 40 12" className="glyph">
            <line x1="2" y1="6" x2="30" y2="6" stroke="currentColor" strokeWidth="2" />
            <polygon points="38,6 28,1 28,11" fill="currentColor" />
          </svg>
          chases
        </span>
        <span>
          <svg viewBox="0 0 40 12" className="glyph">
            <line x1="2" y1="6" x2="38" y2="6" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" />
            <circle cx="20" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          watches
        </span>
        <span>
          <svg viewBox="0 0 40 16" className="glyph">
            <line x1="2" y1="6" x2="38" y2="6" stroke="currentColor" strokeWidth="2" />
            <path d="M 26 6 q 6 9 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          carries
        </span>
        <span className="note">The pictures never lie. The sentences never explain.</span>
      </footer>
    </main>
  )
}
