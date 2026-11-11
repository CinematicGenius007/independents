/* The in-game manual. HANDBOOK is compiled by build.mjs from docs/HANDBOOK.md, the case book and
 * the Guide Mode text. This file only draws it: sidebar (chips on a phone), article and search. */
const Handbook = (() => {
  let el, nav, main, input, cur = null, opened = false, prevFocus = null;
  const sections = HANDBOOK.sections;
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function drawNav() { nav.innerHTML = sections.map((s) => `<button data-ui="hb:${s.id}" class="${s.id === cur ? 'on' : ''}">${esc(s.title)}</button>`).join(''); }
  function show(id) {
    const s = sections.find((x) => x.id === id) || sections[0];
    cur = s.id; input.value = '';
    main.innerHTML = `<article class="prose">${s.html}</article>`;
    main.scrollTop = 0;
    drawNav();
    const b = nav.querySelector('.on'); if (b) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function search(q) {
    q = q.trim();
    if (q.length < 2) { show(cur); return; }
    const low = q.toLowerCase(), mark = (t) => t.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`);
    const hits = sections.filter((s) => s.text.toLowerCase().includes(low));
    main.innerHTML = `<div class="prose"><h1>Search: ${esc(q)}</h1>${hits.map((s) => {
      const i = s.text.toLowerCase().indexOf(low), from = Math.max(0, i - 70);
      return `<button class="hb-hit" data-ui="hb:${s.id}"><b>${esc(s.title)}</b><small>${mark(esc(s.text.slice(from, i + q.length + 90)))}</small></button>`;
    }).join('') || '<p>Nothing found. Try a simpler word.</p>'}</div>`;
    main.scrollTop = 0;
  }
  function open(id) {
    prevFocus = document.activeElement;
    opened = true; el.classList.add('open');
    show(id || cur || 'start');
    if (matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  }
  function close() {
    opened = false; el.classList.remove('open');
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  }
  return {
    init(api) {
      el = document.getElementById('handbook');
      el.innerHTML = `<div class="hb-top"><b>Night Shift Handbook</b><input type="search" placeholder="Search the handbook" aria-label="Search the handbook"><button data-ui="hbx:1">Back to the game</button></div><div class="hb-wrap"><nav class="hb-nav" aria-label="Sections"></nav><div class="hb-main"></div></div>`;
      nav = el.querySelector('.hb-nav'); main = el.querySelector('.hb-main'); input = el.querySelector('input');
      input.addEventListener('input', () => search(input.value));
      api.on('hb', (v) => open(v));
      api.on('hbx', () => close());
    },
    open, close,
    isOpen: () => opened,
  };
})();
