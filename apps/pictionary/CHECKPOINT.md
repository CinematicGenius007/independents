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
| R1 · Tier-1 review gate | **Done** | Static contract audit, full tests/type-check/build, and `#kit` visual review at 1280 px completed during temporary takeover |
| P5 · Canvas | **Done** | Responsive DPR surface, tools, binary live ink, deterministic replay/fill, bounded history, and compact/snapshot sync |
| P6 · Screens | **Done** | Onboarding, home, lobby, game, summaries, results, practice, and stats are routed and responsive |
| P7 · Controller wiring | **Implemented; relay acceptance open** | Controller, sequencer, live ink, private words, late sync, disconnect and host migration are wired and unit-tested; public relays did not connect local browser tabs |
| R2 · Integration gate | **Done** | Authority, ordering, migration, liveness, stale timer, snapshot race, and cleanup findings fixed |
| P8 · Practice + stats | **Done** | Offline-capable practice and local multiplayer stats persistence wired; practice browser flow checked |
| P9 · Polish + docs | **Done; 3-tab acceptance open** | 564 KB gzip build incl. one WASM asset, lazy DB chunk, reduced motion/ARIA/contrast, failure feedback, backup confirmation, and docs |
| R3 · Final review | **Done** | Roster convergence, synchronous stat capture, recovery ordering, stale snapshot rejection, portable word pools, and duplicate WASM findings fixed |

**Test suite at latest checkpoint: 261 passing, 27 files, zero failures. `pnpm type-check`
and `pnpm build` clean. Production output is about 1.45 MB raw / 564 KB gzip including WASM.**

The final suite spans engine, networking, persistence, canvas, controller, sequencer, practice,
and local-stat projections. The 5,000-point canvas case remains part of the regular test run.

## Contract amendments made after Tier 1 reported

The engine agent surfaced two genuine defects in the contracts written in P0. Both the type files
and their implementations are now aligned.

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

## R1 visual findings

The two earlier cosmetic nits were re-checked after all inherited files landed. Panel titles now
knock out the border cleanly, and the paper grain reads as restrained rather than flat. No design
change was needed.

An earlier PLAN inconsistency around lowest peer ID versus earliest `joinedAt` has been corrected.
The plan of record and implementation both preserve the longest-connected host, breaking ties by
peer ID.

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

1. On a network where the public Nostr/MQTT routes are reachable, complete a three-player game and
   verify draw, guess, score, advance, late join, drawer leave, and host migration in real tabs.
2. Run the target-browser, touch/stylus, assistive-technology, and production-preview checks in
   [TODO.md](./TODO.md).
3. Review the continuation recorded in [TAKEOVER_NOTES.md](./TAKEOVER_NOTES.md), especially the
   host recovery and compact canvas snapshot boundaries, before changing their protocols.

Commands, from `apps/pictionary`:

```bash
pnpm install && pnpm dev
```
