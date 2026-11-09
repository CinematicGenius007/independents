# Deadlock, redesigned: clay, pictures, no paragraphs

Standalone rebuild of Game 1 from `prototypes/cs-formalisms/` (left untouched).
Open `index.html` (game) or `pieces.html` (every piece, looping) by double-click.
`node build.mjs` regenerates both from `src/`. Engine checks: `node --test src/engine/engine.test.mjs`,
ladder: `node scripts/certify.mjs [seed]`, size probe: `node scripts/cap.mjs`.

## 1. The concept, simplified

The old game asked the player to read tapes, disciplines, budgets and a certifier panel.
The rules that carry the formalism are only these:

| Formal idea | What the player sees |
| --- | --- |
| Mutex | A **pad**. Its lamp turns the holder's colour. |
| Thread + tape | A **Dollop** in a cart. Its *next stop* is where it is rolling; no tape on screen. |
| Hold-and-wait, wait-for edge | **Red yarn** from the waiter to the holder. A ring of yarn *is* a deadlock. |
| Open window | The loop shows first as **pink dashed yarn** (still fixable), then goes taut red (closed). |
| Hold | A **chock** wedge dropped under a cart. It keeps what it holds. |
| Priority loan | A **golden ticket** dropped on the *holder*. Priority flows from its best waiter, leased, shown as a dot timer. |
| Priority-preemptive scheduler | The **sun**: one cart at a time gets the beam. Only on inversion boards. |
| Deadline | A **melting candle** on the cart. Only when the deadline can bite. |
| Livelock | Two carts politely **shuffle left-right** and bow, forever. |
| Par | The **tray** holds exactly the certified tokens. |

**One interaction.** Drag a token onto a cart while the film is paused on a frame. That is the
whole game. The film strip is the timeline: scrub, rewind, pull a token off a frame, try again.
After a failure, frames you could still have acted in turn warm yellow, so the window is
something you see, not read.

**Wrong clicks are faces, not text.** A ticket on a cart that blocks nobody (the waiter, the hog)
makes it tilt its head and pop a `?`, and the ticket is refused. A chock on the holder is
accepted and genuinely worse (it keeps the pad longer). Correction to the old notes: a loan on
the hog is a no-op, not "worse": the hog already outranks the holder.

Everything on screen is `Engine.replay(level, plan)`. The demo, the board and Dev mode share it.

## 2. Pieces (final)

The proposed list had 10. Final is 12 pieces after two cuts and three additions.

```
Dollop   chubby clay critter in a cart: 6 skins x 6 head silhouettes, googly eyes
Pad      round clay platform + lamp                      (the mutex)
Rail     steel rails on sleepers between pads            (routes)
Hut      the cart's goal; flag, optional clock           (terminus)
Yarn     rope: pink dashed = about to wait, red = waiting, taut = frozen
Chock    striped doorstop + pie timer                    (Hold)
Ticket   gold ticket + 6-dot lease                       (Loan)
Sun      eyes follow the cart that runs                  (scheduler, inversion only)
Candle   shrinks toward the deadline                     (only tight boards)
Pennant  1-3 gold stars on the cart                      (priority, inversion only)
Hand     clay hand that points and drags                 (the demo's only teacher)
Film     frame strip with sprocket holes, token marks (timeline + window)
```

![Rules to pieces](diagrams/pieces.svg)

*Each rule is carried by exactly one piece.*

- **Cut: Signal flag.** The yarn already says "waiting"; a flag duplicated it.
- **Cut: Junction as a rule.** A junction is just a pad with more rails. Drawn, not modelled.
- **Merged: hog.** Not a piece: a Dollop with half-closed eyes circling its own loop.
- **Added: Sun, Hand, Film.** The scheduler discipline was a sentence ("PRIORITY PREEMPTIVE");
  it is now a character. The film turns a scrubber plus plan list into one object.

Art: one SVG filter (wobbly edge + diffuse and specular lighting from a blurred height map +
fine grain), a thumbprint pattern and a darker seam stroke on every lump. Not Aardman's cast:
Dollops, huts and pads are ours.

## 3. Animation set (12 fps, "on twos")

| Clip | Where it plays |
| --- | --- |
| idle | breathing squash, blink, wandering eyes |
| go | anticipate (squash back, lean) then launch then damped settle |
| roll | wheels, small hops, lean into travel |
| wait / bump | stall against a held pad, eyes lock on the holder, sweat drop |
| freeze | deadlock: shiver, steam puffs, eyes swivel round the ring, cold tint, yarn tightens |
| dance | livelock: sidestep, bow, sweat |
| held | chock lands (drop + bounce), cart goes sleepy `z` |
| vip | glow, sparkles, ticket floats over the head; ticket arcs from waiter to holder |
| smug | hog: half-lids, smirk, circling |
| huh | wrong target: head tilt, `?` |
| win | hops, grin, hut flag and confetti |
| unwind | ring unzips as holders release and the next cart is woken into the pad |

All motion is snapped to 12 fps and each frame gets a deterministic 0.7 px "boil" jitter.
`pieces.html` has a switch to compare with smooth 60 fps.

## 4. Growth, cap and measured cost

![Growth ladder](diagrams/ladder.svg)

*The 15 rungs grow sections, carts and par; rung 15 sits at the cap.*

`levelFor(seed, rung)` is pure: seed + rung gives the same board and the same plan everywhere.
Rungs add pads, "tails" (carts hanging off a ring), driveways (longer routes), whole districts,
priority tiers and hogs. A rung's tray is shrunk to the certified plan's tokens.

![Certify and ship](diagrams/certify-cost.svg)

*Every candidate is certified; any rule failure resamples it.*

Shipping rules (same as the old certifier, now enforced): a plan exists; `1 <= par <= budget`;
default run ends in deadlock, livelock or a named inversion; window `>= 2` ticks (checked by
certifying again from the default state at tick 1); no "hold everyone" plan.
Rings now have a roll-in prelude, because with all locks at tick 0 the window was 1 tick and
the old "window >= 2" rule would have rejected every ring.

**Measured** (Node 26, one core, `scripts/certify.mjs` and `scripts/cap.mjs`):

| Board | Pads / carts | Par | States explored | Time |
| --- | --- | --- | --- | --- |
| rung 1 ring | 3 / 3 | 1 | 199 | 3 ms |
| rung 6 two pairs | 4 / 4 | 2 | 2,817 | 12 ms |
| rung 10 twin rings | 6 / 6 | 2 | 6,534 | 40 ms |
| rung 15 full yard (cap) | 10 / 6 | 2 | 7,040 | 47 ms |
| probe: ring of 8 | 8 / 8 | 1 | 632 | 4 ms |
| probe: ring 5 + driveways + ring 3 | 13 / 8 | 2 | 11,113 | 42 ms |
| probe: three rings | 9 / 9 | 3 | 193,244 | 677 ms |
| probe: three rings + pair | 11 / 11 | 4 | >400,000 | state cap, 4 s |

Two things to take from it. **Board size barely matters; par does**: cost grows about 20x per
extra independent intervention (the time placements multiply). So the cap is
**<= 10 sections, <= 6 carts, par <= 2**, which certifies in <= 47 ms in Node (all 15 rungs x 3
seeds tested), and the Dev panel measured 7-12 ms in the worker in headless Chrome. Par 3 is
possible (0.7 s) but not shipped. Pruning that made this work: timer-relative, tick-free state
keys; `(hold, loan, tick)` dominance; branching only on meaningful interventions (hold: cart not
done/blocked/held; loan: only a holder that a higher-priority cart waits on). The in-browser
certify runs in a Web Worker built from the same engine source, with a main-thread fallback.
A compositional split for independent districts would make par 4+ cheap; not needed yet.

Engine has no DOM, no `Math.random`, no clock. Tests: determinism, ring/inversion/livelock
semantics, minimality, monotone growth to the cap, state invariants, all rungs x 3 seeds.

## 5. Modes

**Player**: pictures only. Screen-reader text lives in a hidden live region. The demo is a
hand that never speaks: ring freezes, rewind, chock drops, ring unzips; then an inversion where
the hand first drops the ticket on the waiter (refused with a `?`), then on the holder. Its
target comes from `Engine.analyse`, and every drop goes through `Engine.replay`.

**Dev**: same scene plus an overlay and a panel, all read from the frame on screen: wait-for
graph with `NP` marks, `ME` on held pads, `H&W` on carts that hold and wait, the cycle ringed in
red; four Coffman lamps (circular wait goes amber while the loop is still open, red when
closed); tapes with the program counter, thread/mutex table, effective priority and lease,
state key, discipline, states explored, par, window, traps, certify time, the winning plan (one
click to play it), seed field, rung picker and a share link (`#s=SEED&r=RUNG&dev=1`).

## 6. Cut from the old design, and why

- Tape chips as the primary display: now only in Dev.
- Coffman checklist as text: now four lamps, plus marks on the diagram.
- Budget and disciplines as words: the tray's tokens, and the sun.
- Certifier prose and the ledger: replaced by the film strip's warm "window" frames.
- Six hand-built boards: replaced by one ladder (all six are on it).
- Fixed `+3` priority loan: full inheritance from the best waiter.
- Wake on `done`: the old priority discipline could strand a waiter; fixed.

## 7. Open items

- Dense rungs (13-15) are crowded: driveway pads should go inside the ring.
- Cart facing: carts lean but do not turn along diagonal rails.
- Frame cost: filters are re-rastered each 12 fps frame; fine on a laptop, unmeasured on phones.
- Seeds beyond the ladder (`rung > 15`) are not offered yet.
