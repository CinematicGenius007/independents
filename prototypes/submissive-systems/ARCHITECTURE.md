# Submissive systems — engine architecture for Driftwatch and Loomweight

Working notes for the two low-agency concepts of the next batch: an unmanned
bathysphere and a self-running Jacquard loom. This document follows the house
order used by [docs/CONCEPTS.md](../../docs/CONCEPTS.md): state the mechanical
claim plainly, critique it until it survives, then pay for it with a
deterministic engine and a certification harness before any pixel is drawn.

The interactive mock that accompanies this document is
[index.html](index.html) — one self-contained file, both applications, each in
its own visual register, both honest enough to demonstrate the actual engines.

## 0. What "submissive" has to mean, mechanically

The two apps share a family resemblance worth naming before critiquing either
one, because the failure mode of this genre is one sentence long: *if the
player cannot act, there is nothing to do; if there is nothing to do, it is a
screensaver.*

The claim this batch stands on:

- **The player owns no spatial actuation.** No aim, no steering, no routing.
  The plant does not wait for the player and does not travel through space on
  the player's behalf.
- **The player owns exactly one binary mode, and the right to choose *when*.**
  Driftwatch: a buoyancy sign (rise / sink). Loomweight: a mallet (strike /
  don't). The verb set has cardinality 1–2. The *temporal placement* of the
  verb is chosen from a continuum, and that placement is the entire game.
- **The plant is continuous, autonomous, and deterministic.** The ocean
  carries the hull; the loom advances its own clocks. Mode changes are
  instantaneous — impulses applied to an otherwise autonomous dynamical
  system.

In control-theory language this is not a steered system at all: it is an
**impulsive control** problem over a piecewise-deterministic process. The
player is not the pilot; the player is the correction. The interesting
quantity is not "where can I go" but "**what is the cheapest sequence of mode
changes that lands the plant where I need it**" — a min-cost event sequence,
which is exactly the kind of thing BFS/Dijkstra certify exactly. Better yet,
the hard-won pattern from this repo's previous batch transfers almost
unchanged: Fogwalk certified levels with a belief-state search and priced
moves as `par + 3` because a headless harness showed that without a budget,
random flailing solved 95% of easy boards. A continuous plant with discrete
impulses, discretized at fixed steps, is a graph — and a graph gets a solver,
a certificate, and a budget.

### 0.1 Why one button does not mean shallow

Reviewers will raise "one button, therefore idle" without thinking it
through. The rebuttal is four points, and the engines below depend on all of
them:

1. **Expressiveness lives in the schedule, not the verb set.** A toggle is a
   binary act, but the *time* at which it is performed is a real number. Two
   toggles sixty seconds apart and the same two toggles one second apart
   produce completely different trajectories. The input alphabet is
   {toggle, wait, wait, …} — an unbounded word over a two-letter alphabet.
   The strategy space is infinite even though the hand is small.
2. **The value of a verb is state-contingent.** In Driftwatch the same press
   buys either +40 m eastward drift or ~55 m westward repositioning,
   depending on which depth band the hull was in when pressed. The verbs are
   few; their payoffs are dynamic and heavily history-dependent. That is the
   definition of a planning problem.
3. **Intervention is rationed.** Driftwatch grants a *budget* of valve shifts
   per leg (certified minimum + slack). Loomweight charges a permanent cloth
   defect for unneeded interventions and a far worse permanent defect for
   missing ones. This is Fogwalk's lesson restated: without a budget, flailing
   wins; a puzzle you cannot lose to your own impatience is not a puzzle.
   "Submissive" without a cost on intervention is a screensaver; *submissive
   under budget* is a discipline.
4. **Determinism makes the waiting legible.** Because the plant never acts on
   your behalf and never hides state, the time between two presses is not
   dead time — it is the player reading the consequence of the last press in
   order to time the next one. Every press is a settled bet with a long
   maturation. That cadence — few, freighted, slow to resolve — is exactly
   the experience ordinary action games never provide.

What we deliberately do *not* add: timers you can outrun, twitch reflex
windows, combos, movement, or a second controllable axis. Submission here is
not "slow twitch"; it is *low-frequency command over a continuous plant*.

---

## 1. Driftwatch — the unmanned bathysphere

### 1.1 The pitch, sharpened

You are a sealed instrument aboard an unmanned bathysphere drifting through a
stretched-out, two-dimensional section of ocean: a cross-flow of gyres,
eddies, thermoclines and counter-currents. You cannot steer because there is
no thruster, no propeller, no rudder, no ballast tank release that changes
your horizontal carry. You are not the vehicle's pilot, only the crew of the
single valve lever:

- **HOLD** = VENT the bladder: the hull becomes buoyant, rises.
- **RELEASE** = FLOOD the ballast: the hull sinks.

There is no neutral. The vehicle is *never* parked; it is always sinking or
rising, forever, and its horizontal position is simply whatever the water
does while it does that.

The whole game is the shear. Depth bands don't merely *feel* different —
they are strongly oppositional:

| Depth band | Name | Horizontal carry |
| --- | --- | --- |
| 0–25 m | warm surface jet | **+3.0 m/s (east)** |
| 25–55 m | thermocline undercurrent | +0.6 m/s (weak; the toll band) |
| 55–130 m | cold counter-current | **−1.1 m/s (west)** |
| valve, applied at any depth | VENT / FLOOD | **−2.6 m/s / +2.3 m/s vertical** |

The vehicle rides a *depth-stratified conveyor belt* whose layers run in
opposite directions. Going east cheaply means riding the surface jet — but
there is no neutral and sitting near the surface risks broaching the hull
(absolute fault). Descending to reposition west means the cold counterflow
carries you backwards while it does. You can only spend vertical motion to
change which horizontal belt you are on, never to hover between them, and
the ocean's closed curves labeled *eddies* bleed into whichever band you are
crossing so that the vertical phase and the horizontal carry are never
independent.

A leg is one deliverable: the tracking buoy (the beacon) is placed ahead of
you and deeper than you. Every valve toggle costs one of a permitted budget;
the budget is computed *before* the leg is issued (see the solver, 1.4).
Exhausting the budget before the fix is acquired does not stop the vehicle —
nothing stops the vehicle — but the listening station retires the leg: the
chart is stamped `BEACON LOST` and the run ends. Reaching the beacon inside
budget stamps `FIX CONFIRMED` and opens the next leg at a fresh seed.

### 1.2 Critique of the original pitch

The original idea — "unmanned balloon in a graph of thermally stratified
currents" — is evocative, but as a game brief it was weak in six ways that
made it un-fun and probably shallow. Walk through the severest:

1. **No leg, no runtime bound, no cost of verb.** If you let a vehicle drift
   "until it reaches an interesting spot," every seed is eventually a
   success and the player never plans anything. This is Fogwalk's flailing-
   solves-95%-of-boards failure, in continuous time. Fix: legs with a
   certified budget, `K_certified + 2` shifts.
2. **"Sink *or* rise" is secretly two verbs.** Writing it as a choice
   between sinking and rising implies controls; the actual design has one
   signal: **the valve is open (vent) or closed (flood)**, i.e. HOLD or
   RELEASE. One bit of state, not two decisions per second. Fix: restate as
   hold/release; the vehicle at rest does not exist (there is no neutral).
3. **No failures means no stakes.** "Just drifting in a beautiful ocean" is
   a mood piece. Failures give consequence to the toggles. Toggle too late
   and you pass deep enough to crush the hull; too deep on the wrong
   bathymetry and you ground; drifting to a false peak for the surface jet
   and you broach at z < 3 m. Fix: see the three failure states, 1.3.
4. **Decorated water.** Thermocline as an element of the palette is
   nautical-theme trivia; the interesting tension of any continuous field
   where a single vertical verb matters is *shear* — two horizontal layers
   flowing at strongly different velocities, in this case, opposite
   velocities. Fix: making the stratification the actual engine of play,
   with boundaries that flip your carry sign; the visible render is a
   labeled cutaway section, not a static diagram.
5. **A deterministic field with no planner is only a physics toy.** Without
   a proof of affordable reachability, the designer cannot grade legs, or
   price budgets, or report and reject degenerate seeds. Fix: BFS solver
   tied directly to the integrator, restricted to shifts bounded by K —
   see 1.4.
6. **No leg separation, no seeds, no scoring.** Serialization matters even
   in a browser-only project: `#seed=0x53F1 …` makes the mock shareable and
   a challenge leg to be briskly competed. (The full build being
   asynchronous is incidental.) Fix: legs numbered by beacon count; runs
   shareable as a seed string; stats stenciled in the margin, not in HUD.

### 1.3 The locked rules of the interactive mock

These are the values the prototype ships with; the doc's companion
`index.html` implements them exactly.

- **World**: a single vertical section (x = east, z = depth), 420 m long by
  130 m deep. The north–south axis is not simulated; a plan view would be a
  lie — the chart *is* the vertical section.
- **Bands & shear**: 0–25 m = +3.0; 25–55 m = +0.6; 55–130 m = −1.1 m/s.
  Band boundaries are hard steps in u (step function velocities). Crossing
  a band is not free: crossing spends one toggle *and* the thermocline toll
  band is slow, so each crossing costs enacted drift-time in the middle
  layer.
- **Valve**: `vent` = −2.6 m/s; `flood` = +2.3 m/s. The vehicle never is
  still. No alpha-blend modes and no drifting on momentum; a change of bit
  instantly re-writes the buoyancy constant.
- **Ambient eddies/curl noise**: 9–11 alternating-sign streamfunction
  vortices (see 1.5) with max swirl ±0.5–0.7 m/s, seeded per leg. They add
  a modest vertical *component* (brine skin flow of cold water curling
  upward under the surface) so that the field *never* becomes a pure
  conveyor belt.
- **Budget**: K = certified minimum valve shifts for the leg by the solver.
  Allowed = K + 2. Spent budget happens on each toggle (press OR release
  each flips a state bit). Overspend → BEACON LOST (leg retired).
- **Beacon**: spawned 90–240 m east of start, 55–80 m deep (inside the
  cold counterflow: acquiring it *means* entering the deep flow).
  Acquisition radius 8 m; reachable guarantee within ≤ K shifts, see 1.4.
- **Failure states** (precise, displayed, no ambiguity):
  - `BROACHED` — hull reaches z < 3 m and pops the tail out of the water.
    Absolute; nothing rescues you.
  - `CRUSHED` — z ≥ 96 m: the hull crush contour. (The deep belt that
    repositions you is the same water that exceeds your safe operating
    depth; nowhere is free.)
  - `GROUNDED` — contact with the sea floor. The bathymetry is drawn on the
    chart: **shelf pinnacles** rise close beneath the thermocline, so
    grounding punishes exactly the depths you sink to at the shelves.
- **No pause button**. The ocean doesn't care about the player. (A hidden
   browser tab suspends the page as a side effect — the plant itself has
   no pause.)
- **Semantic loop**: run = consecutive legs; run properties: fixes, leg
  count, cumulative distance, shifts saved (budget − spent). Failing any
  leg retires the run; a fresh run draws a new seed.

### 1.4 The solver: certified reachability in K valve shifts

This is the engine's honesty guarantee, and it is what makes the budget
credible. The briefing proclaims the levels are "playable"; the solver makes
that a *printed* quantity.

The plant is autonomous except for one binary **valve bit** *b ∈ {FLOOD,
VENT}*. While the bit is left alone, the motion is exactly the game
integrator's own. So discretize position onto a 2 m lattice and build a
**layered transition graph** as follows:

- **Vertices**: `(cell_x, cell_z, valve_bit)` — but *not* the naive cell-
  centre lattice, because re-launching every transition from the cell
  centre is **unsound**: it teleports the vehicle, the accumulated
  vertical drift vanishes every hop, and the hull can never actually cross
  a band (the engine probe that caught this is worth keeping as a
  cautionary tale: the naive BFS's reachable set collapsed to one
  z-lattice row across all 84 x-cells, closures exhausted, beacon never
  reached). The shipped solver therefore stores the *exact* (x, z) at
  which a state was first reached and re-launches each flight from there;
  the lattice only quantizes *where a toggle may be booked*, not the
  dynamics. 210 × 65 × 2 ≈ **27,300 vertices** for a 420 × 130 m chart,
  hold quantum 2.0 s (40 substeps at dt 0.05).
- **Hold edges** — no toggle cost: from a vertex's exact position, run the
  *identical*, fixed-step integrator that the game runs (dt = 0.05 s,
  no lag, exact `x += u·dt`, one bit held) for one 2.0-second hold. The
  head is whatever (lattice cell, valve) that flight lands in; the head's
  stored position is the flight's exact endpoint, so chains of holds are
  exact continuations and the only abstraction is *when* the player may
  toggle (quantized to 2 s). Terminal-transition rules: if the flight
  crosses the surface (z < 3 m), the crush contour (z ≥ 96 m), or the sea
  floor, that edge is *fatal* and the head is never enqueued.
- **Toggle edges** — cost 1: `(cell_x, cell_z, b) → (cell_x, cell_z, 1−b)`,
  honouring the game's own semantics (a press and a release each cost one
  budget tick).
- **Beacon cell** — the goal. The certificate K is the *minimum number of
  valve shifts* to reach the beacon cell, computed as a layer-by-layer BFS
  where layer 0 is the start (vehicle's spawn cell, FLOOD) and the next
  layer is all toggle edges within the closure of the previous layer.
- **Certificate** — because the solver runs the *exact integrator* of the
  game over exact positions and reads the same fields, each found
  solution trace is *attainable*: a player reproducing the printed plan
  (toggles on the 2-second grid) replays the flight identically and
  acquires the beacon within K shifts. **The prototype's own verification
  suite replays ten published courses back through the game integrator:
  every one lands at the 8 m acquisition radius with zero deviation** —
  max deviation 0 m across all verified courses. The granted budget is
  K + 2. The certificate is not decoration: PLOT COURSE prints the
  planner's own plan as a dashed course with exactly one red ring per
  shift. (The rendering is the instrument; the BFS number is the
  instrument's reading.)
- **Generation-time rejection**: a seed for which the solver produces no
  path in ≤ 10 shifts is rejected at generation (the shipped acceptance
  window is K ∈ [2, 10]; the prototype certifies its leg on the first to
  a few tries at these band speeds). A seed for which K = 0
  (resolvable entirely by drift, no toggle at all) is *also* rejected —
  there is no decision in such a leg, therefore it isn't a leg. (Idea from
  Fogwalk's generator: solvability and interest are two properties, and a
  generator must certify both.)

The prototype prints on its own paper: "REACHABILITY K = 6 CERTIFIED —
[BFS, layered graph, 27,300 states] — budget granted 8." This is
exactly the role Fogwalk's `par` plays, exported to a continuous field, and
it is also the future hook for daily and shareable seeds: a seed is worth
shipping only if its certificate prints cleanly.

### 1.5 Deterministic field construction: the divergence-free streamfunction

The ocean must behave like a liquid and must be behaving honestly; the
conscientious way to guarantee both is to make every velocity vector the
**curl of a scalar stream function Ψ**, which makes the field exactly
divergence-free by construction:

- u = ∂Ψ/∂z (eastward drift), w = −∂Ψ/∂x (vertical overturn), so

  ∂u/∂x + ∂w/∂z = ∂²Ψ/∂x∂z − ∂²Ψ/∂z∂x ≡ 0.

  Water is never created or destroyed anywhere; closed gyres and
  counterflows are *properties of the geometry*, not applied visually.

Ψ is constructed entirely from a deterministic seed:

1. **A depth-band conveyor**: Ψ_band(z) = −∫₀ᶻ u_band(s) ds, with u_band the
   piecewise-constant band profile (+3.0, +0.6, −1.1). This alone produces
   perfectly horizontal shear layers: the thermocline is where du/dz
   becomes a visible step. Being piecewise-linear in z, its contribution is
   constant u per band with w ≡ 0 — pure shear, no sources or sinks.
2. **A sum of Gaussian vortices** ("curl noise" in the plain language; a
   proper stream-function superposition in fact):

   Ψ_eddy = Σᵢ Aᵢ · exp( −( (x−cxᵢ)²/(2σxᵢ²) + (z−czᵢ)²/(2σzᵢ²) ) ),

   where the (cxᵢ, czᵢ, σxᵢ, σzᵢ, Aᵢ·sign) tuples are drawn from a seeded
   PRNG (mulberry32, integer-only mixing). Their derivatives add to the
   band profile field as (u, w) = (∂Ψ/∂z, −∂Ψ/∂x), so the sum total remains
   an exact streamfunction and the divergence-free property survives.

   9–11 are spawned; radii σx 14–36 m and σz 9–21 m keep eddy circulation
   under ±0.7 m/s so that no user can accidentally park the hull in a
   stationary eddy: the belt always exceeds the eddy. Eddies are the *only*
   source of vertical w — a nice emergent element: near an eddy's rim, the
   vehicle's valve must fight the eddy's up- or down-draft to hold a band.
3. **Total field**: u(x,z) = u_band(z) + Σ ∂Ψᵢ/∂z, w(x,z) = Σ −∂Ψᵢ/∂x.
   The band boundaries are *hard*: velocity is a step. That's deliberate:
   thermocline shear is real, and a step function makes the "cost of
   crossing" legible (the craft visibly skids sideways while the band
   tells it to).
4. **Bathymetry floor**: a deterministic sinusoidal shelf line plus two
   Gaussian pinnacles, drawn as the underside contour. It is not part of
   the flow; it is a static obstacle the flow must be dodged around.
   Heights: the floors sit between 49 and 71 m under the pinnacles — high
   enough to be hit from both the toll band and the upper counterflow —
   and beyond 106 m across the abyssal plains, safely below the crush
   contour (so the plains punish deep drift with CRUSHED, the pinnacles
   punish lazy descents with GROUNDED; the two hazards alternate by
   region).

**Integration & determinism.** Fixed time step (dt = 1/30 s for the game, dt
= 0.05 s for the solver; both consume the same `step(x, z, valve, dt)`
function, and neither uses time-of-day, frame rhythm, nor floating-point
accumulation of *wall* time; a paused page will not drift its world state;
visual smoothness is provided by interpolation, not by re-stepping
different dt values. Determinism is same-machine at double precision —
absolute cross-platform reproducibility is an option (quantizing positions
to 0.01 m and fixing the math) and is not required to certify K, because
charts are certified during generation on one machine. The prototype also
*verifies* its certificates: published courses are replayed back through
the game integrator and must acquire the beacon at the exact shift count.

### 1.6 Interventions that create anticipation

The three classic toggle regimes, and why they're *tense* rather than fussy
— an explicit picture for the entry in §1.1:

- **The ascent ferry.** You sit in the cold counter-current (−1.1 west),
  want +250 m east. HOLD the valve: climb the thermocline toll to reach the
  jet band (+3.0). Cost: 1 toggle to press, 1 to release. But while you
  climb you traverse the toll band, where your carry crashes toward zero —
  so the *net* eastward gain of a ferry is the time-integral of band carry,
  and it depends on where, in x, you began the climb. The skill point is
  subtle and worth stating exactly: the cheap thing is not the toggle, it
  is the **offset you entered it from** — the position you banked in the
  surface jet before committing the next two toggles.
- **The banked descent.** With the beacon deeper than you, and colder water
  below dragging you back west, the right toggle sequence is: FLOOD *early*
  — because while you sink, the counter-current erodes every metre east
  you had banked, so the descent must begin *upstream* (west) of the
  beacon, by an amount the player learns to compute from the carry table.
  Every fine approach is 3–4 toggles of this: a slow-motion bet placed
  against a mostly-frozen chart.
- **The exposure probe.** Sometimes you cannot tell whether an eddy's rim
  will fling you east or west at the beacon's depth. One toggle — down or
  up, through one eddy — is an information purchase: you spend budget to
  buy certainty about the next toggle. The budget prices guesses as well
  as moves, which is exactly why the planner's certificate matters.

and that is exactly the anticipation cycle of a long-range shot in geometry:
the bet has been placed, the payoff delayed; the game's
service during the wait is *forecasting aids* — the depth-trace line, the
dashed planner course if you enable the option, the beacon's echo pulses —
all printed on the chart so the read is always visible. (Measured on the
shipped tuning: K=4 legs resolve in ~80 s of world time and K=8 legs in
~167 s, so a mid-leg toggle grows from one interval to the next by roughly
twenty seconds. That is the inter-interval scale the mock tunes to — not
thirty-to-sixty, but high tens of seconds between wager and verdict.)

### 1.7 Even stronger variant (proposal): the dead-reckoning plot cone

This is the strongest sharpening I found, and it stays within the
deterministic engine while radically increasing the *felt* tension of
reading. The bathysphere's true state stays exact — but the *plotted*
position on the paper chart is a dead-reckoned estimate with growing error:
an uncertainty cone widens with every second of un-confirmed drift, faster
while crossing the thermocline (shear accumulates unmodeled noise). An
echo from the beacon collapses the cone back to a point — and the widening
starts again. The player's real defence schedule becomes: **"buy an echo
before the cone swallows your next hazard."** The engine is untouched; the
*chart* now shows a widening plume instead of a plotted dot. Paradoxically
the felt agency drops to a rumour while the actual play tightens: toggles
become fewer, earlier, and more charged, because every one of them is now
scheduled against the cone's growth as well as the field. **Shipped in the
mock** (§3.4): the plotted fix is a dead-reckoned estimate; the cone is the
felt game. A secondary extension: a *ledger
of beacons* (several eastward temptations at different depths, so a run is
a drifting inventory of unanswered requests) — closer to Fogwalk's
"one best plan" economics; I would headless-test that one before
committing either (see §4).

### 1.8 Playtest & certification plan (Driftwatch)

The headless battery to be written before the real build (and run from the
same engine module the browser ships, since the engine is deterministic on
integers):

- **Zero policy** (never toggles) must solve 0 legs — trivially true
  because the vehicle spawns FLOOD, sinks in the toll band, and grounds or
  crushes without any way east against the counterflow: asserts the game is
  not self-solving.
- **Coarse policy** (random toggle schedule with Poisson λ = one per 20 s)
  must solve ≤ 10% of legs under budget — this is the Fogwalk "flailing
  doesn't do the work" statistic, proving the budget is real work.
- **Greedy policy** (re-derive the BFS after every toggle and follow the
  re-certified plan) must solve ~100% of legs — asserts that whatever
  state the vehicle reaches mid-leg, the leg is still winnable: legality
  alone never leaves the player unplayably lost.
- **Budget slack study**: distribution of K across 100 generated legs
  should top out ≤ 10 with median 4–6, since K > 10 usually signals a
  tedious ferry run and the generator should reject above the p80.

---

## 2. Loomweight — the self-running Jacquard loom

### 2.1 The pitch, sharpened

A Japanese weaving shop, mid-century; a mechanical Jacquard loom is weaving
procedurally from a punched-card chain, on its own clock, and everything
about it is *theirs*: the pattern, the cadence, the colour sequence printed
from the card ledger. You are the shop assistant. You are not permitted to
change what the cloth *becomes*; you are the shop's insurance against the
machine's own vice. The loom runs forever on two nested tally clocks, and
you have one tool: **the mallet** (Space / tap).

The loom runs on a **3 : 4 polyrhythm**. Each shuttle pick (a single weft
pass, ~0.64 s) advances both counters:

- the **treadle** counter (mod 3),
- the **card** counter (mod 4).

The special window — the **shed** — is open for exactly 2 picks out of 12
(the picks at the coincidence of both counters in the lcm(3,4) = 12
supercycle). The shed is the one moment the warp threads are fully
separated and a tool can be passed through cleanly: a **clean catch**.
Twice per 12 picks. Everything else times out of sync.

What requires you:

- **Warp tangles.** Deterministically, the loom sometimes tangles a warp
  thread; a tangle occupies a heddle and has a *width* w = 1. Every third
  pick without intervention, w grows by 1 (widths 2 and 3 at ages 3 and 6
  picks). At w ≥ 4 the shuttle can no longer pass — but it can only be
  trapped **on a shed-closed pick**: while the warp is open the shuttle
  passes harmlessly, so a tangle whose last gated slot put its window on
  the very pick it reaches width 4 is caught as the shed opens, or snaps
  the moment the window closes. A snap punches a tear into the fabric (a
  permanent cut column), and *slub* marks knot their way into the next few
  picks. Three tears and the loom halts; the run frames the cloth.
- **Dye bobbins.** The tray carries five bobbins of finite dye; each pick
  consumes one unit. When the active bobbin runs dry, the loom is owed a
  splice of its two neighbours and a fresh blended colourway. If *you*
  strike on a dry flag, the splice is clean — no defect. If you don't,
  the loom's own forced splice *does* happen (it will not weave on an
  empty bobbin) but the cloth carries two pale *slub rows* of a hurried
  splice: permanent, but far less damaging than a tear.
- **The mallet is graded.** Strike with a tangle live, during the shed —
  *clean catch*, cloth untouched. Strike with a tangle live, off-shed — you
  catch it, but the cloth takes a **slack pick** (a thicker, darker weft
  row permanently woven where your hand slipped): a small cost. Strike with
  nothing pending — **blind mallet**: a slack pick, and nothing more
  useful: the loom does not reward the idle. (It does not punish more than
  that: one flaw row in the cloth, the cloth itself is the memory.)

The consequence: **the cloth is the score.** Nothing else is tallied at the
top of the screen. There is one artifact, and everything you did is woven
into the very fabric your eye can see: slubs, tears, pale splices,
colourway drift — the quality meter is a piece of silk, and its damage
history is legible in the artifact itself. When the loom halts (or you
stop), the run is framed and the cloth is hung *as woven, torn as torn*.

### 2.2 Critique of the original pitch

Five shortcomings of the original "rhythmic maintenance game on an auto-
loom", and each fix that is now in the spec:

1. **"Meditative maintenance" without cost on a wrong input is zero-stakes
   tidying.** If your taps are always useful or always harmless, any
   sequence works and the *rhythm* never matters. Fix: graded taps with a
   permanent artifact cost — the dark slack pick — and *discourage* idle
   input. Blind mallets cost cloth; blind *inaction* costs tears.
2. **A fault schedule that spawns at random "feels" random rather than
   rhythmic.** Randomness was the enemy of a rhythm game's legibility.
   Fix: spawner is a *deterministic hash* of (seed, card, pick) — same
   seed, same tangles, forever — and the design can guarantee a spawn
   *window* distance so no tangle is spawned with less than 4 picks of
   dead-air before you could reach the shed: the *latency to react* is
   designed-in, never luck (§2.4: the guarantee formalised).
3. **A pedestal score meter (quality %) contradicts the artifact vision.**
   If the item you remember is a cloth and the metric is a number, the
   number orphans the cloth; metric-driven players would *never* look at
   the slubs. Fix: the tally *is* the artifact — the cloth is the score,
   and its defects are printed in the weave. This also honours the batch
   rule that no mechanic shall survive removing its theme: here the damage
   display is not an overlay, it *is* the theme.
4. **The original had no halt condition.** "Runs forever" is not a game —
   runs must *end* (and be framed, shown, then replaced) to have shape.
   Fix: 3 tears = mechanical halt; the run stops with the exact cloth in
   hand and tells you a story (framed or hung).
5. **The splices needed a purpose beyond "you pressed a key".** If the
   splice were a player's design choice, the game's agency would balloon —
   it would grow into a mode editor. Fix: the *loom* decides the blend
   deterministically (50/50 between the dried bobbin's two neighbours, in
   the tray's mechanical order); your only choice is *when* to do it and
   whether it will be clean or hurried. Your hand's timing, not your
   palette, is the art you contribute; the *loom's* blend must forever
   bend the colourway.

### 2.3 The locked rules of the interactive mock

- **The clocks.** Pick period 640 ms. Treadle clock period 3 picks, card
  clock period 4 picks; supercycle 12 picks (7.68 s). The shed is open for
  picks ≡ 0, 1 (mod 12). Both counters' hands are visible on a single
  polyrhythm dial; you can also hear them (audio ticks on 3 and a low thud
  when the shed opens).
- **The card chain.** 24 punched cards, advancing every pick; each card's
  12-bit hole pattern (from a seeded hash chain) drives that pick's weave
  texture. The card belt shows the chain winding through the frame; the
  current card is enlarged.
- **Tangles.** Deterministic spawn: hash(seed, pick, card, 17) passes a
  spawn threshold (~13% of eligible picks) and only for picks whose
  distance-to-next-shed gate Δ ∈ [4, 9] — every spawned tangle has at
  least 4 picks (~2.5 s) and at most 9 picks (~5.8 s) of calm before the
  next clean-catch window. The heddle index is hash(seed, pick, card, 19)
  mod 14. Growth: w += 1 on the tangle's 3rd, 6th and 9th unstruck pick
  (w = 2 at age 3, 3 at age 6, 4 at age 9). Snap: w ≥ 4 **on a shed-closed
  pick** (the shuttle is only trapped when the warp shuts on it). Since
  Δ ≤ 9, **every tangle offers at least one shed window before it can be
  trapped**: for Δ = 9 the catch and the trap land on the same pick, and
  the player's strike inside that pick is what separates them; unattended
  death takes 9–10 picks (~6 s) of total inaction.
- **The mallet.** One input, at any moment. Its grades:
  - *clean catch* — a live tangle, shed open: no trace;
  - *hurry catch* — a live tangle, shed closed: tangle cleared, one slack
    pick row woven in;
  - *clean splice* — a dry bobbin flagged, no tangle: neat splice of the
    two neighbours, no slub;
  - *forced splice* — (automatic; not your tap): dried 3 picks with no
    splice: the loom blends anyway and spins two *pale slub rows*;
  - *blind mallet* — nothing pending: one slack pick woven in.
- **Bobbin tray.** 5 bobbins, colour palette fixed per seed order. Capacity
  22–34 picks. When the active bobbin dries, the loom flags it and waits 3
  picks for your clean splice; after that, the forced splice blends equal
  parts of the two neighbours in the tray's mechanical order, and the
  colourway drifts from then on. The blend is **irreversible**: the dye
  ledger never unblends a colour, for the run's whole life.
- **Cloth and tears.** Each pick contributes one row to the fabric. A tear
  punches a notched gap column into the swatch plus 4 slubbed rows; every
  subsequent pick is woven one warp column narrower — the column is dead
  from the tear downward (14 → 13 → 12 across a three-tear life) — so the
  damage history is readable in the selvedge itself. Halt: at the third
  tear.

### 2.4 The fairness guarantee (derived, not felt)

Rhythm games die when the timing window is "do it now" — that is a reflex
game, not a submission game. Loomweight's guarantee is the opposite: the
window is *coarse* (a whole 2-pick shed = 1.28 s), the warning is
*designed* (Δ ≥ 4 picks), and the costs slope deliberately — the cost of
*acting early* is *architectural* (one dark slack row in silk, forever)
while the cost of *losing the shed* is *structural* (a torn thread). The
derivation, so it can be hardened in the harness rather than felt in the
playtest:

- A tangle spawning at pick p meets its next shed at p + Δ with Δ uniform
  over [4, 9] by the spawn gate. Widths: 2 at age 3, 3 at age 6, 4 at age
  9. Snap at w ≥ 4 on a shed-closed pick. Therefore the clean catch is
  available in-window on 100% of spawns (at Δ = 9 catch and trap coincide
  and the strike, graded inside the pick, wins); *unattended* death takes
  9–10 picks (~6 s) of total inaction.
- The expected cost of "wait for the shed" at a given Δ is therefore
  `E[wait] = tear·P(you fail to act by the trap)`, and the expected cost of
  "strike now" is exactly one slack row. The design commits to the frame:
  **act-now is always available and always cheap; the tear is only ever
  purchasable by complete abandonment.** The trade has to slope that way
  in numbers, or waiting becomes irrational; if the harness ever shows the
  two policies equal in expected cost, the gate, not the player's reflexes,
  gets retuned.
- **Blind-mallet spam**: striking on every pick weaves nothing but slack
  rows; the harness asserts that full-spam policy grades strictly worse
  than shed-only policy over 200 picks. If malleting *often* were
  worthwhile, the queue would promote twitch; the cost curve must slope
  against impatience.

### 2.5 The stronger variant found during architecture: *the cloth is the fault schedule*

This variant emerged from asking *where the next batch's early-fault
schedules come from*, and it is strong enough to note here for the future
build. In the mock, the fault spawner hashes (seed, card, pick) regardless
of the cloth being woven. The stronger scheme inverts the reference chain:

> the woven cloth's weft pattern over the last K picks is hashed to produce
> the *next* batch of spawn positions and widths.

Consequences, all of them good for the genre:

1. The world is generative and *self-referential*: the tapestry is the
   level. A slack-heavy cloth *is* a tangle-rich cloth; your mishandling
   today writes tomorrow's hazards into the warp. The loom economically
   rations danger back to you at the shape of what you have woven.
2. Compounding consequence: there is now a *cost to failing fast* beyond
   the tear itself — do not clear tangles, and the fabric's own hash
   *generates* tangles that arrive faster. The damage curve feeds itself.
3. The seed record of a completed cloth carries the entire fault future
   *in its weave*: replay-by-cloth is possible (re-running a run's cloth
   reproduces the run). The selvage is a seed.
4. Generational runs: when the batch's cloth is framed, the *next run's*
   first N picks' fault profile is read off that cloth's hash. Each run
   writes the opening of the next run: damage history that transfers score
   to the world and mistakes-with-memory.

Shipped in the mock as **MOUNT CLOTH · GEN II+** (see §3.4 and the §3.3
state additions: fault salt, spawn gate, scar heddles, growth ages, bobbin
capacity cut, heirloom ink).

### 2.6 Playtest & certification plan (Loomweight)

To be run headlessly against the engine module of the actual build before
the art lands (the mock's engine implements the same FSM, though without
the package's audio driver):

- **No-op policy** (never strikes) must accumulate all 3 tears and halt
  within ~100 picks on every seed — asserts the loom retires a passive
  player, but slowly, and only through spawns the player had full warning
  of by design.
- **Diligent shed-only policy** (strike at every shed pick whenever a
  tangle is live) must collect **0 tears** across 200 picks × 100 seeds —
  this is the certification of the spawn gate: rhythm attendance alone
  must be a complete defence. If a single seed tears under this policy,
  the gate gets retuned, not the player.
  *(Measured on the shipped mock engine, 40 seeds × 250 picks: 0 tears.)*
- **Slack-strike policy** (strike immediately on every tangle, disregard
  the shed) must be *survivable* (0 tears) but produce ≥ 1 slack row per
  two tangles: the demo of "surviving at the cost of the artifact" — the
  cloth just isn't pretty. *(Measured: 0 tears, ~16 slack rows per
  250-pick run.)*
- **Blind spam policy** must grade strictly worse than shed-only over
  200 picks — the temporal analysis in §0.1 item 3 must hold against
  impatience. *(Measured: 0 tears but ~240 slack rows per 250-pick run;
  the cloth is nothing but dark rows.)*
- **No-op policy** (never strikes) must accumulate all 3 tears and halt
  within ~100 picks on every seed — asserts the loom retires a passive
  player, but slowly, and only through spawns the player had full warning
  of by design. *(Measured: halt at pick ≈ 86.)*
- **Colourway drift check**: two seeds, same card chain, policy A vs
  policy B, must differ in the tray's blend ledger after 60 picks — i.e.,
  the input timing must economize *which blends you've caused*, not only
  the *number*; a splice ledger check in the harness log.

---

## 3. The two engines, one page

### 3.1 Shared constraints

Both engines, like every app in this repo, are pure frontend: no server, no
database, no accounts, no network calls. Each mock is a single
self-contained `index.html` with no dependencies. Determinism by
construction: no `Math.random()` anywhere in the plant — all randomness
flows from integer hash chains seeded by the leg/run seed. Pause is coarse
(tab visibility), never mixed into the plant, never a solver step. Both
plants run on **fixed-step accumulator loops**: none of
`requestAnimationFrame`'s jitter penetrates the simulation. (The one real
scheduler — WebAudio — is used for sound only and never as a control
input.)

### 3.2 Driftwatch engine summary

State per vehicle (the "vehicle frame"):

```
    valve ∈ {0: FLOOD, 1: VENT}
    x, z, t                         // metres, seconds
    trace[]                         // for the plotting head
    shiftEvents[]                   // toggle log for the render
```

Step, per fixed tick (both the game and the solver call this exact
function):

```
    (u, w) = flowVec(x, z)          // from Ψ; see 1.5
    x += u · dt
    z += (w + valveRate[valve]) · dt
    t += dt
    if (z < 3)              → BROACHED
    if (z ≥ crushContour)   → CRUSHED
    if (z ≥ floor(x))       → GROUNDED
    x = (x mod W)                   // the chart wraps east–west
```

There is *no* inertial tuck, no smoothing: v ≡ the flow exactly. This is
not a concession, it is the frame: deterministic, no distributed lag, and
the vehicle visibly rides the water rather than the ground.

State per leg (the leg frame):

```
    seed → PRNG → eddies[], hullColour, bathyLine, beacon{x, z}
    budget = BFS-CERTIFICATE() + 2
    shiftsSpent = 0
    status ∈ {LIVE, FIXED, BROACHED, CRUSHED, GROUNDED, OUT-OF-BUDGET}
```

Solver (layered BFS on the exact-position lattice · valve-bit graph) —
see 1.4 — runs at the beginning of *every leg*; the certificate is
stamped as "REACHABILITY K = 6 / [BFS layered ≈27,300 vtx; tens of ms]"
along with the printed course's toggle marks. A display option inscribes
the solver's course as a dashed reference line on the actual paper, which
by itself is the most honest possible demonstration that the solver *is*
the game engine wearing its chart.

### 3.3 Loomweight engine summary

One deterministic state machine, ticked once per pick:

```
    state = {
        seed, pick, treadle, card,               // clocks: pick inc = 1, treadle mod 3, card (belt idx) belt
        tangles[]: { heddle, width, age },
        tray[]: { dye, colour, blendOf[] },       // 5-bobbins mechanical order
        dryFlag, dryAge,                          // splice pending state
        cloth[]: { colour, texture*, flags },     // one record per pick woven
        tears, halt
    }
```

Tick sequence per pick (in strict order — the order *is* the FSM):

1. `pick++; treadle = pick mod 3; card++` (card belt advances per pick).
2. **Spawn check**: `hash(seed, pick, card, 17)` gates; if eligible (gate
   Δ ∈ [4, 9]) and no tangle live at heddle h = hash(seed, pick, card,
   19) mod 14: spawn tangle with width 1.
3. **Tangle maturation**: width grows on the tangle's 3rd/6th/9th
   unstruck pick. If any tangle has w ≥ 4 at the pick's end **and the
   shed is closed** — the shuttle can only be trapped when the warp shuts
   on it — then: **tear** — the cloth row is torn at the tangle's heddle
   column, `tears++`, 4 slub rows follow, the tangle is removed; if
   `tears = 3` → `halt`.
4. **Bobbin**: `dye−=1` on the active bobbin. If dye hits 0: set `dry`,
   `dryAge = 0`. If `dry`: `dryAge++`; at `dryAge = 3`: **forced
   splice** — a deterministic 50/50 blend of the two tray neighbours in
   mechanical order, and 2 pale slub rows enter the cloth ledger.
5. **Weave pass**: the weft colour is the active bobbin's colour; one
   cloth row is appended with the pick's texture bits from the current
   card's hole pattern, plus any flags attached this pick (slacked,
   slubbed, pale-slub, torn-col).
6. **Shed state** for the *next* pick is evaluated
   (`pick mod 12 ∈ {0, 1}`) to light the shed lamp and arm the audio
   thud.

Strike (`input`), applied at any sub-pick moment, graded against the state
at whichever *pick* index the accumulator is currently weaving:

```
    if (live tangle) {
        if (shed open) → clean catch (tangle removed; no cloth trace)
        else           → hurry catch (tangle removed; weave one slack row)
    } else if (dry flag) {
        splice: deterministic blend of the two tray neighbours;
                clean splice (no slub), cleared dry flag
    } else {
        blind mallet: weave one slack row
    }
```

Grade decisions therefore *only* depend on the pick-quantized state; no
reaction-time race is even representable. That choice is what makes the
FSM a **rhythm game without reflexes**: pick-quantized grade + ≥ 4 picks of
warning always. Notably also: the engine has *no absolute time dependency*;
everything is indexed by `pick`, so recording a run = recording (seed,
strike-pick list) and it replays frame-identical on any machine.

### 3.4 What the prototype does and does not implement

The mock is faithful to the engines above as specified: the solver runs the
real BFS; the cloth accumulates; the colourway drifts; tears, slubs and
slacks land in the fabric where they'll always stay; the shedding audio
opens; the ledger of splice blends is on screen. The stronger variants are
no longer stubs — they both shipped in the mock, as promised in §4.4:

- **The dead-reckoning plot cone (§1.7) is live.** `DEAD-RECKONING` arms a
  plotted-fix estimator that knows no eddies; the cone renders as a
  stippled uncertainty ellipse widening under unconfirmed drift (fastest in
  the thermocline toll band: 1.15 m/s vs 0.5/0.6 elsewhere). A sharp
  thermocline crossing — or a rationed **SONAR FIX** (3 per leg) — collapses
  the cone to a stamped red crosshair. The plant integrator is untouched;
  only what the *chart* claims changed.
- **Five certified campaign legs cycle the run** (Leg I The Shelf, II
  Counter-Gyre, III Silent Thermocline, IV Twin Eddies, V The Abyssal
  Narrows) at fixed shareable seeds, selectable in the plotter's HUD;
  the selector each prints its own fresh BFS certificate.
- **The cloth-as-schedule spawner (§2.5) is live.** `MOUNT CLOTH · GEN II+`
  hashes the woven cloth into the next generation's punch-card chain: slack
  rows raise the spawn gate (up to 380‰), tear scars imprint scar heddles
  and accelerate maturation, dye splices shorten every next bobbin, and the
  final blend carries over as the heirloom ink. A Gen II weave replays
  bit-identically from its parent cloth (see `verify.cjs`).
- **`EXPORT SPECIMEN (SVG)`** writes a standalone Meiji textile sample
  sheet — kentō corner marks, vermilion hanko, seed hash, and every woven
  pick reproduced 1:1 — for print.
- **Deep links**: `#driftwatch` and `#loomweight` route the Root Explorer
  straight into either instrument.
- **The certification battery is load-bearing now**: `verify.cjs` runs the
  page's own inline engine headlessly (sandboxed VM over stubbed canvas)
  and asserts every campaign leg certifies in K ∈ [2,10] and *replays its
  printed course through the game integrator with exactly zero deviation*,
  BEACON acquired at ≤ 8 m at the exact shift count; zero policy never
  solves; shed-attendance weaves 0 tears over 40 seeds; spam grades
  strictly worse; Gen II replays bit-identically. It also caught a real
  defect: the lattice stored hop endpoints in `Float32Array`, which re-rounded
  each hop terminus and accumulated ~2.4 × 10⁻⁵ m across a leg; the lattice
  now stores `Float64`, and the replay deviation is bit-exact zero.

## 4. Build order for the real apps

If this batch moves to the main `apps/` tree, the order that both concepts
should be built is:

1. **Engines only** (no UI): `driftwatch/engine/{field,vehicle,solver}.ts`
   and `loomweight/engine/{loom,cards,faults,cloth}.ts` with Vitest suites
   encoding every assertion in §1.8 and §2.6.
2. **Hasty harness mileage**: one `scripts/playtest.ts` per app where the
   no-op policy / random-coarse policy / greedy policy tradeoffs are run
   over 1,000 seeds and the numbers above are the pass-conditions. The batch
   must stress the *spawn gate* and *K slack* numbers therein: outliers are
   real but they read in the design numbers, not in the source code.
3. **Visuals last**: the two registers are already fixed here — Driftwatch
   in ink-on-fanfold bathymetric plotter paper, Loomweight in a Meiji-
   era textile swatch album with printed kentō registration marks and a
   woodcut red hanko against washi. The palette, typefaces, label style and
   material rendering on the prototype page should be lifted *directly*
   into the real UI, not reverted to an app-safe "modern dashboard" set.
4. **Then** reach for the stronger variants if the play-budget still allows:
   the plot cone for Driftwatch, cloth-as-schedule for Loomweight. Both
   sharpen existing engines without touching their cores. *(Both shipped in
   the prototype — see §3.4 — including the headless battery that
   certifies them; the Float64 lattice fix it forced is recorded there.)*

## 5. Register notes (visual direction)

One reference, one app, no blending — from the CONCEPTS process:

- **Driftwatch — Cold-War bathymetric fan-fold plotter.** A strip-chart
  recorder's paper feed: hole-perforated ivory stock with fan-fold
  creases; dark teal ink paths, hairline cyan grid, contour hatch and
  stipple on the bathymetry; red stamp ink *only* for hazards and
  plotter-event labels; stencil/typewriter lettering (`IBM Plex Mono` and
  kin); a bolt-on header banner and shift-log margin; the vehicle drawn as
  a surveying fix mark with a hand-drawn tick trail, not a sprite. Charts
  in this register *show the planner's printed course*, since a plotter
  printing a planned route is period-authentic.
- **Loomweight — Meiji-era woodblock textile sample book.** Cream washi
  leaves; flat inks (sumi black, indigo/ai, vermilion, ochre) with
  occasional colour drift on the cloth where splices force a blend;
  hanko-style red seal; small-caps and brushed-serif headings with narrow
  letter-spacing; registration kentō corner marks; cloth rendered as a
  *woven swatch* (weft runs with holes from the card's pattern bits),
  framed by hand margins like a sample album page, and slubs/tears visible
  in the weave. Japanese ornament in caption labels is set from a small,
  bold set of woodblock-common characters (no CJK font dependency — the
  system serif does it well enough at these sizes).

## 6. Graveyard

Ideas considered and cut, kept here so they aren't re-invented:

- **Surface shipping lanes / collision with passing vessels.** Adds a
  second *external* schedule to Dodge: the ocean is already the antagonist,
  and surface-traffic "events" would pull attention to a schedule neither
  the player nor the plotter can influence. Cut.
- **Oxygen / battery / power budgets.** A ticking meter on a deterministic
  plant forces the player to ferry a resource instead of arming a valve —
  a cheap pacing device that submits the mood to generic survival. Cut.
- **Loomweight: player-chosen splice colours.** Grows the design into a
  colour editor; it dilutes the "the loom decides, you time it" contract.
  Cut (and see §2.5 for the variant that keeps the timing-as-agency frame
  while folding *cloth* into *hazard*).
- **Loomweight: tangle repair knots.** A second verb (freeze the growth
  without clearing) — meaningless in a one-verb contract: the mallet must
  be the only tool offered or the clean/slack dichotomy collapses to a
  three-way tariff. Cut.
- **Driftwatch: ballast recharge loops / cooldown on the valve.** Any
  cooldown turns the certified BFS on its head (a cooldown valve changes
  the transition cost structure and adds another meter to live-track).
  Cut: the budget does the job that cooldowns were trying to do, and it
  does it *legibly*.
