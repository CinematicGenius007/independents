# Night Shift

You are the charge nurse of Harbourside General's emergency department, 19:00 to 07:00.
You never treat anyone. You decide who gets which bed, who goes first, what is held
back, who is called in from home, and when two patients swap places.

The hospital is the game. The concurrency lessons are a side effect of running it:
a care step starts only when **everything it needs is free at the same moment**, and a
patient **keeps the place they are in until the next place is theirs**. Those two rules
are atomic acquisition and hold-and-wait, and they are why real hospitals jam.

Open `index.html` (no server). `?seed=ANYTHING` gives a different night.

```
node build.mjs            # src/ -> index.html
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
| Backdrop | `src/ui/backdrop.js` | The blurred department behind the screen. Stretchers roll in when an ambulance arrives; staff run on a Code Blue. |

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

## Honest limits

- Clinical content is written from general emergency-medicine knowledge to be plausible and consistent. No clinician has reviewed it. It is game content, not guidance.
- Times are compressed (observation periods, surgery lengths).
- Staff are step resources. Nurse-to-patient ratios, breaks and fatigue are not modelled yet.
- One pathway per condition. No diagnostic mimics yet (aortic dissection dressed as STEMI), no bed cleaning, no families.
- No sound. No save. The backdrop is drawn, not filmed.
