# Night Shift

You are the charge nurse of Harbourside General's emergency department, 19:00 to 07:00.
You never treat anyone. You decide who gets which bed, who goes first, what is held
back, who is called in from home, and when two patients swap places.

The hospital is the game. The concurrency lessons are a side effect of running it:
a care step starts only when **everything it needs is free at the same moment**, and a
patient **keeps the place they are in until the next place is theirs**. Those two rules
are atomic acquisition and hold-and-wait, and they are why real hospitals jam.

Run `node build.mjs`, then open `dist/index.html` (no server needed). The landing page links to the game (`dist/play.html`) and the handbook (`dist/handbook.html`). In the game, `?seed=ANYTHING` gives a different night and `?start=shift` skips the start screen. `dist/` is not committed; the host builds it. Launch and hosting plan: `docs/LAUNCH.md`.

```
node build.mjs            # src/ -> dist/ (site, game, handbook, icons, metadata) and docs/CASEBOOK.md
node scripts/brand.mjs    # redraw icons, social card and web images into src/brand (needs Chrome and cwebp)
node --test test/         # engine tests
node scripts/night.mjs [seed] [--smart] [--log]   # headless night, naive or competent bot
```

## Components

![How the pieces talk to each other](diagrams/components.svg)

*The engine is plain ES modules with no DOM. The screen only draws state and forwards clicks.*

| Piece | File | What it owns |
| --- | --- | --- |
| Hospital | `src/engine/hospital.mjs` | Every allocatable unit: 21 ED beds (resus, acute, fast track, behavioural, hallway), CT, X-ray, ultrasound, cath lab, 2 ORs, 12 ICU beds, 16 ward beds, named doctors, nurses, RT, porters, in-house specialists, on-call teams with travel times, blood fridge. |
| Case book | `src/engine/casebook.mjs` | 18 conditions. Each has triage note, history, exam, ECG, vitals when well and at collapse, labs with reference ranges and turnaround, a care pathway of steps with needs, real time targets, and outcomes. |
| Patient | `src/engine/patient.mjs` | Identity, chart notes, results, and a physiology model: `sev` runs 0 (well) to 1 (cardiac arrest). Vital signs are read off `sev`, so the monitor and the simulation never disagree. |
| NEWS2 | `src/engine/news2.mjs` | The Royal College of Physicians early warning score, used for deterioration alerts. |
| Scenario | `src/engine/scenario.mjs` | Scripted set pieces (STEMI at 19:14, stroke behind a kidney stone in the CT queue, 03:00 bus crash) plus seeded random arrivals, and the few inpatient beds that free up overnight. |
| Simulation | `src/engine/sim.mjs` | The minute tick: arrivals, physiology, labs, step progress, queueing, cardiac arrest and code team, alerts, gridlock detection, and every charge-nurse action. |
| Screen | `src/ui/app.js` | PULSE ED: track board, report pane (overview, live monitor, chart and notes, results), central monitor, beds and resources, staff, alerts, end-of-shift review. Desk props: EMS radio, clock and speed, pager, phone. |
| Monitor | `src/ui/monitor.js` | Synthesized ECG (sinus, ST elevation, atrial fibrillation, VF), pleth and respiration traces from the patient's real numbers. |
| Backdrop | `src/ui/backdrop.js` | One photograph of the department (`src/assets/er-floor.jpg`) in layers, with a heavy blur and a clinical grade. The people who walk past are cut out of the same photograph, so they share its colour and light. Stretchers roll in when an ambulance arrives; a Code Blue tints the room. Static on phones and under reduced motion. |
| Site | `src/site/landing.html`, `src/brand/` | The landing page, the brand mark, icons, social card and web images. `build.mjs` adds the meta tags, structured data, manifest, robots, sitemap and `llms.txt`. |
| Guide text | `src/ui/guide-text.js` | One entry per control: where it is, what it means, what to do. Guide Mode, Orientation and the Handbook's "Every control" page all read from it, so they cannot disagree. |
| Guide Mode | `src/ui/guide.js` | Stops the clock. Hover or focus explains any element. On touch, a tap opens a sheet instead of acting, with a button to use the control anyway. |
| Orientation | `src/ui/tutorial.js` | 62 steps in 7 chapters on a separate practice night. Saves the chapter you reached. A shift in progress is set aside and handed back. |
| Handbook | `src/ui/handbook.js`, `docs/HANDBOOK.md` | The manual, compiled at build time with the case book and the control list. Searchable in the game. The build fails if a control links to a missing section. |

## How a patient moves

1. **Arrive.** Ambulances are announced a few minutes ahead (Expected rows, EMS radio). Walk-ins are triaged to the waiting room.
2. **Place.** You assign a bed. Only suitable bed types are offered. Bloods are drawn once the patient is in a bed.
3. **Treat.** Each pathway step claims all its needs at once (for example CT + porter, or OR + surgeon + anesthesiologist + nurse). Staff and scanners are returned when the step ends. The bed is kept.
4. **Move on.** Cath lab, OR, ICU, ward or home. A patient in the OR who needs an ICU bed keeps the OR until the ICU bed exists.

Severity rises every minute a sick patient is untreated. At 1.0 the patient arrests: a code team is pulled from the least urgent patient (their step is interrupted), and survival depends on the cause and how fast the team arrived.

## Your moves

| Move | Effect | Engineer's word |
| --- | --- | --- |
| Assign bed / Move / Board in hallway | Where the patient is. Hallway care is slower and riskier. | allocation |
| Expedite | First in every queue. Default order is first come, first served. | priority |
| Hold | The patient stops claiming the next step. | back off |
| Reserve | A bed, scanner or theatre is kept for one patient, now or when it frees up. | reservation |
| Call in | On-call team arrives after its travel time. | provisioning lead time |
| Phone | ICU step-down (needs a free ward bed), early ward discharge, blood. | back-pressure relief |
| Bed huddle | Swaps patients who each hold what the other needs, in one move. | atomic swap that breaks a deadlock |
| Ambulance diversion | No ambulances for an hour. Walk-ins still come. | load shedding |

The Engineer Lens button shows these words on alerts. They never appear otherwise.

## Balance today

`node scripts/night.mjs` on three seeds: a player who only assigns beds loses 9 to 13
patients. A simple bot that also calls teams in, phones for beds, expedites and
huddles loses 2 to 6. Reserving ahead and holding the right patient is what closes the gap.

## Learning the game

| If you want to | Use |
|---|---|
| Be walked through it | Orientation, from the start screen or the toolbar |
| Find out what one thing means | Guide Mode (G), then point at it |
| Look something up | Handbook (H) |

![A patient's route through the department](diagrams/journey.svg)

*A patient keeps their bed through every care step, until the next place is free.*

## Screen sizes

The screen is a size container, so columns drop by the width of the screen and not the window. Under 1120 px Age and Lab go, under 960 px MD and Dispo go, and Status wraps instead of being cut off. Below 1200 px wide the bezel thins, below 1000 px the monitor fills the view, and below 720 px wide or 520 px tall the board becomes cards with a bottom navigation and the report becomes a full-screen sheet. Where a small screen hides something Orientation points at, the step says so.

## Honest limits

- Clinical content is written from general emergency-medicine knowledge to be plausible and consistent. No clinician has reviewed it. It is game content, not guidance.
- Times are compressed (observation periods, surgery lengths).
- Staff are step resources. Nurse-to-patient ratios, breaks and fatigue are not modelled yet.
- One pathway per condition. No diagnostic mimics yet (aortic dissection dressed as STEMI), no bed cleaning, no families.
- No sound. No save for a shift in progress. The backdrop is one still photograph with people moving across it, so the camera never changes position.
