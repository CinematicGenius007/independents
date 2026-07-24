# Checkpoint — 2026-07-25

Stopping point for the Pictionary build. Everything below is the actual state on disk, not
intentions. Plan of record is [PLAN.md](./PLAN.md); original brief is [INIT_PLAN.md](./INIT_PLAN.md).

## Decisions locked

| Question | Decision |
|---|---|
| Visual direction | Hand-drawn sketch diorama — ink on textured paper, grayscale + one yellow accent (`#F5D311`), red-orange (`#F2603C`) for urgency only |
| Signaling | Trystero over public relays (Nostr primary, MQTT fallback). No backend authored or maintained |
| Stack | React 19 + TypeScript + Vite 7 + Tailwind v4, pnpm — matches `apps/sudoku-solver` |
| Local DB | `sql.js` (wasm) + IndexedDB blob persistence |
| Authority | Deterministic derivation for turn order and word picks; host stamps anything time-dependent |

### Deviations from INIT_PLAN, deliberate

1. **Host sequences timing.** Pure deterministic timing across drifting clocks would award
   different scores to different peers for the same guess. Turn order and word selection stay
   seeded-PRNG deterministic; the host stamps `TURN_STARTED` / `HINT_REVEALED` / `GUESS_CORRECT` /
   `TURN_ENDED`. Host migration is deterministic, so this is not a single point of failure.
2. **The word is never broadcast.** The host sends it privately to the drawer. Guessers hold
   `null` until the reveal. Stronger than the brief, which conceded that clients can inspect the
   word early.

## Status by phase

| Phase | State | Notes |
|---|---|---|
| P0 · Scaffold + contracts | **Done** | Build green. All cross-layer types hand-written and frozen |
| P1 · Design system | **Done** | 18 files under `src/design/`; `#kit` showcase wired into `App.tsx`. Visually verified at 1280px — reads as ink on paper. Two cosmetic nits below |
| P2 · Persistence | **Done** | 24 tests |
| P3 · Networking | **Done** | 35 tests. Now reads `LIMITS.peerDisconnectMs`; `PresenceOptions` exposes `graceMs`/`disconnectMs` overrides for tests |
| P4 · Game engine | **Done** | 147 tests. Both contract amendments below are implemented |
| R1 · Tier-1 review gate | Not started | |
| P5 · Canvas | Not started | |
| P6 · Screens | Not started | |
| P7 · Controller wiring | Not started | Orchestrator-owned |
| R2 · Integration gate | Not started | |
| P8 · Practice + stats | Not started | |
| P9 · Polish + docs | Not started | |

**Test suite at checkpoint: 207 passing, 16 files, zero failures. `pnpm type-check` clean.**
Verified directly after the last agent landed, not taken on report.

Breakdown: engine 147, net 35, db 24, plus seed assertions.

## Contract amendments made after Tier 1 reported

The engine agent surfaced two genuine defects in the contracts I wrote in P0. Both are fixed in the
type files; the implementations were sent back to match and had not finished at checkpoint time.

1. **Hints were structurally impossible.** `HINT_REVEALED` carried only `indices: number[]`. But
   guessers never hold the word, so positions alone gave them nothing to render — a design bug no
   unit test would have caught. `TurnState.revealed` is now `Record<number, string>` and the action
   carries `reveals: Record<number, string>`; the host stamps the actual letters.
2. **The word was lost when the drawer disconnected.** `PLAYER_LEFT` ends the turn immediately, so
   the host's `TURN_ENDED` — which carries the reveal — arrived afterwards and was swallowed by the
   double-scoring guard. `TURN_ENDED` is now specified as idempotent: when the turn has already
   ended it fills in `word` only and never re-applies scores. The one genuinely unrecoverable case
   (the drawer was also the host, so nobody remaining ever knew the word) is specified as
   `word: ''` → UI shows the turn as cancelled rather than faking a reveal.

Also codified: `LIMITS.peerDisconnectMs` (16 s) now sits alongside `peerGraceMs` (8 s), replacing a
convention the net agent had invented locally.

## Open cosmetic issues (for R1, not blockers)

Both observed by me in the `#kit` showcase at 1280px:

1. **`Panel` titles collide with the top border.** The title straddles the panel's top edge like a
   fieldset legend, but with no background gap knocked out, so the ink border runs through the
   text. Worse where a section caption sits directly above (the "TONES" / "Lobby" pair).
2. **Paper grain is close to invisible.** The agent turned the turbulence down after finding it
   overpowering and overshot — the background currently reads as flat off-white. Wants a middle
   setting.

## Judgment calls adopted from agents

- `PlayerStats.rating` starts at 1000.
- `StatsRepo.bump` treats `bestStreak` as a high-water mark, not a sum.
- `StatsRepo.reset()` clears `game_history` as well as the aggregate counters.
- `PRAGMA foreign_keys = ON` is set on every connection — without it the `word_packs` cascade in
  `schema.sql` silently does nothing.
- `GAME_STARTED` clears chat; the controller must dispatch `TURN_STARTED` before `WORD_ASSIGNED`.

## Word library

520 words, zero duplicates, asserted by test: general 90, animals 70, food 70, objects 70,
places 60, hard 60, idioms 50, popculture 50.

## Frozen files — do not edit without updating every consumer

`src/shared/types.ts` · `src/engine/types.ts` · `src/canvas/types.ts` · `src/net/protocol.ts` ·
`src/db/types.ts` · `src/db/schema.sql`

## To resume

1. Let the two in-flight agents land, then re-run `pnpm test` and `pnpm type-check`.
2. Run the **R1 gate**: audit P1–P4 against the contracts, and visually verify the design kit at
   `#kit` (it has never been looked at).
3. Then Tier 2 — P5 (canvas) and P6 (screens) in parallel.

Commands, from `apps/pictionary`:

```bash
pnpm install && pnpm dev
```
