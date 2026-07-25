# Temporary takeover notes

The original build agent paused because its credits ran out. Codex temporarily took over on
2026-07-25, preserving the decisions in `PLAN.md` and `CHECKPOINT.md`.

## Inherited work captured

The previously uncommitted P0–P4 work was verified and committed locally in five reviewable
commits. Nothing was pushed:

- `726f919` — scaffold, plans, dependencies, and frozen cross-layer contracts
- `ec76743` — sketchbook design system and `#kit` showcase
- `d6e0d7f` — sql.js persistence, repositories, migrations, and 520-word seed
- `c070a4a` — Trystero transport, mesh, presence, and room lifecycle
- `cd0ada4` — deterministic game engine

A root `.gitignore` was added so dependency folders, builds, TypeScript build metadata, local
environment files, and macOS metadata are not committed.

## Review gate

R1 was completed against the frozen contracts. The inherited baseline passed 207 tests,
type-check, and production build. The design kit was visually checked at 1280 px; the earlier
panel-title and paper-grain concerns no longer reproduce in the final inherited files.

The only plan inconsistency found is documentary: the architecture overview says host election is
the lowest connected peer ID, but `shared/types.ts`, `net/protocol.ts`, and the implementation use
earliest join time with peer ID as a tie-breaker. No behavior was changed.

## Work added during takeover

P5 has started with:

- `src/canvas/model.ts` — immutable op application, duplicate suppression, local monotonic ID
  allocation, and per-author undo.
- `src/canvas/codec.ts` — compact binary encoding for all live ink frames and complete op logs,
  with malformed/truncated payload rejection.
- `src/canvas/renderer.ts` — deterministic software replay with scanline flood fill, erasing, and
  clear behavior. Identical op logs produce byte-identical RGBA rasters.
- `src/canvas/CanvasSurface.tsx` and `CanvasTools.tsx` — responsive DPR-aware presentation,
  logical coordinate mapping, coalesced pointer samples, animation-frame network batches,
  incremental live-stroke previews, and sketch-style drawing controls.
- `src/canvas/history.ts` — folds old operations into a baseline raster at the retained-history
  limit without changing output pixels; includes a 5,000-point stroke check.
- 21 new canvas tests. Current total: 228 passing across 20 files.

Colors are encoded as three RGB bytes and decoded to canonical uppercase `#RRGGBB`, matching
`INK_PALETTE`.

## First handoff notes (superseded)

Please review the binary format before it becomes a compatibility boundary. P5 still needs the
replay renderer, deterministic flood fill, responsive/DPR-aware canvas component, pointer-event
batching, toolbar wiring, snapshot fallback, pixel equality test, and 5,000-point performance
check. The op-history folding requirement also remained at that point. These items were completed
in the continuation below; this paragraph is retained only to preserve the handoff chronology.

## Continuation through P9

The stale paragraph above describes the first handoff only. The temporary takeover then completed
P5–P9: snapshot-aware folded history, the application router, lobby/game/results flow, host
sequencing and recovery, live ink, practice, local stats, backup controls, accessibility polish,
and lazy browser-safe SQL.js loading. R2 found several authority and migration races; these were
fixed in `992149a8`. Follow-on commits are `4706e449` (folded canvas sync), `5f5a4fa0`
(browser SQL.js interop), and `3d9423e5` (complete application/practice wiring).

R3 then found and prompted fixes for simultaneous roster split-brain, React-batched stat loss,
host recovery ordering, stale out-of-band snapshots, custom-word recovery, and a duplicate build
WASM. The current automated gate is 261 passing tests across 27 files plus clean type-check and
build. Production output totals about 564 KB gzip with one WASM asset. Real-browser checks covered
onboarding, profile persistence, room creation, practice drawing and advancement, stats routing,
the 375 px layout, and production-preview boot. Public relay discovery did not connect the two
local tabs in this environment, so full two-/three-tab gameplay, late join, and host-drop
verification remain explicitly open rather than being reported as passed. The lobby now exposes
relay failure to the player.

R3 recovery fixes are collected in `72b3e851`: revisioned action delivery, gap buffering, atomic
state/canvas snapshots, cross-peer live-ink replay during sync, stable roster bootstrap history,
portable multiplayer word pools, and transition-synchronous local stats.
The final incumbent/newcomer handshake ordering fix is `362aac4b`; the R3 reviewer rechecked the
forced-order regression and reported the tree clean.
