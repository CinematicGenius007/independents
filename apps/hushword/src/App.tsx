import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { configFor } from './engine/game'
import { buildLink } from './engine/link'
import { PRESETS } from './engine/palette'
import { coveredLengths, dailyAnswer, dateKey } from './engine/words'
import { Compose } from './ui/Compose'
import { Grade } from './ui/Grade'
import { Play } from './ui/Play'
import { Eyebrow, Rule, Section, Segmented, Stepper } from './ui/bits'
import { prefs as readPrefs, previousDay, savePrefs, streak, type Prefs } from './ui/store'

/**
 * Hash routing, because the hash is already the link.
 *
 * A case *is* a fragment, so there is no router to install and no path to
 * rewrite: `#/compose` is a page, anything else that is not empty is a case, and
 * an empty hash is the room.
 */
function useHashRoute(): { route: string; navigate: (next: string) => void } {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: string) => {
    if (next === '' || next === '#') {
      window.location.hash = ''
      setHash('')
      return
    }
    window.location.hash = next.startsWith('#') ? next.slice(1) : next
    setHash(window.location.hash)
  }, [])

  return { route: hash.replace(/^#/, ''), navigate }
}

/**
 * The room, with the lights on or off.
 *
 * One attribute on the document, two sets of tokens, and the three inks
 * untouched — ink is the only thing on the page that is data, so it does not
 * change with the wall colour.
 */
function useTheme(): [Prefs['theme'], (next: Prefs['theme']) => void] {
  const [theme, setTheme] = useState<Prefs['theme']>(() => readPrefs().theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const change = useCallback((next: Prefs['theme']) => {
    savePrefs({ theme: next })
    setTheme(next)
  }, [])

  return [theme, change]
}

function Room({ navigate }: { navigate: (next: string) => void }): ReactNode {
  const today = useMemo(() => dateKey(new Date()), [])
  const [theme, setTheme] = useTheme()
  return (
    <div className="stack" style={{ gap: '1.75rem' }}>
      <div className="row row--between">
        <span className="wordmark">HUSHWORD</span>
        <Eyebrow>{today}</Eyebrow>
      </div>

      <div className="stack">
        <h1>Every link speaks its own language.</h1>
        <Rule wide />
        <div className="prose" style={{ maxWidth: '44rem' }}>
          The word is the easy part. A Hushword link also decides what its three colours mean, which cells are allowed
          to tell you anything, and how many guesses you get. Working out what the board is permitted to say is half the
          puzzle.
        </div>
      </div>

      <div className="layout layout--two">
        <button type="button" className="btn btn--primary" onClick={() => navigate('#/daily')}>
          play today's puzzle
        </button>
        <button type="button" className="btn" onClick={() => navigate('#/compose')}>
          make your own puzzle
        </button>
      </div>

      <div className="row">
        <Eyebrow>also here</Eyebrow>
        <button type="button" className="chip" onClick={() => navigate('#/grade')}>
          grade a sealed puzzle
        </button>
        <button type="button" className="chip" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'lights on' : 'lights off'}
        </button>
      </div>

      <Section title="THE FOUR INKS">
        <div className="chips">
          {PRESETS.map((preset) => (
            <span key={preset.intensity} className="chip" style={{ cursor: 'default' }}>
              {preset.label}
              <span className="row" style={{ gap: '0.25rem' }}>
                {(['exact', 'shifted', 'absent'] as const).map((role) => (
                  <span
                    key={role}
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '0.125rem',
                      background: preset.ink[role],
                    }}
                  />
                ))}
              </span>
            </span>
          ))}
        </div>
        <div className="prose">
          Green, amber and slate are data — they mean exact, shifted and absent. The setter can reassign all three per
          link, so the code you know is not the code you get.
        </div>
      </Section>

      <Section title="NO SERVER ANYWHERE IN THIS PICTURE">
        <div className="prose">
          A puzzle travels in the URL fragment, which browsers never send anywhere. There is no account, no lobby and no
          hosted database. An <span style={{ color: 'var(--ink)' }}>open</span> link carries the word and means it; a{' '}
          <span style={{ color: 'var(--ink)' }}>sealed</span> one carries a commitment and is graded by the setter's
          browser; a <span style={{ color: 'var(--ink)' }}>vault</span> one is ciphertext until you bring the
          passphrase. The app is honest about which of those is honest.
        </div>
      </Section>
    </div>
  )
}

export function App(): ReactNode {
  const { route, navigate } = useHashRoute()

  let page: ReactNode
  if (route === '/compose') page = <Compose navigate={navigate} />
  else if (route === '/grade') page = <Grade navigate={navigate} />
  else if (route === '/daily' || route.startsWith('/daily/')) {
    page = <Daily navigate={navigate} date={route.split('/')[2]} />
  }
  else if (route.length > 0 && route !== '/') page = <Play fragment={`#${route}`} navigate={navigate} />
  else page = <Room navigate={navigate} />

  return (
    <div className="ground">
      <div className="shell">{page}</div>
    </div>
  )
}

/**
 * The daily is a link the app builds for you.
 *
 * The word is a hash of the date, so everybody gets the same case without
 * anybody agreeing on anything and without a server holding a schedule.
 *
 * It ships in two dressings of the *same word*. `clean` is the house ink, the
 * legend shown and nothing withheld — the game this one is a version of, for
 * anyone who wants to play that instead. `the case` is what the link decides.
 * Choosing changes nothing about the answer, only about how you are allowed to
 * be told it.
 */
type DailyMode = 'hushword' | 'clean'

/**
 * The daily.
 *
 * The word is a hash of the date, so everybody gets the same puzzle without
 * anybody agreeing on anything and without a server holding a schedule. It ships
 * in two dressings of the *same* answer — `hushword`, which is what the link
 * decides, and `clean`, which is the house ink with nothing withheld — and at any
 * length the catalogue can actually set, because a daily that only exists at six
 * letters is a daily for people who like six letters.
 */
function Daily({ navigate, date }: { navigate: (next: string) => void; date?: string }): ReactNode {
  const today = useMemo(() => dateKey(new Date()), [])
  const key = date ?? today
  const lengths = useMemo(() => coveredLengths(), [])
  const [choice, setChoice] = useState<Prefs>(readPrefs)
  const [played, setPlayed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useMemo(() => streak(today), [today, played])

  const save = useCallback((next: Partial<Prefs>) => {
    savePrefs(next)
    setChoice(readPrefs())
  }, [])

  const fragment = useMemo(() => {
    const answer = dailyAnswer(key, choice.dailyLength)
    const seed = `DAILY-${key}-${choice.dailyLength}`
    const config =
      choice.dailyMode === 'clean'
        ? configFor({
            seed,
            length: choice.dailyLength,
            redaction: { mode: 'off' },
            intensity: 'clear',
            scramble: false,
            legend: 'shown',
          })
        : configFor({ seed, length: choice.dailyLength })
    return buildLink(config, answer).fragment
  }, [key, choice])

  const earlier = useMemo(() => {
    const days: string[] = []
    let day = previousDay(key)
    for (let i = 0; i < 6; i += 1) {
      days.push(day)
      day = previousDay(day)
    }
    return days
  }, [key])

  return (
    <div className="stack">
      <div className="row row--between">
        <Eyebrow>{key === today ? 'the daily' : key}</Eyebrow>
        <Eyebrow>{run === 0 ? 'no run yet' : `${run} day${run === 1 ? '' : 's'} in a row`}</Eyebrow>
      </div>
      <div className="row row--between" style={{ flexWrap: 'wrap' }}>
        <Segmented<DailyMode>
          options={[
            { value: 'hushword', label: 'hushword' },
            { value: 'clean', label: 'clean' },
          ]}
          value={choice.dailyMode}
          onChange={(next) => save({ dailyMode: next })}
        />
        <span className="row">
          <Eyebrow>letters</Eyebrow>
          <Stepper
            value={choice.dailyLength}
            min={lengths[0]}
            max={lengths[lengths.length - 1]}
            onChange={(next) => save({ dailyLength: next })}
          />
        </span>
      </div>
      <div className="prose">
        {choice.dailyMode === 'clean'
          ? 'The same word, plainly: the house ink, the legend shown, nothing withheld.'
          : 'The same word, told the way this link decides to tell it.'}
      </div>

      <Play
        key={fragment}
        fragment={fragment}
        navigate={navigate}
        recordAs={`daily-${key}`}
        onFinish={() => setPlayed((count) => count + 1)}
      />

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <Eyebrow>earlier</Eyebrow>
        {earlier.map((day) => (
          <button key={day} type="button" className="chip" onClick={() => navigate(`#/daily/${day}`)}>
            {day.slice(5)}
          </button>
        ))}
        {key !== today ? (
          <button type="button" className="chip chip--on" onClick={() => navigate('#/daily')}>
            today
          </button>
        ) : null}
      </div>
    </div>
  )
}
