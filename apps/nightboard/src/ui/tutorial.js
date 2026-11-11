/* Orientation: a spotlight tour of the real screen, on a practice night that is thrown away
 * afterwards. A shift already in progress is set aside and comes back untouched.
 *
 * A step is { ch, gk | t+b, target, before(), do: { text, ok, check(), allow, run } }.
 *   gk      borrow the title, text and target from the Guide Mode entry of that name
 *   target  CSS selector, or several joined by commas: the spotlight covers all of them
 *   before  put the screen in the state this step talks about. Must be safe to run twice.
 *   do      the player has to do something real. Next unlocks when check() is true.
 *           run: true lets the clock run, and it stops by itself once check() passes.
 * A target that is not on screen at this window size just shows the card in the middle. */
import HANDBOOK from 'virtual:handbook';
import { GUIDE } from './guide-text.js';
import { Guide } from './guide.js';
import { Handbook } from './handbook.js';

export const Tutorial = (() => {
  const CH = ['The job', 'The screen', 'One patient', 'Your first patients', 'The other screens', 'The desk', 'When it jams'];
  const KEY = 'nightboard.orientation';
  const store = { get() { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } }, set(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* private window */ } } };
  let api, hole, card, on = false, i = 0, setAside = null, menu = false, wasDone = null, lastKey = '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const G = (k) => `[data-g="${k}"]`;

  /* ---- the practice night's cast ---- */
  const ps = () => api.E.patientsOf(api.S);
  const stemi = () => ps().find((p) => p.case === 'stemi');
  const stuck = () => ps().find((p) => p.status === 'active' && p.stepState === 'need' && api.E.KINDS[api.kindOf(p)].ed && !api.E.isBoarding(p)) || ps().find((p) => p.status === 'active');
  let walkInId = null;
  const walkIn = () => { const w = ps().find((p) => p.id === walkInId); if (w) return w; const n = ps().filter((p) => p.status === 'waiting' && p.esi >= 3 && p.case !== 'stemi').sort((a, b) => b.esi - a.esi)[0]; walkInId = n ? n.id : null; return n; };
  const walker = () => ps().find((p) => p.id === walkInId);

  /* ---- what each step needs on screen ---- */
  const U = () => api.ui;
  const toBoard = () => { U().view = 'all'; U().sheet = false; U().phone = false; U().menu = null; };
  const open = (p, tab = 'overview') => { if (!p) return; U().view = 'all'; U().sel = p.id; U().tab = tab; U().sheet = U().isPhone; U().phone = false; U().menu = null; };
  const look = (tab) => () => open(stuck(), tab);

  const SWAP = () => (HANDBOOK.diagrams.jam ? `<div class="swap">${HANDBOOK.diagrams.jam}</div>` : '');
  const reserved = () => Object.values(api.S.units).some((u) => u.reservedFor === (stemi() || {}).id);

  const STEPS = [
    /* The job */
    { ch: 0, t: 'You run the floor', b: 'You are the charge nurse on a 12-hour night shift. You never treat anyone. You decide who gets which bed, who goes first, and who gets called in from home.<br><br>Doctors and nurses do the rest, as long as they have what they need.', before: toBoard },
    { ch: 0, t: 'How you are graded', b: 'This tally is your score. Deaths matter most, then patients harmed by delay. "Targets" are medical deadlines. "LWBS" means left without being seen.', target: G('cap.tally'), before: toBoard },
    { ch: 0, t: 'The one rule that matters', b: 'A care step can start only when <b>everything it needs is free at the same moment</b>: the doctor, the nurse, the scanner.<br><br>And a patient <b>keeps the bed they are in until the next place is ready</b>. That is why hospitals jam, and why they need you.' },

    /* The screen */
    { ch: 1, gk: 'title', before: toBoard },
    { ch: 1, gk: 'tool.callin', before: toBoard },
    { ch: 1, gk: 'tool.phone' },
    { ch: 1, gk: 'tool.divert' },
    { ch: 1, gk: 'tool.guide', b: 'This is the one to remember. Any time you are confused, press G. Everything on the screen will explain itself when you point at it.' },
    { ch: 1, t: 'Orientation, Handbook, Engineer Lens', b: 'Orientation replays this tour. Handbook is the full manual. Engineer Lens adds computing terms to the alerts, for the curious.', target: `${G('tool.learn')}, ${G('tool.book')}, ${G('tool.lens')}` },
    { ch: 1, gk: 'tool.bell' },
    { ch: 1, gk: 'banner', target: '.banner' },
    { ch: 1, t: 'Board tabs', b: 'These filter the board. All Patients is the default. Waiting shows who has no bed. To Be Admitted shows who is stuck waiting for a bed upstairs.', target: '#viewtabs button:not(.activity)', before: toBoard },
    { ch: 1, t: 'Capacity: the emergency department', b: 'ED beds in use, how many people have no bed, and how many are boarding. Boarding means they are finished here but have nowhere to go.', target: `${G('cap.beds')}, ${G('cap.waiting')}, ${G('cap.boarding')}` },
    { ch: 1, t: 'Capacity: the rest of the hospital', b: 'ICU and ward beds, and operating rooms. When these fill, your beds stop emptying.', target: `${G('cap.icu')}, ${G('cap.ward')}, ${G('cap.or')}` },
    { ch: 1, t: 'Capacity: the things you run out of', b: 'One CT scanner, and the blood in the fridge. Both catch people out.', target: `${G('cap.ct')}, ${G('cap.blood')}` },
    { ch: 1, gk: 'col.bed' },
    { ch: 1, gk: 'col.acu' },
    { ch: 1, t: 'Patient and complaint', b: 'Who they are, and why they came in. A complaint is triage\'s first impression, not the final diagnosis.', target: `${G('col.name')}, ${G('col.age')}, ${G('col.cc')}` },
    { ch: 1, t: 'LOS and MD', b: 'LOS is how long they have been here. MD is who has seen them. A red "none" means no doctor yet.', target: `${G('col.los')}, ${G('col.md')}` },
    { ch: 1, gk: 'col.news' },
    { ch: 1, t: 'Lab and Dispo', b: 'Lab shows blood tests as [back / ordered / abnormal]. Dispo is where they will end up: Home, Ward, ICU or Psych.', target: `${G('col.lab')}, ${G('col.dispo')}` },
    { ch: 1, gk: 'col.status', b: 'What is happening right now, in plain words. Read this column first. The colour bar on the far left gives you the same thing at a glance: green treating, amber waiting, red danger, blue boarding.' },

    /* One patient */
    { ch: 2, t: 'Open a patient', b: 'Pressing a row opens that patient\'s report. We have opened someone who is stuck, so you can see why.', target: '.phead', before: look('overview') },
    { ch: 2, gk: 'ov.cc', target: `.pill.cc, .col.narrow > div${G('ov.cc')}`, before: look('overview') },
    { ch: 2, gk: 'ov.vitals', target: '.vt, .pill.vs', b: 'Blood pressure, heart rate, oxygen, breathing, temperature and consciousness. Red is out of the safe range. In Guide Mode, each one explains itself.' },
    { ch: 2, gk: 'v.news', target: G('v.news') },
    { ch: 2, gk: 'path.title', target: '.pill.path, .steps' },
    { ch: 2, gk: 'path.step', target: '.step.cur' },
    { ch: 2, gk: 'need.no', target: '.need.no, .step.cur .needs' },
    { ch: 2, gk: 'path.adv', target: '.pill.bpa, .bpa-box' },
    { ch: 2, gk: 'acts.title', target: '.pill.act, .acts' },
    { ch: 2, gk: 'rtab.monitor', t: 'Live Monitor', b: 'The bedside monitor: heart trace in green, oxygen in blue, breathing in yellow. The numbers are this patient\'s real values, the same ones the simulation uses.', target: '.mon', before: look('monitor') },
    { ch: 2, gk: 'news.break', target: G('news.break'), before: look('monitor') },
    { ch: 2, gk: 'rtab.chart', target: '#rscroll', before: look('chart') },
    { ch: 2, gk: 'rtab.results', target: '#rscroll', before: look('results') },

    /* Your first patients */
    { ch: 3, t: 'An ambulance is coming', b: 'EMS has radioed ahead: a heart attack, about 9 minutes out. You have time to prepare, and that is the whole game.', target: '.banner', before: toBoard, do: { text: 'Press "Open patient" on the red banner.', ok: 'Open. This is your patient.', check: () => U().sel === (stemi() || {}).id, allow: G('banner.open') } },
    { ch: 3, t: 'Hold a bed', b: 'Keep a bed ready, so the patient does not sit in a corridor.', target: '.acts', before: () => open(stemi()), do: { text: 'Under "Reserve a bed for arrival", pick Resus 1.', ok: 'Reserved. Nobody else can take it.', check: reserved } },
    { ch: 3, t: 'Call the team now', b: 'At night the heart team is at home, 25 minutes away. Waiting until the patient arrives would lose those 25 minutes.', target: '.acts', before: () => open(stemi()), do: { text: 'Press "Call in Cath team".', ok: 'They are on the road.', check: () => !!api.S.called.cards } },
    { ch: 3, t: 'Let the clock run', b: 'Now the speed buttons. 1x is one game minute per second. The tour will stop the clock by itself when the ambulance arrives.', target: '.speed', before: () => open(stemi()), do: { text: 'Press 3x.', ok: 'The ambulance is here.', run: true, allow: '.speed button', check: () => (stemi() || {}).status !== 'expected' } },
    { ch: 3, t: 'Put them in the bed', b: 'The bed you reserved is waiting.', target: '.acts', before: () => open(stemi()), do: { text: 'Under "Assign bed", pick Resus 1.', ok: 'In the bed. Treatment starts on its own.', check: () => (stemi() || {}).status === 'active' } },
    { ch: 3, t: 'Treatment runs itself', b: 'The doctor and nurse are free, so the first step started at once. Your job is to make sure the next step is not stuck.', target: '.step.cur, .speed', before: () => open(stemi()), do: { text: 'Press 3x until the ECG is done.', ok: 'ECG done.', run: true, allow: '.speed button', check: () => (stemi() || {}).stepIdx >= 1 } },
    { ch: 3, t: 'Red means missing', b: 'The next step needs the cath lab, a nurse and the heart team. The team is still on the road, so their chip is red. The advisory says when they will arrive.<br><br>Without your call they would not even have left home.', target: '.need.no, .bpa-box', before: () => open(stemi()) },
    { ch: 3, t: 'They made it', b: 'When the team walks in, the step starts by itself. Watch the "Door to balloon" target: 90 minutes from arrival to opening the artery.', target: '.step.cur, .speed', before: () => open(stemi()), do: { text: 'Press 8x until the procedure starts.', ok: 'Procedure under way, well inside the target.', run: true, allow: '.speed button', check: () => { const p = stemi(); return !p || p.stepIdx >= 2 || (p.stepIdx === 1 && p.stepState === 'run'); } } },
    { ch: 3, t: 'Now someone less urgent', skip: () => !walkIn(), b: 'A minor injury in the waiting room. Only safe beds are offered. Minor patients belong in fast track, so the acute beds stay free for the sick.', target: '.acts', before: () => open(walkIn()), do: { text: 'Pick a Fast track chair if there is one, otherwise a hallway stretcher.', ok: 'Placed.', check: () => { const p = walker(); return !p || p.status !== 'waiting'; } } },
    { ch: 3, gk: 'act.expedite', skip: () => !walker() || walker().status !== 'active', target: '[data-k="expedite"]', before: () => open(walker()) },
    { ch: 3, gk: 'act.hold', skip: () => !walker() || walker().status !== 'active', target: '[data-k="hold"]', before: () => open(walker()) },
    { ch: 3, gk: 'act.move', skip: () => !walker() || walker().status !== 'active', target: '[data-k="move"]', before: () => open(walker()) },

    /* The other screens */
    { ch: 4, gk: 'view.central', target: '.central', before: () => { toBoard(); U().view = 'central'; } },
    { ch: 4, gk: 'view.beds', target: '.grid', before: () => { toBoard(); U().view = 'beds'; } },
    { ch: 4, t: 'What the tile colours mean', b: 'Green is free. Yellow is in use. Blue is reserved. Grey is a hospital inpatient. <b>Red means the patient is stuck there</b>, waiting for something else. Red tiles are how jams look.', target: '.grid', before: () => { toBoard(); U().view = 'beds'; } },
    { ch: 4, gk: 'view.staff', target: '#viewscroll', before: () => { toBoard(); U().view = 'staff'; } },
    { ch: 4, gk: 'view.alerts', target: '.alist', b: 'Every alert tonight. Red is critical, amber is a warning, blue is information. Pressing one opens the patient.', before: () => { toBoard(); U().view = 'alerts'; } },

    /* The desk */
    { ch: 5, gk: 'desk.radio', before: toBoard },
    { ch: 5, gk: 'desk.clock', target: '.bigclock' },
    { ch: 5, t: 'Speed', b: 'Pause, 1x, 3x and 8x. <b>You can do everything while paused</b>, and there is no penalty. Pause whenever you need to think. The space bar does the same.', target: '.speed' },
    { ch: 5, gk: 'desk.pager' },
    { ch: 5, gk: 'desk.phone', target: '#phonemenu', before: () => { toBoard(); U().phone = true; } },
    { ch: 5, t: 'Ambulance diversion', b: 'Your last resort: no ambulances for 60 minutes. Walk-ins still come, and you cannot use it again for 3 hours.', target: G('tool.divert'), before: toBoard },

    /* When it jams */
    { ch: 6, t: 'Gridlock', html: SWAP, b: 'Sometimes a patient in the OR needs an ICU bed, while the ICU patient needs the OR. Each holds what the other wants. Neither can move first, and nothing will change on its own.', before: toBoard },
    { ch: 6, gk: 'act.huddle', t: 'The bed huddle', b: 'When the status says GRIDLOCK, open the patient and press Bed huddle. It swaps them in one move. The word "gridlock" will also appear on the alerts.', target: '' },
    { ch: 6, t: 'Three habits that win', b: '<b>Prepare when the radio goes.</b> Reserve and call in before the patient arrives.<br><br><b>Check the waiting room.</b> Nobody monitors it. The sickest person there may not look it.<br><br><b>Keep the exits open.</b> Phone the ICU and wards before they are full.' },
    { ch: 6, t: 'You are ready', b: 'Press G for Guide Mode any time, or ? for the handbook. The hard part of the night starts around 21:00.<br><br>The practice patients go home now. Your real shift starts fresh.', last: true },
  ];

  const usable = (n) => !STEPS[n].skip || !STEPS[n].skip();
  const step = () => STEPS[i];
  const textOf = (s) => {
    const g = s.gk ? GUIDE[s.gk] : null;
    return { title: s.t || (g ? g[1] : ''), body: s.b || (g ? g[2] : ''), todo: s.b || !g ? '' : g[3] };
  };
  const selectorOf = (s) => (s.target !== undefined ? s.target : s.gk ? G(s.gk) : '');
  const done = () => !!step().do && !!step().do.check();
  const canNext = () => !step().do || done();

  function rectOf(sel) {
    if (!sel) return null;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9, n = 0;
    const screenR = { w: innerWidth, h: innerHeight };
    for (const el of document.querySelectorAll(sel)) {
      const q = el.getBoundingClientRect();
      if (q.width < 2 || q.height < 2 || q.right < 0 || q.bottom < 0 || q.left > screenR.w || q.top > screenR.h) continue;
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); n += 1;
    }
    return n ? { l, t, r, b, w: r - l, h: b - t } : null;
  }
  function drawCard() {
    const s = step(), x = textOf(s), total = STEPS.length, d = s.do;
    const stepsInCh = STEPS.filter((q) => q.ch === s.ch), nth = stepsInCh.indexOf(s) + 1;
    card.innerHTML = `<div class="ch"><span>${s.ch + 1} of ${CH.length} &middot; ${esc(CH[s.ch])} &middot; ${nth}/${stepsInCh.length}</span><button data-ui="tut:menu">${menu ? 'Close' : 'Chapters'}</button></div>
      ${menu ? `<div id="tut-menu">${CH.map((c, n) => `<button data-ui="tut:ch${n}" class="${n === s.ch ? 'on' : ''}">${n + 1}. ${esc(c)}</button>`).join('')}</div>` : ''}
      <h5>${esc(x.title)}</h5>${s.html ? s.html() : ''}<p>${x.body}</p>${x.todo ? `<p class="todo"><b>What to do:</b> ${esc(x.todo)}</p>` : ''}
      ${selectorOf(s) && !rectOf(selectorOf(s)) ? '<p class="nofit">Your screen is too small to show this part. It appears on a wider screen.</p>' : ''}
      ${d ? `<div class="do ${done() ? 'ok' : ''}">${done() ? `&#10003; ${esc(d.ok)}` : esc(d.text)}</div>` : ''}
      <div class="bar"><i style="width:${((i + 1) / total) * 100}%"></i></div>
      <div class="nav"><button data-ui="tut:exit">Exit</button><span class="sp">${i + 1} / ${total}</span><button data-ui="tut:back" ${i ? '' : 'disabled'}>Back</button><button class="next" data-ui="tut:next" ${canNext() ? '' : 'disabled'}>${s.last ? (setAside ? 'Back to your shift' : 'Take handover') : 'Next'}</button></div>`;
  }
  function layout() {
    const s = step(), sel = selectorOf(s), r = rectOf(sel);
    hole.classList.toggle('none', !r);
    if (r) { const pad = 4; hole.style.left = `${r.l - pad}px`; hole.style.top = `${r.t - pad}px`; hole.style.width = `${r.w + pad * 2}px`; hole.style.height = `${r.h + pad * 2}px`; }
    card.classList.remove('dock-top');
    if (U().isPhone) { if (r && r.t + r.h / 2 > innerHeight * 0.48) card.classList.add('dock-top'); card.style.left = ''; card.style.top = ''; return; }
    const w = card.offsetWidth, h = card.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 14;
    let x, y;
    if (!r) { x = (vw - w) / 2; y = (vh - h) * 0.4; }
    else if (r.b + gap + h < vh - 8) { x = r.l; y = r.b + gap; }
    else if (r.t - gap - h > 8) { x = r.l; y = r.t - gap - h; }
    else if (r.r + gap + w < vw - 8) { x = r.r + gap; y = r.t; }
    else if (r.l - gap - w > 8) { x = r.l - gap - w; y = r.t; }
    else { x = vw - w - 16; y = vh - h - 16; }
    card.style.left = `${Math.max(8, Math.min(vw - w - 8, x))}px`;
    card.style.top = `${Math.max(8, Math.min(vh - h - 8, y))}px`;
  }
  function enter(n, dir = 1) {
    while (n >= 0 && n < STEPS.length && !usable(n)) n += dir;
    if (n < 0 || n >= STEPS.length) return;
    i = n; menu = false; U().speed = 0;
    const s = step();
    if (s.before) s.before();
    wasDone = null; lastKey = '';
    store.set(s.ch);
    api.render();
    const first = selectorOf(s) && document.querySelector(selectorOf(s).split(',')[0]);
    if (first && first.scrollIntoView) first.scrollIntoView({ block: U().isPhone ? 'start' : 'nearest', inline: 'nearest' });
    drawCard(); layout();
    setTimeout(() => { if (on) layout(); }, 240);   // once the spotlight and any scrolling have settled
  }
  function next() { if (!canNext()) return; if (step().last) finish(true); else enter(i + 1, 1); }
  function finish(completed) {
    on = false; U().speed = 0;
    hole.style.display = 'none'; card.style.display = 'none';
    store.set(0);
    if (setAside) { const s = setAside; setAside = null; api.setShift(s); api.finishOrientation(true); return; }
    if (completed) api.startRealShift();
    else { api.setShift(api.E.newShift(new URLSearchParams(location.search).get('seed') || 'HARBOURSIDE')); api.finishOrientation(false); }
  }
  function begin() {
    if (api.ui.guide) Guide.toggle();
    setAside = api.ui.started ? api.S : null;
    api.setShift(api.E.newShift('ORIENTATION'));
    api.tick(5);
    walkInId = null;
    on = true; hole.style.display = 'block'; card.style.display = 'block';
    const ch = store.get();
    enter(ch ? STEPS.findIndex((s) => s.ch === ch) : 0);
  }
  return {
    init(a) {
      api = a;
      const layer = document.getElementById('tut-layer');
      layer.innerHTML = '<div id="tut-hole" style="display:none"></div><div id="tut-card" style="display:none" role="dialog" aria-label="Orientation"></div>';
      hole = layer.querySelector('#tut-hole'); card = layer.querySelector('#tut-card');
      api.on('tut', (v) => {
        if (v === 'next') next();
        else if (v === 'back') enter(i - 1, -1);
        else if (v === 'exit') finish(false);
        else if (v === 'menu') { menu = !menu; drawCard(); layout(); }
        else if (v.startsWith('ch')) { menu = false; enter(STEPS.findIndex((s) => s.ch === +v.slice(2))); }
      });
    },
    begin,
    active: () => on,
    saved: () => store.get() > 0,
    allows(target) {
      if (!on) return true;
      if (target.closest('#tut-card, #handbook')) return true;
      const s = step();
      if (!s.do || done()) return false;
      return !!target.closest(s.do.allow || selectorOf(s));
    },
    refresh() {
      if (!on) return;
      const s = step(), d = !!s.do && done(), key = `${s.do ? s.do.text : ''}${d}`;
      if (s.do && s.do.run && d && U().speed) U().speed = 0;
      if (key !== lastKey || d !== wasDone) { wasDone = d; lastKey = key; drawCard(); }
      layout();
    },
    key(ev) {
      if (!on || Handbook.isOpen()) return false;
      if (ev.key === 'ArrowRight' || (ev.key === 'Enter' && !ev.target.closest('button'))) next();
      else if (ev.key === 'ArrowLeft') enter(i - 1, -1);
      else if (ev.key === 'Escape') finish(false);
      else if (ev.key === '?') return false;
      return true;
    },
  };
})();
