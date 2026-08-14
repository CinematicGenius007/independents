import { useEffect, useMemo, useState } from 'react'
import { LEVELS, SANDBOX, type Level } from './engine/levels'
import { expand, SYMBOL_HELP, type Grammar } from './engine/lsystem'
import { compare } from './engine/match'
import { walk, type Segment } from './engine/turtle'
import { PlantCanvas } from './ui/PlantCanvas'
import { RuleEditor } from './ui/RuleEditor'

function grow(grammar: Grammar): { segments: readonly Segment[]; truncated: boolean } {
  const expanded = expand(grammar)
  const drawing = walk(expanded.text, grammar.angle)
  return { segments: drawing.segments, truncated: expanded.truncated || drawing.truncated }
}

function describe(grammar: Grammar): string {
  const rules = Object.entries(grammar.rules)
    .map(([symbol, value]) => `${symbol} → ${value}`)
    .join(' · ')
  return `axiom ${grammar.axiom} · ${rules} · ${grammar.angle}° · ${grammar.generations} generations`
}

/**
 * Every grammar gets a row for each bud and for F, even when a level does not use
 * them. Without it a player can see a bud in the target and have nowhere to type
 * its rule.
 */
function withEveryRule(grammar: Grammar): Grammar {
  return { ...grammar, rules: { A: 'A', B: 'B', F: 'F', ...grammar.rules } }
}

export default function App() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [sandbox, setSandbox] = useState(false)
  const [grammar, setGrammar] = useState<Grammar>(() => withEveryRule(LEVELS[0].start))
  const [showTarget, setShowTarget] = useState(true)
  const [cleared, setCleared] = useState<Record<string, number>>({})

  const level: Level = LEVELS[levelIndex]

  useEffect(() => {
    setGrammar(withEveryRule(sandbox ? SANDBOX : level.start))
  }, [level, sandbox])

  const plant = useMemo(() => grow(grammar), [grammar])
  const target = useMemo(() => (sandbox ? { segments: [] } : grow(level.hidden)), [level, sandbox])
  const result = useMemo(
    () => (sandbox ? null : compare(plant.segments, target.segments)),
    [plant, target, sandbox],
  )

  const solved = result !== null && result.score >= level.threshold

  useEffect(() => {
    if (!solved) return
    setCleared((previous) =>
      previous[level.id] === undefined || result!.score > previous[level.id]
        ? { ...previous, [level.id]: result!.score }
        : previous,
    )
  }, [solved, level.id, result])

  const percent = (value: number) => `${Math.round(value * 100)}%`

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <h1 className="wordmark">Bloomwright</h1>
          <p className="tagline">
            You never draw. You write the rules a plant follows, and the plant draws itself.
          </p>
        </div>
      </header>

      <nav className="rail" aria-label="levels">
        {LEVELS.map((entry, index) => (
          <button
            key={entry.id}
            className="tab"
            aria-pressed={!sandbox && index === levelIndex}
            onClick={() => {
              setSandbox(false)
              setLevelIndex(index)
            }}
          >
            {entry.name}
            {cleared[entry.id] !== undefined && <i className="tick" aria-label="cleared" />}
          </button>
        ))}
        <button className="tab" aria-pressed={sandbox} onClick={() => setSandbox(true)}>
          Free growth
        </button>
      </nav>

      <section className="bench">
        <div className="plate-wrap">
          <PlantCanvas plant={plant.segments} target={target.segments} showTarget={showTarget && !sandbox} />
          <div className="plate-foot">
            <span>{plant.segments.length} strokes{plant.truncated ? ', clipped' : ''}</span>
            {!sandbox && (
              <button className="ghost-toggle" onClick={() => setShowTarget((value) => !value)}>
                {showTarget ? 'Hide specimen' : 'Show specimen'}
              </button>
            )}
          </div>
        </div>

        <div className="side">
          {sandbox ? (
            <p className="brief">
              Nothing to match here. Change a rule and watch what a two-character edit does to a
              whole plant.
            </p>
          ) : (
            <p className="brief">
              <b>{level.name}.</b> {level.brief}
            </p>
          )}

          {result && (
            <div className={`meter${solved ? ' solved' : ''}`}>
              <div className="meter-head">
                <span className="score">{percent(result.score)}</span>
                <span className="need">needs {percent(level.threshold)}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${result.score * 100}%` }} />
                <u style={{ left: `${level.threshold * 100}%` }} />
              </div>
              <div className="split">
                <span>on the specimen {percent(result.precision)}</span>
                <span>specimen covered {percent(result.recall)}</span>
              </div>
            </div>
          )}

          <RuleEditor grammar={grammar} onChange={setGrammar} />

          {solved && (
            <div className="finish">
              <h2>Grown.</h2>
              <p className="reveal">{describe(level.hidden)}</p>
              <p className="reveal mine">yours: {describe(grammar)}</p>
              {levelIndex < LEVELS.length - 1 && (
                <button className="tab" onClick={() => setLevelIndex(levelIndex + 1)}>
                  Next specimen
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="legend">
        {Object.entries(SYMBOL_HELP).map(([symbol, help]) => (
          <span key={symbol}>
            <code>{symbol}</code> {help}
          </span>
        ))}
      </footer>
    </main>
  )
}
