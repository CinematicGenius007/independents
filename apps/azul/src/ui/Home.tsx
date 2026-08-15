/**
 * The front door: pick a name, then pick who you are playing.
 *
 * Three ways in, in the order people actually want them: alone against the
 * house, hosting for friends, or joining a code somebody read out.
 */

import { useState } from 'react'
import { isRoomCode } from '../net/room'
import { ROOM_CODE_LENGTH } from '../net/protocol'
import { WallSampler } from './Board'

export interface HomeProps {
  name: string
  onName: (name: string) => void
  onSolo: () => void
  onHost: () => void
  onJoin: (code: string) => void
}

export function Home({ name, onName, onSolo, onHost, onJoin }: HomeProps) {
  const [code, setCode] = useState('')
  const valid = isRoomCode(code)

  return (
    <div className="home">
      <div className="hero">
        <WallSampler />
        <h2 className="hero__lede">
          Take every tile of one colour. Fill a line and it fires onto the wall. Take one tile too
          many and it costs you.
        </h2>
        <p className="hero__body">
          The tile-laying game <i>Azul</i>, played in the browser between two and four people. There
          is no server holding the game — the players hold it between them, and whoever opened the
          room deals from the bag.
        </p>
      </div>

      <div className="choices">
        <section className="choice">
          <h2>Your name</h2>
          <div className="field">
            <label htmlFor="name">Shown to everyone at the table</label>
            <input
              id="name"
              value={name}
              maxLength={18}
              onChange={event => onName(event.target.value)}
              placeholder="Name"
            />
          </div>
        </section>

        <section className="choice">
          <h2>Play alone</h2>
          <p>Against the house. Nothing leaves this browser.</p>
          <button type="button" className="button button--gold" onClick={onSolo} disabled={!name.trim()}>
            Start a solo game
          </button>
        </section>

        <section className="choice">
          <h2>Play with friends</h2>
          <p>Open a room and send the code. Two to four seats, and the house takes any left over.</p>
          <button type="button" className="button" onClick={onHost} disabled={!name.trim()}>
            Open a room
          </button>
        </section>

        <section className="choice">
          <h2>Join a room</h2>
          <div className="field field--code">
            <label htmlFor="code">{ROOM_CODE_LENGTH}-character code</label>
            <input
              id="code"
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              onChange={event => setCode(event.target.value.toUpperCase())}
              onKeyDown={event => {
                if (event.key === 'Enter' && valid && name.trim()) onJoin(code)
              }}
              placeholder="—————"
            />
          </div>
          <button
            type="button"
            className="button"
            disabled={!valid || !name.trim()}
            onClick={() => onJoin(code)}
          >
            Sit down
          </button>
        </section>
      </div>
    </div>
  )
}
