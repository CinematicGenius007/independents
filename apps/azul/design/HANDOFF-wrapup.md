# Handoff: review, finish and commit the uncommitted Azul work

You are picking up uncommitted work in `apps/azul` (React 19 + Vite + TypeScript, pnpm) on the branch `feat/independent-concepts` in `/Users/cinematicgenius007/Development/nebula/independents`. Your job is to:

1. review it;
2. verify it in the running app;
3. fix anything broken;
4. commit it in clean, logical commits.

Do not push or open a PR unless the user asks.

Another agent may be refining the tile artwork at the same time. That covers `src/ui/Tile.tsx`, `src/ui/tileGeometry.ts` and the tile rules in `src/styles.css`. Commit the tile files as they are now as a baseline, but do not change their artwork. If `git status` shows them changing under you, stop and ask the user.

## What was done (all uncommitted)

### 1. Tile redraw

Files: `src/ui/Tile.tsx`, `src/ui/tileGeometry.ts` (new), `src/main.tsx`, `src/styles.css`.

- The five tiles were redrawn after the real Azul set. Patterns are generated from geometry in `tileGeometry.ts`.
- Shared gradients and the face clip path live in `TileDefs`, mounted once in `main.tsx`. Flying tiles are DOM clones, so ids must be global.
- Empty wall spaces (`pounce`) are now a faded flat print of the tile face.
- Empty pattern-line and floor slots are recessed squares.
- Colour names changed to Blue / Yellow / Red / Black / Turquoise.
- Reference photos and exported SVGs are in `design/reference/`. Commit them; they are the source material.

### 2. Learning mode

Files: `src/ui/learning.ts` (new), `src/App.tsx`, `src/ui/Table.tsx`, `src/ui/Board.tsx`, `src/styles.css`.

- A "Learning on/off" button sits in the masthead.
- On by default. Stored in localStorage as `azulejo:learning` (`on` / `off`).
- When on, it shows:
  - the line reckoning (+N / −N / "N short");
  - previews of where tiles would land on the lines and floor;
  - the playable-line outline;
  - rows/cols/sets bonus progress;
  - the +N label as a tile scores;
  - the centre hint and the colour key;
  - the status-bar legend;
  - a new **Remaining tiles** panel in the side column (per-colour count still in bag and lid, via `unseenTiles`).
- The old masthead "Bag" and "Unseen" readouts were removed in favour of that panel.
- When off, a line only highlights on hover or focus.

### 3. Bug fix

Files: `src/net/session.ts`, `src/net/session.test.ts`.

- `onEvent` used to throw, uncaught, when a follower's copy could not apply the host's move, which crashed the table.
- It now validates the seat, catches the error and sends `sync` to get the position again.
- A new test covers this. It fails without the fix.

## Not part of this work: leave alone unless the user says otherwise

- `.claude/launch.json` (adds an `ultimate-ttt` entry; it was already modified before this work).
- `apps/azul/public/design/` (the user's own design study).
- `design/HANDOFF-*.md` (these prompts). Ask the user whether they want them committed.

## Steps

1. **Read the diff.** Run `git diff` and read the new files. Look for:
   - leftover debug code, such as a `Gallery` import or a `?gallery` check in `main.tsx`;
   - unused exports;
   - styles that no longer match their markup (e.g. `.slot--incoming`, `.floor__slot--incoming`, `.board--learning`).
2. **Run the checks.** Run `pnpm --dir apps/azul type-check`, `pnpm --dir apps/azul test` (60 tests should pass) and `pnpm --dir apps/azul build`.
3. **Verify learning mode in the browser.** Run the dev server (the `azul` entry in `.claude/launch.json`, port 5185) and start a solo game against the house. Then:
   - With learning on: pick tiles and confirm the previews, the reckoning and the Remaining tiles panel. Play through one round's scoring and confirm the +N labels appear.
   - Toggle learning off: all of the aids above disappear, hovering a line still highlights it, and moves still work by click and number keys.
   - Reload the page: the setting persists.
   - Check a narrow width (≈390px) for layout breakage, especially the Remaining tiles row.
4. **Check accessibility.** The learning toggle uses `aria-pressed`. Playable lines without learning mode still need a visible focus state.
5. **Commit** in this order, conventional-commit style, like the repo history (`feat(azul): …`, `fix(azul): …`):
   - `fix(azul): resync a follower whose copy cannot apply the host's move` (session.ts + test)
   - `feat(azul): learning mode with previews, hints and a remaining-tiles count` (learning.ts, App, Table, Board, related CSS)
   - `feat(azul): redraw tiles from geometry after the real set` (Tile.tsx, tileGeometry.ts, main.tsx, tile/slot CSS, design/reference/)

   If the CSS cannot be split cleanly across commits, keep it with whichever commit it mostly belongs to. End each commit message with the attribution line the session asks for.
6. **Report back.** Say what you verified, anything you fixed, and the commit hashes.
