import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { GameConfig, GameState } from '../engine/game'
import { clockSeconds, expire, newGame, knownLetters, peek, remaining, scoreSheet, spendHint, spendLift, submit, visibleMarks } from '../engine/game'
import { openLink, commitmentFor } from '../engine/link'
import { inspectPalette } from '../engine/palette'
import { analyseMap } from '../engine/redaction'
import { resolveGuess } from '../engine/rules'
import { answersOfLength, wordListFor, type WordList } from '../engine/words'
import { Board, Cell, copyText, describeRow, Eyebrow, Panel, REVEAL_MS, RoleLegend, Section, type PlayedRow } from './bits'
import { loadCase, recordResult, saveCase } from './store'
import { useSizes } from './sizing'

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

const KEY_CLASS: Record<'exact' | 'shifted' | 'absent', string> = {
  exact: 'ink-hit',
  shifted: 'ink-near',
  absent: 'ink-miss',
}

function Bed({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="stack" style={{ gap: '0.625rem' }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  )
}

/**
 * The keyboard may only know what the solver is allowed to know.
 *
 * Barred cells are skipped, so a redaction never leaks through the keys — the
 * one place a careless implementation would give the whole board away.
 */
function keyStates(rows: readonly PlayedRow[]): Record<string, 'exact' | 'shifted' | 'absent'> {
  const rank = { absent: 0, shifted: 1, exact: 2 } as const
  const out: Record<string, 'exact' | 'shifted' | 'absent'> = {}
  for (const row of rows) {
    row.shown.forEach((mark: string, cell: number) => {
      if (mark === 'barred') return
      const letter = row.word[cell]
      const state = mark as 'exact' | 'shifted' | 'absent'
      const current = out[letter]
      if (!current || rank[state] > rank[current]) out[letter] = state
    })
  }
  return out
}

export function Play({ fragment, navigate, recordAs, onFinish }: { fragment: string; navigate: (hash: string) => void; recordAs?: string; onFinish?: () => void }): ReactNode {
  const [passphrase, setPassphrase] = useState('')

  const opened = useMemo(() => {
    try {
      return openLink(fragment, passphrase.length > 0 ? passphrase : undefined)
    } catch (error) {
      return { kind: 'broken' as const, message: error instanceof Error ? error.message : String(error) }
    }
  }, [fragment, passphrase])

  if (opened.kind === 'broken') {
    return (
      <div className="stack">
        <Eyebrow pink>THIS LINK WILL NOT OPEN</Eyebrow>
        <h1>Nothing to solve here.</h1>
        <Panel>
          <div className="prose">{opened.message}</div>
        </Panel>
        <button type="button" className="btn" onClick={() => navigate('#/')}>
          back to the room
        </button>
      </div>
    )
  }

  if (opened.kind === 'locked') {
    return (
      <div className="stack">
        <Eyebrow>VAULT</Eyebrow>
        <h1>This one needs the passphrase.</h1>
        <div className="prose">
          The word is not in the link. It is ChaCha20 ciphertext until you type the words the setter sent you
          separately, and nothing here can open it without them. That is the whole point of this posture.
        </div>
        <input
          className="field"
          type="password"
          placeholder="passphrase"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
        />
        <button type="button" className="btn" onClick={() => navigate('#/')}>
          back to the room
        </button>
      </div>
    )
  }

  if (opened.kind === 'sealed') {
    return <Sealed config={opened.config} navigate={navigate} />
  }

  if (opened.kind === 'revealed') {
    return (
      <Revealed
        config={opened.config}
        answer={opened.answer}
        nonce={opened.nonce}
        commitment={opened.commitment}
        guesses={opened.guesses}
        navigate={navigate}
      />
    )
  }

  return <Match key={fragment} config={opened.config} answer={opened.answer} fragment={fragment} navigate={navigate} recordAs={recordAs} onFinish={onFinish} />
}

/**
 * A reveal, opened by the solver.
 *
 * The whole value of a sealed case is that this can be checked rather than
 * believed, so the first thing on the screen is the check: the commitment in the
 * link the solver was sent, against the word and the nonce they are being shown
 * now. Everything below it is a record of what happened.
 */
function Revealed({
  config,
  answer,
  nonce,
  commitment,
  guesses,
  navigate,
}: {
  config: GameConfig
  answer: string
  nonce: string
  commitment?: string
  guesses: readonly string[]
  navigate: (hash: string) => void
}): ReactNode {
  const rows: PlayedRow[] = guesses.map((word) => ({ word, shown: resolveGuess(answer, word) }))
  const position = rows.findIndex((row) => row.shown.every((mark) => mark === 'exact'))
  const intact = commitment !== undefined ? commitmentFor(answer, config, nonce) === commitment : null
  const ink = newGame(config, answer).ink

  const sheet = [
    `HUSHWORD ${config.seed} · ${
      position >= 0 ? `SOLVED IN ${position + 1} OF ${config.rows}` : `UNSOLVED, ${config.rows} ROWS`
    }`,
    ...rows.map((row) =>
      row.shown.map((mark) => (mark === 'exact' ? 'X' : mark === 'shifted' ? 'O' : '.')).join(''),
    ),
  ].join('\n')

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div className="row row--between">
        <Eyebrow>SEALED · REVEALED</Eyebrow>
        <Eyebrow>{config.seed}</Eyebrow>
      </div>

      <h1>
        {intact === false
          ? 'This seal does not check out.'
          : position >= 0
            ? 'The word held up, and they got it.'
            : 'The word held up, and they did not get it.'}
      </h1>

      {intact !== null ? <span className="stamp">{intact ? 'SEAL VERIFIED' : 'BROKEN SEAL'}</span> : null}

      <div className="prose" style={{ maxWidth: '44rem' }}>
        {intact === false
          ? 'The word and the nonce in this reveal do not hash to the commitment in the link you were sent. Whatever is below happened, but it did not happen to the word you agreed to.'
          : intact === true
            ? 'The word and the nonce in this reveal hash to the commitment in the link you were sent, so the word was fixed before you played. Nobody chose it after reading your guesses.'
            : 'This reveal carries no commitment to check, so there is nothing here to verify. The guesses are still recorded.'}
      </div>

      <div className="row row--between">
        <span className="eyebrow">THE WORD WAS</span>
        <span className="eyebrow" style={{ color: 'var(--pink)' }}>
          {answer.toUpperCase()}
        </span>
      </div>

      <Board rows={rows} total={Math.max(config.rows, rows.length)} length={config.length} ink={ink} tileSize="2.75rem" />

      <Section title="THE SHEET">
        <div className="sheet">{sheet}</div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void copyText(sheet)
          }}
        >
          copy the sheet
        </button>
      </Section>

      <button type="button" className="btn" onClick={() => navigate('#/')}>
        back to the room
      </button>
    </div>
  )
}

/**
 * A sealed link.
 *
 * The board cannot grade anything, because it does not have the word — so it
 * does the only honest thing available: keeps the guesses in order and hands
 * them back for the setter's browser to judge.
 */
function Sealed({ config, navigate }: { config: GameConfig; navigate: (hash: string) => void }): ReactNode {
  const [typed, setTyped] = useState('')
  const [guesses, setGuesses] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const add = useCallback(() => {
    if (typed.length !== config.length) {
      setToast(`that is ${typed.length} letters, and this puzzle is ${config.length}`)
      return
    }
    setGuesses((current) => [...current, typed])
    setTyped('')
  }, [typed, config.length])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const receipt = guesses.map((guess, index) => `${index + 1}. ${guess.toUpperCase()}`).join('\n')

  return (
    <div className="stack">
      <Eyebrow pink>SEALED</Eyebrow>
      <h1>Nobody here can grade this.</h1>
      <div className="prose">
        The link carries a commitment and nothing else. The word never left the browser that made it, so the board
        cannot tell you whether you are right. It keeps your guesses in order and you send them back.
      </div>
      <Bed label="YOUR GUESSES">
        <div className="row">
          <input
            className="field field--word"
            style={{ letterSpacing: '0.3em' }}
            value={typed}
            maxLength={config.length}
            placeholder={'·'.repeat(config.length)}
            onChange={(event) => setTyped(event.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
            }}
          />
          <button type="button" className="btn btn--primary" onClick={add}>
            add
          </button>
        </div>
        <Panel>
          <div className="row row--between">
            <Eyebrow>YOUR RECEIPT</Eyebrow>
            <button type="button" className="chip" onClick={() => void copyText(receipt)}>
              copy
            </button>
          </div>
          <div className="sheet">{receipt.length > 0 ? receipt : 'nothing yet'}</div>
        </Panel>
        <div className="prose">
          Send that back. The setter's browser holds the word and the nonce, grades it, and publishes a reveal you can
          check against the commitment in this link.
        </div>
      </Bed>
      <button type="button" className="btn" onClick={() => navigate('#/')}>
        back to the room
      </button>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

function Match({
  config,
  answer,
  fragment,
  navigate,
  recordAs,
  onFinish,
}: {
  config: GameConfig
  answer: string
  fragment: string
  navigate: (hash: string) => void
  /** Where to file the result, for a puzzle that counts towards something. */
  recordAs?: string
  onFinish?: () => void
}): ReactNode {
  const restored = useMemo(() => loadCase(fragment, config.seed), [fragment, config.seed])
  const [state, setState] = useState<GameState>(() => restored?.state ?? newGame(config, answer))
  const [typed, setTyped] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [lifting, setLifting] = useState(false)
  const [armed, setArmed] = useState(false)
  const [list, setList] = useState<WordList | null>(null)
  const [shake, setShake] = useState(0)
  /** Rows that were told rather than shown. Kept forever; see Board. */
  const [staged, setStaged] = useState<readonly number[]>([])
  /** Input is locked while the board is mid-sentence. */
  const [locked, setLocked] = useState(false)
  const [elapsed, setElapsed] = useState(() => restored?.elapsed ?? 0)

  // A half-finished puzzle is kept, so a link you were sent is still there
  // tomorrow. A finished one is a result, and is filed instead.
  useEffect(() => {
    saveCase(fragment, config.seed, state, elapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment, config.seed, state])

  const filed = useRef(false)
  useEffect(() => {
    if (state.status === 'playing' || filed.current) return
    filed.current = true
    if (recordAs) {
      recordResult({ id: recordAs, solved: state.status === 'won', guesses: state.turns.length, at: Date.now() })
    }
    onFinish?.()
  }, [state.status, state.turns.length, recordAs, onFinish])

  // The dictionary is one module per word length and arrives when it is needed.
  useEffect(() => {
    let live = true
    void wordListFor(config.length).then((next) => {
      if (live) setList(next)
    })
    return () => {
      live = false
    }
  }, [config.length])

  const playing = state.status === 'playing'

  const rows: PlayedRow[] = useMemo(
    () => state.turns.map((turn, row) => ({ word: turn.word, shown: visibleMarks(state, row) })),
    [state],
  )

  const left = useMemo(() => remaining(state).length, [state])
  const pool = useMemo(() => answersOfLength(config.length).length, [config.length])
  const analysis = useMemo(() => analyseMap(state.map), [state.map])
  const report = useMemo(() => inspectPalette(state.ink), [state.ink])
  const keys = useMemo(
    // The keyboard waits its turn: the row is told first, and only then does the
    // board admit which letters it has learned. And if the setter turned the heat
    // off, it never admits anything.
    () =>
      config.keyHeat
        ? keyStates(locked && staged.length > 0 ? rows.slice(0, staged[staged.length - 1]) : rows)
        : {},
    [rows, locked, staged, config.keyHeat],
  )

  /**
   * The clock.
   *
   * Counting up is a stopwatch and nothing more. Counting down is an aid that can
   * end the puzzle on its own, so it is wired to a real loss rather than a
   * decoration that reaches zero and sits there.
   */
  const seconds = clockSeconds(state, elapsed)
  useEffect(() => {
    if (config.clock === 'off' || state.status !== 'playing') return
    const timer = window.setInterval(() => setElapsed((count) => count + 1), 1000)
    return () => window.clearInterval(timer)
  }, [config.clock, state.status])

  useEffect(() => {
    if (config.clock !== 'down' || state.status !== 'playing') return
    if (elapsed >= config.minutes * 60) setState((current) => expire(current))
  }, [elapsed, config.clock, config.minutes, state.status])
  const sheet = useMemo(() => scoreSheet(state), [state])
  const known = useMemo(() => knownLetters(state), [state])
  const sizes = useSizes(config.length)
  const tileSize = sizes.tile

  /**
   * What a screen reader is told when something happens.
   *
   * The board itself is a labelled group per row, which covers reading it on
   * demand; this covers the part a sighted player gets for free, which is being
   * told the moment a row lands.
   */
  const announcement = useMemo(() => {
    if (state.status === 'won') return `Solved in ${state.turns.length} of ${config.rows}`
    if (state.status === 'lost') return `Out of rows. The word was ${answer.toUpperCase()}`
    const last = rows[rows.length - 1]
    if (!last) return `Your puzzle, ${config.rows} rows of ${config.length} letters`
    if (locked) return ''
    return describeRow(rows.length - 1, last)
  }, [state, rows, config.rows, config.length, answer, locked])

  const attempt = useCallback(() => {
    if (state.status !== 'playing') return
    if (locked) return
    if (!list) {
      setToast('the dictionary is still arriving')
      return
    }
    if (typed.length !== config.length) {
      setToast(`that is ${typed.length} letters, and this puzzle is ${config.length}`)
      return
    }
    const result = submit(state, typed, list)
    if (result.problem) {
      setToast(result.problem)
      setShake((count) => count + 1)
      return
    }
    const row = state.turns.length
    setState(result.state)
    setTyped('')
    setStaged((current) => [...current, row])
    setLocked(true)
    window.setTimeout(() => setLocked(false), REVEAL_MS(config.length))
  }, [typed, state, config.length, list, locked])

  /**
   * One listener for the life of the component.
   *
   * Re-subscribing on every keystroke meant that a fast sequence of keys could
   * have two handlers alive at once, and a single Enter would then attempt the
   * same guess twice — the second one reading a `typed` that had just been
   * cleared, and reporting an empty guess. The listener is now stable and reads
   * the current handler through a ref, which is the whole point of the pattern.
   */
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (!playing) return
      // The board is mid-sentence, or the dictionary has not arrived. Either
      // way a keystroke would be a promise the app cannot keep.
      if (locked || !list) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Enter') {
        event.preventDefault()
        attempt()
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        setTyped((current) => current.slice(0, -1))
        return
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        setTyped((current) => (current.length < config.length ? current + event.key.toLowerCase() : current))
      }
    },
    [playing, attempt, config.length, locked, list],
  )

  const latest = useRef(handler)
  // A layout effect, not an effect, and that is the point rather than a detail.
  //
  // An effect runs after the browser has painted, so there was a window — real
  // in a browser, and easy to hit in a test — where the dictionary had arrived
  // and the keys had gone live in the DOM, but this ref still held the handler
  // whose closed-over `list` was null. A keystroke in that window was silently
  // dropped: the board was visibly enabled and deaf at the same time. Layout
  // effects run inside the same commit that enables the keys, so the two can no
  // longer disagree. Nothing here touches layout, so there is no cost for it.
  useLayoutEffect(() => {
    latest.current = handler
  }, [handler])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => latest.current(event)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const lift = useCallback(
    (row: number, cell: number) => {
      const result = spendLift(state, row, cell)
      if (result.problem) {
        setToast(result.problem)
        return
      }
      setState(result.state)
      setLifting(false)
    },
    [state],
  )

  return (
    <div className="layout layout--play">
      <aside className="stack">
        <Bed label="THE INK">
          <RoleLegend ink={state.ink} />
          <div className="prose">
            {config.scramble
              ? 'This puzzle runs a scrambled code and no key was issued. Row 1 is a worked example — read the colours against those letters and the code is yours.'
              : 'The house ink, meanings where you expect them.'}
          </div>
          <div className="eyebrow">EXACT · SHIFTED · ABSENT</div>
        </Bed>

        <Bed label="THE MAP">
          {config.redaction.mode === 'off' ? (
            <div className="prose">Nothing is withheld on this puzzle. Every cell tells you what it knows.</div>
          ) : (
            <>
              <div className="map">
                {state.map.barred.map((line, row) => (
                  <div className="map__row" key={row}>
                    {line.map((barred, cell) => (
                      <Cell key={cell} barred={barred} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="eyebrow">
                {state.map.visible
                  ? `${analysis.barred} CELLS BARRED · ${analysis.verdict.toUpperCase()}`
                  : 'THE MAP IS WITHHELD — THE BARS ARRIVE AS YOU PLAY'}
              </div>
            </>
          )}
        </Bed>
      </aside>

      <div className="centre">
        <h1 className="sr-only">Puzzle {config.seed}</h1>
        <div className="row row--between" style={{ width: '100%' }}>
          <div className="row">
            <span className="eyebrow">ROW</span>
            <span className="stepper__value">{Math.min(state.turns.length + 1, config.rows)}</span>
            <span className="eyebrow">OF {config.rows}</span>
          </div>
          {config.clock !== 'off' ? (
            <span
              className="eyebrow"
              style={{ color: config.clock === 'down' && seconds <= 30 ? 'var(--pink)' : 'var(--cyan)' }}
              role="timer"
            >
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
            </span>
          ) : null}
          <span className="eyebrow eyebrow--pink">{analysis.barred} CELLS DARK</span>
        </div>

        <Board
          rows={rows}
          total={config.rows}
          length={config.length}
          ink={state.ink}
          tileSize={tileSize}
          onLift={lifting ? lift : undefined}
          typed={playing ? typed : ''}
          shakeToken={shake}
          stagedRows={staged}
          won={state.status === 'won'}
        />

        {playing || locked ? (
          <div
            className="keyboard"
            style={{ '--key': sizes.key, '--key-gap': sizes.gap, maxWidth: `${sizes.room}px` } as CSSProperties}
          >
            {KEY_ROWS.map((row) => (
              <div className="keyboard__row" key={row}>
                {row === 'zxcvbnm' ? (
                  <button
                    type="button"
                    className="key key--wide key--action"
                    onClick={attempt}
                    disabled={locked || !list}
                  >
                    ENTER
                  </button>
                ) : null}
                {row.split('').map((letter) => (
                  <button
                    type="button"
                    key={letter}
                    className={keys[letter] ? `key ${KEY_CLASS[keys[letter]]}` : 'key'}
                    disabled={locked || !list}
                    onClick={() => setTyped((current) => (current.length < config.length ? current + letter : current))}
                  >
                    {letter}
                  </button>
                ))}
                {row === 'asdfghjkl' ? (
                  <button
                    type="button"
                    className="key key--wide"
                    disabled={locked || !list}
                    onClick={() => setTyped((current) => current.slice(0, -1))}
                  >
                    DEL
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="stack" style={{ alignItems: 'center', gap: '0.875rem' }}>
            <span className="stamp">{state.status === 'won' ? 'SOLVED' : 'UNSOLVED'}</span>
            <div className="eyebrow">
              {state.status === 'won'
                ? `IN ${state.turns.length} OF ${config.rows}`
                : config.clock === 'down' && state.turns.length < config.rows
                  ? `OUT OF TIME — THE WORD WAS ${answer.toUpperCase()}`
                  : `THE WORD WAS ${answer.toUpperCase()}`}
            </div>
            {state.peeks > 0 ? <span className="stamp">PEEKED</span> : null}
          </div>
        )}

        {lifting ? <div className="eyebrow eyebrow--pink">TAP A BARRED CELL TO PULL THE BAR BACK</div> : null}
      </div>

      <aside className="stack">
        <Bed label="READOUT">
          <div className="row row--between">
            <span className="eyebrow">ANSWERS LEFT</span>
            <span className="eyebrow" style={{ color: 'var(--ink)' }}>
              {pool === 0 ? 'NO CATALOGUE AT THIS LENGTH' : `${left} OF ${pool}`}
            </span>
          </div>
          <div className="row row--between">
            <span className="eyebrow">INK SEPARATION</span>
            <span className="eyebrow" style={{ color: report.verdict === 'clear' ? 'var(--cyan)' : 'var(--pink)' }}>
              {report.min.toFixed(2)} {report.verdict.toUpperCase()}
            </span>
          </div>
          <div className="row row--between">
            <span className="eyebrow">THINNEST ROW</span>
            <span className="eyebrow" style={{ color: 'var(--ink)' }}>
              ROW {analysis.thinnest.row} AT {analysis.thinnest.open}
            </span>
          </div>
        </Bed>

        <Bed label="LIFTS">
          <div className="row row--between">
            <span className="eyebrow">LEFT</span>
            <span className="eyebrow" style={{ color: state.liftsLeft > 0 ? 'var(--cyan)' : 'var(--dim)' }}>
              {state.liftsLeft} OF {config.lifts}
            </span>
          </div>
          <button
            type="button"
            className={lifting ? 'btn btn--primary' : 'btn'}
            disabled={state.liftsLeft === 0 || !playing}
            onClick={() => setLifting(!lifting)}
          >
            {lifting ? 'tapping a cell' : 'spend a lift'}
          </button>
        </Bed>

        <Bed label="FREE LETTERS">
          {config.hints === 0 ? (
            <div className="prose">None were granted with this puzzle.</div>
          ) : (
            <>
              <div className="row row--between">
                <span className="eyebrow">LEFT</span>
                <span className="eyebrow" style={{ color: state.hintsLeft > 0 ? 'var(--cyan)' : 'var(--dim)' }}>
                  {state.hintsLeft} OF {config.hints}
                </span>
              </div>
              <div className="chips">
                {known.map((letter, cell) => (
                  <button
                    key={cell}
                    type="button"
                    className={letter !== null ? 'chip chip--on' : 'chip'}
                    disabled={letter !== null || state.hintsLeft === 0 || !playing}
                    aria-label={
                      letter !== null
                        ? `position ${cell + 1} is ${letter}`
                        : `spend a free letter on position ${cell + 1}`
                    }
                    onClick={() => {
                      const result = spendHint(state, cell)
                      if (result.problem) {
                        setToast(result.problem)
                        return
                      }
                      setState(result.state)
                    }}
                  >
                    {letter !== null ? letter.toUpperCase() : cell + 1}
                  </button>
                ))}
              </div>
              <div className="prose">Tap a number to be told that letter.</div>
            </>
          )}
        </Bed>

        <Bed label="HONESTY">
          <button
            type="button"
            className={armed ? 'btn btn--primary' : 'btn'}
            disabled={!playing || state.peeks > 0}
            onClick={() => {
              if (!armed) {
                setArmed(true)
                return
              }
              setState(peek(state))
              setArmed(false)
              setToast('the answer is on the board, and the sheet says PEEKED for good')
            }}
          >
            {state.peeks > 0 ? 'peeked' : armed ? 'tap again to spoil it' : 'look at the answer'}
          </button>
          <div className="prose">
            Cheating is not prevented, it is recorded. The stamp cannot be taken off the sheet before you send it.
          </div>
        </Bed>

        {!playing ? (
          <Bed label="THE SHEET">
            <div className="sheet">{sheet}</div>
            <button type="button" className="btn btn--primary" onClick={() => void copyText(sheet)}>
              copy the sheet
            </button>
          </Bed>
        ) : null}
      </aside>

      <div className="footer" style={{ gridColumn: '1 / -1' }}><span>HUSHWORD · {fragment.slice(0, 24)}…</span>
        <span className="row">
          <button type="button" className="chip" onClick={() => navigate('#/compose')}>
            make a puzzle
          </button>
          <button type="button" className="chip" onClick={() => navigate('#/')}>
            the room
          </button>
        </span>
      </div>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
      {/* The board is a labelled group per row, which covers reading it on
          demand. This covers the part a sighted player gets for free: being told
          the moment a row lands. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
