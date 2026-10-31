import { useState } from 'react'
import { LEVELS } from './ai'
import type { Level } from './ai'
import { History } from './Match'
import { loadHistory, loadTally } from './history'
import type { HistoryEntry, Tally } from './history'

export function Lobby({
  name,
  placeholder,
  onName,
  invite,
  onDeclineInvite,
  onLocal,
  onAi,
  onCreate,
  onJoin,
}: {
  name: string
  /** The device codename, shown until the player types their own. */
  placeholder: string
  onName: (name: string) => void
  invite: string | null
  onDeclineInvite: () => void
  onLocal: () => void
  onAi: (level: Level) => void
  onCreate: () => void
  onJoin: (code: string) => void
}) {
  // Read once per visit to the lobby, not on every keystroke in the name field.
  const [history] = useState<HistoryEntry[]>(loadHistory)
  const [tally] = useState<Tally>(loadTally)
  const [code, setCode] = useState('')
  const valid = /^[A-Z0-9]{4,12}$/.test(code)

  return (
    <main className="lobby">
      <div className="lobby-head">
        <span className="eyebrow">Ultimate TTT / 9×9</span>
        <span className="eyebrow">Free · no sign-up</span>
      </div>

      <h1 className="hero">
        Ultimate
        <br />
        TTT<span className="signal">.</span>
      </h1>
      <p className="lede">A board inside a board. Where you play decides where they must.</p>

      {!invite && (
        <label className="namecard">
          <span className="eyebrow">Playing as</span>
          <input
            className="namefield"
            value={name}
            maxLength={24}
            placeholder={placeholder}
            onChange={e => onName(e.target.value)}
            aria-label="Your name"
            spellCheck={false}
            autoComplete="nickname"
          />
          <span className="eyebrow namehint">
            {name.trim() ? 'Saved on this device' : 'Type a name · your rival sees it'}
          </span>
        </label>
      )}

      {invite && (
        <section className="card card-invite" aria-label="Invitation">
          <span className="eyebrow signal">Invitation</span>
          <h2 className="card-title">You&rsquo;re invited to {invite}</h2>
          <p className="card-sub">A game is waiting. Say who you are, then take a seat.</p>
          <input
            className="field"
            aria-label="Your name"
            value={name}
            maxLength={24}
            placeholder={placeholder}
            onChange={e => onName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onJoin(invite)
            }}
          />
          <div className="row">
            <button className="btn btn-signal" onClick={() => onJoin(invite)}>
              Join room {invite}
            </button>
            <button className="btn" onClick={onDeclineInvite}>
              Not this room
            </button>
          </div>
        </section>
      )}

      <section className="cards" aria-label="Ways to play">
        <div className="card card-online">
          <button className="card-hit" onClick={onCreate}>
            <span className="card-top">
              <span className="eyebrow">01 · Online</span>
              <span className="eyebrow">Link ↗</span>
            </span>
            <span className="card-title">Challenge a friend</span>
            <span className="card-sub">One tap. Share the link. No sign-up.</span>
            <span className="slashes" aria-hidden="true" />
          </button>
          <form
            className="join"
            onSubmit={e => {
              e.preventDefault()
              if (valid) onJoin(code)
            }}
          >
            <input
              className="field field-code"
              value={code}
              maxLength={12}
              placeholder="Have a code?"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button className="btn" type="submit" disabled={!valid}>
              Join
            </button>
          </form>
        </div>

        <div className="card card-solo">
          <div className="card-top">
            <span className="eyebrow">02 · Solo</span>
          </div>
          <span className="card-title">Versus the machine</span>
          <div className="levels" role="group" aria-label="Difficulty">
            {LEVELS.map((level, i) => (
              <button key={level.id} className="level" onClick={() => onAi(level.id)} title={level.blurb}>
                <span className="bars-mini" aria-hidden="true">
                  {[0, 1, 2].map(n => (
                    <i key={n} className={n <= i ? 'on' : ''} />
                  ))}
                </span>
                {level.name}
              </button>
            ))}
          </div>
        </div>

        <button className="card card-local card-hit-row" onClick={onLocal}>
          <span className="card-top">
            <span className="eyebrow">03 · Same screen</span>
          </span>
          <span className="card-row">
            <span className="card-title card-title-sm">Pass &amp; play</span>
            <span aria-hidden="true">→</span>
          </span>
        </button>
      </section>

      {history.length > 0 && <History entries={history} />}

      <details className="how">
        <summary className="eyebrow">How it works</summary>
        <ol>
          <li>The cell you play in sends your opponent to the matching small board.</li>
          <li>Three in a row on a small board wins it. Three won boards in a row wins the game.</li>
          <li>Sent to a board that is already decided? Play anywhere.</li>
        </ol>
      </details>

      <footer className="lobby-foot">
        <span className="hatch" aria-hidden="true" />
        <div className="lobby-foot-row">
          <span className="eyebrow">Ultimate TTT</span>
          <span className="eyebrow">
            W {tally.w} · L {tally.l}
            {tally.d > 0 ? ` · D ${tally.d}` : ''}
          </span>
        </div>
      </footer>
    </main>
  )
}
