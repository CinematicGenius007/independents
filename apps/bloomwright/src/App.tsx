import { useEffect, useMemo, useState } from 'react'
import { LEVELS, parSymbols, SANDBOX, type Level } from './engine/levels'
import { descriptionLength, expand, SYMBOL_HELP, type Grammar } from './engine/lsystem'
import { boxDimension, compare } from './engine/match'
import { walk, type Segment } from './engine/turtle'
import { PlantCanvas, type PlateView } from './ui/PlantCanvas'
import { RuleEditor } from './ui/RuleEditor'

function grow(grammar: Grammar): { segments: readonly Segment[]; truncated: boolean } {
  const expanded = expand(grammar)
  const drawing = walk(expanded.text, grammar.angle)
  return { segments: drawing.segments, truncated: expanded.truncated || drawing.truncated }
}

function describe(grammar: Grammar): string {
  const rules = Object.entries(grammar.rules)
    .filter(([symbol, value]) => value !== symbol)
    .map(([symbol, value]) => `${symbol} → ${value}`)
    .join(' · ')
  return `axiom ${grammar.axiom} · ${rules} · ${grammar.angle}° · ${grammar.generations} generations`
}

/**
 * Show a rule row for F and for any bud the grammar actually mentions.
 *
 * Idle rows reading `A → A` were noise on levels with no buds, but a player who
 * spots branching in a specimen still needs somewhere to write a bud rule — hence
 * the button that adds one on demand rather than a row that is always there.
 */
function withUsedRules(grammar: Grammar): Grammar {
  const rules: Record<string, string> = { F: 'F', ...grammar.rules }
  const text = grammar.axiom + Object.values(grammar.rules).join('')
  for (const bud of ['A', 'B']) {
    if (text.includes(bud) && rules[bud] === undefined) rules[bud] = bud
  }
  return { ...grammar, rules }
}

function unusedBud(grammar: Grammar): string | null {
  return ['A', 'B'].find((bud) => grammar.rules[bud] === undefined) ?? null
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export default function App() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [sandbox, setSandbox] = useState(false)
  const [grammar, setGrammar] = useState<Grammar>(() => withUsedRules(LEVELS[0].start))
  const [view, setView] = useState<PlateView>('overlay')
  const [cleared, setCleared] = useState<Record<string, number>>({})

  const level: Level = LEVELS[levelIndex]

  useEffect(() => {
    setGrammar(withUsedRules(sandbox ? SANDBOX : level.start))
    setView('overlay')
  }, [level, sandbox])

  const plant = useMemo(() => grow(grammar), [grammar])
  const target = useMemo(() => (sandbox ? { segments: [] } : grow(level.hidden)), [level, sandbox])
  const result = useMemo(
    () => (sandbox ? null : compare(plant.segments, target.segments)),
    [plant, target, sandbox],
  )

  const mineDimension = useMemo(() => boxDimension(plant.segments), [plant])
  const targetDimension = useMemo(() => boxDimension(target.segments), [target])

  const spent = descriptionLength(grammar)
  const par = sandbox ? 0 : parSymbols(level)
  const withinBudget = spent <= par

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
        <h1 className="wordmark">Bloomwright</h1>
        <div className="dateline">
          <span>A herbarium of grammars</span>
          <span>{sandbox ? 'Free growth' : `Plate ${ROMAN[levelIndex]} — ${level.name}`}</span>
          <span>You never draw. You write what grows.</span>
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
        <div>
          <div className="plate-wrap">
            <PlantCanvas plant={plant.segments} target={target.segments} view={sandbox ? 'mine' : view} />
          </div>
          <div className="plate-caption">
            <span>
              {plant.segments.length} strokes{plant.truncated ? ', clipped' : ''}
            </span>
            {!sandbox && (
              <div className="views">
                {(['overlay', 'difference', 'mine'] as PlateView[]).map((option) => (
                  <button
                    key={option}
                    aria-pressed={view === option}
                    onClick={() => setView(option)}
                    title={
                      option === 'difference'
                        ? 'red: specimen you have not covered · blue: ink with nothing under it'
                        : undefined
                    }
                  >
                    {option === 'mine' ? 'yours only' : option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="column">
          {sandbox ? (
            <p className="standfirst">
              Nothing to match here. Change a rule and watch what a two-character edit does to a whole
              plant.
            </p>
          ) : (
            <p className="standfirst">
              <b>{level.name}.</b> {level.brief}
            </p>
          )}

          {result && (
            <div className="figures">
              <div className="figure">
                <span className="label">Match</span>
                <span className={`value${solved ? ' good' : ''}`}>{percent(result.score)}</span>
                <span className="aside">needs {percent(level.threshold)}</span>
                <span className="bar">
                  <i style={{ width: `${result.score * 100}%` }} />
                  <u style={{ left: `${level.threshold * 100}%` }} />
                </span>
              </div>
              <div className="figure">
                <span className="label">Symbols</span>
                <span className={`value${withinBudget ? ' good' : ' over'}`}>{spent}</span>
                <span className="aside">said in {par}</span>
              </div>
              <div className="figure">
                <span className="label">Dimension</span>
                <span className="value">{mineDimension.toFixed(2)}</span>
                <span className="aside">specimen {targetDimension.toFixed(2)}</span>
              </div>
            </div>
          )}

          {result && (
            <p className="section-rule">
              {result.recall < result.precision
                ? 'You are drawing too little of it — more branching, or more generations.'
                : 'You are drawing more than is there — fewer limbs, or a tighter angle.'}
            </p>
          )}

          <RuleEditor
            grammar={grammar}
            onChange={(next) => setGrammar(withUsedRules(next))}
            onAddBud={
              unusedBud(grammar)
                ? () => {
                    const bud = unusedBud(grammar)!
                    setGrammar({ ...grammar, rules: { ...grammar.rules, [bud]: bud } })
                  }
                : undefined
            }
            addableBud={unusedBud(grammar)}
          />

          {solved && (
            <div className="finish">
              <h2>{withinBudget ? 'Grown, and briefly said' : 'Grown'}</h2>
              <p className="reveal">specimen: {describe(level.hidden)}</p>
              <p className="reveal mine">yours: {describe(grammar)}</p>
              {!withinBudget && (
                <p className="reveal">
                  {spent - par} symbols longer than the specimen. There is a shorter way to say it.
                </p>
              )}
              {levelIndex < LEVELS.length - 1 && (
                <button className="tab" onClick={() => setLevelIndex(levelIndex + 1)}>
                  Next specimen →
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="legend">
        {Object.entries(SYMBOL_HELP).map(([symbol, help]) => (
          <span key={symbol}>
            <code>{symbol}</code>
            {help}
          </span>
        ))}
      </footer>
    </main>
  )
}
