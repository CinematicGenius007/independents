# Root Explorer, minimal sleeve — architecture

Status: design + interactive mock (`index.html` in this folder, plus `verify.cjs`).
Nothing here is wired into `apps/*`. This is a second landing-page variation beside
[`../root-explorer/`](../root-explorer/) (the Fish Night spectral ocean), which is untouched.

**The claim.** The Fish Night page answers "what is the site?" with spectacle. This one answers
with the quietest object a record collector knows: the back of a vinyl sleeve. Matte charcoal
cardstock, monospace liner notes, hairline leaders from a title to a running time. Set into that
card is a small flat chalk world seen in 3D perspective, and the two are one interface: a row of
the tracklist and a landmark in the world are the same thing seen twice, and acting on either
moves the other.

Everything in the Fish Night document that is about the site contract (§1 where it lives and
what it may not do), the manifest, port and handoff protocol (§3), falsifiable lineage (§4) and
the ten games (§6) applies here unchanged. This document only describes what is new: the sleeve,
the world, the focus machine that joins them, the re-inking of the board painters, and the
checks.

Run it: `python3 -m http.server -d . 8080` from the repo root, then open
`http://localhost:8080/prototypes/root-explorer-minimal/`. It needs the network once, for the
pinned `three@0.170.0` import map on jsDelivr (same as Fish Night) and for two Google Fonts
(IBM Plex Mono, Space Mono) with system monospace fallbacks. Nothing else loads.

![How the tracklist, the world, the board and the liner notes share one focus](diagrams/focus.svg)

*One focus state decides the camera, the board, the liner notes and the sigil. Source: [focus.mmd](diagrams/focus.mmd).*

## 1. The physical object

| Layer | What it is | How it is made |
| --- | --- | --- |
| Plaster | the outer wall, `#DCDAD7` | CSS gradients on `html` (soft top light, edge vignette) plus a fixed `feTurbulence` layer multiplied in |
| Petals | translucent off-white botanical petals at the corners | six inline SVG `<symbol>` instances with a blur filter, a pale gradient and a drop shadow; they drift a few pixels, and not at all under `prefers-reduced-motion` |
| Sleeve | the card, `#151516`, floating on a layered cast shadow | `main.sleeve`; its `::before` stacks a procedural canvas of paper fibre, chalk dust and smudges (generated once at load, tiles seamlessly) over an SVG turbulence fallback |
| Type | IBM Plex Mono (Space Mono fallback), `#EAE8E3` and muted `#8E8D8A` | uppercase, `letter-spacing: .04em`; the header is `.78em` tracked, `INDEPENDENTS — SCATTERED WORKS` |
| Accent | one colour, `#EE6A3C` | used for exactly three things: the pinned track, the current landmark and board, and the wanderer's lantern |
| Sigil | 1px monoline mark, bottom right | three SVG rings counter-rotating; the outer ring carries 19 ticks, one per track, and the current track's tick turns accent; hover spins it faster, click toggles the threads |

The canvas is transparent and CSS-masked with a soft ellipse, so the world is drawn directly on
the card's grain: there is no second background to match and no window frame, only four
registration corners.

## 2. Anatomy

```
 INDEPENDENTS — SCATTERED WORKS
 ┌ world (three.js) ───────────────┐   SIDE A — SHIPPED
 │   chalk contours, 19 totems,    │   01 FOGWALK ________ 05:00 · AUTOMATA
 │   the wanderer, the pop-up board│   02 BLOOMWRIGHT ____ 04:12 · L-SYSTEM
 └─────────────────────────────────┘   …
  hint line                [▶ PLAY]    SIDE B — PROTOTYPES
  FIG. 1 …    SPACE THREADS · O MAP    10 SPOREFRONT … 19 LEXICON QUARANTINE
 MECHANISM ____ …        PORTS / TRACK ____ …
 FORMAL CITE ___ …       SELF-TEST _______ ✓ 19/19 PORTS · ✓ 19/19 PAINTERS
 TRANSPORT ____ …        with special guest
 STATE HASH ____ …       [▶ DIVE IN ↵]                          ( sigil )
```

- **Tracklist.** Nineteen real `<a href>` rows, `01`..`19`. A row is a number, a bold title, a
  1px flex leader and `mm:ss · MECHANISM`. Side A is the nine shipped works, Side B the ten
  prototypes. The time is a typical sitting and the tag is a one-word mechanism; both are hand
  authored in `META`, not measured. The href is the destination itself, so middle-click, Tab,
  Enter and no-WebGL all work; the JavaScript only adds the focus behaviour.
- **Liner notes.** Two columns of short-underline credits in the reference's style. With nothing
  focused they describe the whole record (families, citation count, transports, a root hash over
  all 19 session hashes). With a track focused the left column is `MECHANISM / FORMAL CITE /
  TRANSPORT / STATE HASH / SEE ALSO` for that game and the right column is its port (action
  count, 60 Hz or turn-based, seed), entry path, self-test result and one lineage neighbour as
  the "special guest". `STATE HASH` is the live `session.hash()`, refreshed four times a second.

## 3. The world

### 3.1 A flat world, a tilted camera

The ground is the plane `y = 0`, 2D in the strict sense: nothing on it has height, and nothing is
filled. Perspective comes from one `PerspectiveCamera` (FOV 34) orbiting a look-at point. Fog
(`near = 0.55 × distance`, `far = 1.95 × distance`) fades the far ground into the card.

Every line is a `LineSegments2` (three's fat-line addon) at `1 × devicePixelRatio` device pixels,
so a "1px monoline" stays 1 CSS pixel on any display; native WebGL lines would be half a pixel on a
2× screen. About 12 000 line instances in 47 draw calls make the whole scene.

| Layer | Content |
| --- | --- |
| Contours | A marching-squares pass over a smooth height field (long ridges plus a Gaussian hill under every landmark), levels every 0.26, every fourth level brighter. Computed once at load, 0.85-unit grid. The hills are why each landmark stands inside concentric rings. |
| Groove | A dashed double hairline through the 19 landmarks in track order (a Catmull-Rom curve), like the run-out groove of a record. |
| Landmarks | 19 upright monoline totems (§3.3), each with a flat double ring on the ground. |
| Wanderer | A tiny filled paper-cut figure (cloak, brimmed hat, staff) that flips left and right, bobs when it walks and leaves fading chalk footprints; one accent lantern. |
| Threads | `Space`: the 28 lineage edges (`EDGES`) as 1px arcs lying on the ground, grown simultaneously from their source ends by raising the instance count. The current landmark's edges draw again in accent. |
| Board | One pop-up stage reused for every track (§3.4). |

### 3.2 Layout and camera

The 19 landmarks sit on a serpentine over a 5 / 5 / 5 / 4 scatter (`POS`, seeded jitter): 18.5
units between columns, 17 between rows, so consecutive tracks are neighbours and a landmark's
board never lands behind another landmark. Wander bounds are ±52 × ±40; landmarks are solid
(1.25-unit radius).

The camera has one goal per mode and chases it exponentially (`rate ≈ 2.6–3.6 / s`), so any
interruption re-aims smoothly:

| Mode | Look-at | Distance | Elevation | When |
| --- | --- | --- | --- | --- |
| Map | world centre | fills 100 × 80 units | 1.12 rad | first 2.9 s (an establishing shot), and `O` |
| Follow | the wanderer, with a little lead | ≥ 30 | 0.78 rad | default |
| Focus | `landmark + (3.55, 2.1, 0)`, midway between totem and board | ≈ 18, widened for narrow canvases | 0.34 rad, azimuth −0.09 | any focused track |

### 3.3 The landmarks

Each is a handful of polylines in a 3.2 × 4.4 frame, drawn as lines rather than a texture so they
stay crisp at any zoom. They pop up from the ground at load, staggered, by hinging from flat to
upright (a rotation about the base, with a little spring overshoot) and they fold flat again on
dive.

| 01 Fogwalk | 3×3 maze, belief dots, a ring on the mark, fog waves | 10 Sporefront | torus plate with a Life glider, eight edge drums |
| --- | --- | --- | --- |
| 02 Bloomwright | an L-system tree, depth 6, fitted to the frame | 11 Terrarium Hash | Wardian case with a fern |
| 03 Tonguecracker | speech bubble, text bars, angle brackets | 12 Driftwatch | bathysphere on a cable over streamlines |
| 04 Sealed Orders | wax seal with ribbon tails | 13 Loomweight | loom frame, warp lines, weights |
| 05 Hushword | 3×3 tiles, one hatched | 14 Deadlock | four-node wait-for cycle with arrowheads |
| 06 Scribble Club | pencil over a squiggle | 15 Byzantine Choir | semaphore tower |
| 07 Azulejo | azulejo tile: diamond, quarter arcs | 16 Garbage Collector | tricolour: open, hatched, solid |
| 08 Long Haul | the hauler's wedge, stones as ballast | 17 Cartel | hex realm with a compass rose |
| 09 Sudoku / Ult. TTT | a tic-tac-toe grid with a mark in it | 18 Shadow Bidding | a pawn and its dashed shadow |
| | | 19 Lexicon Quarantine | letter chain beside a Go stone |

### 3.4 The pop-up board

There is one board mesh, 6.6 × 4.95 units (the ports' native 512 × 384), hinged along its
bottom edge and placed 5.5 units to the right of whichever landmark is current. Opening it
rotates it from lying flat on the ground to standing (a spring with overshoot); a faint flat
rectangle marks where it folds. Changing track folds the old board flat, swaps, and hinges the
new one up, about a quarter of a second each way.

The board is not drawn by new game code. It runs the **same 19 painters** (`DRAW[adapter]`) the
Fish Night page puts inside its creatures, into an offscreen 512 × 384 canvas, and then re-inks
the result before it becomes the texture:

| Painter output | Becomes |
| --- | --- |
| Hue in the warm band (0°–52° or 335°–360°), chroma > 40, bright enough: amber, orange, crimson | the accent `#EE6A3C`, scaled by the pixel's brightness |
| Everything else | grey tone = ½ luminance + ½ max channel, smoothstepped from card (`#1B1B1C`) to chalk (`#EAE8E3`) |
| Bright pixels | modulated by a fixed grain table, with a few chalk "dropouts" |

So the painters' blue ink and cyan glow collapse to charcoal and chalk, their amber and crimson
become the single accent, and their text stays legible. The only edit to the engine block is
that `pcap` (painter caption text) uses IBM Plex Mono at 0.8× the size instead of Barlow
Condensed; that is a build-time substitution (§6), not a fork of the painters.

Picking is a ray against the board mesh: hit UV → `PICK[adapter](u, v, phase, view)` or the
port's own `pick(u, v)` → `session.do(id, arg)`, exactly as in Fish Night, including `down` /
`move` / `up` phases for Scribble Club's drag. The board repaints at 24 Hz while open, and
immediately after any action.

## 4. One focus, two ways in

```
effective focus = pin  >  hover  >  near
```

| Source | Set by | Camera | Board | Keys |
| --- | --- | --- | --- | --- |
| **near** | the wanderer is within 5.6 units of a landmark (released beyond 8.5; ignored in Map) | frames it | rises (preview) | still walk |
| **hover** | pointer on a row, or Tab focus on it | frames it | rises (preview) | still walk |
| **pin** | click a row, click a landmark, click the board, `#a=slug` in the URL | frames it; the wanderer walks to its standing spot (`+0.4, +2.8`) | rises | the game's own keys win |

Releasing everything returns the camera to Follow and folds the board. A pin ends with `Esc`,
`Esc BACK`, a ground click, or walking more than 11 units away.

Landmark hover only lights the matching row (`.hot`) and does not open the board, so sweeping the
pointer over the world does not make it flap.

### Input routing

| Input | Effect |
| --- | --- |
| `WASD`, arrows | walk. When a track is **pinned**, a key that is one of that port's own actions (e.g. fog's arrows, hush's `G`/`C`/`X`) goes to the game instead |
| click ground | walk there (and release any pin) |
| click landmark / row | pin it |
| click board | pin it and play (drag works) |
| `Space` | toggle the threads (always; ports that use space are played by mouse) |
| `O` | toggle the Map (unless a pinned port owns the key) |
| `Esc` | release the pin, else leave the Map |
| `Enter`, **PLAY TRACK / DIVE IN** | fold and navigate (§5); `Enter` on a focused row that is not yet pinned pins it first, so a second `Enter` dives |

## 5. The handoff

Dive folds the board and the landmark flat into the card (about 0.8 s), then navigates. The URL
follows the same contract as the Fish Night page: route first, then the fragment parameters.

| Track | Navigates to |
| --- | --- |
| Prototype with a page, e.g. Sporefront | `../life-ecologies/index.html#sporefront&from=root&v=1&h=<hash>` plus `&s=<fragment>` for the ports whose page restores state (`restores: true`: Sporefront, Terrarium) |
| Shipped app, e.g. Fogwalk | `../../apps/fogwalk/#from=root&v=1&s=<fragment>&h=<hash>` |
| Long Haul | nothing: it is not on `main` yet. It folds, says so, and unfolds; its row is dimmed |

`<hash>` is `session.hash()` and `<fragment>` is `session.fragment()`, both from the same
deterministic port the board has been playing, so the receiving page can check it was handed the
state the visitor saw. `window.__independents_nav(url)` replaces `location.assign` when present
(that is how the harness captures the URL), and `pageshow` un-folds the page when the visitor
comes back from the bfcache.

## 6. Where the code comes from

`index.html` is one self-contained file with no build step. Its script is, in order:

1. **Engine, copied verbatim** from `../root-explorer/index.html` lines 174–2591: utilities, the
   registry (`REG`, `FAM`), lineage (`EDGES`), SHA-256, the 19 deterministic ports, their
   self-test tapes and the 19 `DRAW` painters and `PICK` functions, and `PORT_REPORT`. It contains
   no `THREE`, no DOM and no clock. One substitution is applied to the copy: the font in `pcap`.
   Plus lines 3334–3335, the per-game `HINTS`.
2. **New code (§4–§8 of the script)**: the sleeve and grain, the duotone re-inking, the focus
   machine, the three.js world, the sigil, input and the loop.

To re-sync after the engine changes upstream, re-copy those two ranges and re-apply the font
substitution; `verify.cjs` will say whether any port or painter regressed. A shared module would
be cleaner and is what the shipped site does (each port is built by its own app); a prototype that
works from `file://`-adjacent static serving cannot import across folders without a server
convention, so the copy stays until the ports move out of the page.

## 7. Verification

`node prototypes/root-explorer-minimal/verify.cjs` (set `SHOTS=dir` to also write screenshots).
It serves the repo root, opens the page in headless Chromium with software WebGL
(`--use-angle=swiftshader`) and drives it with real keyboard and mouse events. Last run:
**82 passed, 0 failed**, covering:

- all 19 ports pass their self-test tape (run twice, same hash), 19 distinct hashes, all 19
  painters draw;
- 19 rows numbered `01`..`19`, the exact `FOGWALK … 05:00 · AUTOMATA` and
  `BLOOMWRIGHT … 04:12 · L-SYSTEM` rows, 9 on Side A and 10 on Side B, 1px leaders, every href
  resolving to a file or folder in this repo (Long Haul excepted), the `#151516` card, the
  `#DCDAD7` plaster, petals, 19 sigil ticks;
- `D`, `ArrowDown`, `A`, `ArrowUp` each walk the wanderer the right way and it stops when the keys
  release; clicking the ground walks it to the clicked point;
- for **each of the 19 tracks**: a row click pins it, the camera lands within 0.9 units of the
  framing point at distance < 22, the board is open, the liner notes show an 8-hex state hash, the
  re-inked texture has chalk pixels, and a real mouse click found by scanning the board moves the
  live session's hash;
- row hover previews and releases; a hovered landmark lights its row; clicking a landmark in the
  Map pins it and the wanderer arrives at its standing spot; standing near a landmark focuses it
  without pinning and walking away releases it;
- `Space` shows and hides all 28 edges, `Esc` releases, `Enter` and the DIVE IN button navigate to
  the Sporefront and Fogwalk URLs above, Long Haul does not navigate, the sigil toggles the
  threads, and the page does not overflow at 390 px;
- zero `console.error`, zero page errors, no failed local requests.

Software WebGL runs this page at only a few frames per second on a busy machine, so the harness
steps the simulation itself (`__independents.stepSim`) rather than waiting on wall-clock frames;
the real keyboard and mouse events are still delivered by the browser.

## 8. Known limits

- The Map and Follow views show the whole world only at small scale; the names are hidden in the
  Map until a landmark is hovered, to keep it legible.
- The wanderer cannot yet walk "into" a board; it stands in front of the landmark. The board is
  a surface to read and click, not a place.
- `Space` is reserved for the threads, so the few ports that use it as an action are played with
  the mouse.
- Times and one-word mechanisms are authored. The citation counts and hashes are computed.
- Long Haul (`status: incoming`) is a real port with no app on `main`: it plays on the board and
  cannot be entered.
- Under `prefers-reduced-motion` the intro, petal drift, sigil spin and spring overshoot are off
  and the camera cuts instead of gliding.
- Without WebGL the world is replaced by a note and the tracklist, liner notes and DIVE IN button
  keep working: the page is a list of links first.
