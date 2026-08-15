/**
 * The room before the tiles come out.
 *
 * Its whole job is to make the code easy to hand to someone else and to make
 * the table obviously incomplete until it is not. The host fills empty chairs
 * with the house; everyone else waits and watches the seats fill.
 */

import { useState } from 'react'
import type { BotStyle } from '../engine/bot'
import { BOT_STYLES } from '../engine/bot'
import type { RelayStatus, Seat } from '../net/protocol'
import { MAX_SEATS, MIN_SEATS } from '../net/protocol'
import { WallSampler } from './Board'

export interface LobbyProps {
  code: string | null
  url: string | null
  status: RelayStatus
  seats: Seat[]
  isHost: boolean
  onAddBot: (style: BotStyle) => void
  onRemove: (id: string) => void
  onStart: () => void
  onLeave: () => void
}

export function Lobby({
  code,
  url,
  status,
  seats,
  isHost,
  onAddBot,
  onRemove,
  onStart,
  onLeave,
}: LobbyProps) {
  const [copied, setCopied] = useState(false)
  const full = seats.length >= MAX_SEATS
  const ready = seats.length >= MIN_SEATS

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="home">
      <div className="hero">
        <WallSampler />
        <p className="hint">
          Five glazes, five rows, five columns. Every space on the wall is pricked with the motif
          that belongs to it — fill one and it fires.
        </p>
      </div>

      <div className="choices">
        {code ? (
          <section className="choice">
            <h2>Room code</h2>
            <p className="code">{code}</p>
            <p>
              {status === 'connected'
                ? 'Anyone with this code can sit down.'
                : status === 'connecting'
                  ? 'Finding a relay to signal through…'
                  : 'No relay would answer. Check the connection and reload.'}
            </p>
            <div className="row">
              <button type="button" className="button button--small" onClick={copy} disabled={!url}>
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <button type="button" className="button button--small button--ghost" onClick={onLeave}>
                Leave
              </button>
            </div>
          </section>
        ) : null}

        <section className="choice">
          <h2>At the table</h2>
          <div className="seats">
            {seats.map(seat => (
              <div className="seat" key={seat.id}>
                <span className="seat__name">
                  {seat.name}
                  {seat.kind === 'bot' ? <span className="seat__meta">house</span> : null}
                  {!seat.present ? <span className="seat__meta">away</span> : null}
                </span>
                {isHost && seat.kind === 'bot' ? (
                  <button
                    type="button"
                    className="button button--small button--ghost"
                    onClick={() => onRemove(seat.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {Array.from({ length: MAX_SEATS - seats.length }, (_, i) => (
              <div className="seat" key={`empty-${i}`}>
                <span className="seat__name" style={{ opacity: 0.5 }}>
                  Empty chair
                </span>
              </div>
            ))}
          </div>

          {isHost ? (
            <>
              <div className="row">
                {BOT_STYLES.map(style => (
                  <button
                    key={style}
                    type="button"
                    className="button button--small button--ghost"
                    disabled={full}
                    onClick={() => onAddBot(style)}
                  >
                    Add {style}
                  </button>
                ))}
              </div>
              <button type="button" className="button button--gold" disabled={!ready} onClick={onStart}>
                {ready ? 'Open the kiln' : `Needs ${MIN_SEATS - seats.length} more`}
              </button>
            </>
          ) : (
            <p className="hint">Waiting for the host to start.</p>
          )}
        </section>
      </div>
    </div>
  )
}
