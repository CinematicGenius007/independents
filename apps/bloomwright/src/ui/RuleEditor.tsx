import { useRef } from 'react'
import { ALPHABET, SYMBOL_HELP, bracketsBalance, sanitize, type Grammar } from '../engine/lsystem'

interface Props {
  grammar: Grammar
  onChange: (grammar: Grammar) => void
}

/**
 * Rules are edited as short strings, but every symbol is also a button, so the
 * alphabet stays discoverable without a manual. Typing is filtered rather than
 * validated: an unknown character simply never lands.
 */
export function RuleEditor({ grammar, onChange }: Props) {
  const lastFocused = useRef<string>('axiom')

  const setRule = (symbol: string, value: string) => {
    onChange({ ...grammar, rules: { ...grammar.rules, [symbol]: sanitize(value) } })
  }

  const insert = (symbol: string) => {
    const field = lastFocused.current
    if (field === 'axiom') onChange({ ...grammar, axiom: sanitize(grammar.axiom + symbol) })
    else setRule(field, (grammar.rules[field] ?? '') + symbol)
  }

  const ruleKeys = Object.keys(grammar.rules)

  return (
    <div className="editor">
      <label className="field">
        <span className="field-label">Axiom</span>
        <input
          value={grammar.axiom}
          onChange={(event) => onChange({ ...grammar, axiom: sanitize(event.target.value) })}
          onFocus={() => (lastFocused.current = 'axiom')}
          spellCheck={false}
        />
      </label>

      {ruleKeys.map((symbol) => {
        const value = grammar.rules[symbol]
        const broken = !bracketsBalance(value)
        return (
          <label className="field" key={symbol}>
            <span className="field-label">
              {symbol} <span className="arrow">→</span>
            </span>
            <input
              className={broken ? 'broken' : undefined}
              value={value}
              onChange={(event) => setRule(symbol, event.target.value)}
              onFocus={() => (lastFocused.current = symbol)}
              spellCheck={false}
              aria-invalid={broken}
            />
            {broken && <span className="warn">unclosed branch</span>}
          </label>
        )
      })}

      <div className="palette">
        {ALPHABET.map((symbol) => (
          <button key={symbol} onClick={() => insert(symbol)} title={SYMBOL_HELP[symbol]}>
            {symbol}
          </button>
        ))}
      </div>

      <label className="slider">
        <span className="field-label">
          Angle <b>{grammar.angle}°</b>
        </span>
        <input
          type="range"
          min={4}
          max={120}
          step={1}
          value={grammar.angle}
          onChange={(event) => onChange({ ...grammar, angle: Number(event.target.value) })}
        />
      </label>

      <label className="slider">
        <span className="field-label">
          Generations <b>{grammar.generations}</b>
        </span>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={grammar.generations}
          onChange={(event) => onChange({ ...grammar, generations: Number(event.target.value) })}
        />
      </label>
    </div>
  )
}
