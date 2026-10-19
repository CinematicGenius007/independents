import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { newGame, scoreSheet, submit, type GameState } from '../engine/game'
import { buildReveal, commitmentFor, forgetSealed, sealedCases, type SealedRecord } from '../engine/link'
import { wordListFor, type WordList } from '../engine/words'
import { Board, copyText, Eyebrow, Panel, Rule, Section, type PlayedRow } from './bits'

/**
 * Grading a sealed case.
 *
 * A sealed link cannot grade anything, because it does not have the word — so
 * the solver sends their guesses back and the setter's browser, which does have
 * it, decides. That round trip is the whole posture, and until this screen
 * existed the round trip had nowhere to happen.
 *
 * The output is a reveal: the word, the nonce that was kept out of the link, the
 * commitment they have to match, and the guesses. Anyone can check it. That is
 * what makes the seal a promise rather than a claim.
 */
/**
 * The receipt is whatever a person pasted into a chat window.
 *
 * It arrives numbered, one guess per line, the way the sealed screen hands it
 * over — so numbering, punctuation and stray characters are stripped rather than
 * reported as a bad word. Only letters survive.
 */
function parseReceipt(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((word) => word.replace(/[^a-z]/gi, '').toLowerCase())
    .filter((word) => word.length > 0)
}

export function Grade({ navigate }: { navigate: (hash: string) => void }): ReactNode {
  const [cases, setCases] = useState<SealedRecord[]>(() => sealedCases())
  const [chosen, setChosen] = useState<SealedRecord | null>(null)
  const [receipt, setReceipt] = useState('')
  const [list, setList] = useState<WordList | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!chosen) return
    let live = true
    setList(null)
    void wordListFor(chosen.config.length).then((next) => {
      if (live) setList(next)
    })
    return () => {
      live = false
    }
  }, [chosen])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const guesses = useMemo(() => parseReceipt(receipt), [receipt])

  const graded = useMemo((): { state: GameState; used: number; ignored: number } | { problem: string } | null => {
    if (!chosen || !list || guesses.length === 0) return null
    let state: GameState = newGame(chosen.config, chosen.answer)
    let used = 0
    for (const guess of guesses) {
      const result = submit(state, guess, list)
      if (result.problem) return { problem: `${guess.toUpperCase()} — ${result.problem}` }
      state = result.state
      used += 1
      // A receipt can carry guesses past the end of the puzzle — a solver who kept
      // typing, or pasted the same line twice. The verdict is already decided at
      // that point, so the rest is ignored rather than treated as an error.
      if (state.status !== 'playing') break
    }
    return { state, used, ignored: guesses.length - used }
  }, [chosen, list, guesses])

  const intact = chosen !== null && commitmentFor(chosen.answer, chosen.config, chosen.nonce) === chosen.commitment

  const reveal = useMemo(() => {
    if (!chosen || !('state' in (graded ?? {}))) return null
    const built = graded as { state: GameState }
    return buildReveal(chosen.config, chosen.answer, chosen.nonce, built.state.turns.map((turn) => turn.word), chosen.commitment)
  }, [chosen, graded])

  const rows: PlayedRow[] =
    graded && 'state' in graded ? graded.state.turns.map((turn) => ({ word: turn.word, shown: turn.marks })) : []

  return (
    <div className="stack" style={{ gap: '1.75rem' }}>
      <div className="stack">
        <Eyebrow>HUSHWORD · GRADE</Eyebrow>
        <h1>Someone played your sealed puzzle.</h1>
        <div className="prose" style={{ maxWidth: '44rem' }}>
          This link could not grade itself — it never had the word. Your browser does, if it is the one that made the
          puzzle. Paste the receipt they sent back and the board gets decided here.
        </div>
        <Rule wide />
      </div>

      {cases.length === 0 ? (
        <Panel>
          <Eyebrow pink>NOTHING SEALED IN THIS BROWSER</Eyebrow>
          <div className="prose">
            A sealed puzzle exists only where it was made. If you built one somewhere else, or cleared your storage, the
            word is gone and no screen can bring it back — which is exactly what a server would have prevented, and what
            this app does not have.
          </div>
          <button type="button" className="btn" onClick={() => navigate('#/compose')}>
            make a sealed puzzle
          </button>
        </Panel>
      ) : (
        <Section title={`SEALED FROM THIS BROWSER (${cases.length})`}>
          <div className="stack">
            {cases.map((entry) => (
              <div
                key={entry.commitment}
                className="panel"
                style={entry.commitment === chosen?.commitment ? { borderColor: 'var(--pink)' } : undefined}
              >
                <div className="row row--between">
                  <span className="row">
                    <span className="eyebrow" style={{ color: 'var(--ink)' }}>
                      {entry.config.seed}
                    </span>
                    <span className="eyebrow">
                      {entry.config.length} LETTERS · {entry.config.rows} ROWS
                    </span>
                  </span>
                  <span className="row">
                    <span className="eyebrow">{entry.commitment.slice(0, 12)}…</span>
                    <button type="button" className="chip" onClick={() => setChosen(entry)}>
                      {entry.commitment === chosen?.commitment ? 'chosen' : 'choose'}
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        forgetSealed(entry.commitment)
                        setCases(sealedCases())
                        if (entry.commitment === chosen?.commitment) setChosen(null)
                      }}
                    >
                      forget
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {chosen ? (
        <>
          <Section
            title="THE RECEIPT"
            note={
              <span className="eyebrow" style={{ color: intact ? 'var(--cyan)' : 'var(--pink)' }}>
                {intact ? 'SEAL INTACT IN STORAGE' : 'THE STORED NONCE NO LONGER MATCHES'}
              </span>
            }
          >
            <div className="prose">
              The guesses they sent back, in order, separated by spaces or newlines. Anything that is not a word in the
              lexicon is reported rather than quietly skipped.
            </div>
            <textarea
              className="field"
              style={{ height: '5rem', padding: '0.625rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              value={receipt}
              placeholder="danger wander damage"
              onChange={(event) => setReceipt(event.target.value)}
            />
            <div className="row row--between">
              <span className="eyebrow">{guesses.length} GUESSES</span>
              {list === null ? <span className="eyebrow">FETCHING THE LEXICON</span> : null}
              {graded && 'ignored' in graded && graded.ignored > 0 ? (
                <span className="eyebrow">{graded.ignored} PAST THE END, IGNORED</span>
              ) : null}
              {graded && 'problem' in graded ? (
                <span className="eyebrow" style={{ color: 'var(--pink)' }}>
                  {graded.problem}
                </span>
              ) : null}
            </div>
          </Section>

          {graded && 'state' in graded ? (
            <>
              <div className="centre" style={{ alignItems: 'flex-start' }}>
                <div className="row row--between" style={{ width: '100%' }}>
                  <span className="eyebrow">
                    {graded.state.status === 'won'
                      ? `SOLVED IN ${graded.state.turns.length} OF ${chosen.config.rows}`
                      : graded.state.status === 'lost'
                        ? 'RAN OUT OF ROWS'
                        : 'STILL PLAYING — MORE ROWS TO COME'}
                  </span>
                  <span className="eyebrow" style={{ color: 'var(--pink)' }}>
                    THE WORD WAS {chosen.answer.toUpperCase()}
                  </span>
                </div>
                <Board
                  rows={rows}
                  total={chosen.config.rows}
                  length={chosen.config.length}
                  ink={newGame(chosen.config, chosen.answer).ink}
                  tileSize={chosen.config.length > 7 ? '2.5rem' : '2.75rem'}
                  won={graded.state.status === 'won'}
                />
              </div>

              <Section title="THE SHEET">
                <div className="sheet">{scoreSheet(graded.state)}</div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void copyText(scoreSheet(graded.state))
                    setToast('sheet copied')
                  }}
                >
                  copy the sheet
                </button>
              </Section>

              {reveal ? (
                <Section title="THE REVEAL">
                  <div className="prose">
                    Send this back. It carries the word, the nonce that was kept out of the original link, the
                    commitment they have to match and every guess — so they can check that the word you are showing them
                    is the one the seal was built on, rather than one chosen after reading their guesses.
                  </div>
                  <Panel accent>
                    <div className="sheet" style={{ wordBreak: 'break-all' }}>
                      {reveal.fragment}
                    </div>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        void copyText(`${location.origin}${location.pathname}${reveal.fragment}`)
                        setToast('reveal copied')
                      }}
                    >
                      copy the reveal
                    </button>
                  </Panel>
                </Section>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
