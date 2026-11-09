# Root Explorer, minimal sleeve — architecture (Revision 5: the rising spiral)

Status: design + interactive mock (`index.html`, `world.js`, `previews.js`, `content.js` and `verify.cjs` in this folder).
Nothing here is wired into `apps/*`. It sits beside [`../root-explorer/`](../root-explorer/) (the Fish Night spectral ocean), which is untouched.

Run it: `python3 -m http.server -d . 8080` from the repo root, then open
`http://localhost:8080/prototypes/root-explorer-minimal/`. It needs the network once, for the pinned `three@0.170.0`
import map on jsDelivr and two Google Fonts (IBM Plex Mono, Space Mono) that fall back to system monospace.
Everything else is in this folder. Serve over http; ES modules do not load from `file://`.

## 0. What changed, and why

**Revision 5** swaps the flat disc for a 3D spiral. The feedback on Revision 4 was *"this is brilliant, I love it; instead of the
circle with the plates on top of it, show them as an auto-moving spiral coming from the bottom to the top of the screen."* So the
big circular platter, its rim and its tonearm are gone. The nineteen plates now hang along one hairline thread that winds
**up through the screen as a helix**, enters below the bottom edge, leaves above the top edge, and keeps flowing by itself.
Everything the page already did well (charcoal grain, type, copy, the nineteen plates, the LIVE 09 / ROADMAP 10 split, the
phone layout) is untouched. §1 describes the new world; the rest of this file still describes Revision 4's reasoning.

Revision 4 had three problems to fix. Revision 3 put a small Three.js world inside a bordered window, next to a verbose
tracklist, with a miniature working clone of each game docked underneath. Three things were wrong with that:

| Problem | What Revision 4 does instead |
| --- | --- |
| The 3D world lived in a mini window. | **The page is the world.** One `<canvas>`, `position: fixed`, exactly `100vw × 100vh`, on the `#151516` cardstock. The HTML is a thin layer of liner notes on top of it. No frame, no window, no page scroll. |
| The copy was an engineering log (`STATE HASH`, `REV`, `TICK 60 HZ`, `BFS`, `ČERNÝ 1964`). | **Nineteen sentences a first-time visitor understands.** Every track says what it is, what you do, who plays and how long. The formal lineage stays in each project's own README. |
| Each track was a tiny functional game emulator with debug buttons. | **Theme previews:** nineteen art-directed plates. Each one carries the mood and the one idea of its project, moves on its own, answers the pointer, and does nothing a landing page should not do. Clicking through is how you play. |

The soul is unchanged: *Dandy Brown — Scattered Days*. Matte charcoal grain, crisp monospace, 1px hairline leaders from a
title to a running time, breathing negative space, one accent (`#EE6A3C`).

## 1. The world: a spiral that climbs

The metaphor is still the sleeve's own (a record, a groove, two sides) but the groove no longer lies flat. It has been
unwound into a **helix**, and the plates hang along it like cards threaded on a string.

- **The thread** is a 1px chalk hairline following the helix (`updateThread`). Side A (live) is solid; Side B (roadmap) is
  dashed; between them is a run-out gap marked by two small accent ticks. It is rebuilt every frame from the flow, so the dashes
  ride up with the plates, and it fades out at both ends of the loop so it never visibly starts or stops.
- **The plates** are the same 5 × 6.25 world-unit plates as before, hanging `LIFT = 1.1` above their station on a post, with
  a paper-cut back layer and a small **station ring** where the post meets the thread (the ring turns accent orange on the
  plate you point at, or the one you stand in front of). Their face is a `CanvasTexture` (§3). Side B plates keep dashed frames.
- **Volume without a floor.** Nothing is drawn underneath the spiral. The depth comes from the helix itself: plates on the
  front arc are close, large and bright; plates winding round the back are small and dim (perspective, a depth-based brightness
  `lit`, and a fog that thickens behind the axis). Every plate also **fans like a carousel**: it turns toward you by `0.95 · sin φ`
  radians, so the sides are angled and the back plates still show their faces.
- **Chalk dust** is 360 points that drift upward with the flow, a little slower, so the rise has parallax.

### 1.1 The geometry

Station `k` has a coordinate `q`: its index, plus `0.7` for Side B (the gap). The loop has length `LOOP = q₁₉ + 1.8 = 20.5`
stations; the 1.8 is the seam where the loop closes. A single number, **`flow`**, says how far the spiral has risen. A plate sits at

    s  = (q + flow) mod LOOP                    how far up the helix it is
    φ  = (s − LOOP/2) · 2π/7                    angle round the axis (seven stations to a turn; φ = 0 faces the camera)
    p  = ( R sin φ,  (s − LOOP/2) · dy + y0,  R cos φ )

so adding to `flow` is a **screw motion**: every plate climbs and swings round the axis at once, and when one passes `s = LOOP`
it re-enters at `s = 0`, one lap later. The wrap happens under a smooth fade (`edgeFade`, 1.6 stations: the plate scales and
dims to nothing) so a plate never pops. `R` is 11.5 on a desktop and 8.5 on a phone. `dy` is **solved from the layout** in
`layout()` so the loop is a little taller than the screen: the helix always enters below the bottom edge and leaves above the
top edge, whatever the window size. The helix always keeps its map composition (right-hand 56% of a desktop; the full width of
a phone) so it never changes shape when you step in.

![How one travel state drives the camera, the card and the plates](diagrams/world.svg)

*The flow (auto-clock plus your hand) and the track number are one travel state; it slides every plate along the helix, aims the camera, and swaps the card. The pointer's position on a plate drives its preview. Source: [world.mmd](diagrams/world.mmd).*

### 1.2 Two modes, one state

| | MAP (the page opens here) | WALK |
| --- | --- | --- |
| Camera | 11° above the helix axis, the whole spiral in view, cover text on the left | Low 3/4 view, facing one plate head-on, plate framed beside the liner card |
| The spiral | **Rises by itself** at 0.42 stations a second; hovering a plate eases it to 0.05; a drag or the wheel adds to it, with inertia | Holds still with that plate in front; the thread curls round it |
| Plates | Scaled 1.05× (phone 1.0×), front arc bright, back arc dim; hover lifts one and names it | Current one lifts at full brightness; neighbours dim to 30% so type never fights them |
| Text | The cover: headline, two side buttons | The liner card (right column on desktop, bottom sheet on a phone) |
| Travel state | `flowT`, an unbounded float the spring `flowS` follows | `tT`, a float track index; `flowT = LOOP/2 − q(tT) + wrap` |

**Gliding into WALK.** `go(i)` picks the copy of the loop closest to where the spiral is now (`wrapFor`), so the plate always arrives by
the shorter way round: from track 01, `End` (track 19) is only 1.8 stations *back*, through the seam. The camera, the plate and the
thread all move at once, because the camera is fixed in the world and only `flow` changes.

Where the focus lands on screen is a **layout**, not a magic number: `layout()` picks a screen point for the thing we look at
(left-third of a desktop with the card on the right; centred above the bottom sheet on a phone), the camera distance is
solved so the plate is the right pixel height, and `camera.setViewOffset` slides the image there without changing the pose.
That is why the plate is never under the card (the verify script measures it).

On a phone, the helix runs behind the cover, so two soft charcoal fades (`.veil`) sit over the very top and bottom of the screen
in MAP; they hold the headline and the two buttons readable while plates climb behind them. On a desktop a thin version of the
same fade (`.vig`) keeps the top bar and the rail readable.

## 2. Interaction, from the first moment

There is no "click to start". The page opens in MAP with the spiral already climbing (the plates glide up from below on load),
the camera leaning a little toward the pointer, and every plate already animating.

| Input | MAP | WALK |
| --- | --- | --- |
| Nothing | the spiral rises on its own, plates fanning round the helix | the plate in front stays, its preview alive |
| Mouse wheel | scroll down: the spiral rises faster; scroll up: it slows, stops, then runs back (stays in MAP) | **one notch = one track**, with a lean toward the next while you scroll; wheel-up at track 01 rises to MAP |
| Drag / swipe | up (or right) lifts the spiral with your finger, down scrubs it back; a flick keeps going with inertia, then the auto-rise resumes | drag either axis to travel; a flick moves exactly one track, never two |
| Hover | the flow eases to a crawl, the plate lifts and a tooltip names it; move off and the rise picks up gently | the plate leans toward the cursor and its preview reacts |
| Click / tap | the camera glides in front of that plate (WALK) | on the current plate: **pokes** the preview; on another plate: flies to it |
| Keys | `→ ↓ ← ↑ PgDn D` step in front of the plate nearest the middle of the screen; `M` toggles | `→ ↓ ← ↑ A D`, `Home`, `End`, `Enter` opens, `Esc` rises to MAP, `I` the tracklist |
| Buttons | `SIDE A` / `SIDE B` on the cover, `INDEX` | `LIVE / ROADMAP` switch, ‹ › on the card, `TRY NEXT`, the 19-tick rail, `OPEN` |

Pointer events are used for mouse, pen and touch alike. The canvas is `touch-action: none`; the index sheet is the only
thing that scrolls. Reduced motion stiffens every spring and turns the auto-rise off (the spiral stays put until you scrub it) along with the intro glide.

## 3. Theme previews, not emulators

`previews.js` is nineteen small functions, one per project. Each draws into a 600 × 750 canvas that the world maps
onto the standing plate. Common frame: grain, a hairline border (solid for LIVE, dashed for ROADMAP), a numbered
header, and a footer with a one-word mood and a LIVE or IN THE WORKSHOP badge. Inside, **chalk ink plus the project's
single colour**, and a headline caption in plain English. Every preview:

1. moves on its own, 2. reacts to the pointer, 3. has one `poke` (a click), 4. is deterministic when its random
source is fixed (the verify script seeds it).

| # | Plate | What you feel in a few seconds | Pointer | Click |
| --- | --- | --- | --- | --- |
| 01 | Fogwalk | A glowing fog of "you might be here" dots collapsing to one place in a maze | point where to walk; all selves step together | new maze |
| 02 | Bloomwright | A rule (`F → …`) repeated into a plant | move sideways to bend the rule | grow another round |
| 03 | Tonguecracker | Three sentences in a new language; build the fourth | hover a sentence or a word chip | a new language |
| 04 | Sealed Orders | Three secret moves sealed inside a link | hover an order | change an order (the link changes) |
| 05 | Hushword | A word grid with clues blacked out | hover a black bar to peek | a new puzzle link |
| 06 | Scribble Club | Friends drawing a house while guesses roll in | your pencil follows your cursor | restart the round |
| 07 | Azulejo | A wall of tiles falling into place | hover a ghost tile to lay it | clear the wall |
| 08 | Long Haul | A hauler slowing under its own pile of stones | point at stones to eat them | dump the pile as a wall |
| 09 | Sudoku & Tic-Tac-Toe | A grid inside a grid: your square picks their board | the square you point at lights the next board | play there |
| 10 | Sporefront | A real, living wrap-around board of cells | sprinkle spores | reseed |
| 11 | Terrarium Hash | A glass case whose recipe is its web address | mist it | change the recipe |
| 12 | Driftwatch | A river of particles carrying a bathysphere to a beacon | the valve follows your cursor | — |
| 13 | Loomweight | Two rhythms (3 and 4 beats) weaving cloth | sweep away tangles | — |
| 14 | Deadlock | Four trains in a ring, each waiting on the next | hover a section | let that train go |
| 15 | Byzantine Choir | Seven towers, one liar, and a vote that still holds | hover a link to cut it | cut it / pick a new liar |
| 16 | Garbage Collector | A heap being marked, then swept | point at a node to keep it alive | rebuild the heap |
| 17 | Cartel of Cartographers | Three realms growing around a river no one may build on | hover shows legal tiles | claim a tile |
| 18 | Shadow Bidding | A 5 × 5 chess board with two sealed bids | hover a seal to try to tamper | reveal now |
| 19 | Lexicon Quarantine | A chain of letters being surrounded by stones | hover a free space | place a stone |

Two of these (Sporefront, Terrarium Hash) run a real Life-like rule because that *is* their mood; the rest are
choreographed. None of them is the game, and none carries debug controls. The game is one click away on the card.

## 4. Human-first content

`content.js` is the whole copy deck. Rules it follows, and that `verify.cjs` enforces:

- **One hook per track**, one short sentence (18–72 characters): *"Eat the stones. Then dump them behind you."*
- **One "you do" paragraph**, 60–150 characters, starting with a verb or a plain noun: *"Run a railway of shared track and
  break the standoff before every train is stuck waiting for another."*
- **Players** and **sitting** (the running time on the leader) replace every spec line.
- **No engineering vocabulary** anywhere in the DOM: no state hashes, tick rates, algorithms, citations or transports.
- **LIVE cards say PLAY, ROADMAP cards say PEEK AT**, so the distinction is in the button too.
- **TRY NEXT** replaces the old lineage graph with one human suggestion per track.

Information architecture, over a full-screen world: *cover* (what is this, two doors) → *card* (the one track in
front of you) → *index* (the whole tracklist as liner notes, with the one-line hook under every title). Side A = **LIVE · 09**,
Side B = **ROADMAP · 10** everywhere: the switch, the rail, the groove, the plate frames, the index headings.

## 5. The phone (390 × 844)

The same world, native instrument rules:

- The canvas is still `100vw × 100vh`. The plate is solved to sit in the band **above** a bottom sheet (`layout()` reads the
  sheet's height), at most 86% of the width, centred.
- The **bottom sheet** (a fixed flex column on a charcoal gradient) holds the LIVE / ROADMAP switch, the card text, and
  `‹ OPEN ›`. Every control is 44px or taller. `TRY NEXT` and long copy are trimmed.
- **Swipe** left or up = next, right or down = back (the dominant axis locks after 8px), one flick = one track.
  **Tap the plate** to poke it. Tap `MAP` for the whole spiral; the sheet hides (and becomes un-hittable) and a swipe up or down scrubs the rising spiral.
- `INDEX` is an 86%-height bottom sheet with 19 rows of 56px+, the only thing that scrolls.
- The cover moves its two doors and hint to the bottom of the screen where a thumb is. The phone helix is tighter (`R = 8.5`) so the full width of the screen holds it.

## 6. Why one approach with two modes

The brief invited switchable interpretations. I built two *modes* of a single world (WALK and MAP) rather than two
page layouts, because contrasting layouts was Revision 3's job and it made the page busier, not clearer. WALK is the
tour; MAP is the overview. They are the same state, so the switch is a camera move rather than a context switch, and
both are present from the first frame.

## 7. Contracts and limits

- **Hand-off.** `OPEN` goes to the project's own page: shipped apps at `../../apps/<name>/#from=root&v=1`; roadmap
  ideas at `../<group>/index.html#<slug>&from=root&v=1`. There are no live game sessions here any more, so no state is
  carried. Long Haul is not on `main` yet: its button says `ARRIVING SOON` and only shows a message.
  `window.__independents_nav` can replace the default `location.assign` (the verify script uses it).
- **No WebGL**: the page falls back to the tracklist as a plain, scrolling list of real links.
- **Cost**: the focused plate redraws 30×/s, nearby plates 8×/s, the rest every 2 s; in MAP front-arc plates redraw at 6 Hz and back-arc plates at 3 Hz, three per frame at most; plates faded out at the loop's ends are skipped. The thread is ~230 line segments rebuilt per frame.
- **Test hooks**: `window.__independents` has `state()` (including `flow`, `autoV`, the helix size and the thread's segment counts), `scene()`, `go()`, `toMap()`, `probe(slug)`, `projectPlate(i)` (screen position, width, loop position `s`, depth `front`, brightness `lit`, fade `env`), `setAuto()`, `stepSim()`.

## 8. Certification: `verify.cjs`

`node prototypes/root-explorer-minimal/verify.cjs` (optionally `SHOTS=/dir` for screenshots) in headless Chromium with
software WebGL. 85 certificates, in nine groups:

1. The page is the world: one fixed canvas, exactly viewport-sized, no frame, no scroll, `#151516`, a live render loop.
2. Nineteen tracks: real rows 01–19, nine LIVE then ten ROADMAP, hairline leaders, every `href` resolves, every hook is a short
   sentence, every card says what you do, no card is wordy, **no engineering vocabulary**, PLAY vs PEEK AT.
3. Nineteen previews: each draws, **animates on its own, reacts to the pointer** (same random seed, different pixels) and survives a click.
4. Desktop interaction, in two halves.
   **The spiral:** no circular mesh remains in the scene (`flatDiscs === 0`, no meshes outside the plates); the thread has a solid
   LIVE run and a dashed ROADMAP run; with no input the spiral rises on its own and at least three in four of the plates on
   screen climb; the helix fills the screen from the top third to the bottom third; across a **full lap** (3 200 simulated frames)
   every plate wraps, no plate is visible at the instant it wraps (`pops === 0`), and plates reach below the bottom edge and above the top edge;
   front-arc plates are drawn at least 1.3× wider and 1.5× brighter than back-arc plates; hovering a plate eases the flow
   to a crawl and names it, moving off lets it pick up; the wheel makes it rise at least twice as fast and stays in MAP; a drag up
   and a drag down scrub it by the right amount; clicking a plate glides into WALK on that exact track.
   **Walk and chrome:** the plate sits beside the card, one wheel notch = one track, arrows, Home/End, drag either axis, the rail,
   the LIVE/ROADMAP switch, previous/next, TRY NEXT, poking the current plate, wheel-up to MAP, `M`, `Esc`, the cover's doors.
5. Hand-off URLs, and the pending app only toasts.
6. The index opens, groups the sides, flies to a row, closes with `Esc`.
7. Phone (390 × 844): no scroll in either axis, canvas 390 × 844, the switch moves into the sheet, 44px targets, the plate framed above the sheet,
   swipe left/up/right, tap pokes, ROADMAP / next / MAP; **in MAP a swipe up lifts the spiral, it keeps rising on its own, and 6+ plates
   fill the screen from top to bottom**; the index sheet.
8. No WebGL (`?nogl` forces it): the page degrades to a plain, scrolling list of 19 real links.
9. Zero console errors, zero page errors, zero failed requests (desktop, phone and no-WebGL pages together).

Limits worth knowing: the headless run uses a CPU renderer, so the verify script pauses the real-time loop and advances the
simulation explicitly; on a real GPU the loop runs at display rate. Plate lean and the carousel fan are art, not physics.
