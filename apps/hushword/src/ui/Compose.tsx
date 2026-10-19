import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { rateCase, type CaseRating } from '../engine/difficulty'
import type { ClockMode, GameConfig, Posture } from '../engine/game'
import { buildLink, rememberSealed, type BuiltLink } from '../engine/link'
import { checkInk, inspectPalette, HOUSE_INK, type Legend, type Role, type RoleInk } from '../engine/palette'
import {
  analyseMap,
  buildRedaction,
  paint,
  recognisePattern,
  REDACTION_PRESETS,
  type RedactionConfig,
  type RedactionMap,
} from '../engine/redaction'
import { randomSeedText } from '../engine/rng'
import type { Lexicon } from '../engine/rules'
import { answersOfLength, sampleWords, wordListFor, type WordList } from '../engine/words'
import { Cell, copyText, Eyebrow, Panel, Rule, Segmented, Stepper, Toggle } from './bits'

/** Three to twelve letters — the whole range the rules support. */
const MIN_LENGTH = 3
const MAX_LENGTH = 12

/** Eight colours that can carry any of the three roles without being unreadable. */
const PALETTE: readonly string[] = [
  '#1F8A55',
  '#2BC46B',
  '#D9A21A',
  '#FF3D8B',
  '#8B5CF6',
  '#4DE1FF',
  '#333A4D',
  '#F4F4F4',
]

/** The roles in the words a player would use, rather than the words the code uses. */
const ROLES: readonly { readonly role: Role; readonly label: string }[] = [
  { role: 'exact', label: 'Right letter, right spot' },
  { role: 'shifted', label: 'Right letter, wrong spot' },
  { role: 'absent', label: 'Not in the word' },
]

const LEGENDS: readonly { readonly value: Legend; readonly label: string }[] = [
  { value: 'shown', label: 'shown' },
  { value: 'example', label: 'worked example' },
  { value: 'hidden', label: 'hidden' },
]

export function Compose({ navigate }: { navigate: (hash: string) => void }): ReactNode {
  const [seed] = useState(() => randomSeedText())
  const [word, setWord] = useState('garden')
  const [length, setLength] = useState(6)
  const [rows, setRows] = useState(6)
  const [hard, setHard] = useState(false)
  const [lexicon, setLexicon] = useState<Lexicon>('free')

  const [ink, setInk] = useState<RoleInk>(HOUSE_INK)
  const [scramble, setScramble] = useState(false)
  const [legend, setLegend] = useState<Legend>('example')

  const [presetId, setPresetId] = useState('house')
  const [redaction, setRedaction] = useState<RedactionConfig>(() => REDACTION_PRESETS[1].config(6, 6))
  const [lifts, setLifts] = useState(2)
  const [hints, setHints] = useState(0)
  const [clock, setClock] = useState<ClockMode>('off')
  const [minutes, setMinutes] = useState(5)
  const [keyHeat, setKeyHeat] = useState(true)

  const [posture, setPosture] = useState<Posture>('open')
  const [passphrase, setPassphrase] = useState('')

  const [rating, setRating] = useState<CaseRating | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [list, setList] = useState<WordList | null>(null)
  useEffect(() => {
    let live = true
    setList(null)
    void wordListFor(length).then((next) => {
      if (live) setList(next)
    })
    return () => {
      live = false
    }
  }, [length])

  const map: RedactionMap = useMemo(() => {
    try {
      return buildRedaction(redaction, length, rows, seed)
    } catch {
      return buildRedaction({ mode: 'off' }, length, rows, seed)
    }
  }, [redaction, length, rows, seed])

  // A named shape is re-cut when the grid changes under it. A painted map is not,
  // because the setter drew it at that size on purpose.
  useEffect(() => {
    if (presetId === 'custom') return
    const preset = REDACTION_PRESETS.find((entry) => entry.id === presetId)
    if (preset) setRedaction(preset.config(length, rows))
  }, [length, rows, presetId])

  const analysis = useMemo(() => analyseMap(map), [map])
  const recognised = useMemo(() => (map.mode === 'open' ? recognisePattern(map) : null), [map])
  const inkCheck = useMemo(() => checkInk(ink, { scramble, legend, seed }), [ink, scramble, legend, seed])
  const inkReport = useMemo(() => inspectPalette(ink), [ink])

  const answers = useMemo(() => answersOfLength(length), [length])
  const guesses = useMemo(() => list?.guessList ?? [], [list])
  const curated = answers.length > 0
  const hasDictionary = guesses.length > 0

  /**
   * Your word, and nothing said about it.
   *
   * The catalogue is for the daily. A puzzle made for a friend may be a nickname,
   * a surname, a word from another language or one that has not been coined yet,
   * so the only thing checked is the shape. What the app *does* tell you is
   * whether the word is one it recognises, because that is worth knowing and not
   * worth enforcing.
   */
  const wordShaped = word.length === length
  const known = list !== null && (list.guesses.has(word) || answers.includes(word))
  const wordOk = wordShaped
  const isCatalogued = answers.includes(word)

  const rateable = curated || hasDictionary
  const ratingPool = useMemo(() => {
    if (!rateable) return []
    const base = curated ? answers : sampleWords(guesses, 1200)
    return base.includes(word) ? base : [...base, word]
  }, [rateable, curated, answers, guesses, word])

  /**
   * The ink is only carried when it differs from the preset.
   *
   * It costs about thirteen characters on every link — nine bytes for three
   * colours — and the common case is a setter who never touched them. Omitting
   * it when it matches the house ink also keeps `intensity` meaningful rather
   * than vestigial.
   */
  const houseInk =
    ink.exact.toUpperCase() === HOUSE_INK.exact && ink.shifted.toUpperCase() === HOUSE_INK.shifted && ink.absent.toUpperCase() === HOUSE_INK.absent

  const config: GameConfig = {
    seed,
    length,
    rows,
    hard,
    intensity: 'clear',
    ink: houseInk ? undefined : ink,
    scramble,
    legend,
    redaction,
    lifts,
    hints,
    clock,
    minutes,
    keyHeat,
    lexicon,
    posture,
  }

  let built: BuiltLink | null = null
  let buildProblem: string | null = null
  if (wordOk) {
    try {
      built = buildLink(config, word, posture === 'vault' ? { passphrase } : {})
    } catch (error) {
      buildProblem = error instanceof Error ? error.message : String(error)
    }
  }
  const vaultNeedsPassphrase = posture === 'vault' && passphrase.length === 0

  useEffect(() => {
    if (!wordOk || list === null || !rateable || ratingPool.length === 0) {
      setRating(null)
      return
    }
    setMeasuring(true)
    const timer = window.setTimeout(() => {
      setRating(
        rateCase({ answers: ratingPool, guesses, answer: word, rows, map, minSeparation: inkReport.min, legend }),
      )
      setMeasuring(false)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [wordOk, list, rateable, ratingPool, guesses, word, rows, map, inkReport.min, legend])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const sealedFragment = posture === 'sealed' && built ? built.fragment : ''
  useEffect(() => {
    if (!built || posture !== 'sealed' || !built.payload.commitment) return
    rememberSealed({
      commitment: built.payload.commitment,
      config: built.payload.config,
      answer: word,
      nonce: built.secret.nonce,
      createdAt: Date.now(),
    })
    // Keys on the link itself, so an edit that changes nothing does not re-save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sealedFragment])

  const onPaint = useCallback(
    (row: number, cell: number) => {
      const result = paint(map, row, cell, !map.barred[row][cell])
      if (result.problem) {
        setToast(result.problem)
        return
      }
      setPresetId('custom')
      setRedaction({ mode: 'open', explicit: result.map.barred.map((line) => [...line]) })
    },
    [map],
  )

  const tunePattern = (next: { count?: number; fromRow?: number; kind?: 'leading' | 'alternate' }) => {
    const base = redaction.pattern ?? { kind: 'leading' as const, count: 4, fromRow: 3 }
    setPresetId('custom')
    setRedaction({ mode: redaction.mode, pattern: { ...base, ...next } })
  }

  const hiding = redaction.mode === 'closed'
  const canHide = redaction.mode === 'pattern' || redaction.mode === 'closed'

  return (
    <div className="layout layout--two">
      <div className="stack" style={{ gap: '2.25rem' }}>
        <div className="stack">
          <Eyebrow>HUSHWORD · COMPOSE</Eyebrow>
          <h1>Make a puzzle.</h1>
          <input
            className="field field--word"
            value={word}
            maxLength={length}
            aria-label="the answer"
            onChange={(event) => setWord(event.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())}
          />
          <div className="row row--between">
            <span className="eyebrow">
              {!wordShaped
                ? `${word.length} of ${length} letters`
                : list === null
                  ? 'checking…'
                  : known
                    ? isCatalogued
                      ? 'a catalogued answer'
                      : 'a real word the daily would not pick'
                    : 'your own word'}
            </span>
            <span className="row">
              <Stepper
                value={length}
                min={MIN_LENGTH}
                max={MAX_LENGTH}
                onChange={(next) => {
                  setLength(next)
                  setWord((current) => current.slice(0, next))
                }}
              />
              <span className="eyebrow">letters</span>
            </span>
          </div>
        </div>

        <Rule wide />

        <div className="stack">
          <Eyebrow>the ink</Eyebrow>
          {ROLES.map(({ role, label }) => (
            <div className="row row--between" key={role}>
              <span className="row">
                <span
                  className="swatch"
                  style={{ background: ink[role], cursor: 'default' }}
                  aria-hidden="true"
                />
                <span className="prose">{label}</span>
              </span>
              <span className="swatches">
                {PALETTE.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    className={ink[role].toUpperCase() === colour ? 'swatch swatch--on' : 'swatch'}
                    style={{ background: colour }}
                    aria-label={`${label}: ${colour}`}
                    aria-pressed={ink[role].toUpperCase() === colour}
                    onClick={() => setInk({ ...ink, [role]: colour })}
                  />
                ))}
              </span>
            </div>
          ))}
          <div className="row row--between">
            <Toggle on={scramble} onChange={setScramble} label="shuffle which colour means what" />
            <button type="button" className="chip" onClick={() => setInk(HOUSE_INK)}>
              reset
            </button>
          </div>
          <div className="row row--between">
            <Eyebrow>who learns the code</Eyebrow>
            <Segmented<Legend> options={LEGENDS} value={legend} onChange={setLegend} />
          </div>
          {inkCheck.problems.map((problem) => (
            <div className="eyebrow" style={{ color: 'var(--pink)' }} key={problem.message}>
              {problem.message}
            </div>
          ))}
          {inkCheck.problems.length === 0 ? (
            <div className="eyebrow">
              {inkReport.verdict === 'clear' ? 'these three read apart' : 'these three sit close together'}
            </div>
          ) : null}
        </div>

        <Rule wide />

        <div className="stack">
          <Eyebrow>what gets withheld</Eyebrow>
          <div className="chips">
            {REDACTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={preset.id === presetId ? 'chip chip--on' : 'chip'}
                title={preset.blurb}
                onClick={() => {
                  setPresetId(preset.id)
                  setRedaction(preset.config(length, rows))
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="prose">
            {presetId === 'custom'
              ? 'Your own map. Tap a cell to bar it or open it.'
              : REDACTION_PRESETS.find((entry) => entry.id === presetId)?.blurb}
          </div>

          <div className="row row--between row--wrap">
            <span className="map">
              {map.barred.map((line, row) => (
                <span className="map__row" key={row}>
                  {line.map((barred, cell) => (
                    <Cell key={cell} barred={barred} onToggle={() => onPaint(row, cell)} size="1.375rem" />
                  ))}
                </span>
              ))}
            </span>
            <span className="stack" style={{ gap: '0.5rem', alignItems: 'flex-end' }}>
              {redaction.mode === 'pattern' || redaction.mode === 'closed' ? (
                <>
                  <span className="row">
                    <span className="eyebrow">run</span>
                    <Stepper value={redaction.pattern?.count ?? 4} min={1} max={length} onChange={(count) => tunePattern({ count })} />
                  </span>
                  <span className="row">
                    <span className="eyebrow">from row</span>
                    <Stepper value={redaction.pattern?.fromRow ?? 3} min={1} max={rows} onChange={(fromRow) => tunePattern({ fromRow })} />
                  </span>
                </>
              ) : null}
              <span className="row">
                <span className="eyebrow">rows</span>
                <Stepper value={rows} min={3} max={12} onChange={setRows} />
              </span>
            </span>
          </div>

          <div className="row row--between">
            <div className="eyebrow">
              {analysis.barred} of {analysis.total} barred · {analysis.verdict}
              {analysis.sealedRows > 0
                ? ` · ${analysis.sealedRows} ${analysis.sealedRows === 1 ? 'row says' : 'rows say'} nothing`
                : ''}
            </div>
            {recognised ? <div className="eyebrow">reads as {recognised.pattern.kind} {recognised.pattern.count} from row {recognised.pattern.fromRow}</div> : null}
          </div>

          <Toggle
            on={hiding}
            onChange={(on) => {
              if (!canHide) return
              setRedaction({ ...redaction, mode: on ? 'closed' : 'pattern' })
            }}
            label={canHide ? 'keep the map hidden from the solver' : 'a painted map is always shown'}
          />
          <Toggle on={redaction.decoy === true} onChange={(on) => setRedaction({ ...redaction, decoy: on })} label="let barred cells lie" />
          <Toggle on={redaction.shear === true} onChange={(on) => setRedaction({ ...redaction, shear: on })} label="walk the window one cell right per row" />
          <div className="row row--between">
            <Eyebrow>lifts granted</Eyebrow>
            <Stepper value={lifts} min={0} max={5} onChange={setLifts} />
          </div>
          <div className="row row--between">
            <Eyebrow>free letters granted</Eyebrow>
            <Stepper value={hints} min={0} max={4} onChange={setHints} />
          </div>
          <div className="prose">
            A lift pulls one bar back. A free letter gives away the letter at a position the solver chooses.
          </div>
        </div>

        <Rule wide />

        <div className="stack">
          <Eyebrow>how hard it plays</Eyebrow>
          <div className="row row--between">
            <Toggle on={hard} onChange={setHard} label="a proven letter has to be used again" />
          </div>
          <div className="row row--between">
            <span className="prose">which words count</span>
            <Segmented<Lexicon>
              options={[
                { value: 'free', label: 'any letters' },
                { value: 'strict', label: 'real words only' },
              ]}
              value={lexicon}
              onChange={setLexicon}
            />
          </div>
          <div className="row row--between">
            <span className="prose">the clock</span>
            <Segmented<ClockMode>
              options={[
                { value: 'off', label: 'off' },
                { value: 'up', label: 'up' },
                { value: 'down', label: 'down' },
              ]}
              value={clock}
              onChange={setClock}
            />
          </div>
          {clock === 'down' ? (
            <div className="row row--between">
              <Eyebrow>minutes on the clock</Eyebrow>
              <Stepper value={minutes} min={1} max={30} onChange={setMinutes} />
            </div>
          ) : null}
          <Toggle on={keyHeat} onChange={setKeyHeat} label="the keyboard carries used letters" />
          {!keyHeat ? <div className="eyebrow">they will have to remember what they have tried</div> : null}
          {!rateable && list !== null ? (
            <div className="eyebrow">no dictionary at {length} letters, so this one is not rated</div>
          ) : (
            <div className="eyebrow">
              {measuring
                ? 'measuring…'
                : rating
                  ? `${rating.measured ?? '—'} guesses, ${rating.verdict}${
                      rating.redactionCost > 0 ? `, +${rating.redactionCost} for the redaction` : ''
                    }${rating.inkReadCost > 0 ? `, +${rating.inkReadCost.toFixed(2)} for the ink` : ''}`
                  : '—'}
            </div>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: '2.25rem' }}>
        <div className="stack">
          <Eyebrow>the link</Eyebrow>
          <Segmented<Posture>
            options={[
              { value: 'open', label: 'open' },
              { value: 'sealed', label: 'sealed' },
              { value: 'vault', label: 'vault' },
            ]}
            value={posture}
            onChange={setPosture}
          />
          {posture !== 'open' ? (
            <input
              className="field"
              type="password"
              placeholder={posture === 'sealed' ? 'sealed links take no passphrase' : 'passphrase'}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={posture === 'sealed'}
              style={{ opacity: posture === 'sealed' ? 0.4 : 1 }}
            />
          ) : null}
          <Panel accent={built !== null}>
            <div className="sheet" style={{ wordBreak: 'break-all' }}>
              {built ? built.fragment : vaultNeedsPassphrase ? 'needs a passphrase' : buildProblem ?? 'name a word first'}
            </div>
            <div className="row row--between">
              <span className="eyebrow">
                {built ? `${built.fragment.length} characters` : ''}
                {built?.revealsAnswer ? ' · the word is in it' : built ? ' · the word is not in it' : ''}
              </span>
              <button
                type="button"
                className="chip"
                disabled={!built}
                onClick={() => {
                  if (built) void copyText(`${location.origin}${location.pathname}${built.fragment}`)
                  setToast('link copied')
                }}
              >
                copy
              </button>
            </div>
          </Panel>
          <div className="prose">
            {posture === 'open'
              ? 'The word rides in the URL fragment, so no server, log or CDN ever sees it. It is not a secret from whoever you send it to.'
              : posture === 'sealed'
                ? 'The link carries a commitment and nothing else. They play, send their guesses back, and your browser grades them.'
                : 'Encrypted under the passphrase with ChaCha20 and an HMAC tag. The link on its own is inert.'}
          </div>
          {posture === 'sealed' && built ? (
            <Panel>
              <Eyebrow pink>keep this — nothing else can grade the puzzle</Eyebrow>
              <div className="sheet">{`answer ${built.secret.answer}\nnonce  ${built.secret.nonce}`}</div>
              <button
                type="button"
                className="chip"
                onClick={() => void copyText(`${built.secret.answer} ${built.secret.nonce}`)}
              >
                copy the reveal
              </button>
            </Panel>
          ) : null}
          <button type="button" className="btn btn--primary" disabled={!built} onClick={() => built && navigate(built.fragment)}>
            play it yourself
          </button>
        </div>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
