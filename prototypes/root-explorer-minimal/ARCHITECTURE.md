# Root Explorer, minimal sleeve — architecture (Revision 4: the record)

Status: design + interactive mock (`index.html`, `world.js`, `previews.js`, `content.js` and `verify.cjs` in this folder).
Nothing here is wired into `apps/*`. It sits beside [`../root-explorer/`](../root-explorer/) (the Fish Night spectral ocean), which is untouched.

Run it: `python3 -m http.server -d . 8080` from the repo root, then open
`http://localhost:8080/prototypes/root-explorer-minimal/`. It needs the network once, for the pinned `three@0.170.0`
import map on jsDelivr and two Google Fonts (IBM Plex Mono, Space Mono) that fall back to system monospace.
Everything else is in this folder. Serve over http; ES modules do not load from `file://`.

## 0. What changed, and why

Revision 3 put a small Three.js world inside a bordered window, next to a verbose tracklist, with a miniature
working clone of each game docked underneath. Three things were wrong with that, and they are the whole brief:

| Problem | What Revision 4 does instead |
| --- | --- |
| The 3D world lived in a mini window. | **The page is the world.** One `<canvas>`, `position: fixed`, exactly `100vw × 100vh`, on the `#151516` cardstock. The HTML is a thin layer of liner notes on top of it. No frame, no window, no page scroll. |
| The copy was an engineering log (`STATE HASH`, `REV`, `TICK 60 HZ`, `BFS`, `ČERNÝ 1964`). | **Nineteen sentences a first-time visitor understands.** Every track says what it is, what you do, who plays and how long. The formal lineage stays in each project's own README. |
| Each track was a tiny functional game emulator with debug buttons. | **Theme previews:** nineteen art-directed plates. Each one carries the mood and the one idea of its project, moves on its own, answers the pointer, and does nothing a landing page should not do. Clicking through is how you play. |

The soul is unchanged: *Dandy Brown — Scattered Days*. Matte charcoal grain, crisp monospace, 1px hairline leaders from a
title to a running time, breathing negative space, one accent (`#EE6A3C`).

![How one travel state drives the camera, the card and the plates](diagrams/world.svg)

*One travel state (MAP or WALK, plus a track number) drives the camera, the card and the plates; the pointer's position on a plate drives its preview. Source: [world.mmd](diagrams/world.mmd).*

## 1. The world: a record you turn

The metaphor is the sleeve's own: the thing inside it is a **record**. It lies in perspective on the card, with a spiral
groove from the rim to the label, and the nineteen projects stand on that groove as plates, like sleeves propped
along a track.

- **The disc** is one shader (`world.js`, `discMat`): fine radial grooves, two registration rings, a bright rim, and an
  anisotropic *sheen* in two opposite lobes that follows your cursor like a light you hold. Far areas fade into the
  card colour, so the record never has an edge you can see past.
- **The groove** is a hairline spiral. Side A (live) is solid, Side B (roadmap) is dashed, with a small accent
  run-out gap between them. The label at the centre is a drawn sigil with the catalogue number `IND-LP-019`.
- **The plates** are 5 × 6.25 world units, standing 1.1 above the groove on a post, with a drop shadow on the
  disc, a paper-cut back layer behind them, and a ring where they touch the groove. Their face is a `CanvasTexture`
  (§3). Side B plates have dashed frames.
- **The tonearm** is a hairline Bézier from a fixed pivot to the groove under the last track you touched.
- **Chalk dust** is 360 drifting points, parallaxed against the cursor.

Stations are placed by *arc length* along the spiral (`SP`: radius `35 − 3.4 φ`, 8.5 units apart, a 7-unit run-out gap
between tracks 09 and 10). The record is a `THREE.Group` that rotates about Y; **the camera only moves along the X axis**,
so turning the record under the needle is mathematically the same as walking the groove, and dragging the record
in MAP mode is the same code path.

### 1.1 Two modes, one state

| | WALK | MAP |
| --- | --- | --- |
| Camera | Low, 3/4 view, facing the current plate head-on; the record rotates so that plate faces you | High (50°), the whole record in view, cover text on the left |
| Plates | Current one lifts and is full brightness; neighbours dim to 36% so type never fights them | All plates tilt toward you and scale up 1.55×; hover lifts one and names it |
| Text | The liner card (right column on desktop, bottom sheet on a phone) | The cover: headline, two side buttons |
| Travel state | `tT` — a float track index with a spring | `spin` — a free angle with inertia |

Where the focus lands on screen is a **layout**, not a magic number: `layout()` picks a screen point for the thing we look at
(left-third of a desktop with the card on the right; centred above the bottom sheet on a phone), the camera distance is
solved so the plate is the right pixel height, and `camera.setViewOffset` slides the image there without changing the pose.
That is why the plate is never under the card (the verify script measures it).

## 2. Interaction, from the first moment

There is no "click to start". The page opens in MAP with the record already alive: it drifts, the sheen follows
the cursor, plates tilt toward the pointer, and every plate is already animating.

| Input | MAP | WALK |
| --- | --- | --- |
| Mouse wheel | one notch down dives to the last track | **one notch = one track**, with a lean toward the next while you scroll; wheel-up at track 01 rises to MAP |
| Drag / swipe | spins the record (DJ-style, with inertia) | drag either axis to travel; a flick moves exactly one track, never two |
| Hover | the sleeve lifts and a tooltip names it | the plate leans toward the cursor and its preview reacts |
| Click / tap | drops the needle on that sleeve | on the current plate: **pokes** the preview (one more thing it can do); on another plate: flies to it |
| Keys | `→ ↓ PgDn D` dive; `M` toggles | `→ ↓ ← ↑ A D`, `Home`, `End`, `Enter` opens, `Esc` rises to MAP, `I` the tracklist |
| Buttons | `SIDE A` / `SIDE B` on the cover, `INDEX` | `LIVE / ROADMAP` switch, ‹ › on the card, `TRY NEXT`, the 19-tick rail, `OPEN` |

Pointer events are used for mouse, pen and touch alike. The canvas is `touch-action: none`; the index sheet is the only
thing that scrolls. Reduced motion stiffens every spring and stops the idle drift and the intro spin.

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
  **Tap the plate** to poke it. Tap `MAP` for the whole record; the sheet hides (and becomes un-hittable) and a swipe spins the record.
- `INDEX` is an 86%-height bottom sheet with 19 rows of 56px+, the only thing that scrolls.
- The cover moves its two doors and hint to the bottom of the screen where a thumb is.

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
- **Cost**: the focused plate redraws 30×/s, nearby plates 8×/s, the rest every 2 s; in MAP all plates redraw at 6 Hz, three per frame at most.
- **Test hooks**: `window.__independents` has `state()`, `go()`, `toMap()`, `probe(slug)`, `projectPlate(i)`, `setAuto()`, `stepSim()`.

## 8. Certification: `verify.cjs`

`node prototypes/root-explorer-minimal/verify.cjs` (optionally `SHOTS=/dir` for screenshots) in headless Chromium with
software WebGL. 73 certificates, in nine groups:

1. The page is the world: one fixed canvas, exactly viewport-sized, no frame, no scroll, `#151516`, a live render loop.
2. Nineteen tracks: real rows 01–19, nine LIVE then ten ROADMAP, hairline leaders, every `href` resolves, every hook is a short
   sentence, every card says what you do, no card is wordy, **no engineering vocabulary**, PLAY vs PEEK AT.
3. Nineteen previews: each draws, **animates on its own, reacts to the pointer** (same random seed, different pixels) and survives a click.
4. Desktop interaction: hover names a sleeve, dragging spins the record, a click drops the needle, the plate sits beside the card,
   one wheel notch = one track, arrows, Home/End, drag either axis, the rail, the LIVE/ROADMAP switch, previous/next, TRY NEXT,
   poking the current plate, wheel-up to MAP, `M`, `Esc`, the cover's doors.
5. Hand-off URLs, and the pending app only toasts.
6. The index opens, groups the sides, flies to a row, closes with `Esc`.
7. Phone: no scroll in either axis, canvas 390 × 844, the switch moves into the sheet, 44px targets, the plate framed above the sheet,
   swipe left/up/right, tap pokes, ROADMAP / next / MAP / index sheet.
8. No WebGL (`?nogl` forces it): the page degrades to a plain, scrolling list of 19 real links.
9. Zero console errors, zero page errors, zero failed requests.

Limits worth knowing: the headless run uses a CPU renderer, so the verify script pauses the real-time loop and advances the
simulation explicitly; on a real GPU the loop runs at display rate. The tonearm and plate lean are art, not physics.
