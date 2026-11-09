#!/usr/bin/env node
/* =====================================================================
   Headless-Chromium certification for prototypes/root-explorer-minimal.

   Serves the repo root on a throwaway port, opens the page with software WebGL
   and proves, with real keyboard and mouse events:

   1. all 19 deterministic ports pass their self-test tape (run twice, same
      hash) and all 19 painters draw something;
   2. the tracklist is 19 hairline-leader rows, 01..19, Side A then Side B, each
      with a two-word formal sub-caption, a par/metric and a mechanism tag, every
      href points at a file that exists in this repo; html, body and the sleeve are
      one full-bleed #151516 card (no plaster, petals, margin or shadow); the top
      ensemble credits, the Scattered Days liner-note blocks, the IND-LP-019
      colophon and the multi-ring sigil are all present;
   2b. the world is dense: survey fiducials, elevation ticks, five etched
      territories, a compass rose that answers the camera, groove micro-landmarks,
      chalk motes; every landmark is a 3-layer (z -0.35 / 0 / +0.35) paper-cut with a
      moving mechanism, a numbered plinth and a pennant; the lantern ring and the
      bearing line follow the wanderer; the stage has callouts, a live FPS / tick
      HUD and one clickable keycap per port action;
   3. WASD and the arrow keys walk the wanderer; clicking the ground walks it;
   4. clicking any of the 19 track rows pins it, the camera glides to its
      landmark, the paper board hinges up, the liner notes name its state
      hash, and a real mouse click on the board changes the live session;
   5. hovering a row previews it and releases on leave; clicking a landmark in
      the map pins the matching row (bidirectional);
   6. Space toggles the lineage threads, Esc releases, Enter folds the paper
      and hands off with the #fragment contract (route first, then
      from / v / h / s); an app that is not on main yet does not navigate;
   7. zero console errors, zero page errors, no horizontal overflow at 390px.

   Run:   node prototypes/root-explorer-minimal/verify.cjs
   Shots: SHOTS=/some/dir node prototypes/root-explorer-minimal/verify.cjs
   Needs: playwright (local or global) with a Chromium build; network once for
          the pinned three.js on jsDelivr (same as the Fish Night page).
   Exit 0 = every certificate green.
   ===================================================================== */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), cp = require("child_process");
let pw; try { pw = require("playwright"); } catch (e) { pw = require(path.join(cp.execSync("npm root -g").toString().trim(), "playwright")); }
const ROOT = path.resolve(__dirname, "..", ".."), SHOTS = process.env.SHOTS || "";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/plain" };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0].split("#")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(d); }); });

let pass = 0, fail = 0; const bad = [];
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log("  ok   " + msg); } else { fail++; bad.push(msg); console.log("  FAIL " + msg + (extra !== undefined ? "  ← " + JSON.stringify(extra) : "")); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port, url = `http://localhost:${port}/prototypes/root-explorer-minimal/index.html`;
  const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); }); page.on("pageerror", e => errors.push("pageerror: " + (e.stack || e.message)));
  page.on("requestfailed", rq => { const u = rq.url(); if (!/fonts\.(googleapis|gstatic)\.com/.test(u)) errors.push("requestfailed: " + u); });
  page.on("response", rs => { if (rs.status() >= 400 && rs.url().startsWith(`http://localhost:${port}`) && !/favicon/.test(rs.url())) errors.push("http " + rs.status() + ": " + rs.url()); });
  const I = fn => page.evaluate(fn);
  const step = (n, render = true) => page.evaluate(([n, render]) => __independents.stepSim(n, 1 / 60, render), [n, render]);
  const st = () => I(() => __independents.state());
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png") }); } };

  console.log("\n[1] load + ports + painters");
  await page.goto(url, { waitUntil: "load" }); await page.waitForFunction(() => window.__independents && document.querySelectorAll("a.trk").length === 19, null, { timeout: 30000 });
  const rep = await I(() => ({ ports: __independents.PORT_REPORT.map(r => [r.slug, r.ok, r.hash]), paint: __independents.PAINT_REPORT.map(r => [r.slug, r.ok, r.err || r.lit]), gl: !document.body.classList.contains("nogl") }));
  ok(rep.gl, "WebGL context created");
  ok(rep.ports.length === 19 && rep.ports.every(r => r[1]), "19/19 ports pass the self-test tape (two runs, same hash)", rep.ports.filter(r => !r[1]));
  ok(new Set(rep.ports.map(r => r[2])).size === 19, "19 distinct state hashes");
  ok(rep.paint.length === 19 && rep.paint.every(r => r[1]), "19/19 painters draw", rep.paint.filter(r => !r[1]));

  console.log("\n[2] tracklist");
  const rows = await I(() => [...document.querySelectorAll("a.trk")].map(a => ({ n: a.querySelector(".n").textContent, t: a.querySelector(".t").textContent, d: a.querySelector(".d").textContent, href: a.getAttribute("href"), slug: a.dataset.slug, lead: getComputedStyle(a.querySelector(".lead")).height, side: a.closest("ol").id })));
  ok(rows.map(r => r.n).join() === Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")).join(), "rows numbered 01..19");
  ok(/FOGWALK/.test(rows[0].t) && rows[0].d === "05:00· AUTOMATA", "row 01 FOGWALK ... 05:00 · AUTOMATA", rows[0]);
  ok(/BLOOMWRIGHT/.test(rows[1].t) && rows[1].d === "04:12· L-SYSTEM", "row 02 BLOOMWRIGHT ... 04:12 · L-SYSTEM", rows[1]);
  ok(rows.slice(0, 9).every(r => r.side === "sideA") && rows.slice(9).every(r => r.side === "sideB") && rows.filter(r => r.side === "sideB").length === 10, "9 shipped on Side A, 10 prototypes on Side B");
  ok(rows.every(r => r.lead === "1px"), "every leader is a 1px hairline");
  const missing = rows.filter(r => r.slug !== "longhaul" && !fs.existsSync(path.resolve(ROOT, "prototypes", "root-explorer-minimal", r.href.split("#")[0], r.href.endsWith("/") ? "" : "")) && !fs.existsSync(path.resolve(ROOT, "prototypes", "root-explorer-minimal", r.href.split("#")[0])));
  ok(missing.length === 0, "every row href resolves to a path in this repo (except Long Haul, not on main yet)", missing.map(r => r.href));
  const fb = await I(() => { const cs = (x, p) => getComputedStyle(x, p), s = document.querySelector(".sleeve"), r = s.getBoundingClientRect();
    return { html: cs(document.documentElement).backgroundColor, body: cs(document.body).backgroundColor, sleeve: cs(s).backgroundColor, shadow: cs(s).boxShadow, mt: cs(s).marginTop, ml: cs(s).marginLeft, mr: cs(s).marginRight,
      left: r.left, top: r.top, w: r.width, h: r.height, cw: document.documentElement.clientWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, petals: document.querySelectorAll(".petal").length,
      plaster: cs(document.documentElement).getPropertyValue("--plaster").trim(), petalDefs: document.querySelectorAll("#pt,#pf,#pb").length, tooth: cs(document.body, "::before").content,
      grain: cs(s).getPropertyValue("--grain").trim().slice(0, 22), vig: cs(s, "::after").backgroundImage.includes("radial-gradient"), vigPos: cs(s, "::after").position, fibre: cs(s, "::before").backgroundImage.includes("url(") }; });
  ok(fb.html === "rgb(21, 21, 22)" && fb.body === "rgb(21, 21, 22)" && fb.sleeve === "rgb(21, 21, 22)", "html, body and main.sleeve are all #151516 charcoal cardstock", fb);
  ok(fb.left === 0 && fb.top === 0 && Math.abs(fb.w - fb.cw) < 1 && fb.h >= fb.ih - 1 && fb.sw <= fb.cw, "the sleeve is full-bleed: 100% of the viewport width, at least its height, no overflow", fb);
  ok(fb.mt === "0px" && fb.ml === "0px" && fb.mr === "0px" && fb.shadow === "none", "no outer margin and no card drop-shadow", fb);
  ok(fb.petals === 0 && fb.petalDefs === 0 && fb.plaster === "" && fb.tooth === "none", "plaster, petals and the plaster tooth layer are gone", fb);
  ok(fb.grain.startsWith("url(") && fb.fibre && fb.vig && fb.vigPos === "fixed", "procedural paper fibre + chalk dust grain and a viewport vignette cover the whole screen", fb);

  console.log("\n[2b] ensemble credits, liner-note blocks, colophon, sigil");
  const ens = await I(() => { const e = document.querySelector("#ensemble"); return { next: document.querySelector("h1").nextElementSibling?.id, cols: e.querySelectorAll(".col").length, rows: [...e.querySelectorAll(".cr")].map(r => ({ b: r.querySelector("b").textContent, v: r.querySelector("span").textContent, lead: getComputedStyle(r.querySelector("i")).height })) }; });
  ok(ens.next === "ensemble" && ens.cols === 2 && ens.rows.length === 6, "two-column ensemble block sits right under the header", ens);
  ok(["AUTOMATA", "COMMIT-REVEAL", "WEBRTC", "60 HZ", "CELLULAR"].every(k => ens.rows.some(r => r.b.toUpperCase().includes(k))), "ensemble credits the five formal mechanisms", ens.rows.map(r => r.b));
  ok(ens.rows.some(r => /ČERNÝ 1964/i.test(r.v)) && ens.rows.some(r => /LAMPORT/i.test(r.v)) && ens.rows.some(r => /LINDENMAYER 1968/i.test(r.v)), "and their mathematical lineages", ens.rows.map(r => r.v));
  ok(ens.rows.every(r => r.lead === "1px") && /with special guest/i.test(ens.rows[5].b) && /2\.5D PERSPECTIVE STAGE/i.test(ens.rows[5].v), "every credit has a 1px underline leader; with special guest ____ 2.5D PERSPECTIVE STAGE", ens.rows[5]);
  const sub = await I(() => [...document.querySelectorAll("a.trk")].map(a => ({ sub: a.querySelector(".sub")?.textContent, pm: a.querySelector(".pm")?.textContent, tag: a.querySelector(".d em")?.textContent, l2: getComputedStyle(a.querySelector(".lead2")).height })));
  ok(sub.every(r => /^\S+ \S+$/.test(r.sub)), "every row has a two-word formal sub-caption", sub.filter(r => !/^\S+ \S+$/.test(r.sub)));
  ok(sub.every(r => r.pm && r.pm.length > 2 && r.tag && r.l2 === "1px") && sub[0].pm === "PAR 5", "every row has a hairline leader to a par/metric (Fogwalk's par is the computed BFS optimum, 5) and a mechanism tag", sub[0]);
  const idleLabels = await I(() => [...document.querySelectorAll(".credits b")].map(b => b.textContent.toUpperCase()));
  ok(["PRODUCED BY", "ENGINEERED BY", "FORMAL CITE", "CERTIFIED AT", "TRANSPORT", "STATE HASH"].every(k => idleLabels.includes(k)), "liner notes carry PRODUCED BY / ENGINEERED BY / FORMAL CITE / CERTIFIED AT / TRANSPORT / STATE HASH", idleLabels);
  const colo = await I(() => { const l = document.querySelector("#colophon").getBoundingClientRect(), sg = document.querySelector("#sigil").getBoundingClientRect(); return { lno: document.querySelector("#colophon .lno").textContent, l: l.left, sgR: sg.right, iw: document.documentElement.clientWidth, sgTop: sg.top, lTop: l.top }; });
  ok(colo.lno === "IND-LP-019" && colo.l < 90 && colo.sgR > colo.iw - 90, "IND-LP-019 label colophon bottom-left, sigil bottom-right", colo);
  const sg = await I(() => ({ groups: ["sgOut", "sgRing", "sgMid", "sgIn"].filter(i => document.getElementById(i)).length, circles: document.querySelectorAll("#sigil circle").length, lines: document.querySelectorAll("#sigil line").length, polys: document.querySelectorAll("#sigil polygon").length }));
  ok(sg.groups === 4 && sg.circles >= 14 && sg.lines >= 85 && sg.polys >= 6, "the sigil is a four-group multi-ring monoline mark (gauge, 19-gon, hexagram, pentagram, 16-star)", sg);
  ok(await I(() => document.querySelectorAll("#sgRing .tick").length) === 19, "sigil carries 19 ticks, one per track");

  console.log("\n[3] keyboard walking + click-to-walk");
  await I(() => __independents.skipIntro()); await step(120);
  await shot("01-follow");
  const w0 = (await st()).wan;
  await page.keyboard.down("d"); await step(40, false); await page.keyboard.up("d"); const w1 = (await st()).wan;
  ok(w1[0] > w0[0] + 3 && Math.abs(w1[1] - w0[1]) < .5, "D walks right", [w0, w1]);
  await page.keyboard.down("ArrowDown"); await step(40, false); await page.keyboard.up("ArrowDown"); const w2 = (await st()).wan;
  ok(w2[1] > w1[1] + 3, "ArrowDown walks toward the viewer", [w1, w2]);
  await page.keyboard.down("a"); await step(40, false); await page.keyboard.up("a"); const w3 = (await st()).wan;
  ok(w3[0] < w2[0] - 3, "A walks left", [w2, w3]);
  await page.keyboard.down("ArrowUp"); await step(40, false); await page.keyboard.up("ArrowUp"); const w4 = (await st()).wan;
  ok(w4[1] < w3[1] - 3, "ArrowUp walks away", [w3, w4]);
  await step(60, false); const w5 = (await st()).wan; await step(30, false); const w6 = (await st()).wan;
  ok(Math.hypot(w6[0] - w5[0], w6[1] - w5[1]) < .01, "wanderer stops when the keys are released");
  await step(60);
  const tgt = [w6[0] + 4, w6[1] + 2], pt = await page.evaluate(([x, z]) => __independents.world.groundPoint(x, z), tgt);
  await page.mouse.click(pt.x, pt.y); await step(150, false); const w7 = (await st()).wan;
  ok(Math.hypot(w7[0] - tgt[0], w7[1] - tgt[1]) < .6, "clicking the ground walks the wanderer there", { tgt, w7 });

  console.log("\n[3b] the dense world: ground layer, micro-landmarks, layered landmarks, lantern, compass");
  const D = await I(() => { const w = __independents.world, d = w.DETAIL; return { ...d, totems: w.totems.map(t => ({ slug: t.art.slug, z: t.layers.map(l => l.position.z), mechs: t.mechs.length, plinth: t.txt.userData.text, pennant: t.num.userData.text, n: t.art.n })) }; });
  ok(D.fiducials >= 300, `survey grid of + fiducial crosshairs across y = 0 (${D.fiducials})`, D.fiducials);
  ok(D.elevTicks >= 30 && D.elevLabels >= 4 && D.axisLabels >= 10, `elevation index ticks (${D.elevTicks}), spot heights (${D.elevLabels}) and grid margin labels (${D.axisLabels})`, D);
  ok(JSON.stringify(D.territories) === JSON.stringify(["I · AUTOMATA RIDGE", "II · SEALED BASIN", "III · CELLULAR FLATS", "IV · LOCKSTEP TRENCH", "V · PEER COMMONS"]), "five etched territory labels lie on the ground", D.territories);
  ok(D.rose && D.rose.r >= 6, "a large compass rose / azimuth ring is etched into the ground", D.rose);
  ok(D.posts >= 8 && D.cairns >= 8 && D.flags >= 4 && D.reeds >= 100 && D.motes >= 200, `micro-landmarks along the groove: ${D.posts} mile-marker posts, ${D.cairns} cairns, ${D.flags} survey flags, ${D.reeds} reed clusters, ${D.motes} chalk motes`, D);
  ok(D.totems.length === 19 && D.totems.every(t => t.z.join() === "-0.35,0,0.35"), "all 19 landmarks are 3-layer paper-cuts at z = -0.35, 0, +0.35", D.totems.filter(t => t.z.join() !== "-0.35,0,0.35"));
  ok(D.totems.every(t => t.mechs >= 1) && D.totems.filter(t => t.mechs > 1).length >= 2, "each has a moving mechanical sub-element (Deadlock and Byzantine Choir have two)", D.totems.filter(t => !t.mechs));
  ok(D.totems.every(t => t.plinth === String(t.n).padStart(2, "0") && t.pennant === t.plinth), "each has an etched plinth and a pennant badge lettered 01..19");
  const mechState = () => I(() => __independents.world.totems.map(t => t.mechs.map(m => [m.g.position.x, m.g.position.y, m.g.rotation.z, m.g.scale.x].map(v => v.toFixed(4)).join()).join("|")));
  const m0 = await mechState(); await step(37, false); const m1 = await mechState();
  ok(m0.every((v, i) => v !== m1[i]), "every mechanism moved after 37 frames of uTime", m0.map((v, i) => v === m1[i] ? i : null).filter(v => v !== null));
  const kick = await I(() => { const a = __independents.ART[0], t = __independents.world.totems[0]; a.session.do("up"); __independents.stepSim(1, 1 / 60, false); const k1 = a.kick, mc = t.mechs[0], p0 = mc.ph; __independents.stepSim(30, 1 / 60, false); return { k1, k2: a.kick, dph: mc.ph - p0 }; });
  ok(kick.k1 > .9 && kick.k2 < kick.k1, "a session action kicks its landmark's mechanism (revision counter -> speed boost) and it settles", kick);
  const lan = await I(() => { const w = __independents.world; return { vis: w.lantern.visible, parent: w.lantern.parent === w.scene.children.find(c => c === w.lantern.parent), colA: w.ringA.material.color.getHexString(), colB: w.ringB.material.color.getHexString(), rs: w.ringA.scale.x, y: w.ringA.geometry ? 1 : 0, vis2: w.ringA.visible && w.ringB.visible }; });
  ok(lan.vis && lan.vis2 && lan.colA === "ee6a3c" && lan.colB === "ee6a3c" && lan.rs > 1.4, "the wanderer carries a lantern light ring projected on the ground", lan);
  const rose0 = await I(() => { const w = __independents.world; return { d: w.roseDial.rotation.y, c: w.camMark.rotation.y, o: w.roseMat.opacity, az: w.CAM.az }; });
  await I(() => __independents.pin("fogwalk")); await step(150, false);
  const rose1 = await I(() => { const w = __independents.world; return { d: w.roseDial.rotation.y, c: w.camMark.rotation.y, o: w.roseMat.opacity, az: w.CAM.az }; });
  ok(Math.abs(rose1.d - rose0.d) > .05 && Math.abs(rose1.c - rose0.c) > .015 && rose1.o > rose0.o + .03, "the compass rose responds to the camera's angle (dial turns, marker moves, ring brightens as the camera drops)", { rose0, rose1 });
  await I(() => __independents.unpin()); await step(120, false);

  console.log("\n[4] all 19 tracks: row click -> camera, board, liner notes, live board click");
  const unresponsive = [];
  for (let i = 0; i < 19; i++) {
    const slug = rows[i].slug;
    await I(() => __independents.unpin()); await step(70, false);
    await page.locator(`a.trk[data-slug="${slug}"]`).click({ position: { x: 20, y: 6 } });
    await step(110);
    const s = await st();
    const g = await page.evaluate(i => { const w = __independents.world, p = __independents.POS[i]; return { dx: Math.hypot(w.CAM.look.x - (p.x + __independents.FOCUS_DX), w.CAM.look.z - p.z), dist: w.CAM.dist, el: w.CAM.el }; }, i);
    const live = await I(() => { const d = __independents.inkCv.getContext("2d").getImageData(0, 0, 512, 384).data; let lit = 0, acc = 0; for (let k = 0; k < d.length; k += 16) { if (d[k] > 170 && d[k + 1] > 165) lit++; if (d[k] > 180 && d[k + 2] < 110) acc++; } return { lit, acc }; });
    const liner = await I(() => ({ hash: document.querySelector("#hashVal")?.textContent, rowOn: document.querySelector("a.trk.on")?.dataset.slug, play: document.querySelector("#playA").disabled }));
    const good = s.pin === slug && s.boardSlug === slug && s.boardOpen > .9 && g.dx < .9 && g.dist < 22 && g.el < .6 && liner.rowOn === slug && !liner.play && /^[0-9a-f]{8}$/.test(liner.hash || "") && live.lit > 40;
    ok(good, `${String(i + 1).padStart(2, "0")} ${slug}: pinned, camera framed (dist ${g.dist.toFixed(1)}), board up, liner hash ${liner.hash}, ${live.lit} chalk px${live.acc ? ", " + live.acc + " accent px" : ""}`, { s, g, liner, live });
    if (i === 0 || i === 9) await shot(`02-focus-${slug}`);
    // a real mouse click on the board must move the live session: scan a 7x5 lattice until the hash changes
    const h0 = await page.evaluate(i => __independents.ART[i].session.hash(), i); let moved = false;
    for (let vi = 0; vi < 5 && !moved; vi++) for (let ui = 0; ui < 7 && !moved; ui++) {
      const u = (ui + .5) / 7, v = (vi + .5) / 5, p = await page.evaluate(([u, v]) => __independents.world.boardPoint(u, v), [u, v]);
      await page.mouse.click(p.x, p.y); await step(2, false);
      moved = (await page.evaluate(i => __independents.ART[i].session.hash(), i)) !== h0;
    }
    if (!moved) unresponsive.push(slug);
    const liner2 = await I(() => document.querySelector("#hashVal")?.textContent), real2 = await page.evaluate(i => __independents.ART[i].session.hash(), i);
    await step(20, false);
    if (moved) { const lh = await I(() => document.querySelector("#hashVal")?.textContent); ok(/^[0-9a-f]{8}$/.test(lh), `${slug}: a real mouse click on the board moved the session (${h0} → ${real2})`); void liner2; }
    // stage furniture: a live FPS / tick HUD, drafting callouts, and one clickable keycap per port action (spied, so no-op actions count too)
    await step(20, false);
    const stage = await page.evaluate(i => { const w = __independents.world, a = __independents.ART[i], want = a.session.actions.filter(x => x.ui !== false).slice(0, 18).map(x => x.id), on = w.keycaps.filter(k => k.on).map(k => k.id), d = w.hud.material.map.image.getContext("2d").getImageData(0, 0, 1024, 64).data; let lit = 0; for (let k = 3; k < d.length; k += 16) if (d[k] > 60) lit++;
      window.__calls = []; const o = a.session.do; a.session.do = function (id, arg) { window.__calls.push(id); return o.call(this, id, arg); }; a.__od = o; return { want, on, lit, hud: { ...w.hudInfo }, kids: w.board.children.length }; }, i);
    const kcOk = JSON.stringify(stage.want) === JSON.stringify(stage.on) && stage.want.length > 0;
    for (let j = 0; j < stage.want.length; j++) { const kp = await page.evaluate(j => __independents.world.keycapPoint(j), j); await page.mouse.click(kp.x, kp.y); await step(2, false); }
    const calls = await page.evaluate(i => { const a = __independents.ART[i], c = window.__calls; a.session.do = a.__od; delete a.__od; return c; }, i);
    ok(kcOk && JSON.stringify(calls) === JSON.stringify(stage.want) && stage.lit > 150 && /^FPS \d+ · [\d.]+ MS$/.test(stage.hud.l) && /^(TICK 60 HZ|TURN-BASED) · REV \d+$/.test(stage.hud.r) && stage.kids >= 3,
      `${slug}: stage has ${stage.want.length} keycaps, a real click on each fired its action (${calls.join(",")}), HUD "${stage.hud.l}" / "${stage.hud.r}"`, { stage, calls });
    await step(5, false);
  }
  ok(unresponsive.length === 0, "every board answered a real mouse click", unresponsive);

  console.log("\n[5] hover preview, release, and landmark <-> row bidirection");
  await I(() => { __independents.unpin(); const w = __independents.world; w.WAN.p.set(-50, 0, -36); w.WAN.target = null; w.WAN.v.set(0, 0, 0); }); await step(120, false);
  await page.locator('a.trk[data-slug="driftwatch"]').hover(); await step(100);
  let s = await st();
  ok(s.hover === "driftwatch" && s.eff === "driftwatch" && !s.pin && s.boardSlug === "driftwatch" && s.boardOpen > .9, "hovering a row previews its landmark and raises the board", s);
  ok(await I(() => document.querySelector('a.trk[data-slug="driftwatch"]').classList.contains("hot")), "hovered row is marked hot, not pinned");
  const brg = await I(() => { const w = __independents.world, a = __independents.ART.find(x => x.slug === "driftwatch"), dx = a.pos.x - w.WAN.p.x, dz = a.pos.z + 1 - w.WAN.p.z, want = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, t = document.querySelector(".tag.brg"); return { vis: w.bear.visible && w.bearEnd.visible, txt: t.textContent, op: t.style.opacity, want, range: Math.hypot(dx, dz), sx: w.bear.scale.x }; });
  const got = +(/BRG (\d{3})°/.exec(brg.txt) || [])[1];
  ok(brg.vis && Math.abs(((got - brg.want + 540) % 360) - 180) <= 1 && new RegExp(`· ${brg.range.toFixed(1)} U$`).test(brg.txt) && brg.sx > 5, `the lantern throws a compass bearing line to the hovered track: ${brg.txt}`, brg);
  await page.mouse.move(700, 60); await step(110); s = await st();
  ok(!s.hover && !s.eff && s.boardOpen < .1, "leaving the row folds the board back down", s);
  ok(!(await I(() => __independents.world.bear.visible)), "the bearing line goes away with the focus");
  await I(() => __independents.toggleMap(true)); await step(200); await shot("06-map");
  const lp = await I(() => __independents.world.landmarkPoint("gc"));
  await page.mouse.move(lp.x, lp.y); await step(2, false);
  ok(await I(() => document.querySelector('a.trk[data-slug="gc"]').classList.contains("hot")), "hovering a landmark in the world lights its tracklist row");
  await page.mouse.click(lp.x, lp.y); await step(480, false); await step(10); s = await st();
  ok(s.pin === "gc" && s.boardSlug === "gc" && !s.map, "clicking a landmark pins its track (and leaves the map)", s);
  ok(await I(() => document.querySelector("a.trk.on")?.dataset.slug) === "gc", "its row is the pinned row");
  const pl = await I(() => ({ labels: [...document.querySelectorAll(".credits b")].map(b => b.textContent.toUpperCase()), hash: document.querySelector("#hashVal")?.textContent }));
  ok(["PRODUCED BY", "ENGINEERED BY", "FORMAL CITE", "CERTIFIED AT", "TRANSPORT", "STATE HASH", "WITH SPECIAL GUEST"].every(k => pl.labels.includes(k)) && /^[0-9a-f]{8}$/.test(pl.hash), "pinned liner notes keep the six Scattered Days blocks, now about the track, plus a special guest", pl);
  const sp = await I(() => { const a = __independents.ART.find(a => a.slug === "gc"); return [a.pos.x + .4, a.pos.z + 2.8]; });
  ok(Math.hypot(s.wan[0] - sp[0], s.wan[1] - sp[1]) < 1.2, "the wanderer walked to the landmark's standing spot", { wan: s.wan, sp });
  await shot("03-focus-gc");

  console.log("\n[6] walking near a landmark focuses it; walking away releases");
  await I(() => __independents.unpin()); await step(60, false);
  await I(() => { const a = __independents.ART[2], w = __independents.world; w.WAN.p.set(a.pos.x + 3, 0, a.pos.z + 3); w.WAN.target = null; w.WAN.v.set(0, 0, 0); });
  await step(120); s = await st();
  ok(s.near === "tonguecracker" && s.eff === "tonguecracker" && !s.pin && s.boardSlug === "tonguecracker", "standing next to a landmark focuses it without pinning", s);
  await page.keyboard.down("w"); await step(110, false); await page.keyboard.up("w"); await step(150); s = await st();
  ok(!s.near && !s.eff, "walking away lets the camera go back to following", s);

  console.log("\n[7] Space threads, Esc, Enter handoff");
  ok(!(await st()).threads, "threads start off");
  await page.keyboard.press("Space"); await step(60); s = await st();
  ok(s.threads, "Space draws the constellation threads", s);
  const th = await I(() => { let n = 0, vis = 0; __independents.world.scene.traverse(o => { if (o.isLineSegments2 && o.visible && o.geometry.instanceCount > 0 && o.material.opacity >= .45 && o.material.opacity <= .5) { n++; vis = Math.max(vis, o.geometry.instanceCount); } }); return { n, vis }; });
  ok(th.vis >= 28 * 29, "all 28 lineage edges are drawn on the ground plane", th);
  await shot("04-threads");
  await page.keyboard.press("Space"); await step(60);
  ok(!(await st()).threads, "Space again hides them");
  await I(() => { window.__nav = null; window.__independents_nav = u => { window.__nav = u; }; });
  await page.locator('a.trk[data-slug="sporefront"]').click(); await step(110);
  await page.keyboard.press("Escape"); await step(5, false); s = await st();
  ok(!s.pin, "Esc releases the pin", s);
  await page.locator('a.trk[data-slug="sporefront"]').click(); await step(110);
  await page.keyboard.press("Enter"); await step(30, false); s = await st();
  ok(s.diving, "Enter starts the fold", s);
  await step(90, false); s = await st();
  ok(s.boardOpen < .15, "the paper board folds flat into the card", s);
  await page.waitForFunction(() => window.__nav, null, { timeout: 5000 }).catch(() => { });
  let nav = await I(() => window.__nav);
  ok(/\/prototypes\/life-ecologies\/index\.html#sporefront&from=root&v=1&h=[0-9a-f]{8}&s=/.test(nav || ""), "Enter on Sporefront navigates to ../life-ecologies/index.html#sporefront with from/v/h/s", nav);
  await I(() => { __independents.FOC.diving = false; __independents.world.fold("sporefront", false); __independents.unpin(); window.__nav = null; }); await step(60, false);
  await page.locator('a.trk[data-slug="fogwalk"]').click(); await step(110);
  await page.getByRole("button", { name: /Dive in/ }).first().click(); await page.waitForFunction(() => window.__nav, null, { timeout: 5000 }).catch(() => { });
  nav = await I(() => window.__nav);
  ok(/\/apps\/fogwalk\/#from=root&v=1&s=[\w-]+&h=[0-9a-f]{8}$/.test(nav || ""), "DIVE IN on Fogwalk navigates to ../../apps/fogwalk/ with s (state) and h (hash)", nav);
  await I(() => { __independents.FOC.diving = false; __independents.world.fold("fogwalk", false); __independents.unpin(); window.__nav = null; }); await step(60, false);
  await page.locator('a.trk[data-slug="longhaul"]').click(); await step(110); await page.keyboard.press("Enter"); await sleep(1400); await step(30, false); s = await st();
  ok(!(await I(() => window.__nav)) && !s.diving, "Long Haul (not on main yet) folds and unfolds without navigating", s);

  console.log("\n[8] sigil + mobile");
  await I(() => __independents.unpin()); await step(60, false);
  await page.locator("#sigil").click(); ok((await st()).threads, "clicking the sigil toggles the threads"); await page.locator("#sigil").click();
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(300); await step(60);
  const ov = await I(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, fh: document.querySelector("#frame").getBoundingClientRect().height }));
  ok(ov.sw <= ov.iw, "no horizontal overflow at 390px", ov);
  await page.locator('a.trk[data-slug="shadow"]').scrollIntoViewIfNeeded(); await page.locator('a.trk[data-slug="shadow"]').click(); await step(110);
  await page.evaluate(() => document.querySelector("#world").scrollIntoView()); await sleep(200); await shot("05-mobile-shadow");
  ok((await st()).boardSlug === "shadow", "mobile: track click raises the board");

  console.log("\n[9] console");
  ok(errors.length === 0, "zero console errors, page errors or failed local requests", errors);

  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("FAILED:\n  " + bad.join("\n  "));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
