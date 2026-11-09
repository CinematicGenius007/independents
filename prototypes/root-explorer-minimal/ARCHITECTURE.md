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

Revision 2 (after review): the outer plaster wall, the botanical petals and the floating-card
shadow are gone. The charcoal card **is** the page, edge to edge, and the extra width and height
go to a denser 2.5D world and a fuller *Scattered Days* set of liner notes. §1, §3 and §7 below
describe the current page.

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

There is one object and it fills the viewport: `html`, `body` and `main.sleeve` are all
`#151516` matte charcoal cardstock, `width: 100%`, `min-height: 100vh`, no outer margin, no
border, no box-shadow. There is no wall behind it and nothing sticks out from under it.

| Layer | What it is | How it is made |
| --- | --- | --- |
| Cardstock | `#151516`, the whole screen | `html, body, .sleeve` background; the page padding is only `clamp(18px, 3vw, 56px)` inside the card |
| Grain | paper fibre, chalk dust and a few smudges across the full screen | `.sleeve::before` stacks a procedural canvas (generated once at load, tiles seamlessly, set as `--grain`) over an SVG turbulence fallback |
| Vignette | a quiet lit-from-the-top falloff | `.sleeve::after`, `position: fixed` radial gradients, so the card reads as one lit sheet at any scroll position |
| Type | IBM Plex Mono (Space Mono fallback), `#EAE8E3` and muted `#8E8D8A` | uppercase, `letter-spacing: .04em`; the header is `.78em` tracked, `INDEPENDENTS — SCATTERED WORKS` |
| Accent | one colour, `#EE6A3C` | the pinned track, the current landmark and board, the wanderer's lantern and its bearing line, the compass rose's north needle and camera marker |
| Sigil | 1px monoline mark, bottom right | four counter-rotating groups (§2); the 19 ticks on the track ring carry the current track in accent; hover spins it faster, click toggles the threads |

The canvas is transparent and CSS-masked with a soft ellipse, so the world is drawn directly on
the card's grain: there is no second background to match and no window frame, only four
registration corners.

## 2. Anatomy

```
 I N D E P E N D E N T S   —   S C A T T E R E D   W O R K S
 AUTOMATA / GRAMMARS ___ Černý 1964 · Lindenmayer 1968     60 HZ FIXED-POINT SIM ___ …
 COMMIT-REVEAL CRYPTO ___ …    WEBRTC P2P ___ …           CELLULAR / EMERGENT ___ …
                                                          with special guest ___ 2.5D PERSPECTIVE STAGE
 ┌ world (three.js, ~70% of the width) ─┐   SIDE A — SHIPPED
 │ survey grid, contours, territories,  │   01 FOGWALK ________________ 05:00 · AUTOMATA
 │ compass rose, 19 three-layer dioramas│      SYNCHRONIZING WORD _____________ PAR 5
 │ the wanderer + lantern + bearing line│   02 BLOOMWRIGHT ____________ 04:12 · L-SYSTEM
 │ the pop-up stage with callouts, HUD  │      …
 │ and one keycap per action            │   SIDE B — PROTOTYPES
 └──────────────────────────────────────┘   10 SPOREFRONT … 19 LEXICON QUARANTINE
  hint line                    [▶ PLAY]
  FIG. 1 …        SPACE THREADS · O MAP
 LINER NOTES — SCATTERED DAYS
 PRODUCED BY ___ …            TRACK / MECHANISM ___ …
 ENGINEERED BY ___ …          PORT ___ …
 FORMAL CITE ___ …            ENTRY ___ …
 CERTIFIED AT ___ …           SEE ALSO ___ …
 TRANSPORT ___ …              with special guest ___ …
 STATE HASH ___ …             [▶ DIVE IN ↵]
 ┌ IND-LP-019 ┐                                              ( multi-ring sigil )
```

- **Ensemble credits.** The top block, directly under the header: two columns, a bold credit, a
  short 1px underline leader and a muted value. The five formal mechanisms with their lineages
  (Automata / Grammars: Černý 1964 and Lindenmayer 1968; Commit-Reveal Crypto: hash commitment,
  Lamport–Shostak–Pease 1982; WebRTC P2P; 60 Hz Fixed-Point Sim; Cellular / Emergent), then
  `with special guest ____ 2.5D PERSPECTIVE STAGE`.
- **Tracklist.** Nineteen real `<a href>` rows, `01`..`19`. A row is two lines on a
  four-column grid. Line one: number, bold title, 1px hairline leader, `mm:ss · MECHANISM`. Line
  two, smaller and muted: a two-word formal sub-caption (`SYNCHRONIZING WORD`, `COFFMAN CYCLES`),
  a second hairline leader and a par / metric. Fogwalk's par (`PAR 5`) is the computed
  breadth-first optimum; the other metrics name the unit each port is scored in (`SHA-256`,
  `3:4 · 12 PICK`, `N ≥ 3F + 1`). Side A is the nine shipped works, Side B the ten prototypes.
  The time, tag, sub-caption and metric are hand authored in `META`, `SUBCAP` and `METRIC`, not
  measured. The href is the destination itself, so middle-click, Tab,
  Enter and no-WebGL all work; the JavaScript only adds the focus behaviour.
- **Liner notes (the bottom block).** The *Scattered Days* layout, two columns of short-underline
  credits. The left column is always the six blocks `PRODUCED BY / ENGINEERED BY / FORMAL CITE /
  CERTIFIED AT / TRANSPORT / STATE HASH`. With nothing focused they describe the whole record
  (the label, 19 deterministic ports, the citation count, `✓ 19/19 PORTS · ✓ 19/19 PAINTERS`,
  the transports, a root hash over all 19 session hashes). With a track focused they are about
  that game (family and status, its port, seed and 60 Hz or turn-based, its formal cites, its own
  self-test, its transport and the live `session.hash()`, refreshed four times a second). The
  right column adds the track, mechanism, port metric, entry path, `SEE ALSO` and one lineage
  neighbour as the "special guest".
- **Colophon and sigil.** Bottom left, the `IND-LP-019` label (a boxed catalogue number with
  the label name, speed and side counts). Bottom right, the sigil: a dashed ring and a 60-tooth
  gauge (every fifth tooth long), the 19 track ticks over a 19-sided polygon, a circle holding
  two triangles and a {5/2} pentagram with five family dots, and a 16-point star with eight
  spokes, an octagon and the accent dot. Four groups counter-rotate at different speeds.

## 3. The world

### 3.1 A flat world, a tilted camera

The ground is the plane `y = 0`, 2D in the strict sense: nothing on it has height, and nothing is
filled. Perspective comes from one `PerspectiveCamera` (FOV 34) orbiting a look-at point. Fog
(`near = 0.55 × distance`, `far = 1.95 × distance`) fades the far ground into the card.

Every line is a `LineSegments2` (three's fat-line addon) at `1 × devicePixelRatio` device pixels,
so a "1px monoline" stays 1 CSS pixel on any display; native WebGL lines would be half a pixel on a
2× screen. About 14 000 line instances in roughly 130 draw calls make the whole scene.

| Layer | Content |
| --- | --- |
| Survey grid | 391 `+` fiducial crosshairs on a 6-unit lattice across `y = 0` (every fifth one longer) and `X ±n` / `Z ±n` grid references lettered flat along the south and west margins. |
| Contours | A marching-squares pass over a smooth height field (long ridges plus a Gaussian hill under every landmark), levels every 0.26, every fourth level brighter. Computed once at load, 0.85-unit grid. The hills are why each landmark stands inside concentric rings. |
| Elevation index | Down-slope hachure ticks (about 380) along the index contours, and twelve `EL +1.4`-style spot heights lettered flat beside them. |
| Territories | Five etched labels lying in perspective on the ground in the gaps between landmark rows, each with a boundary rule: *I · AUTOMATA RIDGE*, *II · SEALED BASIN*, *III · CELLULAR FLATS*, *IV · LOCKSTEP TRENCH*, *V · PEER COMMONS*. |
| Compass rose | A 1px azimuth ring (72 degree ticks, 30° marks), a turning inner dial (16-point star, cardinal and intercardinal spokes, accent north needle), `N E S W`, and an accent marker for the camera. The dial turns with the camera azimuth (×3), the marker follows it, and the whole rose brightens as the camera drops (map → follow → focus). |
| Groove | A dashed double hairline through the 19 landmarks in track order (a Catmull-Rom curve), like the run-out groove of a record. |
| Micro-landmarks | Along the groove, on alternating sides and never inside a landmark ring or board footprint: 21 mile-marker posts (a tally plate and a ground `M01`…), cairns of three stacked stones, tripod survey flags that flutter on `uTime`, and about 126 clusters of chalk reed strokes. |
| Chalk motes | 320 points drifting above the plane. A `ShaderMaterial` moves and twinkles them entirely in the vertex shader from the shared `uTime` uniform. |
| Landmarks | 19 three-layer paper-cut dioramas (§3.3), each with a dial ring and a numbered plinth etched on the ground. |
| Wanderer | A tiny filled paper-cut figure (cloak, brimmed hat, staff) that flips left and right, bobs when it walks and leaves fading chalk footprints; one accent lantern. The lantern projects a light ring onto the ground (a soft pool, a pulsing ring and a slowly turning dashed ring with four compass ticks). |
| Bearing line | While a track is hovered or pinned, a dashed accent rule runs along the ground from the wanderer to that track's plinth, ending in a target mark, lettered `BRG 148° · 52.5 U` (compass bearing from north, and range). |
| Threads | `Space`: the 28 lineage edges (`EDGES`) as 1px arcs lying on the ground, grown simultaneously from their source ends by raising the instance count. The current landmark's edges draw again in accent. |
| Board | One pop-up stage reused for every track (§3.4). |

All lettering on the ground is canvas text on a transparent plane (`textMesh`). The canvas width
comes from a fixed per-character advance, not from measuring the font, so the web font arriving
late only repaints the text and never changes a texture's size.

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
| Focus | `landmark + (3.1, 2.1, 0)` (`FOCUS_DX`), midway between totem and board | ≈ 17–19, widened for narrow canvases | 0.34 rad, azimuth −0.09 | any focused track |

### 3.3 The landmarks

Each landmark is a **three-layer 2.5D paper-cut diorama**: three sheets of 1px monoline in
a 3.2 × 4.4 frame at local depths `z = -0.35`, `0` and `+0.35`. They are lines rather than a
texture, so they stay crisp at any zoom, and because the layers are really separated in depth the
perspective camera gives true parallax as the wanderer walks; a small extra offset
(`(camera.x − landmark.x) × 0.012`, opposite on the back and front sheets) exaggerates it.

| Sheet | Depth | Content |
| --- | --- | --- |
| Back | `z = -0.35` | A family-shaped paper panel (arch for Commit-Reveal, chamfered for P2P, stepped for Automata, notched for Lockstep, gridded for Cellular), a seeded ridge cut-out and a hatched ground band. |
| Middle | `z = 0` | The original monoline glyph, one per game (the table below). |
| Front | `z = +0.35` | A flagpole with a **pennant badge** whose cloth is lettered `01`…`19` (it flutters on `uTime`), and the **mechanism**. |

The mechanism is a moving sub-element, one per game (two for Deadlock and Byzantine Choir),
advanced from the shared `uTime`:

| Game | Mechanism | Game | Mechanism |
| --- | --- | --- | --- |
| Fogwalk | a radar arm sweeping the belief ring | Sporefront | a rotating eight-spoke seed-drum wheel |
| Bloomwright | a sprig swaying at the crown | Terrarium Hash | mist drops falling into the case |
| Tonguecracker | speech arcs pulsing | Driftwatch | a bathysphere cage rising and sinking on its tether |
| Sealed Orders | a pendant seal swinging | Loomweight | a shuttle reciprocating across the warp |
| Hushword | a cursor bar sliding along the row | Deadlock | two signal-bridge arms moving in anti-phase (interlocked) |
| Scribble Club | a pencil tracing the squiggle | Byzantine Choir | semaphore arms plus a swinging pendulum |
| Azulejo | a diamond turning inside the tile | Garbage Collector | a sweep line scanning down the heap |
| Long Haul | a hauler sliding along the track | Cartel | a compass needle turning in the realm |
| Sudoku / Ult. TTT | an X turning in the cell | Shadow Bidding | a bid paddle swinging |
| | | Lexicon Quarantine | a pen sliding along the word chain |

Session state drives them too: when a port's `rev` counter changes (any action, and every tick
for the 60 Hz ports) the landmark's `kick` goes to 1, which multiplies the mechanism's speed
(×3.2) and amplitude (×1.6) and decays over about 0.8 s; a hovered or pinned landmark also runs
faster.

On the ground each landmark has a dial ring (36 ticks) and an **etched plinth**: a double
rectangle in front of the base with the track number `01`…`19` lettered flat on it. All of its
lines (and the two number labels) turn accent when the landmark is current.

Landmarks pop up from the ground at load, staggered, by hinging the whole three-layer stack from
flat to upright (a rotation about the base, with a little spring overshoot) and they fold flat
again on dive.

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

**Stage furniture.** The pop-up is a small drafting sheet, not just a picture:

- *Callouts.* Eight graduated ticks along the top edge and six along the left edge, a top
  dimension line with arrowheads, a right-hand vertical dimension line, and a ground scale bar
  (`0 · 1.5 · 3 U`) beside the footprint. They hinge with the sheet.
- *Live HUD.* A strip above the sheet, repainted four times a second: `FPS 60 · 16.7 MS` (an
  exponential average of the frame time), the sheet's `W 6.60 × H 4.95 U`, and `TICK 60 HZ · REV n`
  (or `TURN-BASED · REV n` for the turn-based ports, with the port's live revision counter).
- *Keycaps.* One ground-lying keycap per port action (`session.actions` with `ui !== false`, up
  to 18, six per row, centred in front of the sheet), labelled with the action and its keyboard
  alias (`[ W ]`, `[ click ]`). A click on a keycap calls `act(art, id)`, so a mouse-only user can
  trigger every action a keyboard user can (arm, rotate, step, seal, reveal, tamper, pause, sweep,
  …) directly on the stage. A pressed keycap flashes accent and dips.

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
**127 passed, 0 failed**, covering:

- all 19 ports pass their self-test tape (run twice, same hash), 19 distinct hashes, all 19
  painters draw;
- **full bleed**: `html`, `body` and `.sleeve` are all `rgb(21, 21, 22)`, the sleeve starts at
  (0, 0), is as wide as the viewport and at least as tall, has `0` margins and no box-shadow, and
  the page does not overflow; there are no `.petal` nodes, no petal `<symbol>`s, no `--plaster`
  variable and no plaster-tooth layer; the procedural grain and a fixed viewport vignette cover
  the screen;
- 19 rows numbered `01`..`19`, the exact `FOGWALK … 05:00 · AUTOMATA` and
  `BLOOMWRIGHT … 04:12 · L-SYSTEM` rows, 9 on Side A and 10 on Side B, 1px leaders, every href
  resolving to a file or folder in this repo (Long Haul excepted); every row has a two-word
  sub-caption, a second 1px leader, a par / metric (Fogwalk `PAR 5`) and a mechanism tag;
- the **ensemble block** sits directly under the header (two columns, six credits, five
  mechanisms and their lineages, 1px leaders, `with special guest … 2.5D PERSPECTIVE STAGE`); the
  six **liner-note blocks** are present idle and while a track is pinned; the `IND-LP-019`
  colophon is bottom left and the four-group sigil (19 ticks, ≥ 14 circles, ≥ 85 lines, ≥ 6
  polygons) is bottom right;
- the **dense world**: ≥ 300 fiducials, elevation ticks, spot heights and margin labels, exactly
  the five territory labels, the compass rose, ≥ 8 posts, ≥ 8 cairns, ≥ 4 flags, ≥ 100 reed
  clusters and ≥ 200 motes; all 19 landmarks have layers at z `-0.35, 0, 0.35`, a mechanism, a
  numbered plinth and a pennant `01`..`19`; **every mechanism moves** over 37 frames; an action
  on a port kicks its landmark's mechanism and it settles; the lantern rings are accent and
  scaled; the compass dial, camera marker and ring opacity change when the camera moves to a
  focused track; hovering a distant row draws a bearing line whose `BRG` and range match a
  direct computation, and it disappears with the focus;
- `D`, `ArrowDown`, `A`, `ArrowUp` each walk the wanderer the right way and it stops when the keys
  release; clicking the ground walks it to the clicked point;
- for **each of the 19 tracks**: a row click pins it, the camera lands within 0.9 units of the
  framing point at distance < 22, the board is open, the liner notes show an 8-hex state hash, the
  re-inked texture has chalk pixels, a real mouse click found by scanning the board moves the
  live session's hash, the stage shows exactly one keycap per UI action, **a real mouse click on
  every keycap fires its action** (the port's `do` is spied, so no-op actions count), and the HUD
  reads `FPS n · x MS` and `TICK 60 HZ` / `TURN-BASED · REV n`;
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
  Map until a landmark is hovered, to keep it legible. The ground lettering (territories, spot
  heights, posts) is deliberately faint: it is texture first and information second.
- The mechanisms are decorative readouts of *activity*, not of game state: they speed up when the
  port's revision counter changes, but they do not draw the game (the board does that).
- Ports with more than 18 UI actions would show only the first 18 keycaps; today the largest has
  11 (Terrarium Hash).
- The wanderer cannot yet walk "into" a board; it stands in front of the landmark. The board is
  a surface to read and click, not a place.
- `Space` is reserved for the threads, so the few ports that use it as an action are played with
  the mouse.
- Times and one-word mechanisms are authored. The citation counts and hashes are computed.
- Long Haul (`status: incoming`) is a real port with no app on `main`: it plays on the board and
  cannot be entered.
- Under `prefers-reduced-motion` the intro, sigil spin and spring overshoot are off
  and the camera cuts instead of gliding.
- Without WebGL the world is replaced by a note and the tracklist, liner notes and DIVE IN button
  keep working: the page is a list of links first.
