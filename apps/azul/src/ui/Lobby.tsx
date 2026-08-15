/**
 * The room before the tiles come out.
 *
 * Two jobs. Make the code trivial to hand to someone else, and make the table
 * obviously incomplete until it is not — so the room is drawn as four chairs,
 * each holding the blank wall its player is about to start filling. An empty
 * chair shows the wall nobody has claimed and the three house players who
 * would take it, named by how they play rather than by a difficulty number.
 *
 * The code is set as a maker's stamp, because that is what it is: five
 * characters pressed into the piece so the other half of the pair can find it.
 */

import { useState } from 'react'
import type { BotStyle } from '../engine/bot'
import { BOT_STYLES } from '../engine/bot'
import type { RelayStatus, Seat } from '../net/protocol'
import { MAX_SEATS, MIN_SEATS } from '../net/protocol'
import { WALL_SIZE, wallColor } from '../engine/types'
import { Tile } from './Tile'

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

/** How each house player behaves, in words a player can act on. */
const HOUSE_STYLE: Record<BotStyle, string> = {
  apprentice: 'takes the tile in front of it and hopes',
  artisan: 'counts the floor before it commits',
  master: 'plays for the bonus, and for what it leaves you',
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
  const empty = Math.max(0, MAX_SEATS - seats.length)
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
    <div className="lobby">
      <section className="lobby__head">
        {code ? (
          <div className="stamp">
            <span className="stamp__label">Room</span>
            <span className="stamp__code">{code}</span>
            <span className="stamp__status" data-status={status}>
              {status === 'connected'
                ? 'open — anyone with the code can sit down'
                : status === 'connecting'
                  ? 'finding a relay to signal through'
                  : 'no relay answered; check the connection and reload'}
            </span>
          </div>
        ) : (
          <div className="stamp stamp--solo">
            <span className="stamp__label">Solo</span>
            <span className="stamp__code">You and the house</span>
            <span className="stamp__status">nothing leaves this browser</span>
          </div>
        )}

        <div className="row">
          {url ? (
            <button type="button" className="button button--small" onClick={copy}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          ) : null}
          <button type="button" className="button button--small button--ghost" onClick={onLeave}>
            Leave
          </button>
        </div>
      </section>

      <div className="chairs">
        {seats.map((seat, index) => (
          <article className="chair chair--taken" key={seat.id}>
            <BlankWall />
            <div className="chair__body">
              <h3 className="chair__name">{seat.name}</h3>
              <p className="chair__note">
                {seat.kind === 'bot'
                  ? HOUSE_STYLE[seat.style]
                  : index === 0
                    ? 'holds the bag and deals'
                    : seat.present
                      ? 'seated'
                      : 'away — the house will play this seat'}
              </p>
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
          </article>
        ))}

        {Array.from({ length: empty }, (_, i) => (
          <article className="chair chair--empty" key={`empty-${i}`}>
            <BlankWall faded />
            <div className="chair__body">
              <h3 className="chair__name">Empty chair</h3>
              {isHost ? (
                <>
                  <p className="chair__note">Wait for someone, or let the house take it.</p>
                  <div className="chair__houses">
                    {BOT_STYLES.map(style => (
                      <button
                        key={style}
                        type="button"
                        className="button button--small button--ghost"
                        onClick={() => onAddBot(style)}
                        title={HOUSE_STYLE[style]}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="chair__note">Room for one more.</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <footer className="lobby__foot">
        {isHost ? (
          <>
            <button type="button" className="button button--gold" disabled={!ready} onClick={onStart}>
              {ready ? 'Open the kiln' : `Needs ${MIN_SEATS - seats.length} more`}
            </button>
            <p className="hint">
              Two to four play. Displays are dealt at two per player plus one, so a fuller table is
              a busier one.
            </p>
          </>
        ) : (
          <p className="hint">Waiting for the host to start. Your seat is held.</p>
        )}
      </footer>
    </div>
  )
}

/** The wall a player starts with: all pounce, nothing fired. */
function BlankWall({ faded = false }: { faded?: boolean }) {
  return (
    <div className={`chair__wall ${faded ? 'chair__wall--faded' : ''}`} aria-hidden="true">
      {Array.from({ length: WALL_SIZE }, (_, r) =>
        Array.from({ length: WALL_SIZE }, (_, c) => (
          <Tile key={`${r}-${c}`} color={wallColor(r, c)} pounce className="chair__tile" />
        )),
      )}
    </div>
  )
}
