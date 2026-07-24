# Pictionary — Build Plan

Derived from [INIT_PLAN.md](./INIT_PLAN.md). This document is the execution contract: phases,
dependency order, module ownership, and acceptance criteria per phase.

---

## 0. Decisions locked before build

| Question | Decision | Rationale |
|---|---|---|
| Visual direction | **Hand-drawn sketch diorama** (ref image 1) | Paper texture, ink-marker strokes, grayscale + single yellow accent (`#F5D311`), red-orange alerts (`#F2603C`). The UI speaks the same visual language as the drawing canvas. |
| Signaling | **Trystero** over public relays (Nostr primary, MQTT fallback) | Zero backend authored or maintained. Join by `#room=<id>`, automatic full mesh, ~10 KB. |
| Framework | React 19 + TypeScript + Vite + Tailwind v4 | Matches `apps/sudoku-solver` convention in this repo. pnpm. |
| Local DB | `sql.js` (wasm) + IndexedDB blob persistence | OPFS/absurd-sql is fragile across Safari/Firefox. Export/import falls out for free. |
| Authority model | Deterministic derivation + **host as sequencer** | Turn order and word selection are seeded-PRNG derived (no arbiter needed, per spec). Phase transitions and time-based scoring are stamped by the host, because wall clocks diverge. Documented deviation from "no central arbiter". |

### Deviations from INIT_PLAN (deliberate)

1. **Host sequencer for timing.** Pure deterministic timing is not achievable across peers with
   drifting clocks; two peers would award different point totals for the same guess. The host
   stamps `TURN_END`, `HINT_REVEAL`, and `GUESS_CORRECT` (with elapsed ms). Everything else stays
   deterministic. Host migration is deterministic (lowest peer ID) so this is not a single point
   of failure.
2. **Canvas is an op-log, not a bitmap.** Late joiners receive the op-log (compact binary), not a
   PNG, unless the log exceeds a size threshold — then a PNG snapshot plus a truncated log.

---

## 1. Architecture

Four independent layers. Game logic never imports the transport; the transport never imports React.

```
┌─────────────────────────────────────────────────────────┐
│  screens/  — Onboarding · Lobby · Game · Results · Stats │  React
├─────────────────────────────────────────────────────────┤
│  design/   — Panel, SketchButton, Bubble, Chip, Ticker   │  React + tokens
├──────────────┬────────────────┬─────────────────────────┤
│  canvas/     │  game/         │  screens glue           │
│  op-log,     │  controller:   │                         │
│  renderer,   │  engine ⇄ net  │                         │
│  codec       │  ⇄ db          │                         │
├──────────────┴────────────────┴─────────────────────────┤
│  engine/  pure reducer · seeded PRNG · scoring · hints   │  zero deps, unit-tested
├─────────────────────────────────────────────────────────┤
│  net/     Trystero adapter · protocol codec · presence   │  transport-agnostic interface
│           · host election · reconnection                 │
├─────────────────────────────────────────────────────────┤
│  db/      sql.js · schema · repositories · word packs    │  IndexedDB-backed
└─────────────────────────────────────────────────────────┘
```

### Directory layout

```
apps/pictionary/
  public/sql-wasm.wasm
  src/
    shared/types.ts        # cross-layer contract (owned by orchestrator)
    styles/theme.css       # design tokens
    design/                # presentational component kit
    db/                    # sqlite.ts, schema.sql, repos/, seed/words.json
    net/                   # protocol.ts, transport.ts, room.ts
    engine/                # types.ts, reducer.ts, rng.ts, scoring.ts, guess.ts, words.ts
    canvas/                # model.ts, codec.ts, renderer.ts, tools/, useDrawing.ts
    game/                  # controller.ts, hooks/
    screens/
```

### Key mechanisms

**Turn order & word selection.** `seed = hash(roomId + gameNonce)`; `mulberry32(seed)` drives a
Fisher–Yates shuffle of the sorted player-ID list and the per-turn word index. Every client
computes the identical sequence; only the drawer's client renders the word.

**Stroke sync.** Logical canvas 1600×1000. Points quantized to Int16 (0–10000 normalized). Live
strokes stream as `STROKE_APPEND { strokeId, points[] }` batched on `requestAnimationFrame`
(~16 ms), sent over a binary data channel. No bitmap broadcast.

**Fill bucket.** Broadcast as `FILL { x, y, color }`; each client runs the identical flood fill
against its own raster, which is identical because the op-log is identical.

**Undo.** Op-log with monotonic IDs; `UNDO` pops the drawer's last op and triggers a replay.
History capped at 100 ops per turn.

**Host election.** Host = lexicographically smallest connected peer ID. On host disconnect, every
client re-elects deterministically; the new host requests a canvas snapshot from any peer and
resumes the current phase from its own last-known state.

---

## 2. Phases

Each phase lists **owner** (orchestrator = me, or a Sonnet subagent), **blocking deps**, and
**acceptance criteria**. Phases on the same tier run in parallel.

### Tier 0 — Foundation

#### P0 · Scaffold + shared contracts — *orchestrator*
Deps: none.
- Vite + React 19 + TS + Tailwind v4 app, pnpm, matching repo conventions.
- Vitest configured for `engine/`, `canvas/`, `net/` unit tests.
- **Write every cross-layer type by hand**: `shared/types.ts`, `net/protocol.ts` (message union),
  `engine/types.ts` (state + action union), `canvas/types.ts` (op union), `db/schema.sql`, repo
  interface signatures, `styles/theme.css` token names.
- Accept: `pnpm build` and `pnpm test` pass on an empty shell; every downstream agent has a typed
  surface to implement against and cannot collide.

### Tier 1 — Parallel layer build (4 agents)

#### P1 · Design system — *Sonnet*
Deps: P0 tokens.
- Tokens: paper `#F2F1ED`, ink `#1A1A1A`, accent `#F5D311`, alert `#F2603C`, plus grayscale ramp.
  Light/dark not required; the paper look is single-mode.
- Paper grain texture (inline SVG feTurbulence, no external asset), ink borders 3 px with subtle
  per-instance rotation, hard offset drop shadows, dashed selection outlines.
- Components: `Panel`, `TornCard`, `SketchButton`, `IconButton`, `SpeechBubble` (with tail),
  `PlayerChip`, `Avatar`, `Slider`, `Toggle`, `Modal`, `Toast`, `Ticker`, `ProgressBar`, `WordBlanks`.
- Type: hand-lettered display face for headings, clean sans for body. Self-hosted or system stack —
  no external font CDN (offline-capable, CSP-safe).
- Accept: a `/kit` dev-only route renders every component in every state; no layout shifts; keyboard
  focus visible on all interactives.

#### P2 · Persistence — *Sonnet*
Deps: P0 schema.
- `sql.js` bootstrap with wasm served from `public/`, lazy-loaded so it never blocks first paint.
- Schema per INIT_PLAN §Data Schema, plus a `schema_version` table and a forward-only migration runner.
- Repositories: `players`, `preferences`, `wordPacks`, `words`, `stats`, `gameHistory`.
- Persistence: debounced `db.export()` → IndexedDB blob; restore on boot; `exportToFile()` /
  `importFromFile()`.
- **Seed word library: ≥ 500 words** across General, Animals, Food, Places, Objects, Idioms,
  Pop Culture, Hard Mode, each with a 1–3 difficulty rating. Ship as JSON, imported on first boot.
- Accept: unit tests cover round-trip persistence, migration from empty, export/import fidelity,
  and word-count-per-category assertions.

#### P3 · Networking — *Sonnet*
Deps: P0 protocol.
- `Transport` interface (send/broadcast/on/peers/leave) with a Trystero implementation behind it —
  swapping relays or moving to manual SDP later must not touch callers.
- Binary codec for the message union; stroke messages must be compact (typed arrays, not JSON).
- Presence: join/leave, latency ping, `disconnected` flagging with a grace window before removal.
- Host election + migration, state-resync request/response, late-join snapshot request.
- Room URL: `#room=<id>`, generated + copyable; parsed on boot.
- Accept: codec round-trip tests for every message type; a simulated two-peer harness (in-memory
  transport double) exercises join → host election → host drop → re-election.

#### P4 · Game engine — *Sonnet*
Deps: P0 engine types.
- Pure reducer covering phases: `idle → lobby → turn_intro → drawing → turn_end → round_end → game_end`.
- `mulberry32` PRNG + string hash; deterministic turn order and word picks.
- Scoring exactly per spec: guesser `max(10, 100 - elapsed*2)`, drawer `10 * correctGuessers`.
- Guess handling: normalization, exact match, Levenshtein ≤ 2 → "close" whisper, 3 s rate limit,
  post-correct message masking.
- Hints: after 50 % of turn time, reveal one letter every 10 s, deterministic positions.
- Accept: ≥ 40 unit tests. Two engine instances fed the identical action log must land on
  byte-identical state (property test).

### Tier 2 — Surfaces (2 agents, after Tier 1 review gate)

#### P5 · Drawing canvas — *Sonnet*
Deps: P0 canvas types, P1 (tool UI), P4 (turn state).
- Responsive canvas mapped to the 1600×1000 logical space; DPR-aware.
- Tools: pencil, eraser, fill bucket, undo, clear. Color palette + hex input. Brush 1–50 px.
- Op-log model, binary codec, replay renderer, PNG snapshot fallback.
- Pointer events (mouse + touch + stylus pressure where available).
- Accept: codec round-trip tests; replaying an op-log produces a pixel-identical raster; drawing at
  60 fps with 5 000 points in the log.

#### P6 · Screens — *Sonnet*
Deps: P1, P4 selectors.
- Onboarding (nickname + avatar color, restored from DB), Lobby (player list, host settings: turn
  time 30–180 s, rounds, categories, custom words), Game (canvas + chat + scoreboard + timer +
  word blanks), Round summary, Results with Play Again, Stats dashboard.
- Chat panel with system messages, close-guess whispers, masked post-correct messages.
- Fully responsive: side-by-side on desktop, stacked with a collapsible chat on mobile.
- Accept: every screen driven by mocked state renders correctly at 375 px and 1440 px.

### Tier 3 — Integration

#### P7 · Controller wiring — *orchestrator*
Deps: P1–P6.
- `game/controller.ts`: net messages → engine actions → React state; local intents → net broadcast.
- Late-join snapshot flow, disconnect/reconnect, host migration end-to-end.
- Drawer-private word delivery, timer sync, intermission auto-advance.
- Accept: **two real browser tabs** join a room, play a full turn — draw, guess, score, advance —
  verified by me driving both tabs.

### Tier 4 — Completion

#### P8 · Practice mode + stats — *Sonnet*
Deps: P7.
- Solo practice: random word, timer, heuristic "AI guess" for flavor; playable with zero peers.
- Stats aggregation and dashboard; export/import DB from the UI.
- Accept: solo mode fully playable offline (airplane mode); stats increment correctly across games.

#### P9 · Polish, perf, docs — *Sonnet* + orchestrator verification
Deps: P8.
- Bundle budget check (< 2 MB compressed incl. wasm), code splitting, lazy sql.js.
- Latency measurement on the stroke path; keyboard nav; reduced-motion; ARIA on live regions.
- `README.md` (run locally, signaling flow explained, SQLite persistence explained) and `TODO.md`
  (AI solo guesser, animated replay, uploaded avatars).
- Accept: fresh clone → `pnpm install && pnpm dev` → 3-tab game verified by me; build size reported.

### Review gates

- **R1** after Tier 1: reviewer agent audits P1–P4 against contracts; I run typecheck + full test suite.
- **R2** after P7: reviewer agent audits integration for races, leaks, and error paths; I verify in-browser.
- **R3** after P9: final correctness + simplicity pass.

---

## 3. Dependency graph

```
P0 ──┬─► P1 ─┐
     ├─► P2 ─┤
     ├─► P3 ─┼─► R1 ─┬─► P5 ─┐
     └─► P4 ─┘       └─► P6 ─┴─► P7 ─► R2 ─► P8 ─► P9 ─► R3
```

## 4. Risk register

| Risk | Mitigation |
|---|---|
| Public relay unavailable / blocked | Transport interface allows a relay-strategy swap without touching callers; surface a clear "can't reach relay" state rather than a silent hang. |
| Mesh at 8 peers saturates the stroke path | Only one drawer streams at a time; batched binary packets; measured in P9. |
| sql.js wasm blows the bundle budget | Lazy-loaded, not on the first-paint path; budget verified in P9. |
| Flood-fill divergence across clients | Identical op-log ⇒ identical raster; fill runs on the logical-space raster, never the DPR-scaled one. |
| Parallel agents colliding on shared types | All cross-layer types are written by the orchestrator in P0 and are read-only for agents. |
