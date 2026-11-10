/* Harbourside General: everything the charge nurse can allocate.
 * A "unit" is one indivisible thing: one bed, one scanner, one person.
 * A patient's care step needs a set of units all at once. */

/** kind -> how it behaves and how it is shown. */
export const KINDS = {
  // where a patient physically is inside the ED
  resus: { label: 'Resus / trauma bay', group: 'ED beds', place: true, ed: true, monitored: true },
  acute: { label: 'Acute bed', group: 'ED beds', place: true, ed: true, monitored: true },
  fast: { label: 'Fast track chair', group: 'ED beds', place: true, ed: true },
  bh: { label: 'Behavioural health room', group: 'ED beds', place: true, ed: true },
  hall: { label: 'Hallway stretcher', group: 'ED beds', place: true, ed: true },
  // where a patient goes when leaving the ED (they keep it until the next place is free)
  cath: { label: 'Cath lab', group: 'House', place: true, monitored: true },
  or: { label: 'Operating room', group: 'House', place: true, monitored: true },
  icu: { label: 'ICU bed', group: 'House', place: true, inpatient: true },
  ward: { label: 'Ward bed', group: 'House', place: true, inpatient: true },
  psych: { label: 'Psychiatric bed', group: 'House', place: true, inpatient: true },
  // visited for one step, then given back
  ct: { label: 'CT scanner', group: 'Imaging' },
  xr: { label: 'X-ray', group: 'Imaging' },
  us: { label: 'Ultrasound', group: 'Imaging' },
  // people
  md: { label: 'ED physician', group: 'Staff', staff: true },
  pa: { label: 'Physician assistant', group: 'Staff', staff: true },
  rn: { label: 'ED nurse', group: 'Staff', staff: true },
  rt: { label: 'Respiratory therapist', group: 'Staff', staff: true },
  porter: { label: 'Porter', group: 'Staff', staff: true },
  surg: { label: 'Trauma surgeon', group: 'Specialists', staff: true },
  anes: { label: 'Anesthesiologist', group: 'Specialists', staff: true },
  cards: { label: 'Interventional cardiology', group: 'Specialists', staff: true },
  neuro: { label: 'Neurology', group: 'Specialists', staff: true },
  ob: { label: 'Obstetrics / gynecology', group: 'Specialists', staff: true },
  gi: { label: 'Gastroenterology', group: 'Specialists', staff: true },
  psy: { label: 'Psychiatry', group: 'Specialists', staff: true },
};

const U = (id, kind, name, x = {}) => ({ id, kind, name, holder: null, reservedFor: null, ...x });
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

/** On-call teams the charge nurse can call in: who, and minutes until they are in house. */
export const ON_CALL = {
  cards: { label: 'Cath team (interventional cardiology)', eta: 25, unit: () => U('cards1', 'cards', 'Dr. Amara Nwosu', { role: 'Interventional cardiologist, on call' }) },
  ob: { label: 'Obstetrics / gynecology', eta: 20, unit: () => U('ob1', 'ob', 'Dr. Leila Haddad', { role: 'OB-GYN, on call' }) },
  gi: { label: 'Gastroenterology (endoscopy)', eta: 30, unit: () => U('gi1', 'gi', 'Dr. Tomasz Zielinski', { role: 'Gastroenterologist, on call' }) },
  psy: { label: 'Psychiatry', eta: 40, unit: () => U('psy1', 'psy', 'Dr. Ruth Abebe', { role: 'Psychiatrist, on call' }) },
  rn: { label: 'Extra ED nurse (float pool)', eta: 30, unit: () => U('rn7', 'rn', 'Devi Raman RN', { role: 'Float pool nurse' }) },
  anes: { label: 'Second anesthesiologist', eta: 25, unit: () => U('anes2', 'anes', 'Dr. Mei-Ling Zhou', { role: 'Anesthesiologist, backup call' }) },
  surg: { label: 'Second trauma surgeon', eta: 30, unit: () => U('surg2', 'surg', 'Dr. Kofi Mensah', { role: 'Trauma surgeon, backup call' }) },
};

/** Fresh list of units for the start of a shift. holder 'bg' = an inpatient who was already
 * there before the shift (background occupancy). */
export function buildUnits() {
  const units = [
    U('R1', 'resus', 'Resus 1'), U('R2', 'resus', 'Resus 2'), U('T1', 'resus', 'Trauma 1'), U('T2', 'resus', 'Trauma 2'),
    ...many(8, (i) => U(`A${i}`, 'acute', `Acute ${i}`)),
    ...many(3, (i) => U(`FT${i}`, 'fast', `Fast track ${i}`)),
    U('BH1', 'bh', 'BH room 1'), U('BH2', 'bh', 'BH room 2'),
    ...many(4, (i) => U(`H${i}`, 'hall', `Hallway ${i}`)),
    U('CT1', 'ct', 'CT 1'),
    U('XR1', 'xr', 'Portable X-ray'), U('US1', 'us', 'Ultrasound'),
    U('CATH', 'cath', 'Cath lab'),
    U('OR1', 'or', 'OR 1'), U('OR2', 'or', 'OR 2'),
    ...many(12, (i) => U(`ICU${i}`, 'icu', `ICU ${i}`, { holder: i > 10 ? null : 'bg' })),
    ...many(16, (i) => U(`W${i}`, 'ward', `Ward 5-${i}`, { holder: i > 11 ? null : 'bg' })),
    U('PSY1', 'psych', 'Psych unit bed', { holder: 'bg' }),
    U('md1', 'md', 'Dr. Mateo Reyes', { role: 'Attending physician' }),
    U('md2', 'md', 'Dr. Priya Singh', { role: 'Attending physician' }),
    U('md3', 'md', 'Dr. Daniel Cho', { role: 'Senior resident (PGY-3)' }),
    U('pa1', 'pa', 'Whitney Park PA-C', { role: 'Physician assistant, fast track' }),
    U('rn1', 'rn', 'Sunita Patel RN', { role: 'Resus nurse' }),
    U('rn2', 'rn', 'Min-jun Kim RN', { role: 'Resus nurse' }),
    U('rn3', 'rn', 'Carmen Diaz RN', { role: 'Acute nurse' }),
    U('rn4', 'rn', 'Emeka Okafor RN', { role: 'Acute nurse' }),
    U('rn5', 'rn', 'Hannah Lee RN', { role: 'Fast track nurse' }),
    U('rn6', 'rn', 'Tariq Aziz RN', { role: 'Triage / float nurse' }),
    U('rt1', 'rt', 'Joanne Bell RRT', { role: 'Respiratory therapist' }),
    U('po1', 'porter', 'Luis (porter)', { role: 'Patient transport' }),
    U('po2', 'porter', 'Agnes (porter)', { role: 'Patient transport' }),
    U('surg1', 'surg', 'Dr. Elena Markovic', { role: 'Trauma surgeon, in house' }),
    U('anes1', 'anes', 'Dr. Samuel Otieno', { role: 'Anesthesiologist, in house' }),
    U('neuro1', 'neuro', 'Dr. Ingrid Solberg', { role: 'Stroke neurologist (telestroke)' }),
  ];
  return Object.fromEntries(units.map((u) => [u.id, u]));
}

export const START_STOCK = { prbc: 10 };          // units of O-negative / crossmatched red cells in the ED fridge
export const SHIFT_START = 19 * 60;               // 19:00
export const SHIFT_MINUTES = 12 * 60;             // 19:00 to 07:00

/** Minutes since shift start -> "HH:MM" wall clock. */
export function clock(t) {
  const m = (((SHIFT_START + t) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const hm = (min) => `${Math.floor(Math.max(0, min) / 60)}:${String(Math.floor(Math.max(0, min) % 60)).padStart(2, '0')}`;
