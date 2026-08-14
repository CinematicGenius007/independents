import { useEffect, useMemo, useState } from 'react'
import { say, type Features } from './engine/language'
import { randomSeedText } from './engine/rng'
import type { Scene } from './engine/scene'
import {
  canAnswer,
  createStudy,
  judge,
  survivors,
  unheardAtoms,
  wordsSeen,
} from './engine/study'
import { hypothesisCount, TIERS, type TierId } from './engine/tiers'
import { SceneView } from './ui/SceneView'

const TIER_ORDER: TierId[] = ['order', 'shapeandshade', 'many', 'marked']

/** The grammar in plain words, shown only once the player is done guessing. */
function explain(features: Features): string[] {
  const lines: string[] = [
    {
      SVO: 'The doer comes first, then the action, then the thing acted on.',
      SOV: 'Both participants come first, and the action closes the sentence.',
      VSO: 'The action opens the sentence, then the doer, then the thing acted on.',
    }[features.order],
  ]

  if (features.adjectives !== 'none') {
    lines.push(`Colour and size words go ${features.adjectives} the word for the shape.`)
  }
  if (features.number !== 'none') {
    lines.push(`More than one is marked as a ${features.number}.`)
  }
  if (features.case !== 'none') {
    lines.push(`The ${features.case === 'object' ? 'thing acted on' : 'doer'} wears an extra marker, as a ${features.casePlacement}.`)
  }
  if (features.adjAgrees) lines.push('Adjectives copy that marker from the noun they describe.')
  if (features.verbAgrees !== 'none') {
    lines.push(
      features.verbAgrees === 'both'
        ? 'The action word takes the many-marker if either participant is many.'
        : `The action word agrees in number with the ${
            features.verbAgrees === 'subject' ? 'doer' : 'thing acted on'
          }.`,
    )
  }

  return lines
}

export default function App() {
  const [tier, setTier] = useState<TierId>('order')
  const [seed, setSeed] = useState('ORU-101')
  const [asked, setAsked] = useState<Scene[]>([])
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<ReturnType<typeof judge> | null>(null)
  const [done, setDone] = useState(false)

  const study = useMemo(() => createStudy(seed, tier), [seed, tier])

  useEffect(() => {
    setAsked([])
    setTyped('')
    setVerdict(null)
    setDone(false)
  }, [study])

  const left = useMemo(() => survivors(study, asked).length, [study, asked])
  const ready = useMemo(() => canAnswer(study, asked), [study, asked])
  const missingWords = useMemo(() => unheardAtoms(study, asked).length, [study, asked])
  const vocabulary = useMemo(() => wordsSeen(study, asked), [study, asked])
  const total = hypothesisCount(study.tier)

  const ask = (scene: Scene) => {
    if (asked.includes(scene) || done) return
    setAsked([...asked, scene])
  }

  const submit = () => {
    const result = judge(study, typed)
    setVerdict(result)
    if (result.right) setDone(true)
  }

  const newLanguage = () => setSeed(randomSeedText())

  return (
    <main className="app">
      <header className="masthead">
        <div className="brand">
          <h1 className="wordmark">Tonguecracker</h1>
          <p className="tagline">
            Nobody explains the language. You choose what to have translated, then you speak it.
          </p>
        </div>
        <div className="chipset">
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
            New language ↻
          </button>
        </div>
      </header>

      <section className="gauges">
        <div className="gauge">
          <span className="label">Grammars left</span>
          <span className="value">{left}</span>
          <span className="aside">of {total} this tier allows</span>
          <span className="track">
            <i style={{ width: `${(Math.log2(left) / Math.log2(total)) * 100}%` }} />
          </span>
        </div>
        <div className="gauge">
          <span className="label">Questions</span>
          <span className={`value${asked.length > study.par ? ' over' : ''}`}>{asked.length}</span>
          <span className="aside">par {study.par}</span>
        </div>
        <div className={`gauge verdict ${ready ? 'ready' : 'guessing'}`}>
          <span className="label">{ready ? 'You can answer' : 'Still guessing'}</span>
          <span className="reason">
            {ready
              ? 'Every grammar that fits your evidence says the same thing.'
              : missingWords > 0
                ? `${missingWords} word${missingWords === 1 ? '' : 's'} in it you have never heard.`
                : `${left} grammars fit your evidence and they disagree.`}
          </span>
        </div>
      </section>

      <section className="block">
        <h2 className="heading">Given free</h2>
        <ul className="cards">
          {study.gifts.map((scene, index) => (
            <li key={index} className="card">
              <SceneView scene={scene} />
              <p className="caption">{say(scene, study.language).join(' ')}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2 className="heading">
          Ask about one <em>{study.language.name} answers anything — but each answer costs a question</em>
        </h2>
        <ul className="cards rack">
          {study.rack.map((scene, index) => {
            const answered = asked.includes(scene)
            return (
              <li key={index} className={`card askable${answered ? ' answered' : ''}`}>
                <SceneView scene={scene} />
                {answered ? (
                  <p className="caption">{say(scene, study.language).join(' ')}</p>
                ) : (
                  <button className="ask" onClick={() => ask(scene)} disabled={done}>
                    How do you say this?
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block answer">
        <h2 className="heading">Now say this one</h2>
        <div className="answer-row">
          <div className="card test">
            <SceneView scene={study.test} size={260} />
          </div>
          <div className="answer-form">
            <label>
              <span className="label">Type it in {study.language.name}</span>
              <input
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value)
                  setVerdict(null)
                }}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                placeholder="…"
                spellCheck={false}
                disabled={done}
              />
            </label>
            <div className="chipset">
              <button className="chip solid" onClick={submit} disabled={done || typed.trim() === ''}>
                Say it
              </button>
              {!ready && !done && <span className="warning">You are not ready — this is a guess.</span>}
            </div>

            {verdict && !verdict.right && (
              <p className="marks">
                {verdict.answer.map((_, index) => (
                  <b key={index} className={verdict.marks[index] ? 'right' : 'wrong'}>
                    {verdict.marks[index] ? 'word right' : 'word wrong'}
                  </b>
                ))}
              </p>
            )}

            <div className="vocab">
              <span className="label">Words you have heard</span>
              <p>{vocabulary.join('  ·  ') || 'nothing yet'}</p>
            </div>
          </div>
        </div>

        {done && (
          <div className="finish">
            <h3>
              {study.language.name} cracked in {asked.length} question{asked.length === 1 ? '' : 's'}
              {asked.length <= study.par ? ' — at par' : ` (par ${study.par})`}
            </h3>
            <ul>
              {explain(study.language.features).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="chipset">
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
                  Harder language →
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="legend">
        <span>
          <svg viewBox="0 0 44 14" className="glyph">
            <line x1="3" y1="7" x2="32" y2="7" stroke="#101010" strokeWidth="2.6" strokeLinecap="round" />
            <polygon points="41,7 30,1 30,13" fill="#101010" />
          </svg>
          chases
        </span>
        <span>
          <svg viewBox="0 0 44 14" className="glyph">
            <line x1="3" y1="7" x2="41" y2="7" stroke="#101010" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" />
            <path d="M 11 7 q 11 -9 22 0 q -11 9 -22 0" fill="none" stroke="#101010" strokeWidth="2.4" />
          </svg>
          watches
        </span>
        <span>
          <svg viewBox="0 0 44 18" className="glyph">
            <line x1="3" y1="7" x2="31" y2="7" stroke="#101010" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M 27 2 q 7 14 14 0" fill="none" stroke="#101010" strokeWidth="2.6" />
          </svg>
          carries
        </span>
        <span className="note">The pictures never lie. The sentences never explain.</span>
      </footer>
    </main>
  )
}
