#!/usr/bin/env node
/* =====================================================================
   Headless-Chromium certification for prototypes/root-explorer-minimal  (Revision 4: the whole page is the world)

   Serves the repo root on a throwaway port, opens the page with software WebGL and proves, with real
   keyboard, mouse-wheel, mouse and touch events (touch goes through the DevTools protocol):

   1. the page IS the 3D world: one real <canvas> at 100vw x 100vh, fixed, no bordered window, no
      scrollbars, html / body / clear colour are #151516 charcoal; WebGL context lives;
   2. the nineteen tracks: 19 real <a href> rows in the tracklist, 01..19, nine LIVE then ten ROADMAP,
      every href resolves in this repo (Long Haul is not on main yet); copy is human: no engineering
      vocabulary anywhere in the DOM, every hook is a short sentence, every card explains what you do;
   3. the nineteen theme previews: every plate draws, animates on its own, reacts to the pointer, and
      survives a click (run twice with the same random seed, so "reacts" is a real difference);
   4. desktop interaction from the first moment: cover state with a living map; a mouse-wheel notch,
      the arrow keys, a mouse drag and the rail all travel; Home / End / M; wheel-up at track 1 returns
      to the map; dragging the map spins the record; hovering a sleeve names it; clicking a sleeve
      drops the needle; clicking the current plate pokes it; the liner card, the LIVE / ROADMAP switch,
      previous / next and TRY NEXT agree with the camera; the plate is framed beside the card, never under it;
   5. OPEN hands off to the project (shipped apps at ../../apps/NAME/, ideas at ../GROUP/index.html#slug,
      both with from=root), the one pending app only toasts;
   6. the index (tracklist) opens, scrolls, and a row flies to its plate;
   7. the 390 x 844 phone: no sideways or vertical page scroll, a bottom sheet with the LIVE / ROADMAP
      switch, the plate framed above it, 44px touch targets, swipe travels, a tap pokes, the index is a
      sheet; the same 19 tracks are reachable;
   8. zero console errors, zero page errors, zero failed requests.

   Run:   node prototypes/root-explorer-minimal/verify.cjs
   Shots: SHOTS=/some/dir node prototypes/root-explorer-minimal/verify.cjs
   Needs: playwright (local or global) with a Chromium build; network once for the pinned three.js on
          jsDelivr and two Google Fonts (with system monospace fallbacks).
   Exit 0 = every certificate green.
   ===================================================================== */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), cp = require("child_process");
let pw; try { pw = require("playwright"); } catch (e) { pw = require(path.join(cp.execSync("npm root -g").toString().trim(), "playwright")); }
const ROOT = path.resolve(__dirname, "..", ".."), SHOTS = process.env.SHOTS || "";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/plain" };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0].split("#")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(d); }); });

let pass = 0, fail = 0; const bad = [];
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log("  ok   " + msg); } else { fail++; bad.push(msg); console.log("  FAIL " + msg + (extra !== undefined ? "  <- " + JSON.stringify(extra) : "")); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BANNED = /\b(state hash|tick|60 ?hz|bfs|černý|cerny|lamport|lindenmayer|sha-?256|fixed-point|commit-reveal|webrtc|manifest|deterministic|painter|adapter|coffman|streamfunction|bang-bang|totalistic|quorum|handoff|fragment|payload|lockstep|replicat|serializ|hash commitment|formal)\b/i;

(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port, url = `http://localhost:${port}/prototypes/root-explorer-minimal/index.html`;
  const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const errors = [];
  const watch = page => {
    page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
    page.on("pageerror", e => errors.push("pageerror: " + (e.stack || e.message)));
    page.on("requestfailed", rq => { const u = rq.url(); if (!/fonts\.(googleapis|gstatic)\.com/.test(u)) errors.push("requestfailed: " + u); });
    page.on("response", rs => { if (rs.status() >= 400 && rs.url().startsWith(`http://localhost:${port}`) && !/favicon/.test(rs.url())) errors.push("http " + rs.status() + ": " + rs.url()); });
  };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); watch(page);
  const I = (fn, arg) => page.evaluate(fn, arg);
  const step = (n = 60, draw = false) => page.evaluate(([n, d]) => __independents.stepSim(n, 1 / 60, d), [n, draw]);
  const st = () => I(() => __independents.state());
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await step(2, true); await sleep(900); await page.screenshot({ path: path.join(SHOTS, name + ".png") }); } };
  const css = () => page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => { }))));
  const wheelStep = async dy => { await page.mouse.wheel(0, dy); await sleep(650); await step(90); };

  console.log("\n[1] the page is the world");
  await page.goto(url, { waitUntil: "load" }); await page.waitForFunction(() => window.__independents && __independents.state().frames > 2, null, { timeout: 40000 });
  await sleep(1500); const live0 = (await st()).frames; await sleep(2500); const live1 = (await st()).frames; await I(() => __independents.setAuto(false)); await step(240, true);
  const fb = await I(() => { const c = document.querySelector("#world"), r = c.getBoundingClientRect(), cs = x => getComputedStyle(x); const body = document.body.scrollHeight, cw = document.documentElement.clientWidth;
    return { w: r.width, h: r.height, l: r.left, t: r.top, iw: innerWidth, ih: innerHeight, pos: cs(c).position, canvases: document.querySelectorAll("canvas").length, frame: !!document.querySelector("#frame, #stage, .stage, #trueWindow"),
      html: cs(document.documentElement).backgroundColor, bodyBg: cs(document.body).backgroundColor, ovf: cs(document.body).overflow, sw: document.documentElement.scrollWidth, cw, sh: document.documentElement.scrollHeight, ih2: innerHeight,
      border: cs(c).borderTopWidth, gl: !!(c.getContext && !document.body.classList.contains("nogl")), grain: cs(document.documentElement).getPropertyValue("--grain").trim().startsWith("url(") }; });
  ok(fb.canvases === 1 && fb.pos === "fixed" && fb.l === 0 && fb.t === 0 && fb.w === fb.iw && fb.h === fb.ih, "exactly one canvas, fixed, 0,0 and exactly 100vw x 100vh", fb);
  ok(!fb.frame && fb.border === "0px", "no bordered mini-window (#frame / #stage / #trueWindow) anywhere");
  ok(fb.html === "rgb(21, 21, 22)" && fb.bodyBg === "rgb(21, 21, 22)", "html and body are #151516 matte charcoal cardstock", fb);
  ok(fb.sw <= fb.cw && fb.sh <= fb.ih2 + 1 && fb.ovf === "hidden", "the page never scrolls: the world is the interface (no scrollbars)", fb);
  ok(fb.grain, "procedural paper grain is applied over the whole card");
  const s0 = await st(); ok(s0.gl && live1 > live0 && s0.mode === "map", "WebGL context is live, the render loop runs by itself, and the page opens on the whole record (map)", { live0, live1, mode: s0.mode });

  console.log("\n[2] nineteen tracks, written for a first-time visitor");
  const rows = await I(() => [...document.querySelectorAll("a.trk")].map(a => ({ n: a.querySelector(".n").textContent, t: a.querySelector(".t").textContent, d: a.querySelector(".d").textContent, sub: a.querySelector(".sub").textContent, href: a.getAttribute("href"), slug: a.dataset.slug, side: a.closest("ol").id, lead: getComputedStyle(a.querySelector(".lead")).height })));
  ok(rows.length === 19 && rows.map(r => r.n).join() === Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")).join(), "tracklist has 19 real rows numbered 01..19");
  ok(rows.slice(0, 9).every(r => r.side === "sideA") && rows.slice(9).every(r => r.side === "sideB"), "nine LIVE (Side A) then ten ROADMAP (Side B)");
  ok(rows.every(r => r.lead === "1px"), "every row keeps its 1px hairline leader (the liner-notes soul)");
  ok(/fogwalk/i.test(rows[0].t) && rows[0].d === "05:00" && /bloomwright/i.test(rows[1].t) && rows[1].d === "04:12", "running times sit on the leaders: 01 FOGWALK 05:00, 02 BLOOMWRIGHT 04:12", rows.slice(0, 2));
  const missing = rows.filter(r => r.slug !== "longhaul" && !fs.existsSync(path.resolve(ROOT, "prototypes", "root-explorer-minimal", r.href.split("#")[0])));
  ok(missing.length === 0, "every row href resolves to a path in this repo (Long Haul is not on main yet)", missing.map(r => r.href));
  const sub = rows.map(r => r.sub);
  ok(sub.every(t => t.length >= 18 && t.length <= 72 && /[.!?]$/.test(t)), "every hook is one short human sentence (18-72 characters)", sub.filter(t => t.length < 18 || t.length > 72 || !/[.!?]$/.test(t)));
  const cards = []; for (let i = 0; i < 19; i++) { await I(i2 => __independents.go(i2), i); await step(40); cards.push(await I(() => ({ title: document.querySelector("#card .c-title span")?.textContent, text: document.querySelector("#card")?.innerText, hook: document.querySelector("#card .c-hook")?.textContent, you: document.querySelector("#card .c-you")?.textContent, open: document.querySelector("#card a.open")?.textContent.trim(), num: document.querySelector("#card .c-head span")?.textContent }))); }
  ok(cards.every((c, i) => c.num === `${String(i + 1).padStart(2, "0")} / 19`), "the liner card follows the camera through all 19 tracks", cards.map(c => c.num));
  ok(cards.every(c => c.you && c.you.length >= 60 && c.you.length <= 150 && /^[A-Z]/.test(c.you)), "every card says plainly what you do (60-150 characters)", cards.filter(c => !c.you || c.you.length < 60 || c.you.length > 150).map(c => c.title));
  ok(cards.every(c => c.text.split(/\s+/).length <= 80), "no card is wordy (80 words or fewer, headings and buttons included)", cards.map(c => c.text.split(/\s+/).length));
  const allText = (await I(() => document.body.innerText + " " + [...document.querySelectorAll("#index a")].map(a => a.textContent).join(" "))) + cards.map(c => c.text).join(" ");
  ok(!BANNED.test(allText), "no engineering vocabulary anywhere (no STATE HASH, TICK, 60 HZ, BFS, ČERNÝ, SHA-256, WEBRTC, QUORUM…)", (allText.match(BANNED) || [])[0]);
  ok(cards.slice(0, 9).every(c => /^PLAY /.test(c.open) || /ARRIVING/.test(c.open)) && cards.slice(9).every(c => /^PEEK AT /.test(c.open)), "LIVE cards say PLAY, ROADMAP cards say PEEK AT, so the distinction is in the button too", cards.map(c => c.open));
  await I(() => __independents.toMap()); await step(120);

  console.log("\n[3] the nineteen theme previews");
  const probes = []; for (const t of rows) probes.push(await I(s => __independents.probe(s), t.slug));
  ok(probes.every(p => p.lit > 200), "all 19 plates draw real ink", probes.filter(p => p.lit <= 200).map(p => [p.slug, p.lit, p.err]));
  ok(probes.every(p => p.animates), "all 19 animate on their own (a landing page never looks dead)", probes.filter(p => !p.animates).map(p => p.slug));
  ok(probes.every(p => p.reacts), "all 19 react to the pointer (same random seed, different frame with a cursor)", probes.filter(p => !p.reacts).map(p => p.slug));
  ok(probes.every(p => p.poke), "all 19 survive a click", probes.filter(p => !p.poke).map(p => [p.slug, p.err]));
  ok(probes.every(p => !p.err), "no preview threw while drawing", probes.filter(p => p.err).map(p => [p.slug, p.err]));

  console.log("\n[4] desktop: interacting from the first moment");
  await page.reload({ waitUntil: "load" }); await page.waitForFunction(() => window.__independents && __independents.state().frames > 2, null, { timeout: 40000 }); await I(() => __independents.setAuto(false)); await step(300, true);
  const cov = await I(() => { const g = id => getComputedStyle(document.querySelector(id)); return { cover: g("#cover").opacity, card: g("#card").visibility, h1: document.querySelector("#cover h1").textContent, ctaA: !!document.querySelector('#cover [data-go="0"]'), ctaB: !!document.querySelector('#cover [data-go="9"]') }; });
  ok(cov.cover === "1" && cov.card === "hidden" && /Nineteen small games/.test(cov.h1) && cov.ctaA && cov.ctaB, "first moment: a clear headline, the two side buttons, the record already alive behind it", cov);
  await shot("01-cover-map");
  /* the map answers a hover with the sleeve's name */
  await I(() => __independents.state()); await page.mouse.move(900, 600); await step(30);
  let hovFound = -1, hovPt = null; for (const i of [12, 13, 14, 11, 10, 9, 15, 16, 8, 7]) { const p = await I(i2 => __independents.projectPlate(i2), i); await page.mouse.move(p.x, p.y); await step(8); const s = await st(); if (s.hov === i) { hovFound = i; hovPt = p; break; } }
  const tipOn = await I(() => document.querySelector("#tip").classList.contains("on") && document.querySelector("#tip").textContent);
  ok(hovFound >= 0 && !!tipOn, "hovering a sleeve in the map lifts it and names it", { hovFound, tipOn }); await shot("02-map-hover");
  /* dragging the map spins the record */
  const sp0 = (await st()).spin; await page.mouse.move(700, 700); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(700 + k * 35, 700); await sleep(16); } await page.mouse.up(); await step(20); const sp1 = (await st()).spin; await step(300);
  ok(Math.abs(sp1 - sp0) > .8, "dragging the record spins it like a DJ (and it keeps its inertia)", [sp0, sp1]);
  /* click a sleeve: the needle drops there */
  let pick = -1, pp = null; for (const i of [12, 13, 14, 11, 10, 9, 15, 16, 8, 7, 6, 5]) { const p = await I(i2 => __independents.projectPlate(i2), i); await page.mouse.move(p.x, p.y); await step(8); if ((await st()).hov === i) { pick = i; pp = p; break; } }
  ok(pick >= 0, "after the spin settles, some sleeve is still under the cursor to pick", pick); if (pick < 0) { pick = 12; pp = await I(() => __independents.projectPlate(12)); }
  await page.mouse.move(pp.x, pp.y); await step(10); const hv = (await st()).hov; await page.mouse.click(pp.x, pp.y); await step(240, true); const sw = await st();
  ok(sw.mode === "walk" && sw.cur === hv && hv >= 0, "clicking a sleeve in the map drops the needle on it (walk mode, matching track)", { hv, sw: { mode: sw.mode, cur: sw.cur } });
  await css(); await shot("03-walk");
  const card = await I(() => { const r = document.querySelector("#card").getBoundingClientRect(), v = getComputedStyle(document.querySelector("#card")); return { l: r.left, r: r.right, vis: v.visibility, op: v.opacity, cover: getComputedStyle(document.querySelector("#cover")).visibility }; });
  const pl = await I(i2 => __independents.projectPlate(i2), sw.cur);
  ok(card.vis === "visible" && card.cover === "hidden", "walk mode shows the liner card and hides the cover", card);
  ok(pl.x + pl.w / 2 < card.l - 20 && pl.x - pl.w / 2 > 0 && Math.abs(pl.y - sw.layout.cy) < 14, "the plate is framed beside the card, never under it, centred on the layout focus", { pl, cardL: card.l, cy: sw.layout.cy });
  /* travel: wheel notch, arrows, drag, rail, keys */
  await I(() => __independents.go(0)); await step(120); await page.mouse.move(520, 450);
  await wheelStep(120); let s = await st(); ok(s.cur === 1, "one mouse-wheel notch travels exactly one track", s.cur);
  await wheelStep(120); await wheelStep(-120); s = await st(); ok(s.cur === 1, "wheel down then up returns to the same track", s.cur);
  await page.keyboard.press("ArrowRight"); await step(60); await page.keyboard.press("ArrowDown"); await step(60); s = await st(); ok(s.cur === 3, "ArrowRight and ArrowDown both go forward", s.cur);
  await page.keyboard.press("ArrowLeft"); await step(60); s = await st(); ok(s.cur === 2, "ArrowLeft goes back", s.cur);
  await page.keyboard.press("End"); await step(60); s = await st(); const e1 = s.cur; await page.keyboard.press("Home"); await step(60); s = await st(); ok(e1 === 18 && s.cur === 0, "End jumps to track 19, Home to track 01", [e1, s.cur]);
  await page.mouse.move(520, 450); await page.mouse.down(); for (let k = 1; k <= 10; k++) { await page.mouse.move(520 - k * 24, 450); await sleep(24); } await page.mouse.up(); await step(90); s = await st();
  ok(s.cur === 1, "dragging the world to the left travels forward (one track)", s.cur);
  await page.mouse.move(520, 600); await page.mouse.down(); for (let k = 1; k <= 10; k++) { await page.mouse.move(520, 600 + k * 26); await sleep(24); } await page.mouse.up(); await step(90); s = await st();
  ok(s.cur === 0, "dragging down travels back (either axis works)", s.cur);
  const railBox = await I(() => { const b = document.querySelector('.tk[data-i="12"]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height - 6 }; });
  await page.mouse.click(railBox.x, railBox.y); await step(240); s = await st(); ok(s.cur === 12, "the rail of nineteen ticks flies to any track", s.cur);
  const sideLive = await I(() => document.querySelector('#sides [data-side="A"]').getAttribute("aria-pressed")), sideRoad = await I(() => document.querySelector('#sides [data-side="B"]').getAttribute("aria-pressed"));
  ok(sideRoad === "true" && sideLive === "false", "the LIVE / ROADMAP switch follows the camera (track 13 is ROADMAP)", [sideLive, sideRoad]);
  await page.click('#sides [data-side="A"]'); await step(200); s = await st(); ok(s.cur === 0, "choosing LIVE flies to Side A", s.cur);
  await page.click('#sides [data-side="B"]'); await step(200); s = await st(); ok(s.cur === 9, "choosing ROADMAP flies to Side B", s.cur);
  await page.click("#card .nav[data-step='1']"); await step(80); s = await st(); const n1 = s.cur; await page.click("#card .nav[data-step='-1']"); await step(80); s = await st(); ok(n1 === 10 && s.cur === 9, "the card's next / previous buttons travel", [n1, s.cur]);
  const like = await I(() => document.querySelector("#card [data-like]").dataset.like); await page.click("#card [data-like]"); await step(160); s = await st(); ok(s.cur === +like, "TRY NEXT flies to the suggested neighbour", [like, s.cur]);
  /* the plate answers a click */
  await I(() => __independents.go(4)); await step(200, true); const pc = await I(() => __independents.projectPlate(4)); await page.mouse.move(pc.x, pc.y); await step(6); const sp = (await st()).pokes; await page.mouse.click(pc.x, pc.y); await step(6); const sp2 = (await st()).pokes;
  ok(sp2 === sp + 1 && (await st()).cur === 4, "clicking the current plate pokes its preview (it does not fly away)", [sp, sp2]);
  /* overscroll back to the map, keys */
  await I(() => __independents.go(0)); await step(120); await page.mouse.move(520, 450); await sleep(650); await page.mouse.wheel(0, -120); await sleep(300); await step(90); s = await st(); ok(s.mode === "map", "wheel-up at track 01 returns to the whole record", s.mode);
  await page.keyboard.press("m"); await step(150); s = await st(); ok(s.mode === "walk", "M toggles between the map and the last track", s.mode);
  await page.keyboard.press("Escape"); await step(150); s = await st(); ok(s.mode === "map", "Esc rises back to the map", s.mode);
  await page.click('#cover [data-go="9"]'); await step(200); s = await st(); ok(s.mode === "walk" && s.cur === 9, "the cover's SIDE B button dives into track 10", { mode: s.mode, cur: s.cur });
  await I(() => __independents.go(5)); await step(160, true); await page.mouse.move(520, 450); await step(40, true); await shot("04-walk-6");
  await I(() => __independents.go(16)); await step(200, true); await shot("05-walk-17");

  console.log("\n[5] open hands off to the project");
  await I(() => { window.__nav = []; window.__independents_nav = u => window.__nav.push(u); });
  await I(() => __independents.go(0)); await step(60); await page.click("#card a.open"); let nav = await I(() => window.__nav.slice());
  ok(nav.length === 1 && /\/apps\/fogwalk\/#from=root&v=1$/.test(nav[0]), "a LIVE project opens its own app at apps/fogwalk/ with from=root", nav);
  await I(() => __independents.go(9)); await step(60); await page.click("#card a.open"); nav = await I(() => window.__nav.slice());
  ok(nav.length === 2 && /\/life-ecologies\/index\.html#sporefront&from=root&v=1$/.test(nav[1]), "a ROADMAP idea opens its prototype with its #slug and from=root", nav[1]);
  await I(() => __independents.go(7)); await step(60); await page.click("#card a.open"); nav = await I(() => window.__nav.slice()); const toast = await I(() => document.querySelector("#toast").classList.contains("on"));
  ok(nav.length === 2 && toast, "Long Haul (not on main yet) does not navigate, it says so", { nav: nav.length, toast });
  await I(() => __independents.go(0)); await step(40); await page.keyboard.press("Enter"); nav = await I(() => window.__nav.slice());

  console.log("\n[6] the index (tracklist)");
  await I(() => __independents.toMap()); await step(100); await page.keyboard.press("i"); await css(); const ix = await I(() => { const r = document.querySelector("#index").getBoundingClientRect(); return { l: r.left, w: r.width, op: document.body.classList.contains("index-open"), h2: [...document.querySelectorAll("#index h2")].map(h => h.textContent) }; });
  ok(ix.op && ix.l >= -1 && ix.w <= 600 && ix.h2.length === 2 && /LIVE/.test(ix.h2[0]) && /ROADMAP/.test(ix.h2[1]), "I opens the tracklist: SIDE A — LIVE, SIDE B — ROADMAP", ix); await shot("06-index");
  await page.click('a.trk[data-slug="driftwatch"]'); await step(200); s = await st(); ok(s.cur === 11 && s.mode === "walk" && !s.indexOpen, "a row flies to its plate and closes the sheet", s);
  await page.keyboard.press("i"); await css(); await page.keyboard.press("Escape"); await css(); ok(!(await st()).indexOpen, "Esc closes the tracklist");

  console.log("\n[7] the 390 x 844 phone");
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const m = await mctx.newPage(); watch(m);
  const mcss = () => m.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => { })))), mI = (fn, arg) => m.evaluate(fn, arg), mstep = (n = 60, d = false) => m.evaluate(([n, d]) => __independents.stepSim(n, 1 / 60, d), [n, d]), mst = () => m.evaluate(() => __independents.state());
  const mshot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await mstep(2, true); await sleep(900); await m.screenshot({ path: path.join(SHOTS, name + ".png") }); } };
  await m.goto(url, { waitUntil: "load" }); await m.waitForFunction(() => window.__independents && __independents.state().frames > 2, null, { timeout: 40000 }); await mI(() => __independents.setAuto(false)); await mstep(300, true);
  const cdp = await mctx.newCDPSession(m);
  const touch = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const swipe = async (x0, y0, x1, y1) => { await touch("touchStart", x0, y0); for (let k = 1; k <= 10; k++) { await touch("touchMove", x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10); await sleep(22); } await touch("touchEnd"); await mstep(100); };
  const ov = await mI(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, phone: __independents.state().layout.phone, canvas: (() => { const r = document.querySelector("#world").getBoundingClientRect(); return [r.width, r.height]; })() }));
  ok(ov.sw <= ov.iw && ov.sh <= ov.ih && ov.phone && ov.canvas[0] === 390 && ov.canvas[1] === 844, "no sideways or vertical page scroll; the canvas is 390 x 844", ov);
  const cv = await mI(() => ({ h1: document.querySelector("#cover h1").getBoundingClientRect().bottom, sideA: document.querySelector('#cover [data-go="0"]').getBoundingClientRect(), sideB: document.querySelector('#cover [data-go="9"]').getBoundingClientRect(), tb: [...document.querySelectorAll(".tb")].map(b => b.getBoundingClientRect().height), cx: __independents.state().layout })); await mshot("07-phone-cover");
  ok(cv.sideA.height >= 44 && cv.sideB.height >= 44 && cv.tb.every(h => h >= 44) && cv.sideA.left >= 0 && cv.sideA.right <= 390, "phone cover: headline, two 44px side buttons and 44px MAP / INDEX", cv);
  await touch("touchStart", 195, 640); await touch("touchEnd"); await mstep(5); /* an empty tap on the cover does nothing odd */
  await m.tap('#cover [data-go="0"]'); await mstep(260, true); await mcss(); let ms = await mst();
  ok(ms.mode === "walk" && ms.cur === 0, "tapping SIDE A dives into track 01", { mode: ms.mode, cur: ms.cur });
  const dock = await mI(() => { const d = document.querySelector("#dock").getBoundingClientRect(), side = document.querySelector("#dock #sides"), els = [...document.querySelectorAll("#dock button, #dock a")].filter(b => b.getBoundingClientRect().width > 0).map(b => [b.className || b.dataset.side, Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width)]); return { top: d.top, bottom: d.bottom, w: d.width, sideInDock: !!side, els, visible: getComputedStyle(document.querySelector("#card")).visibility }; });
  ok(dock.sideInDock && dock.bottom <= 844 && dock.w <= 390 && dock.top > 380, "the LIVE / ROADMAP switch moves into the bottom sheet; the sheet stays in the lower half", dock);
  ok(dock.els.length >= 5 && dock.els.every(e => e[1] >= 44), "every control in the sheet is at least 44px tall", dock.els.filter(e => e[1] < 44));
  const ppl = await mI(() => __independents.projectPlate(0)); const lay = (await mst()).layout;
  ok(ppl.x - ppl.w / 2 >= 0 && ppl.x + ppl.w / 2 <= 390 && ppl.y + ppl.w * .625 <= dock.top + 30 && ppl.y - ppl.w * .625 >= 30 && Math.abs(ppl.y - lay.cy) < 14, "the plate is framed above the sheet, inside the screen, centred on the focus", { ppl, dockTop: dock.top, cy: lay.cy }); await mshot("08-phone-walk");
  await swipe(300, 330, 90, 330); ms = await mst(); ok(ms.cur === 1, "swiping left travels to the next track", ms.cur);
  await swipe(300, 420, 300, 190); ms = await mst(); ok(ms.cur === 2, "swiping up also travels forward", ms.cur);
  await swipe(100, 330, 300, 330); ms = await mst(); ok(ms.cur === 1, "swiping right goes back", ms.cur);
  const pl2 = await mI(() => __independents.projectPlate(__independents.state().cur)); const pk0 = (await mst()).pokes; await m.touchscreen.tap(pl2.x, pl2.y); await mstep(8); ok((await mst()).pokes === pk0 + 1, "tapping the plate pokes the preview", [(await mst()).pokes, pk0]);
  await m.tap('#dock #sides [data-side="B"]'); await mstep(200, true); ms = await mst(); ok(ms.cur === 9, "tapping ROADMAP in the sheet goes to Side B", ms.cur);
  await m.tap("#card .nav[data-step='1']"); await mstep(80); ok((await mst()).cur === 10, "the sheet's next button works with a thumb");
  await m.tap("#mapBtn"); await mstep(220, true); await mcss(); ms = await mst(); ok(ms.mode === "map", "MAP rises back over the record", ms.mode);
  const dockHidden = await mI(() => getComputedStyle(document.querySelector("#dock")).opacity); ok(dockHidden === "0", "the sheet gets out of the way in the map", dockHidden); await mshot("09-phone-map");
  await swipe(120, 520, 320, 520); const spn = (await mst()).spin; await mstep(5); ok(Math.abs(spn - ms.spin) > .5, "a swipe on the map spins the record", [ms.spin, spn]);
  await m.tap("#indexBtn"); await mcss(); const sheet = await mI(() => { const r = document.querySelector("#index").getBoundingClientRect(); const rows = [...document.querySelectorAll("#index a.trk")].map(a => a.getBoundingClientRect().height); return { top: r.top, bottom: r.bottom, w: r.width, minRow: Math.min(...rows), n: rows.length, scrolls: document.querySelector("#index").scrollHeight > document.querySelector("#index").clientHeight, sw: document.documentElement.scrollWidth }; }); await mshot("10-phone-index");
  ok(sheet.top > 80 && sheet.bottom <= 844 && sheet.w === 390 && sheet.minRow >= 44 && sheet.n === 19 && sheet.scrolls && sheet.sw <= 390, "the index is a bottom sheet: 19 rows, 44px+ each, scrollable, no overflow", sheet);
  await mI(() => document.querySelector('a.trk[data-slug="byzantine"]').scrollIntoView()); await m.tap('a.trk[data-slug="byzantine"]'); await mstep(260, true); ms = await mst(); ok(ms.cur === 14 && ms.mode === "walk" && !ms.indexOpen, "tapping a row flies to its plate and closes the sheet", ms);
  await mshot("11-phone-walk-15");
  const ph = await mI(() => ({ you: getComputedStyle(document.querySelector("#card .c-you")).display, open: document.querySelector("#card a.open").getBoundingClientRect().height, sw: document.documentElement.scrollWidth }));
  ok(ph.open >= 52 && ph.sw <= 390, "the PEEK AT button is thumb-sized and nothing overflows", ph);
  await mctx.close();

  console.log("\n[7b] no WebGL: the tracklist is the page");
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const np = await nctx.newPage(); watch(np);
  await np.goto(url + "?nogl", { waitUntil: "load" }); await np.waitForFunction(() => window.__independents, null, { timeout: 30000 });
  const ng = await np.evaluate(() => ({ nogl: document.body.classList.contains("nogl"), canvas: getComputedStyle(document.querySelector("#world")).display, rows: [...document.querySelectorAll("#index a.trk")].filter(a => a.getBoundingClientRect().width > 0).length, scroll: document.documentElement.scrollHeight > innerHeight, cover: getComputedStyle(document.querySelector("#cover")).display, sw: document.documentElement.scrollWidth <= innerWidth }));
  ok(ng.nogl && ng.canvas === "none" && ng.rows === 19 && ng.scroll && ng.cover === "none" && ng.sw, "without WebGL the page degrades to a plain scrolling list of 19 real links", ng);
  await nctx.close();

  console.log("\n[8] errors");
  ok(errors.length === 0, "zero console errors, zero page errors, zero failed requests", errors.slice(0, 6));
  await browser.close(); srv.close();
  console.log(`\n${fail ? "FAIL" : "PASS"}: ${pass} ok, ${fail} failed` + (bad.length ? "\n  - " + bad.join("\n  - ") : ""));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
