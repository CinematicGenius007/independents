# Ultimate TTT — HUD redesign plan

The look is a vehicle dashboard: near-black panels, hairline borders, monospace labels, and one
signal colour that only appears when something is forced or live. The Paper file
("Ultimate TTT") holds the artboards this plan implements: HUD lobby, match, invite and result,
desktop, and the four transitional states.

## Visual system

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0B0D10` | page |
| `--panel` | `#14181D` | cards, scoreboard |
| `--line` | `#2A3038` | hairlines, grid |
| `--text` | `#E8E6DF` | primary text, O mark |
| `--dim` | `#8A919B` | labels |
| `--signal` | `#FF5A36` | forced board, live, primary action — nothing else |
| `--x` | `#7FD6E8` | X |

Type: Space Grotesk 700 for headings, JetBrains Mono for labels, numbers and codes. Both are
self-hosted and subset to Latin through `@fontsource`, so there is no render-blocking request to
Google Fonts.

Motion is transform and opacity only, 120–420 ms, and switched off under
`prefers-reduced-motion`.

## Screens

1. **Lobby** — hero, three launch cards (online, versus the machine, pass and play), device
   codename and record, last three matches.
2. **Match** — scoreboard cards, forced-board label, the board, move timeline, last move.
   Below 960 px it is one column; above it is three: identity rail, board, timeline and history.
3. **Waiting / invite** — QR-free for now (no dependency): big room code, Share, Copy.
4. **Result** — verdict, match number, Rematch, Share result (PNG card), Copy replay link, Replay.
5. **Replay** — opened from `#m=…`; scrub the timeline, verified-by-replay badge.
6. **Transitional states** — waiting for rival, handoff arrow to the forced board, board
   captured, reconnecting with the queued move.

## Features

- **Match record** (`src/record.ts`). A finished game is its move list, because the rules are a
  pure function. Moves are bit-packed — 4 bits when the board is forced, 7 when it is free — and
  base64url'd into `#m=…`. Decoding replays the game, so a link with an illegal move is rejected.
- **Match number** (`#7QK-4M2`). SHA-256 of the canonical record, 30 bits in Crockford base32.
  Replaying a link recomputes it. It proves the sequence is unaltered; it does not prove the game
  was really played, and it is not globally registered.
- **Last three matches** (`src/history.ts`). A ring buffer in `localStorage`, newest first,
  tolerant of storage being refused or corrupted.
- **Move log in the table** (`src/net/table.ts`). The reducer keeps the moves of the current
  round, so online games can be recorded, replayed and shared without any new message type.
- **Versus the machine** (`src/ai.ts`). Three levels over the existing `legalMoves` and
  `applyMove`: Rookie (takes wins, blocks, otherwise random), Tactician (alpha-beta, depth 3),
  Grandmaster (iterative deepening alpha-beta on a 600 ms budget). Runs in a Web Worker so the
  interface never stalls.
- **Share result.** The result card is drawn on a canvas, exported as PNG, and passed to
  `navigator.share` with the replay link; where files cannot be shared it downloads.
- **Codename.** A stable `adjective-animal-NN` per device when no name is set.

## Not in this pass

Emotes (every message goes into the room's 2000-entry log), rule twists, undo, powers and clocks.
Those are planned separately.

## Web presence

SVG favicon, mask-able PNG icons, Apple touch icon, Safari pinned tab, Open Graph and Twitter
images, web manifest, `robots.txt` and `sitemap.xml`, JSON-LD `VideoGame` metadata. PNGs are
generated from the SVG sources by `scripts/make-icons.mjs`.
