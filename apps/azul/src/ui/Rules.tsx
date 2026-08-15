/**
 * The rules, in the order a player meets them.
 *
 * Not a rulebook — a reminder. Six things, each one phrased as what you do
 * rather than what the system does, and each one visible in a single glance
 * without scrolling on a phone.
 */

import { useEffect } from 'react'

export function Rules({ onClose }: { onClose: () => void }) {
  // Escape closes it, and so does the ground around it — the two things anyone
  // tries first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div className="sheet__panel panel" onClick={event => event.stopPropagation()}>
        <header className="sheet__head">
          <h2 className="sheet__title">How to play</h2>
          <button type="button" className="button button--small button--ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <ol className="sheet__list">
          <li>
            <b>Take a colour, all of it.</b> Every tile of one glaze from one display, or every
            tile of one glaze from the centre. What is left on that display slides into the centre
            for whoever comes next.
          </li>
          <li>
            <b>Put them on one pattern line.</b> Lines fill right to left and hold a single colour.
            A line can only take a colour its wall row has not already fired.
          </li>
          <li>
            <b>What will not fit falls to the floor</b>, and the floor charges −1, −1, −2, −2, −2,
            −3, −3. You may drop a whole handful there on purpose when nothing else will take it.
          </li>
          <li>
            <b>A full line fires.</b> When the table is bare, each full line sends one tile to its
            wall space and the rest to the lid. A tile alone scores 1; a tile touching others
            scores the whole run it joins, horizontally and vertically both.
          </li>
          <li>
            <b>The first to take from the centre</b> starts the next round — and takes a penalty
            tile for the privilege.
          </li>
          <li>
            <b>The game ends</b> the moment someone completes a horizontal row of five. Then count
            2 for each full row, 7 for each full column, and 10 for each colour placed all five
            times.
          </li>
        </ol>

        <p className="hint">
          Everything you need to decide is on the board: a line you can play shows what it would
          earn and what the spillage would cost before you commit to it.
        </p>
      </div>
    </div>
  )
}
