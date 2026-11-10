/* PULSE ED: the charge nurse's screen, plus the desk around it.
 * The engine owns every rule. This file only draws state and forwards clicks. */
const App = (() => {
  const E = Engine;
  const seed = new URLSearchParams(location.search).get('seed') || 'HARBOURSIDE';
  let S = E.newShift(seed);
  const ui = { sel: null, view: 'all', tab: 'overview', speed: 0, menu: null, open: null, toast: null, lens: false, intro: true, phone: false, logSeen: S.log.length };
  const LENS = { grid: 'deadlock', forgot: 'starvation', news5: 'priority inversion', nobed: 'priority inversion', code: 'preemption', clock: 'deadline', lowblood: 'resource exhaustion' };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const act = (o) => `data-act="${esc(JSON.stringify(o))}"`;
  const set = (k, v) => `data-ui="${k}:${v}"`;
  const hm = (m) => `${Math.floor(Math.max(0, m) / 60)}:${String(Math.max(0, m) % 60).padStart(2, '0')}`;
  const last = (name) => name.split(',')[0];
  const low = (label) => label.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase());   // keeps ED, ICU, CT, IM as written
  const P = (id) => S.patients[id];
  const unitOrder = Object.keys(S.units);
  const kindOf = (p) => (p.loc ? S.units[p.loc].kind : null);

  /* ---------- reading a patient ---------- */
  function describe(q) {
    if (q.arrest) return `${q.name} (Code Blue)`;
    const st = E.stepOf(q);
    if (q.stepState === 'run') return `${q.name} (${low(st.label)}, ${q.stepLeft} min left)`;
    const b = E.blockers(S, q)[0];
    return `${q.name}, who is waiting for ${b ? low(b.label) : 'the next step'}`;
  }
  function explain(b) {
    if (b.need === 'bed' || b.need === 'blood') return b.label + '.';
    if (b.absent) {
      const k = b.kinds.find((x) => S.called[x]);
      return `${b.label}: nobody in the building. ${k ? `Called in, here at ${E.clock(S.called[k].eta)}.` : 'Call them in.'}`;
    }
    const held = b.holders.filter((h) => h.pid).map((h) => `${h.name} has ${describe(P(h.pid))}`);
    const res = b.holders.filter((h) => h.reservedFor).map((h) => `${h.name} is reserved for ${P(h.reservedFor).name}`);
    const bg = b.holders.filter((h) => h.bg).length;
    return `${b.label}: none free. ${[...held.slice(0, 3), ...res].join('. ')}${held.length > 3 ? ` and ${held.length - 3} more` : ''}${bg ? `${held.length ? '. ' : ''}${bg} occupied by inpatients` : ''}.`;
  }
  function statusOf(p) {
    if (p.status === 'expected') return { c: 'grey', cls: 'exp', text: `Ambulance ETA ${p.arriveAt - S.t} min` };
    if (p.arrest) return { c: 'red', cls: 'code', text: p.arrest.teamAt === null ? 'CODE BLUE: no team free yet' : 'CODE BLUE: CPR in progress' };
    if (p.status === 'waiting') return { c: p.esi <= 2 ? 'red' : 'amber-f', cls: p.esi <= 2 ? 'bad' : '', text: `${p.via === 'ems' ? 'On ambulance stretcher' : 'Waiting room'}. No bed for ${S.t - p.arriveAt} min` };
    const st = E.stepOf(p);
    if (p.hold) return { c: 'grey', text: 'On hold (your order)' };
    if (p.stepState === 'run') return { c: st.needs.length ? 'green' : 'grey', text: `${st.label}, ${p.stepLeft} min left` };
    const b = E.blockers(S, p);
    if (S.gridlocks.some((g) => g.includes(p.id))) return { c: 'red', cls: 'bad', text: 'GRIDLOCK: needs a bed huddle' };
    if (E.isBoarding(p)) return { c: 'sky', text: `Boarding ${hm(S.t - p.reqAt)}. Needs ${b[0] ? low(b[0].label) : 'a bed'}` };
    return { c: 'amber-f', text: `Waiting ${S.t - p.reqAt} min for ${b.map((x) => low(x.label)).join(', ') || 'the team'}` };
  }
  const newsCell = (p) => { if (p.status === 'expected') return ''; const n = E.newsOf(p, S.t).score; return `<span class="${n >= 7 ? 'r' : n >= 5 ? 'a' : ''}">${p.arrest ? 'ARREST' : n}</span>`; };
  function dispoOf(p) { const end = E.caseOf(p).steps.at(-1); return end.end === 'home' ? 'Home' : { icu: 'ICU', ward: 'Ward', psych: 'Psych' }[end.place] || ''; }
  function labCell(p) { if (!p.labs.length) return ''; const dn = p.labs.filter((x) => x.done); const ab = dn.filter((x) => x.l[4]).length; return `<span class="${dn.some((x) => /HH|LL/.test(x.l[4])) ? 'r' : ''}">[${dn.length}/${p.labs.length}/${ab}]</span>`; }

  /* ---------- track board ---------- */
  const VIEWS = [['all', 'All Patients'], ['expected', 'Expected'], ['waiting', 'Waiting'], ['dept', 'In Beds'], ['admit', 'To Be Admitted'], ['house', 'Cath / OR']];
  const ACTIVITIES = [['central', 'Central Monitor'], ['beds', 'Beds & Resources'], ['staff', 'Staff'], ['alerts', 'Alerts']];
  function inView(p, v) {
    if (!['expected', 'waiting', 'active'].includes(p.status)) return false;
    const ed = p.status === 'active' && E.KINDS[kindOf(p)].ed;
    return v === 'all' || (v === 'expected' && p.status === 'expected') || (v === 'waiting' && p.status === 'waiting') || (v === 'dept' && ed) || (v === 'admit' && p.status === 'active' && E.isBoarding(p)) || (v === 'house' && p.status === 'active' && !ed);
  }
  function rows(v) {
    const rank = { expected: 0, waiting: 1, active: 2 };
    return E.patientsOf(S).filter((p) => inView(p, v)).sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'active' ? unitOrder.indexOf(a.loc) - unitOrder.indexOf(b.loc) : a.esi - b.esi || a.arriveAt - b.arriveAt));
  }
  function board() {
    const body = rows(ui.view).map((p) => {
      const s = statusOf(p);
      const bed = p.status === 'expected' ? 'EXP' : p.status === 'waiting' ? (p.via === 'ems' ? 'EMS' : 'WR') : p.loc;
      return `<tr class="${s.cls || ''} ${ui.sel === p.id ? 'sel' : ''}" ${set('sel', p.id)}>
        <td class="st" style="background:var(--${s.c})"></td><td><b>${bed}</b></td><td class="acu e${p.esi}">${p.esi}</td>
        <td>${p.status === 'expected' ? `Expected, EMS (${p.sex})` : `<b>${esc(p.name)}</b> (${p.sex})`}${p.prio ? ' <span class="r" title="Expedited">&#9650;</span>' : ''}</td>
        <td class="c">${p.age}</td><td>${esc(p.cc)}</td><td>${p.status === 'expected' ? '' : hm(S.t - p.arriveAt)}</td>
        <td>${p.author && p.seenAt !== null ? esc(p.author.replace(/^Dr\. /, '').split(' ').at(-1 - (/PA-C|RN/.test(p.author) ? 1 : 0)).slice(0, 4).toUpperCase()) : (p.status === 'expected' ? '' : '<span class="r">none</span>')}</td>
        <td class="c">${newsCell(p)}</td><td>${labCell(p)}</td><td>${dispoOf(p)}</td><td class="${s.c === 'red' ? 'r' : ''}">${esc(s.text)}</td></tr>`;
    }).join('');
    return `<div class="board" id="boardscroll"><table><thead><tr><th></th><th>Bed</th><th>Acu</th><th>Patient</th><th>Age</th><th>Complaint</th><th>LOS</th><th>MD</th><th>NEWS</th><th title="results back / ordered / abnormal">Lab</th><th>Dispo</th><th style="width:36%">Status</th></tr></thead><tbody>${body || '<tr><td colspan="12" class="m" style="padding:14px">Nobody in this view.</td></tr>'}</tbody></table></div>`;
  }

  /* ---------- report pane ---------- */
  function monitorPanel(p, big) {
    const v = E.vitalsOf(p, S.t), c = E.caseOf(p), k = kindOf(p);
    const wired = p.status === 'active' && E.KINDS[k].monitored;
    const rhythm = p.arrest ? 'vf' : c.rhythm;
    const alarms = [];
    if (p.arrest) alarms.push(['hi', '*** VENTRICULAR FIBRILLATION  NO PULSE']);
    else {
      if (v.hr > 130 || v.hr < 40) alarms.push(['hi', `*** HR ${v.hr > 130 ? 'HIGH' : 'LOW'} ${v.hr}`]);
      if (v.spo2 < 90) alarms.push(['hi', `*** SpO2 LOW ${v.spo2}`]);
      if (v.sbp < 90) alarms.push(['hi', `*** NIBP LOW ${v.sbp}/${v.dbp}`]);
      if (v.rr > 30 || v.rr < 8) alarms.push(['med', `** RESP ${v.rr > 30 ? 'HIGH' : 'LOW'} ${v.rr}`]);
    }
    const a = alarms[0] || ['', wired ? `${rhythm === 'af' ? 'ATRIAL FIBRILLATION' : rhythm === 'stemi' ? 'SINUS RHYTHM  ST ELEVATION' : v.hr > 100 ? 'SINUS TACHYCARDIA' : 'SINUS RHYTHM'}` : 'SPOT CHECK ONLY: NOT ON CONTINUOUS MONITORING HERE'];
    const data = `data-hr="${v.hr}" data-rr="${v.rr}" data-spo2="${v.spo2}" data-rhythm="${rhythm}"`;
    const map = Math.round((v.sbp + 2 * v.dbp) / 3);
    if (!big) return `<div class="tile ${alarms[0] ? alarms[0][0] : ''}" ${set('sel', p.id)}><header><span><b>${p.loc}</b> ${esc(p.name)}</span><span>NEWS ${p.arrest ? '--' : E.newsOf(p, S.t).score}</span></header><canvas data-wave="ecg" ${data} data-secs="4"></canvas><div class="nums"><span class="hr">${p.arrest ? '---' : v.hr}</span><span class="sp">${p.arrest ? '--' : v.spo2}%</span><span class="bp">${p.arrest ? '--/--' : `${v.sbp}/${v.dbp}`}</span><span class="rs">${p.arrest ? '--' : v.rr}</span></div></div>`;
    const wave = (w) => (wired ? `<canvas data-wave="${w}" ${data}></canvas>` : '<div style="height:48px"></div>');
    return `<div class="mon"><div class="alarm ${a[0]}">${esc(p.name)} &middot; ${p.loc || 'waiting room'} &middot; ${a[1]}</div>
      ${wave('ecg')}<div class="num hr"><small>HR  bpm  ${wired ? 'II' : ''}</small><b>${p.arrest ? '---' : v.hr}</b></div>
      ${wave('pleth')}<div class="num sp"><small>SpO2 %${v.o2 ? '  on O2' : '  room air'}</small><b>${p.arrest ? '--' : v.spo2}</b></div>
      ${wave('resp')}<div class="num rs"><small>RESP /min</small><b>${p.arrest ? '--' : v.rr}</b></div>
      <div class="num bp" style="grid-column:1/3;flex-direction:row;gap:26px;align-items:baseline;padding:4px 0"><span><small>NIBP mmHg </small><b>${p.arrest ? '--/--' : `${v.sbp}/${v.dbp}`}</b> <small>(${p.arrest ? '--' : map})</small></span><span style="color:#fff"><small>TEMP &deg;C </small><b>${v.temp.toFixed(1)}</b></span><span style="color:#fff"><small>GCS </small><b>${v.gcs}</b></span></div></div>`;
  }
  function pathway(p) {
    const c = E.caseOf(p), block = E.blockers(S, p);
    const stepsHtml = c.steps.map((st, i) => {
      const doneStep = i < p.stepIdx || ['admitted', 'home'].includes(p.status);
      const cur = i === p.stepIdx && p.status === 'active';
      const mark = doneStep ? '<span class="g">&#10003;</span>' : cur ? `<span class="${p.stepState === 'run' ? 'g' : 'a'}">&#9679;</span>` : '<span class="m">&#9675;</span>';
      const right = doneStep ? '<span class="g" style="font-weight:400">done</span>' : cur ? (p.stepState === 'run' ? `<span class="g">${p.stepLeft} min left</span>` : `<span class="a">waiting ${S.t - p.reqAt} min</span>`) : `<span class="m">${st.dur ? `${st.dur} min` : ''}</span>`;
      let needs = '';
      if (cur || (i === p.stepIdx + 1 && p.stepState === 'run') || (p.status === 'waiting' && i === 0)) {
        needs = `<div class="needs">${st.needs.map((n) => {
          const b = cur && p.stepState === 'need' ? block.find((x) => x.need === n) : null;
          const using = cur && p.stepState === 'run' ? [...p.using, p.loc].map((id) => S.units[id]).find((u) => n.split('|').includes(u.kind)) : null;
          const label = n.split('|').map((k) => E.KINDS[k].label).join(' or ');
          return `<span class="need ${b ? 'no' : cur ? 'ok' : ''}" title="${b ? esc(explain(b)) : ''}">${b ? '&#10005;' : cur ? '&#10003;' : ''} ${using ? esc(using.name) : label}</span>`;
        }).join('')}${st.blood ? `<span class="need ${S.stock.prbc < st.blood && !doneStep && p.stepState === 'need' ? 'no' : ''}">${st.blood} units red cells</span>` : ''}${!st.needs.length ? '<span class="need">bed only</span>' : ''}</div>`;
      }
      return `<div class="step ${cur ? 'cur' : ''}">${mark}<span>${esc(st.label)}</span>${right}${needs}</div>`;
    }).join('');
    const clocks = Object.values(p.clocks).map((k) => {
      const used = k.at !== null ? k.at : S.t - p.arriveAt;
      return `<span class="need ${k.met === true ? 'ok' : k.met === false || used > k.limit ? 'no' : ''}">${esc(k.label)}: ${Math.max(0, used)} / ${k.limit} min${k.met === true ? ' met' : k.met === false ? ' missed' : ''}</span>`;
    }).join('');
    return `<span class="pill path">Care Pathway: ${esc(c.title)}</span><div class="steps">${stepsHtml}</div>${clocks ? `<div class="needs" style="display:flex;gap:4px;flex-wrap:wrap">${clocks}</div>` : ''}`;
  }
  function advisory(p) {
    const c = E.caseOf(p), lines = [];
    let red = false;
    if (p.arrest) { red = true; lines.push(p.arrest.teamAt === null ? 'Cardiac arrest and no doctor and nurse are free. The code team is pulled from the least urgent patient as soon as one can be interrupted.' : 'Code team at the bedside. CPR in progress. The outcome depends on how fast they got here and on the cause.'); }
    const grid = S.gridlocks.find((g) => g.includes(p.id));
    if (grid) { red = true; lines.push(`Gridlock. ${grid.map((id) => `${last(P(id).name)} is in ${S.units[P(id).loc].name} and needs ${low(E.KINDS[E.stepOf(P(id)).place].label)}`).join('; ')}. Neither can move first. A bed huddle moves them together.`); if (ui.lens) lines.push('<i>Engineer lens: deadlock. Hold-and-wait plus a circular wait. The fix is an atomic swap.</i>'); }
    if (p.status === 'expected') lines.push(`Arrives in ${p.arriveAt - S.t} min. Get ready now: reserve a bed and call in anyone the pathway needs who is at home.`);
    if (!grid && !p.arrest) for (const b of E.blockers(S, p)) lines.push(esc(explain(b)));
    if (p.hold) lines.push('You put this patient on hold. They will not claim staff, scanners or beds until you release it.');
    if (p.status === 'active' && p.stepState === 'run' && !p.arrest) lines.push(`In progress: ${esc(low(E.stepOf(p).label))}. The team and equipment are released when it ends. The bed is kept.`);
    if (c.tip && (p.status !== 'active' || p.stepIdx < 2)) lines.push(`<span class="m">Charge tip: ${esc(c.tip)}</span>`);
    return `<span class="pill bpa">BestPractice Advisory</span><div class="bpa-box ${red ? 'red' : ''}">${lines.map((l) => `<p>${l}</p>`).join('') || '<p>Nothing is blocking this patient.</p>'}</div>`;
  }
  function actions(p) {
    const list = E.actionsFor(S, p);
    if (!list.length) return '';
    return `<span class="pill act">Charge Actions</span><div class="acts">${list.map((a) => {
      if (!a.choices) return `<button class="btn ${a.primary ? 'primary' : ''} ${a.on ? 'on' : ''}" ${act(a.action)}><span>${esc(a.label)}</span>${a.hint ? `<small>${esc(a.hint)}</small>` : ''}</button>`;
      const open = ui.open === a.key || (a.primary && ui.open === null);
      return `<button class="btn ${a.primary ? 'primary' : ''}" ${set('open', open ? 'none' : a.key)}><span>${esc(a.label)}</span><small>${a.choices.length} free ${open ? '&#9652;' : '&#9662;'}</small></button>${open ? `<div class="choices">${a.choices.map((ch) => `<button class="btn" ${act(ch.action)}>${esc(ch.label)}<small>${esc(ch.hint)}</small></button>`).join('') || `<span class="m">${esc(a.empty)}</span>`}</div>` : ''}`;
    }).join('')}</div>`;
  }
  function overview(p) {
    const v = E.vitalsOf(p, S.t), n = E.newsOf(p, S.t), c = E.caseOf(p);
    const hi = (bad, txt) => `<span class="${bad ? 'r' : ''}">${txt}</span>`;
    return `<div class="col narrow"><span class="pill cc">Chief Complaint</span><div>${esc(c.triage)}</div>
      <span class="pill vs">Vitals ${E.clock(S.t)}</span>
      ${p.arrest ? '<div class="r">No pulse. CPR in progress.</div>' : `<div class="vt"><span>BP</span>${hi(v.sbp <= 90 || v.sbp >= 200, `${v.sbp}/${v.dbp}`)}<span>HR</span>${hi(v.hr > 110 || v.hr < 50, v.hr)}<span>SpO2</span>${hi(v.spo2 < 92, `${v.spo2}%${v.o2 ? ' on O2' : ''}`)}<span>RR</span>${hi(v.rr > 24 || v.rr < 9, v.rr)}<span>Temp</span>${hi(v.temp > 38.5 || v.temp < 35.1, `${v.temp.toFixed(1)} &deg;C`)}<span>GCS</span>${hi(v.gcs < 15, v.gcs)}<span>NEWS2</span>${hi(n.score >= 5, `${n.score} (${n.risk})`)}<span>ESI</span><b>${p.esi}</b></div>`}</div>
      <div class="col wide">${pathway(p)}</div><div class="col">${advisory(p)}${actions(p)}</div>`;
  }
  function chart(p) {
    const c = E.caseOf(p);
    return `<div class="col"><span class="pill cc">History</span><div class="kv"><span>HPI</span><span>${esc(c.hpi)}</span><span>Past history</span><span>${esc(c.pmh.join(', '))}</span><span>Medications</span><span>${esc(c.meds.join(', '))}</span><span>Allergies</span><span class="${c.allergies === 'NKDA' ? '' : 'r'}">${esc(c.allergies)}</span><span>Exam</span><span>${esc(c.exam)}</span>${c.ecg ? `<span>ECG</span><span>${esc(c.ecg)}</span>` : ''}<span>MRN</span><span>HGH #${p.mrn}</span></div></div>
      <div class="col"><span class="pill note">Notes and procedures</span><div class="tl">${[...p.notes].reverse().map((x) => `<div class="${x.kind}"><small>${E.clock(x.t)} &middot; ${x.kind} &middot; ${esc(x.author)}</small>${esc(x.text)}</div>`).join('')}</div></div>`;
  }
  function results(p) {
    const c = E.caseOf(p), dn = p.labs.filter((x) => x.done), pend = p.labs.length - dn.length;
    const lab = dn.map((x) => { const [name, val, unit, ref, flag] = x.l; return `<tr><td>${E.clock(x.at)}</td><td>${esc(name)}</td><td class="${flag ? 'r' : ''}">${esc(val)} ${flag ? `<small>${flag}</small>` : ''}</td><td>${esc(unit)}</td><td class="m">${esc(ref)}</td></tr>`; }).join('');
    return `<div class="col"><span class="pill vs">Laboratory</span>${dn.length ? `<table class="labs"><tr><th>Time</th><th>Test</th><th>Result</th><th>Unit</th><th>Reference</th></tr>${lab}</table>` : ''}<div class="m">${p.status === 'waiting' || p.status === 'expected' ? 'Bloods are drawn once the patient is in a bed.' : pend ? `${pend} result${pend > 1 ? 's' : ''} pending in the lab.` : c.labs.length ? 'All results back.' : 'No bloods needed.'}</div></div>
      <div class="col"><span class="pill path">Imaging and procedures</span>${c.ecg && p.seenAt !== null ? `<div class="rep"><b>12-lead ECG</b>${esc(c.ecg)}</div>` : ''}${p.results.map((r) => `<div class="rep"><b>${esc(r.name)} &middot; ${E.clock(r.t)}</b>${esc(r.text)}</div>`).join('') || '<div class="m">No reports yet.</div>'}</div>`;
  }
  function report() {
    const p = P(ui.sel);
    if (!p) return '<div class="report"><div class="rbody m">Select a patient on the board to open their report.</div></div>';
    const s = statusOf(p), c = E.caseOf(p), gone = !['expected', 'waiting', 'active'].includes(p.status);
    const tabs = [['overview', 'Overview - Charge'], ['monitor', 'Live Monitor'], ['chart', 'Chart and Notes'], ['results', `Results (${p.labs.filter((x) => x.done).length + p.results.length})`]];
    const body = gone ? `<div class="col"><div class="bpa-box ${p.outcome.grade === 'good' ? '' : 'red'}"><p><b>${{ admitted: 'Admitted', home: 'Discharged home', died: 'Died', lwbs: 'Left without being seen' }[p.status]} at ${E.clock(p.leftAt)}${p.dest ? `, ${esc(p.dest)}` : ''}.</b></p><p>${esc(p.outcome.text)}</p></div></div><div class="col wide">${pathway(p)}</div>`
      : ui.tab === 'monitor' ? `<div class="col wide">${monitorPanel(p, true)}</div><div class="col"><span class="pill vs">NEWS2 breakdown</span><div class="kv">${Object.entries(E.newsOf(p, S.t).parts).map(([k, v]) => `<span>${{ rr: 'Resp rate', spo2: 'SpO2', o2: 'On oxygen', sbp: 'Systolic BP', hr: 'Pulse', avpu: 'Consciousness', temp: 'Temperature' }[k]}</span><span class="${v === 3 ? 'r' : v ? 'a' : ''}">${v}</span>`).join('')}</div><div class="m">0-4 low. 5-6 urgent review. 7 or more: emergency response. Patients in fast track, hallway or the waiting room only get spot checks, so trouble there is seen late.</div></div>`
      : ui.tab === 'chart' ? chart(p) : ui.tab === 'results' ? results(p) : overview(p);
    return `<div class="report"><div class="tabs">${tabs.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" ${set('tab', k)}>${l}</button>`).join('')}</div>
      <div class="phead"><span><span class="sq" style="background:var(--${gone ? 'grey' : s.c})"></span><b>${esc(p.name)}</b></span><span>HGH #${p.mrn}</span><span>${p.age} y.o. ${p.sex}</span><span>${p.loc ? esc(S.units[p.loc].name) : p.status === 'waiting' ? 'Waiting room' : ''}</span><span>ESI ${p.esi}</span><span>Arrived ${E.clock(p.arriveAt)} ${p.via === 'ems' ? 'by EMS' : p.via === 'house' ? '(inpatient)' : 'walk-in'}</span><span class="${c.allergies === 'NKDA' ? '' : 'r'}">Allergies: ${esc(c.allergies)}</span></div>
      <div class="rbody" id="rscroll">${body}</div></div>`;
  }

  /* ---------- full-screen activities ---------- */
  function centralView() {
    const ps = E.patientsOf(S).filter((p) => p.status === 'active' && E.KINDS[kindOf(p)].monitored).sort((a, b) => unitOrder.indexOf(a.loc) - unitOrder.indexOf(b.loc));
    return `<div class="view"><h3 class="sec">Central monitoring station: ${ps.length} patients on continuous monitoring</h3><div class="central">${ps.map((p) => monitorPanel(p, false)).join('')}</div></div>`;
  }
  function unitTile(u) {
    const q = u.holder && u.holder !== 'bg' ? P(u.holder) : null;
    const stuck = q && q.loc === u.id && q.stepState === 'need' && !q.arrest;
    const cls = u.holder === 'bg' ? 'bg' : q ? (stuck ? 'busy stuck' : 'busy') : u.reservedFor ? 'res' : '';
    const sub = u.holder === 'bg' ? 'inpatient' : q ? esc(q.name) : u.reservedFor ? `reserved: ${esc(last(P(u.reservedFor).name))}` : 'free';
    return `<div class="unit ${cls}" ${q ? set('sel', q.id) : ''}><b>${esc(u.name)}</b><small>${sub}${u.holder && u.reservedFor && q ? ` &middot; next: ${esc(last(P(u.reservedFor).name))}` : ''}</small></div>`;
  }
  function bedsView() {
    const groups = ['ED beds', 'Imaging', 'House'];
    const html = groups.map((g) => { const us = Object.values(S.units).filter((u) => E.KINDS[u.kind].group === g); const free = us.filter((u) => !u.holder).length; return `<h3 class="sec">${g}: ${free} of ${us.length} free</h3><div class="grid">${us.map(unitTile).join('')}</div>`; }).join('');
    return `<div class="view">${html}<h3 class="sec">Blood fridge</h3><div>${S.stock.prbc} units of red cells${S.phone.blood ? ' (6 more on the way)' : ''}. Red tiles: the patient is stuck there, waiting for something else.</div></div>`;
  }
  function staffView() {
    const us = Object.values(S.units).filter((u) => E.KINDS[u.kind].staff);
    const row = (u) => { const q = u.holder ? P(u.holder) : null; return `<tr ${q ? set('sel', q.id) : ''} style="${q ? 'cursor:pointer' : ''}"><td><b>${esc(u.name)}</b></td><td>${esc(u.role || '')}</td><td class="${q ? 'a' : 'g'}">${q ? 'Busy' : 'Free'}</td><td>${q ? `${esc(q.name)} &middot; ${q.arrest ? 'Code Blue' : esc(E.stepOf(q).label)}${q.arrest ? '' : `, ${q.stepLeft} min left`}` : ''}</td></tr>`; };
    const oncall = Object.entries(E.ON_CALL).map(([k, oc]) => { const cl = S.called[k]; return `<tr><td><b>${esc(oc.label)}</b></td><td>On call from home, ${oc.eta} min away</td><td class="${cl ? (cl.here ? 'g' : 'a') : 'm'}">${cl ? (cl.here ? 'In house' : `Arriving ${E.clock(cl.eta)}`) : 'At home'}</td><td>${cl ? '' : `<button class="btn" ${act({ type: 'callIn', kind: k })}>Call in</button>`}</td></tr>`; }).join('');
    return `<div class="view"><h3 class="sec">On shift</h3><table class="labs"><tr><th>Name</th><th>Role</th><th>Status</th><th>With</th></tr>${us.map(row).join('')}</table><h3 class="sec" style="margin-top:14px">On call</h3><table class="labs"><tr><th>Team</th><th></th><th>Status</th><th></th></tr>${oncall}</table></div>`;
  }
  function alertsView() {
    return `<div class="view alist"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><h3 class="sec">Alerts</h3><button class="btn" ${act({ type: 'ack', id: 'all' })}>Acknowledge all</button></div>${S.alerts.map((a) => `<div class="al ${a.level} ${a.ack ? 'ack' : ''}" ${a.pid ? set('sel', a.pid) : ''}><span class="lv"></span><time>${E.clock(a.t)}</time><span><b>${esc(a.title)}</b>${ui.lens && LENS[a.key.split(':')[0]] ? `<em>${LENS[a.key.split(':')[0]]}</em>` : ''} &middot; ${esc(a.text)}</span></div>`).join('') || '<div class="m">Quiet. For now.</div>'}</div>`;
  }
  function reviewView() {
    const m = E.summary(S), bad = E.patientsOf(S).filter((p) => p.outcome && p.outcome.grade !== 'good' && p.arriveAt >= 0);
    const grade = m.died === 0 && m.harm <= 2 ? 'A' : m.died <= 1 && m.harm <= 5 ? 'B' : m.died <= 3 ? 'C' : 'D';
    const jams = {}; for (const a of S.alerts) { const k = a.key.split(':')[0]; if (LENS[k]) jams[k] = (jams[k] || 0) + 1; }
    return `<div class="view review"><h3 class="sec">Morbidity and mortality review: night of seed ${esc(seed)}</h3><div class="big">Grade ${grade}</div>
      <p>${m.good} patients did well. <span class="r">${m.died} died.</span> <span class="a">${m.harm} were harmed by delay.</span> ${m.lwbs} left without being seen. Time targets met: ${m.clocksMet} of ${m.clocksTotal}. Ambulances diverted: ${m.diverted}.</p>
      <table><tr><th style="text-align:left">Arrived</th><th style="text-align:left">Patient</th><th style="text-align:left">Diagnosis</th><th style="text-align:left">What happened</th></tr>${bad.map((p) => `<tr ${set('sel', p.id)} style="cursor:pointer"><td>${E.clock(p.arriveAt)}</td><td><b>${esc(p.name)}</b></td><td>${esc(E.caseOf(p).title)}</td><td class="${p.outcome.grade === 'died' ? 'r' : 'a'}">${esc(p.outcome.text)}</td></tr>`).join('')}</table>
      <h3 class="sec" style="margin-top:14px">How the house jammed (engineer's names)</h3><p>${Object.entries(jams).map(([k, n]) => `${LENS[k]}: ${n}`).join(' &middot; ') || 'No jams recorded.'}</p>
      <button class="btn" ${set('newshift', 1)}>Work another night</button></div>`;
  }

  /* ---------- chrome ---------- */
  function screen() {
    const m = E.summary(S), units = Object.values(S.units);
    const count = (kind) => { const us = units.filter((u) => u.kind === kind); return `${us.filter((u) => u.holder).length} / ${us.length}`; };
    const full = (kind) => units.filter((u) => u.kind === kind).every((u) => u.holder);
    const open = S.alerts.filter((a) => !a.ack), top = open.find((a) => a.level === 'crit') || open.find((a) => a.level === 'warn');
    const ct = units.find((u) => u.kind === 'ct'), ctq = E.patientsOf(S).filter((p) => p.status === 'active' && p.stepState === 'need' && E.stepOf(p).needs.includes('ct')).length;
    const isBoard = VIEWS.some(([k]) => k === ui.view);
    const menu = ui.menu === 'callin' ? `<div class="menu">${Object.entries(E.ON_CALL).map(([k, oc]) => { const cl = S.called[k]; return `<div class="row"><span><b>${esc(oc.label)}</b><small>${cl ? (cl.here ? 'In house' : `Arriving ${E.clock(cl.eta)}`) : `At home. ${oc.eta} min to get here.`}</small></span>${cl ? '' : `<button class="btn" ${act({ type: 'callIn', kind: k })}>Call in</button>`}</div>`; }).join('')}</div>` : '';
    return `<div class="title"><span><b>PULSE ED</b>&nbsp; Track Board (Harbourside General ED)</span><span>ALVAREZ, JOSEFINA RN &middot; Charge Nurse &middot; Shift 1900-0700 &middot; <b>${E.clock(S.t)}</b></span></div>
      <div class="tools"><button ${set('menu', 'callin')}>Call In Staff &#9662;</button><button ${set('phone', 1)}>Phone &#9662;</button><button class="${S.t < S.divertUntil ? 'on' : ''}" ${act({ type: 'divert' })}>${S.t < S.divertUntil ? `On diversion until ${E.clock(S.divertUntil)}` : 'Ambulance Diversion'}</button><span class="sep"></span><button class="${ui.lens ? 'on' : ''}" ${set('lens', 1)}>Engineer Lens</button><button ${set('intro', 1)}>How this works</button>
        <div class="right"><button class="bell ${open.some((a) => a.level === 'crit') ? 'hot' : ''}" ${set('view', 'alerts')}>Alerts (${open.length})</button></div>${menu}</div>
      ${top ? `<div class="banner ${top.level}">${esc(top.title)}<span>${esc(top.text)}</span>${top.pid ? `<button ${set('sel', top.pid)}>Open patient</button>` : ''}<button ${act({ type: 'ack', id: top.id })}>Acknowledge</button></div>` : ''}
      <div class="tabs">${VIEWS.map(([k, l]) => `<button class="${ui.view === k ? 'on' : ''}" ${set('view', k)}>${l} (${E.patientsOf(S).filter((p) => inView(p, k)).length})</button>`).join('')}<span class="gap"></span>${ACTIVITIES.map(([k, l]) => `<button class="${ui.view === k ? 'on' : ''}" ${set('view', k)}>${l}</button>`).join('')}${S.over ? `<button class="${ui.view === 'review' ? 'on' : ''}" ${set('view', 'review')}>Shift Review</button>` : ''}</div>
      <div class="cap"><span>ED beds <b class="${m.census >= m.edBeds ? 'r' : ''}">${m.census} / ${m.edBeds}</b></span><span>Waiting <b class="${m.waiting > 6 ? 'r' : ''}">${m.waiting}</b></span><span>Boarding <b class="${m.boarding > 3 ? 'r' : ''}">${m.boarding}</b></span><span>ICU <b class="${full('icu') ? 'r' : ''}">${count('icu')}</b></span><span>Ward <b class="${full('ward') ? 'r' : ''}">${count('ward')}</b></span><span>OR <b class="${full('or') ? 'a' : ''}">${count('or')}</b></span><span>CT <b class="${ct.holder ? 'a' : 'g'}">${ct.holder ? `in use${ctq ? `, ${ctq} queued` : ''}` : 'free'}</b></span><span>Blood <b class="${S.stock.prbc <= 2 ? 'r' : ''}">${S.stock.prbc} u</b></span>
        <span class="goal">Tonight: <b class="${m.died ? 'r' : 'g'}">${m.died} died</b> &middot; <b class="${m.harm ? 'a' : 'g'}">${m.harm} harmed</b> &middot; <b>${m.good}</b> well &middot; targets <b>${m.clocksMet}/${m.clocksTotal}</b> &middot; LWBS <b>${m.lwbs}</b></span></div>
      <div class="main">${isBoard ? `${board()}<div class="split">&#9662; Report</div>${report()}` : ui.view === 'central' ? centralView() : ui.view === 'beds' ? bedsView() : ui.view === 'staff' ? staffView() : ui.view === 'alerts' ? alertsView() : reviewView()}${!isBoard && ui.view !== 'review' && P(ui.sel) && ui.pin ? '' : ''}</div>
      ${ui.toast ? `<div class="toast ${ui.toast.ok ? '' : 'fail'}">${esc(ui.toast.msg)}</div>` : ''}`;
  }
  function desk() {
    const exp = E.patientsOf(S).filter((p) => p.status === 'expected').sort((a, b) => a.arriveAt - b.arriveAt);
    const latest = S.alerts[0];
    return `<div class="prop" id="radio"><h4><span class="led ${exp.length ? 'on' : ''}"></span>EMS RADIO</h4>${exp.slice(0, 2).map((p) => `<div class="lcd" ${set('sel', p.id)} style="cursor:pointer">ETA ${String(p.arriveAt - S.t).padStart(2, '0')}m ${esc((E.caseOf(p).prealert || p.cc).slice(0, 24).toUpperCase())}</div>`).join('') || '<div class="lcd green">NO UNITS INBOUND</div>'}</div>
      <div class="prop" id="timer"><h4>NIGHT SHIFT ${S.over ? '&middot; HANDOVER' : ''}</h4><div style="display:flex;align-items:center;gap:12px"><span class="bigclock">${E.clock(S.t)}</span><div class="speed">${[[0, '&#10073;&#10073;'], [1, '1x'], [3, '3x'], [8, '8x']].map(([v, l]) => `<button class="${ui.speed === v ? 'on' : ''}" ${set('speed', v)}>${l}</button>`).join('')}</div></div></div>
      <div class="prop" id="pager"><h4>PAGER</h4><div class="lcd green" style="white-space:normal">${latest ? `${E.clock(latest.t)} ${esc(latest.title.toUpperCase())}: ${esc(latest.text)}` : 'NO PAGES'}</div></div>
      <div class="prop" id="phone" ${set('phone', 1)}><h4>DESK PHONE</h4><div>L1 ICU charge &middot; ${S.phone.stepdown}</div><div>L2 Bed management &middot; ${S.phone.discharge}</div><div>L3 Blood bank ${S.phone.blood ? '&middot; sending' : ''}</div></div>
      ${ui.phone ? `<div id="phonemenu"><h3>Desk phone</h3>
        <div class="row"><span><b>ICU charge nurse</b><small>Step a patient down to the ward. Needs a free ward bed. Frees an ICU bed in 20 min. ${S.phone.stepdown} left tonight.</small></span><button class="btn" ${act({ type: 'phone', what: 'stepdown' })}>Call</button></div>
        <div class="row"><span><b>Bed management</b><small>Send a ward patient home early. Frees a ward bed in 30 min. ${S.phone.discharge} left tonight.</small></span><button class="btn" ${act({ type: 'phone', what: 'discharge' })}>Call</button></div>
        <div class="row"><span><b>Blood bank</b><small>6 units of red cells in 15 min. ${S.stock.prbc} in the fridge now.</small></span><button class="btn" ${act({ type: 'phone', what: 'blood' })}>Call</button></div></div>` : ''}`;
  }
  const INTRO = `<div class="card"><h1>Night shift, Harbourside General</h1><div class="m">19:00 to 07:00. You are the charge nurse. You do not treat anyone. You decide who gets what, and when.</div>
    <ol><li><b>Place.</b> Patients arrive by ambulance or walk in. Pick one on the board and assign a bed. Sickest first: ESI 1 is dying, ESI 5 can wait.</li>
    <li><b>Read the pathway.</b> Each care step needs everything at once: a doctor, a nurse, a scanner, a theatre. A red chip is the missing piece, and the advisory says who has it.</li>
    <li><b>Unblock.</b> Expedite the sick past the queue, hold or move patients, reserve what a dying patient will need, call teams in from home before they are needed, phone for inpatient beds.</li>
    <li><b>Watch.</b> Alerts and the live monitors tell you who is getting worse. The waiting room is not monitored.</li></ol>
    <div class="m" style="margin-bottom:14px">A patient keeps their place until the next place is free. That one rule is why hospitals jam.</div>
    <button class="btn" data-ui="start:1">Take handover</button></div>`;

  function render() {
    const keep = ['boardscroll', 'rscroll'].map((id) => [id, $(id) ? $(id).scrollTop : 0]);
    $('screen').innerHTML = screen();
    $('desk').innerHTML = desk();
    for (const [id, top] of keep) if ($(id)) $(id).scrollTop = top;
    $('intro').style.display = ui.intro ? 'flex' : 'none';
    $('vignette').className = E.patientsOf(S).some((p) => p.arrest) ? 'code' : '';
  }
  function toast(r) { if (!r || !r.msg) return; ui.toast = r; clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = null; render(); }, 2600); }

  function world() {   // let the room behind the screen react to what just happened
    for (const e of S.log.slice(ui.logSeen)) { if (e.text === 'Ambulance arrived') Backdrop.ambulance(); if (e.type === 'code') Backdrop.codeBlue(); }
    ui.logSeen = S.log.length;
    const m = E.summary(S); Backdrop.setBusy((m.census + m.waiting) / (m.edBeds + 6));
  }
  function step() {
    if (S.over) return;
    E.tick(S); world();
    if (S.over) { ui.speed = 0; ui.view = 'review'; }
  }

  document.addEventListener('pointerdown', (ev) => {
    const a = ev.target.closest('[data-act]'), u = ev.target.closest('[data-ui]');
    if (a) { toast(E.act(S, JSON.parse(a.dataset.act))); ui.open = null; ui.menu = null; }
    else if (u) {
      const [k, v] = u.dataset.ui.split(':');
      if (k === 'sel') { ui.sel = +v; ui.open = null; if (!VIEWS.some(([x]) => x === ui.view)) ui.view = 'all'; if (!inView(P(ui.sel), ui.view)) ui.view = 'all'; }
      else if (k === 'view') { ui.view = v; }
      else if (k === 'tab') ui.tab = v;
      else if (k === 'open') ui.open = v;
      else if (k === 'menu') ui.menu = ui.menu === v ? null : v;
      else if (k === 'phone') ui.phone = !ui.phone;
      else if (k === 'lens') ui.lens = !ui.lens;
      else if (k === 'speed') ui.speed = +v;
      else if (k === 'intro') { ui.intro = true; ui.resume = ui.speed; ui.speed = 0; }
      else if (k === 'start') { ui.intro = false; ui.speed = ui.resume || 1; }
      else if (k === 'newshift') { location.search = `?seed=${Math.random().toString(36).slice(2, 8).toUpperCase()}`; return; }
    } else { if (!ev.target.closest('.menu')) ui.menu = null; if (!ev.target.closest('#phonemenu')) ui.phone = false; }
    render();
  });
  document.addEventListener('keydown', (ev) => { if (ev.code === 'Space' && !ui.intro) { ev.preventDefault(); ui.speed = ui.speed ? 0 : 1; render(); } });

  let acc = 0, prev = performance.now();
  setInterval(() => {
    const now = performance.now(); acc += ((now - prev) / 1000) * ui.speed; prev = now;
    let n = 0; while (acc >= 1 && n < 10) { step(); acc -= 1; n += 1; }
    if (n) render();
  }, 200);

  $('intro').innerHTML = INTRO;
  Backdrop.start($('world')); Waves.start();
  ui.sel = (rows('all')[0] || {}).id || null;
  render();
  return { get state() { return S; }, ui, render, step };
})();
