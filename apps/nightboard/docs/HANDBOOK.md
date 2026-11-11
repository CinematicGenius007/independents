# Quick start {#start}

You are the **charge nurse** of an emergency department, from 19:00 to 07:00. You do not treat anyone. You decide who gets which bed, who goes first, what gets held back, and who is called in from home.

## The 60-second version

1. **Look at the board.** Each row is a patient. Red and amber rows need you.
2. **Press a row.** Their report opens underneath.
3. **Read the care pathway.** A red chip is what they are waiting for.
4. **Press a Charge Action.** Assign a bed, call a team, reserve a scanner.
5. **Press 1x** and let time pass. Pause whenever you need to think. There is no penalty.

## Three ways to learn

| If you want to | Do this |
| --- | --- |
| Be walked through it | Start **Orientation** from the start screen, or the toolbar. About 8 minutes, on a practice night. |
| Find out what one thing means | Press **G** for Guide Mode, then point at it. |
| Look something up | You are in the right place. Use the search box. |

> Your real shift is safe. Orientation runs on a separate practice night, and your shift comes back when it ends.

# Your goal and your grade {#grade}

At 07:00 you get a **Morbidity and Mortality review**: the list of who did badly, and why. Real hospitals hold these meetings too.

| Grade | What it takes |
| --- | --- |
| A | Nobody died, and 2 or fewer patients were harmed by delay |
| B | At most 1 death and 5 harmed |
| C | At most 3 deaths |
| D | More than 3 deaths |

A patient counts as **harmed** if they had a cardiac arrest, missed a time target, or got dangerously close to collapse.

The other numbers in the tally:

- **Well:** patients who did fine.
- **Targets:** medical deadlines met, such as door to balloon for a heart attack.
- **LWBS:** left without being seen. People give up if they wait too long.

The review also lists ambulances you diverted.

# The two rules {#rules}

Everything in the game comes from two rules. They are also true of real hospitals.

**Rule 1. A care step needs everything at once.** A CT scan needs the scanner and a porter. Surgery needs the theatre, the surgeon, the anaesthetist and a nurse. If one is missing, the step does not start, and nobody else's work moves forward because of it.

**Rule 2. A patient keeps their place until the next place is ready.** You cannot put a patient down in a corridor because the ICU is full. They stay in the bed they are in. So a full ICU fills the theatre, which fills your beds, which fills the waiting room.

![A patient holds a bed through every step, and only leaves when the next place is free.](journey.svg)

## How a patient moves through the night

1. **Arrive.** Ambulances radio ahead and appear as Expected. Walk-ins go to the waiting room.
2. **Bed.** You assign one. Only safe bed types are offered. Blood tests start once they are in a bed.
3. **Care steps.** Each step claims what it needs, runs, and releases the staff and equipment. The bed is kept.
4. **Leave.** Home, ward, ICU, cath lab or theatre.

## Getting sicker

Every patient has a hidden severity that rises each minute they go untreated. The vital signs are read straight from it, so the monitor never lies. At the top of the scale the patient goes into cardiac arrest.

A Code Blue pulls one doctor and one nurse from the least urgent patient, interrupting whatever they were doing. If nobody can get there within 10 minutes, the patient dies. Each minute of delay lowers the chance of survival.

Being in a hallway bed makes every step 30% slower, and patients get worse 20% faster.

# Reading the screen {#screen}

From top to bottom:

| Part | What it tells you |
| --- | --- |
| Blue title bar | The software and the time. |
| Toolbar | Call In Staff, Phone, Ambulance Diversion, Guide Mode, Orientation, Handbook, Engineer Lens, Alerts. |
| Banner | The single most urgent alert. Appears only when there is one. |
| Tabs | Filters for the board on the left, full-screen views on the right. |
| Capacity strip | How full each part of the hospital is, then tonight's score. |
| Track board | One row per patient. |
| Report | The patient you selected. |

## The capacity strip

| Label | Meaning |
| --- | --- |
| ED beds | Emergency beds in use, out of 21, hallway included. |
| Waiting | People with no bed. |
| Boarding | Finished here, but stuck in your bed waiting for one upstairs. |
| ICU | Intensive care beds, out of 12. |
| Ward | Ordinary beds, out of 16. |
| OR | Operating rooms, out of 2. |
| CT | The one scanner, and how many are queued. |
| Blood | Units of red cells in the fridge. |

# The board and other views {#reading}

## Track board columns

| Column | Meaning |
| --- | --- |
| Colour | Green treating. Amber waiting for something. Red danger or jam. Blue boarding. Grey nothing needed. |
| Bed | EXP expected, WR waiting room, EMS ambulance stretcher, or a bed code: R resus, T trauma, A acute, FT fast track, BH behavioural, H hallway. |
| Acu | ESI triage level, 1 (dying) to 5 (minor). |
| Patient | Name and sex. A red triangle means you expedited them. |
| Age | In years. |
| Complaint | Why they came, in triage's words. |
| LOS | Length of stay so far. |
| MD | Who has seen them. Red "none" means no doctor yet. |
| NEWS | Early warning score. See Vitals and NEWS2. |
| Lab | [back / ordered / abnormal] |
| Dispo | Where they are going: Home, Ward, ICU, Psych. |
| Status | What is happening right now. The most useful column. |

On a phone the board becomes a list of cards with the same information.

## ESI, the triage level

| ESI | Means | Example |
| --- | --- | --- |
| 1 | Dying without immediate action | Heart attack, major trauma |
| 2 | High risk, should not wait | Stroke, sepsis |
| 3 | Sick but stable | Abdominal pain, needs tests |
| 4 | Minor, one simple resource | Wrist injury |
| 5 | Very minor | Small cut |

> Triage can be wrong. A young woman with "abdominal pain" might be bleeding inside. Watch the NEWS score, not just the ESI.

## Full-screen views

**Central Monitor** shows live traces for every patient on a monitor. A flashing red tile is an alarm.

**Beds & Resources** shows every bed, scanner and theatre as a tile.

| Tile | Means |
| --- | --- |
| Green | Free |
| Yellow | In use, progressing |
| Blue | Reserved |
| Grey | Hospital inpatient you do not control |
| Red | The patient is stuck here, waiting for something else |

**Staff** shows who is on shift and who they are with, and the on-call teams at home.

**Alerts** lists everything tonight, newest first.

# The patient report {#report}

**Overview** is where you will spend your time.

- **Chief Complaint:** the triage note.
- **Vitals:** current numbers. Red is out of range.
- **Care Pathway:** the steps in order. A tick is done, a dot is current.
- **Chips under a step:** what it needs. Green is ready. **Red is what is missing.**
- **Time targets:** medical deadlines in minutes from arrival.
- **BestPractice Advisory:** in plain words, what is blocking this patient and who has it.
- **Charge Actions:** what you can do. The list changes with the situation.

**Live Monitor** is the bedside monitor, with the NEWS2 score broken down.

**Chart and Notes** has the history, medicines, allergies, exam and a timeline.

**Results** has blood tests and imaging reports. Bloods are drawn only once the patient has a bed.

# Vitals and NEWS2 {#vitals}

| Sign | What it is | Normal | Worry when |
| --- | --- | --- | --- |
| HR | Heart beats per minute | 60 to 100 | Over 110, under 50 |
| BP | Blood pressure, top over bottom | Around 120/80 | Top number 90 or lower |
| RR | Breaths per minute | 12 to 20 | Over 24, under 9 |
| SpO2 | Oxygen in the blood | 95% or more | Below 92% |
| Temp | Body temperature | 36.1 to 38 °C | Over 38.5, under 35.1 |
| GCS | Consciousness, 3 to 15 | 15 | Anything below 15 |

**NEWS2** (National Early Warning Score) is a real tool from the UK's Royal College of Physicians. Each vital sign scores 0 to 3 and they are added together.

| NEWS2 | Means |
| --- | --- |
| 0 to 4 | Low risk |
| 5 or 6 | Medium: urgent review |
| 7 or more | High: emergency response |

The game raises an alert at 7 or more, and a warning when someone in the waiting room reaches 5.

## The bedside monitor

- **Green trace:** the heart's electrical activity (ECG). Chaos with no pattern is ventricular fibrillation, a cardiac arrest.
- **Blue trace:** the pulse at the finger (pleth).
- **Yellow trace:** breathing.

Only resus, trauma and acute beds have continuous monitoring. Patients in fast track, the hallway or the waiting room only get spot checks, so trouble there is seen late.

# Every move you can make {#moves}

| Move | What it does | Use it when |
| --- | --- | --- |
| **Assign bed** | Puts a waiting patient in a bed. | Sickest first, in the best bed they need. |
| **Reserve a bed** | Holds a bed for an ambulance on the way. | The moment a critical ambulance radios in. |
| **Reserve equipment** | Keeps a scanner, cath lab or theatre for one patient. | The next step of a very sick patient. |
| **Call in** | Brings a team from home. Cath 25 min, surgery 30, anaesthesia 25, GI 30, OB 20, psychiatry 40, extra nurse 30. | Before the patient arrives. |
| **Expedite** | First in every queue. | A stroke stuck behind a kidney stone. Use it sparingly. |
| **Hold** | The patient stops claiming their next step. | To leave scarce staff for someone sicker. |
| **Move** | Changes bed. Not during a procedure. | Move a stable patient to the hallway to free a monitored bed. |
| **Bed huddle** | Swaps patients who each hold what the other needs. | Whenever you see GRIDLOCK. |
| **Phone ICU** | Moves a stable ICU patient to a ward. Needs a free ward bed. ICU bed in 20 min. 7 a night. | ICU filling up. |
| **Phone bed management** | Sends a ward patient home early. Ward bed in 30 min. 8 a night. | Ward filling up. |
| **Phone blood bank** | 6 units of red cells in 15 min. | Before the fridge runs out. |
| **Ambulance diversion** | No ambulances for 60 min. Walk-ins still come. Ready again after 3 hours. | Last resort. |

# Alerts {#alerts}

| Colour | Means | Examples |
| --- | --- | --- |
| Red, critical | Needs you now | Code Blue, major pre-alert, NEWS 7 or more, gridlock, a death |
| Amber, warning | Going wrong | ESI 1 or 2 with no bed for 8 minutes, waiting-room NEWS of 5 or more, critical lab, time target at risk, patient passed over repeatedly, blood at 2 units or fewer |
| Blue, information | Good to know | Staff arrived, bed free, blood delivered, patient revived |

**Acknowledge** only says you have seen it. It fixes nothing.

The **"Passed over"** alert is the one people miss. It means a patient has been skipped three or more times and has waited 40 minutes or more. They are stuck at the back of a queue that keeps being overtaken.

# The desk {#desk}

| Item | What it does |
| --- | --- |
| EMS radio | Ambulances on the way. Press a line to open that patient. |
| Clock and speed | Pause, 1x, 3x, 8x. At 1x, one game minute is one real second. |
| Pager | The latest alert as a text. |
| Desk phone | ICU charge nurse, bed management, blood bank. The numbers are calls left tonight. |

## Keyboard

| Key | Does |
| --- | --- |
| Space | Pause or 1x |
| 0, 1, 3, 8 | Set speed |
| G | Guide Mode on or off |
| ? or H | Open this handbook |
| H in Guide Mode | Open the handbook on the thing you are pointing at |
| Esc | Close whatever is open |
| Left and right arrows | Back and next in Orientation |

# When it jams {#jams}

Hospitals rarely fail because one thing is overloaded. They fail because everything is waiting on something else.

## Gridlock

![Each patient holds what the other one needs, so neither can move first.](jam.svg)

The status column will say **GRIDLOCK**. Open either patient and press **Bed huddle**. It swaps them in one move, which is the only way out.

## Exit block

ICU is full, so the theatre patient cannot leave, so the theatre is full, so the next surgical patient stays in your bed.

**Fix:** phone the ICU or bed management early. Their beds take 20 to 30 minutes to free.

## Stuck in the queue

The queue is first come, first served. A stroke arriving just after a kidney stone waits behind it for the scanner.

**Fix:** expedite the stroke, or reserve the CT.

## Passed over

The priority patients keep overtaking someone who has now waited an hour.

**Fix:** expedite them, or hold someone less sick for one step.

## The team that is not there

A step needs someone at home. Nothing will happen until they arrive.

**Fix:** call them when the radio goes, not when the patient arrives.

# What the night looks like {#night}

> Spoilers. This is how the default night runs. Other seeds change the walk-ins, and the big events stay the same.

| Time | What arrives |
| --- | --- |
| 19:00 | A quiet hour of minor injuries. Clear the board. |
| 19:14 | Heart attack by ambulance. |
| 19:52 | A kidney stone, then a stroke six minutes later. Both will want the CT. |
| 20:35 | Severe allergic reaction, walks in. |
| 21:08 | Major trauma. |
| 21:30 | Sepsis. |
| 22:05 | Ectopic pregnancy, under-triaged. |
| 22:35 | Gastrointestinal bleed. Blood use starts. |
| 23:22 | Overdose. |
| 00:00 | Heart failure. |
| 00:30 | Psychiatric emergency. |
| 00:52 | Appendicitis. |
| 01:35 | An ICU patient re-bleeds and needs the OR. Expect gridlock. |
| 01:42 | Second trauma. |
| 02:35 | Second heart attack. |
| 02:50 | Diabetic emergency. |
| 03:00 | Bus crash. Several at once. |
| 04:20 | Second stroke. |
| 05:00 | Second sepsis. |
| 05:40 | Heart failure. |
| 06:15 | Overdose. |

# Glossary {#glossary}

| Word | Plain English |
| --- | --- |
| Acuity | How sick someone is. |
| Admit | Keep in hospital. |
| Allergies, NKDA | No known drug allergies. |
| Anaesthetist | Doctor who puts patients to sleep for surgery. |
| Arrest | The heart has stopped pumping. |
| AVPU | Quick check of alertness: alert, voice, pain, unresponsive. |
| Boarding | Finished in the ED, but stuck waiting for a bed upstairs. |
| Cath lab | Room where blocked heart arteries are opened. |
| Charge nurse | The nurse who runs the floor for the shift. |
| Code Blue | Hospital-wide call for a cardiac arrest. |
| CT | A scan that images the inside of the body. |
| Dispo | Disposition: where the patient goes next. |
| Door to balloon | Time from arrival to opening a blocked heart artery. |
| ECG | Heart tracing. |
| ED | Emergency department. |
| EMS | Ambulance service. |
| ESI | Emergency Severity Index, the triage level. |
| Fast track | Area for minor injuries. |
| GCS | Glasgow Coma Scale: how awake someone is, 3 to 15. |
| HPI | History of the present illness: the story so far. |
| ICU | Intensive care unit. |
| LOS | Length of stay. |
| LWBS | Left without being seen. |
| MAP | Average blood pressure. |
| MD | A doctor. |
| MRN | Medical record number. |
| NEWS2 | National Early Warning Score. |
| NIBP | Blood pressure from an arm cuff. |
| OR | Operating room. |
| PA-C | Physician assistant. |
| PCI | Procedure to open a blocked heart artery. |
| Pleth | Pulse wave from a finger sensor. |
| Porter | Person who moves patients around the hospital. |
| Resus | Resuscitation room, for the sickest patients. |
| ROSC | The heart has started again after an arrest. |
| RT | Respiratory therapist. |
| Sepsis | Life-threatening response to infection. |
| SpO2 | Oxygen level in the blood. |
| STEMI | A major heart attack. |
| Triage | Sorting patients by how urgent they are. |

# The Engineer Lens {#lens}

Nightboard began as a way to teach concurrency, which is how computers share things between competing tasks. A hospital turns out to have exactly the same problems, with higher stakes.

Turn on **Engineer Lens** to see the computing word on each alert. It changes nothing in the hospital.

| In the hospital | In a computer |
| --- | --- |
| A step needs everything at once | Atomic acquisition |
| Keeping your bed until the next is ready | Hold-and-wait |
| Gridlock | Deadlock |
| Bed huddle | Atomic swap |
| Passed over | Starvation |
| Stroke behind a kidney stone | Priority inversion |
| Code team pulled from another patient | Preemption |
| Time targets | Deadlines |
| Reserve | Reservation |
| Call in | Provisioning lead time |
| Ambulance diversion | Load shedding |
| Hold | Back off |

# Honest limits {#limits}

- The medical content is written from general emergency medicine knowledge to be plausible and consistent. **No clinician has reviewed it. It is game content, not medical guidance.**
- Times are compressed. Real surgery and observation take longer.
- Staff are claimed step by step. Nurse-to-patient ratios, breaks and fatigue are not modelled.
- Each condition has one pathway, and the diagnosis is known. Real medicine is much less certain.
- No bed cleaning, no families, and no sound. Progress is not saved between visits.
- The background is a generated image of an emergency department with animated figures on top.
