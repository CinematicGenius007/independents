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
| P5 · Canvas | **In progress** | Pure op-log model and binary frame/log codec landed with 15 tests; renderer, tools, pointer hook, and performance verification remain |
| P6 · Screens | Not started | |
| P7 · Controller wiring | Not started | Orchestrator-owned |
| R2 · Integration gate | Not started | |
| P8 · Practice + stats | Not started | |
| P9 · Polish + docs | Not started | |

**Test suite at latest checkpoint: 222 passing, 18 files, zero failures. `pnpm type-check`
and `pnpm build` clean.**

Breakdown before P5: engine 147, net 35, db 24, plus seed assertions. P5 currently adds 15
canvas model/codec tests.

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

## R1 visual findings

The two earlier cosmetic nits were re-checked after all inherited files landed. Panel titles now
knock out the border cleanly, and the paper grain reads as restrained rather than flat. No design
change was needed.

One documentation inconsistency was noted but behavior was deliberately left untouched: an early
PLAN paragraph says host migration chooses the lowest peer ID, while the frozen shared/net
contracts and implementation choose earliest `joinedAt`, breaking ties by peer ID. The latter is
the plan of record because it preserves the longest-connected host.

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

1. Continue P5 with the replay renderer and deterministic fill implementation.
2. Add the responsive/DPR-aware drawing surface, pointer batching hook, and tool UI.
3. Complete P5 pixel-replay and 5,000-point performance acceptance checks.
4. Then P6 screens, followed by P7 controller integration.

Commands, from `apps/pictionary`:

```bash
pnpm install && pnpm dev
```
