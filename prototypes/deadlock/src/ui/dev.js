/* Dev mode: the machinery, read straight from the engine for the frame on screen.
 * Same scene as Player mode (Board draws the wait-for graph and the Coffman tags);
 * this panel adds tapes, mutex/thread table, certifier numbers, seed + share link. */
const Dev = (() => {
  const E = Engine;
  const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SK = Clay.SKINS;
  let built = false;

  function chip(op, active, done) {
    let t = op.k;
    if (op.k === 'lock' || op.k === 'unlock') t = `${op.k} ${op.r}`;
    if (op.k === 'travel') t = `travel ${op.n}`;
    if (op.k === 'try') t = `try ${op.r}/${op.backoff}`;
    return `<span class="chip${active ? ' act' : ''}${done ? ' dn' : ''}">${t}</span>`;
  }
  const lamp = (cls, name, on, hint) => `<div class="lamp ${on ? 'on ' + on : ''} ${cls}" title="${esc(hint)}"><i></i><b>${name}</b></div>`;

  function skeleton(A) {
    $('#dev').innerHTML = `
      <section><h3>Coffman <small>on the diagram: ME, H&amp;W, NP, red ring</small></h3><div id="d-coffman" class="lamps"></div></section>
      <section><h3>Machine</h3><div id="d-machine"></div></section>
      <section><h3>Threads <small>cart = thread, pad = mutex</small></h3><div id="d-threads"></div></section>
      <section><h3>Product automaton <small>carts × monitor</small></h3><div id="d-cert"></div></section>
      <section><h3>Plan</h3><div id="d-plan"></div></section>
      <section><h3>Seed</h3>
        <form id="d-seedform" class="seedrow"><input id="d-seed" value="${esc(A.seed)}" spellcheck="false" aria-label="seed"><select id="d-rung" aria-label="rung"></select><button type="submit">build</button></form>
        <div id="d-level" class="mono"></div>
        <div class="seedrow"><input id="d-link" readonly aria-label="share link"><button id="d-copy" type="button">copy</button></div>
      </section>`;
    const sel = $('#d-rung');
    E.LADDER.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1} · ${s.name}`; sel.appendChild(o); });
    $('#d-seedform').addEventListener('submit', (e) => { e.preventDefault(); A.go(+sel.value, $('#d-seed').value); });
    sel.addEventListener('change', () => A.go(+sel.value, $('#d-seed').value));
    $('#d-copy').addEventListener('click', () => { const l = $('#d-link'); l.select(); try { navigator.clipboard.writeText(l.value); } catch { document.execCommand('copy'); } $('#d-copy').textContent = 'copied'; setTimeout(() => { $('#d-copy').textContent = 'copy'; }, 1200); });
    $('#dev').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'apply') A.setPlan((A.analysis.plan || []).map((x) => ({ ...x })));
      if (b.dataset.act === 'clear') A.resetPlan();
    });
    built = true;
  }

  function render(A) {
    if (!A.level || !A.rep) return;
    if (!built) skeleton(A);
    const L = A.level; const f = A.frame(); const c = E.compile(L); const rep = A.rep;
    // Coffman
    const holding = f.carts.some((x) => x.held.length);
    const hw = f.carts.some((x) => x.held.length && x.blockedOn >= 0);
    const np = f.edges.length > 0;
    const cw = f.cycle ? 'red' : f.intentCycle ? 'amber' : '';
    $('#d-coffman').innerHTML = lamp('', 'mutual exclusion', holding ? 'green' : '', 'a pad holds one cart at a time (ME tags)') + lamp('', 'hold & wait', hw ? 'green' : '', 'a cart keeps its pad while asking for another (H&W tags)')
      + lamp('', 'no preemption', np ? 'green' : '', 'nobody can take a pad away: only release frees it (NP tags on wait edges)') + lamp('', 'circular wait', cw, cw === 'amber' ? 'the loop is forming (dashed yarn): window still open' : 'closed wait-for cycle (red ring)');
    const hash = fnv(f.key);
    $('#d-machine').innerHTML = `<div class="kv mono"><span>tick</span><b>${f.tick}</b><span>status</span><b class="st-${f.statusName}">${f.statusName}</b><span>discipline</span><b>${L.mode === 'priority' ? 'priority-preemptive' : 'synchronous lockstep'}</b><span>budget left</span><b>hold ${f.budget.hold} · loan ${f.budget.loan}</b><span>state key</span><b>#${hash}</b><span>frames</span><b>${rep.frames.length}</b></div>`;
    // threads
    let th = '<table class="thr mono"><tr><th></th><th>thread</th><th>pri</th><th>state</th><th>tape</th></tr>';
    L.carts.forEach((cart, i) => {
      const x = f.carts[i];
      const state = x.done ? 'done' : x.blockedOn >= 0 ? `blocked(${L.resources[x.blockedOn]}) ← c${f.owner[x.blockedOn]}` : x.holdLeft > 0 ? `held ${x.holdLeft}` : x.busyLeft > 0 ? `travel ${x.busyLeft}` : 'runnable';
      th += `<tr><td><i class="dot" style="background:${SK[cart.skin].main}"></i></td><td>c${i}${cart.hog ? ' hog' : ''}</td><td>${x.prio}${x.eff !== x.prio ? '→' + x.eff : ''}${x.boostLeft ? ' ⟲' + x.boostLeft : ''}</td><td>${state}${x.held.length ? ' · holds ' + x.held.map((r) => L.resources[r]).join(',') : ''}</td>
      <td class="tape">${cart.tape.map((op, k) => chip(op, k === x.pc && !x.done, k < x.pc)).join('')}</td></tr>`;
    });
    th += '</table>';
    th += '<div class="mutexes mono">' + L.resources.map((r, k) => `<span class="mx ${f.owner[k] >= 0 ? 'held' : ''}">${r}: ${f.owner[k] >= 0 ? 'c' + f.owner[k] : 'free'}</span>`).join('') + '</div>';
    $('#d-threads').innerHTML = th;
    // certifier
    const a = A.analysis;
    const m = (a && a.cert) ? a : null;
    let ch;
    if (!m || !m.cert) ch = `<p class="mono">certifying… ${A.certState}</p>`;
    else {
      const cert = m.cert;
      ch = `<div class="kv mono"><span>states explored</span><b>${cert.explored.toLocaleString()}</b><span>generated / pruned</span><b>${cert.generated.toLocaleString()} / ${cert.pruned.toLocaleString()}</b><span>certified par</span><b>${m.par}</b><span>window</span><b>${m.window ?? '…'} ticks</b><span>traps</span><b>${m.traps ?? '…'} of ${m.firstMoves ?? '…'} first moves</b><span>default run</span><b>${m.defaultFailure}</b><span>certify time</span><b>${A.certMs != null ? A.certMs.toFixed(1) + ' ms ' + (A.certState === 'worker' ? '(worker)' : '(main thread)') : '…'}</b><span>cap</span><b>${E.CAP.sections} pads · ${E.CAP.carts} carts</b></div>
      <div class="plan mono"><b>winning plan</b> ${(m.plan || []).map((p) => `<span class="pl ${p.kind}">${p.kind} c${L.carts.findIndex((q) => q.id === p.cart)}@${p.tick}</span>`).join(' ')}</div>
      <div class="seedrow"><button data-act="apply" type="button">show winning plan</button><button data-act="clear" type="button">clear</button></div>`;
    }
    $('#d-cert').innerHTML = ch;
    $('#d-plan').innerHTML = A.plan.length ? `<div class="plan mono">${A.plan.map((p) => `<span class="pl ${p.kind}">${p.kind} ${p.cart}@${p.tick}</span>`).join(' ')}</div>` + `<div class="mono">result: <b class="st-${rep.statusName}">${rep.statusName}</b> at tick ${rep.ticks}${rep.rejected.length ? ' · ' + rep.rejected.length + ' no-op' : ''}</div>` : `<div class="mono">no moves yet · default run: <b class="st-${rep.statusName}">${rep.statusName}</b> at tick ${rep.ticks}</div>`;
    const seedIn = $('#d-seed'); if (document.activeElement !== seedIn) seedIn.value = A.seed;
    $('#d-rung').value = A.rung;
    $('#d-level').textContent = `${L.family} · ${L.resources.length} pads · ${L.carts.length} carts · ${L.mode}`;
    $('#d-link').value = A.shareLink();
  }
  const $ = (s) => document.querySelector(s);
  return { render };
})();
