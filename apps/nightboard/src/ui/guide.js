/* Guide Mode: while it is on, the clock stops and every tagged element (data-g) explains itself.
 * Mouse: hover shows a popover next to the element, and clicks still work.
 * Touch: a tap opens a bottom sheet instead of acting, with a button to do the thing anyway.
 * Keyboard: focus shows the same popover. */
import { GUIDE } from './guide-text.js';
import { Handbook } from './handbook.js';

export const Guide = (() => {
  let api, layer, hl, tip, bar;
  let at = null, shown = '', tap = null, sheet = false;
  const touchOnly = matchMedia('(hover: none)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const on = () => api.ui.guide;

  function entryHtml(el) {
    const key = el.dataset.g, e = GUIDE[key];
    if (!e) return '';
    const [where, title, what, todo] = e;
    const now = el.dataset.gl || api.liveFor(key, el.dataset.gp);
    return `<div class="crumb">${esc(where)}</div><h5>${esc(title)}</h5><p>${esc(what)}</p>${todo ? `<p class="todo"><b>What to do:</b> ${esc(todo)}</p>` : ''}${now ? `<p class="now">${esc(now)}</p>` : ''}`;
  }
  function paint(el) {
    if (!el || !GUIDE[el.dataset.g]) { hide(); return; }
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) { hide(); return; }
    hl.style.cssText = `display:block;left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px`;
    const html = `${entryHtml(el)}<p class="more">Press H to read more in the handbook.</p>`;
    if (html !== shown) { tip.innerHTML = html; shown = html; }
    tip.classList.remove('sheet');
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10;
    let x = r.left, y = r.bottom + gap;
    if (y + h > vh - 8) y = r.top - h - gap;
    if (y < 8) { y = Math.min(vh - h - 8, Math.max(8, r.top)); x = r.right + gap; if (x + w > vw - 8) x = r.left - w - gap; }
    tip.style.left = `${Math.max(8, Math.min(vw - w - 8, x))}px`;
    tip.style.top = `${Math.max(8, Math.min(vh - h - 8, y))}px`;
  }
  function hide() { hl.style.display = 'none'; tip.style.display = 'none'; tip.classList.remove('sheet'); sheet = false; shown = ''; }
  function underPointer() {
    if (!at) return null;
    const el = document.elementFromPoint(at.x, at.y);
    return el && !el.closest('#gtip, #gbar') ? el.closest('[data-g]') : null;
  }
  function openSheet(el, press) {
    const r = el.getBoundingClientRect();
    hl.style.cssText = `display:block;left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px`;
    const canUse = press.act || press.ui;
    tip.innerHTML = `${entryHtml(el)}<div class="sheet-acts">${canUse ? '<button data-ui="gd:do">Use this control</button>' : ''}<button data-ui="gd:book">Read more</button><button data-ui="gd:close">Close</button></div>`;
    tip.style.cssText = 'display:block';
    tip.classList.add('sheet');
    shown = ''; sheet = true; tap = press; tap.topic = (GUIDE[el.dataset.g] || [])[4];
  }
  function toggle() {
    api.ui.guide = !api.ui.guide;
    document.body.classList.toggle('guide', api.ui.guide);
    bar.style.display = api.ui.guide ? 'flex' : 'none';
    if (!api.ui.guide) { hide(); at = null; }
    api.render();
  }
  return {
    init(a) {
      api = a; layer = document.getElementById('guide-layer');
      layer.innerHTML = `<div id="ghl"></div><div id="gtip" role="tooltip"></div><div id="gbar" style="display:none"><span>Guide Mode. ${touchOnly ? 'Tap' : 'Point at'} anything. The clock is stopped.</span><button data-ui="guide:1">Exit</button></div>`;
      hl = layer.querySelector('#ghl'); tip = layer.querySelector('#gtip'); bar = layer.querySelector('#gbar');
      document.addEventListener('pointermove', (ev) => {
        if (!on() || ev.pointerType !== 'mouse') return;
        at = { x: ev.clientX, y: ev.clientY };
        paint(ev.target.closest && !ev.target.closest('#gtip, #gbar') ? ev.target.closest('[data-g]') : null);
      }, { passive: true });
      document.addEventListener('focusin', (ev) => { if (on() && !sheet && ev.target.matches('[data-g]')) { at = null; paint(ev.target); } });
      api.on('gd', (v) => {
        const t = tap; hide(); tap = null;
        if (v === 'do' && t) api.dispatch(t.act, t.ui, t.outside);
        if (v === 'book' && t) Handbook.open(t.topic);
      });
    },
    toggle,
    refresh() { if (!on() || sheet) return; if (at) paint(underPointer()); },
    /* A tap in Guide Mode explains instead of acting. Returns true if it used up the tap. */
    captureTap(press) {
      if (!on() || press.target.closest('#gtip, #gbar, #handbook')) return false;
      if (press.guideEl && press.guideEl.dataset.g === 'tool.guide') return false;
      if (press.guideEl && GUIDE[press.guideEl.dataset.g]) { openSheet(press.guideEl, press); return true; }
      hide(); return true;
    },
    openTopic() {
      const el = underPointer() || document.activeElement;
      const e = el && el.dataset && GUIDE[el.dataset.g];
      Handbook.open(e ? e[4] : 'controls');
    },
  };
})();
