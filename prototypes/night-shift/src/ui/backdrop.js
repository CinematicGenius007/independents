/* The department behind the screen. A photograph of the floor, out of focus, with a live
 * layer of people on top of it. Nothing here affects the game.
 *
 *   .photo        the floor, once at mid blur and once at heavy blur for the near desk
 *   #mid          480x270 canvas: staff, gurneys and light, placed in photo coordinates
 *   #near         160x90 canvas: people crossing right in front of the camera
 *
 * The people who walk are cut out of the photograph itself, with feathered edges, so they
 * have real colour and light. Drawn figures looked like cartoons next to it.
 *
 * The low canvas resolutions are the depth of field: stretched to the window they are soft
 * for free. Lanes are the walkable parts of the photo, so people stay on the floor. */
const Backdrop = (() => {
  const PW = 1376, PH = 768;       // the photograph
  const OVER = 1.06;               // layers overscan the window so the sway never shows an edge
  const MIDW = 480, MIDH = 270, NEARW = 160, NEARH = 90;
  // [x, y, w, h] of people standing clear in the photograph
  const CUTOUTS = [[722, 278, 112, 244], [1150, 305, 112, 315], [205, 262, 112, 248], [535, 282, 106, 208], [798, 212, 40, 112], [648, 216, 48, 122], [895, 222, 44, 116]];
  const DOOR = [703, 232];
  const GLOWS = [[175, 224, '#58e08a'], [1262, 226, '#58e08a'], [350, 214, '#8fd0ff'], [1073, 178, '#ffffff']];

  // Where people can walk, in photo pixels. Left and right aisles are the parts the monitor leaves visible.
  const LANES = [
    { x0: -150, x1: 470, y0: 470, y1: 438 },
    { x0: -180, x1: 330, y0: 600, y1: 560 },
    { x0: 1500, x1: 980, y0: 455, y1: 400 },
    { x0: 1560, x1: 1120, y0: 610, y1: 560 },
    { x0: 170, x1: 620, y0: 362, y1: 356 },
    { x0: 1240, x1: 840, y0: 360, y1: 350 },
  ];

  let canvas, mc, nc, photos = [], W = 0, H = 0, sc = 1, px = 0, py = 0;
  let busy = 0.4, strobe = 0, code = 0, time = 0, prev = 0, nearIn = 3, stamp = 0;
  let walkers = [], nears = [], sprites = [];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  
  function fit() {
    W = innerWidth * OVER; H = innerHeight * OVER;
    sc = Math.max(W / PW, H / PH);
    px = (W - PW * sc) / 2; py = (H - PH * sc) / 2;
    if (canvas.mid.width !== MIDW) { canvas.mid.width = MIDW; canvas.mid.height = MIDH; canvas.near.width = NEARW; canvas.near.height = NEARH; }
  }
  // photo pixels -> mid canvas pixels
  const X = (x) => ((px + x * sc) / W) * MIDW;
  const Y = (y) => ((py + y * sc) / H) * MIDH;
  const S_ = (d) => ((d * sc) / W) * MIDW;
  const heightAt = (y) => 96 + Math.max(0, y - 330) * 0.78;   // figures grow as they come towards the camera

  function makeSprites(img) {
    sprites = CUTOUTS.map(([x, y, w, h]) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      c.drawImage(img, x, y, w, h, 0, 0, w, h);
      // keep a soft body-shaped column, so the floor around the person falls away
      c.globalCompositeOperation = 'destination-in';
      c.filter = `blur(${Math.max(3, w * 0.09)}px)`;
      c.beginPath(); c.ellipse(w / 2, h * 0.11, w * 0.2, h * 0.1, 0, 0, 6.3); c.fill();
      c.beginPath(); c.ellipse(w / 2, h * 0.55, w * 0.36, h * 0.42, 0, 0, 6.3); c.fill();
      return cv;
    });
  }
  const person = () => ({ sprite: Math.floor(Math.random() * CUTOUTS.length), ph: rand(0, 6.28), flip: Math.random() < 0.5 });
  function spawn(opts = {}) {
    const lane = opts.lane ?? LANES[Math.floor(Math.random() * LANES.length)];
    const out = opts.out ?? Math.random() < 0.5;
    const speed = (opts.speed || rand(0.05, 0.1));
    walkers.push({ lane, u: out ? 1 : 0, dir: out ? -speed : speed, kind: opts.kind || 'walk', crew: opts.crew || [person()], ttl: 60, pause: !opts.kind && Math.random() < 0.25 ? rand(1.5, 5) : 0, pauseAt: rand(0.55, 0.95) });
  }

  function drawPerson(c, x, y, h, p, t, going) {
    if (!sprites.length) return;
    const sp = sprites[p.sprite], w = (sp.width / sp.height) * h, step = Math.sin(t * 7 + p.ph) * going;
    c.save();
    c.translate(x, y - Math.abs(step) * h * 0.014);
    c.rotate(step * 0.022);
    if (p.flip) c.scale(-1, 1);
    c.drawImage(sp, -w / 2, -h, w, h);
    c.restore();
  }
  function drawGurney(c, x, y, h, dirSign) {
    const len = h * 0.95, deck = y - h * 0.3;
    c.strokeStyle = '#8c949c'; c.lineWidth = h * 0.02;
    c.beginPath(); c.moveTo(x - len * 0.35, deck); c.lineTo(x - len * 0.35, y - 2); c.moveTo(x + len * 0.35, deck); c.lineTo(x + len * 0.35, y - 2); c.stroke();
    c.fillStyle = '#222a31'; c.beginPath(); c.arc(x - len * 0.35, y - 2, h * 0.025, 0, 6.3); c.arc(x + len * 0.35, y - 2, h * 0.025, 0, 6.3); c.fill();
    c.fillStyle = '#e4e8ea'; c.fillRect(x - len / 2, deck - h * 0.06, len, h * 0.075);    // mattress
    c.fillStyle = '#b8d0d8'; c.beginPath(); c.ellipse(x - dirSign * len * 0.08, deck - h * 0.08, len * 0.34, h * 0.06, 0, 0, 6.3); c.fill();   // blanket over the patient
    c.fillStyle = '#b9805a'; c.beginPath(); c.arc(x + dirSign * len * 0.38, deck - h * 0.1, h * 0.045, 0, 6.3); c.fill();
    c.strokeStyle = '#9aa4ad'; c.lineWidth = h * 0.012; c.beginPath(); c.moveTo(x + dirSign * len * 0.5, deck); c.lineTo(x + dirSign * len * 0.5, deck - h * 0.6); c.stroke();   // IV pole
    c.fillStyle = '#cfe6ee'; c.fillRect(x + dirSign * len * 0.5 - h * 0.03, deck - h * 0.6, h * 0.06, h * 0.09);
  }
  function drawCrashCart(c, x, y, h) {
    c.fillStyle = '#b12a2c'; c.fillRect(x - h * 0.15, y - h * 0.5, h * 0.3, h * 0.46);
    c.fillStyle = '#7d1c1e'; for (let i = 1; i < 4; i += 1) c.fillRect(x - h * 0.15, y - h * 0.5 + (i * h) / 8.4, h * 0.3, h * 0.012);
    c.fillStyle = '#20262c'; c.fillRect(x - h * 0.15, y - h * 0.04, h * 0.3, h * 0.04);
  }

  function drawMid(dt) {
    const c = mc;
    c.clearRect(0, 0, MIDW, MIDH);
    // furthest away first, so nearer people overlap
    walkers.sort((a, b) => laneY(a) - laneY(b));
    for (const w of walkers) {
      const y = laneY(w), x = w.lane.x0 + (w.lane.x1 - w.lane.x0) * w.u, h = S_(heightAt(y));
      const sx = X(x), sy = Y(y), going = w.pause > 0 && Math.abs(w.u - w.pauseAt) < 0.01 ? 0.1 : 1;
      c.fillStyle = 'rgba(8,12,16,.28)'; c.beginPath(); c.ellipse(sx, sy, h * (w.kind === 'walk' ? 0.2 : 0.6), h * 0.04, 0, 0, 6.3); c.fill();
      const dirSign = Math.sign((w.lane.x1 - w.lane.x0) * w.dir) || 1;
      if (w.kind === 'gurney') {
        drawGurney(c, sx, sy, h, dirSign);
        drawPerson(c, sx - dirSign * h * 0.68, sy, h, w.crew[0], time, going);
        if (w.crew[1]) drawPerson(c, sx + dirSign * h * 0.68, sy - 1, h, w.crew[1], time, going);
      } else if (w.kind === 'cart') {
        drawCrashCart(c, sx + dirSign * h * 0.34, sy, h);
        drawPerson(c, sx, sy, h, w.crew[0], time, going);
      } else {
        drawPerson(c, sx, sy, h, w.crew[0], time, going);
      }
    }
    // the small lit things in the room: bedside monitors, the odd lamp
    c.globalCompositeOperation = 'lighter';
    for (const [i, [gx, gy, col]] of GLOWS.entries()) {
      const a = 0.16 + 0.1 * Math.sin(time * (1.3 + i * 0.4) + i), r = S_(70);
      const g = c.createRadialGradient(X(gx), Y(gy), 0, X(gx), Y(gy), r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = a; c.fillStyle = g; c.fillRect(X(gx) - r, Y(gy) - r, r * 2, r * 2);
    }
    // ambulance lights thrown across the floor from the bay doors
    if (strobe > 0) {
      const beat = Math.floor(time * 3.2) % 2, flick = Math.sin(time * 26) > -0.2 ? 1 : 0.55;
      const dx = X(DOOR[0]), dy = Y(DOOR[1]), r = MIDW * 0.82;
      const g = c.createRadialGradient(dx, dy, 0, dx, dy, r);
      g.addColorStop(0, beat ? 'rgba(255,40,50,1)' : 'rgba(60,110,255,1)');
      g.addColorStop(0.5, beat ? 'rgba(160,20,40,.45)' : 'rgba(30,60,190,.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = Math.min(1, strobe / 2) * 0.5 * flick; c.fillStyle = g; c.fillRect(0, 0, MIDW, MIDH);
    }
    if (code > 0) {
      c.globalAlpha = Math.min(1, code) * (0.1 + 0.09 * Math.sin(time * 6.2)); c.fillStyle = '#ff2436'; c.fillRect(0, 0, MIDW, MIDH);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    strobe = Math.max(0, strobe - dt); code = Math.max(0, code - dt);
  }
  const laneY = (w) => w.lane.y0 + (w.lane.y1 - w.lane.y0) * w.u;

  function drawNear(dt) {
    const c = nc;
    c.clearRect(0, 0, NEARW, NEARH);
    if (sprites.length) for (const n of nears) {
      n.x += n.v * dt;
      const sp = sprites[n.sprite], w = (sp.width / sp.height) * n.h;
      c.drawImage(sp, n.x - w / 2, NEARH - n.h * 0.72, w, n.h);
    }
    nears = nears.filter((n) => n.x > -60 && n.x < NEARW + 60);
    nearIn -= dt;
    if (nearIn <= 0) {
      const fromLeft = Math.random() < 0.5, hurry = code > 0 ? 2.2 : 1;
      nears.push({ x: fromLeft ? -40 : NEARW + 40, v: (fromLeft ? 1 : -1) * rand(26, 46) * hurry, h: rand(120, 170), sprite: Math.floor(Math.random() * 4) });
      nearIn = (code > 0 ? rand(0.6, 1.4) : rand(5, 13)) / (0.6 + busy);
    }
  }

  function advance(dt) {
    const want = Math.round(6 + busy * 12);
    if (walkers.length < want && Math.random() < dt * 2) spawn();
    for (const w of walkers) {
      if (w.pause > 0 && Math.abs(w.u - w.pauseAt) < 0.01) { w.pause -= dt; continue; }
      w.u += w.dir * dt;
    }
    walkers = walkers.filter((w) => w.u >= -0.02 && w.u <= 1.02);
  }

  function frame(ms) {
    requestAnimationFrame(frame);
    if (innerWidth < 1000 || innerHeight <= 520) return;   // the app covers the room at these sizes
    if (ms - stamp < 33) return;                           // 30 fps is plenty for something this far out of focus
    const dt = Math.min(0.1, (ms - prev) / 1000 || 0.03); prev = ms; stamp = ms; time += dt;
    advance(dt); drawMid(dt); drawNear(dt);
    // a little handheld drift, like a camera on someone's shoulder
    const sx = Math.sin(time * 0.31) * 5 + Math.sin(time * 0.83) * 2, sy = Math.cos(time * 0.23) * 3 + Math.sin(time * 0.71) * 1.4;
    canvas.scene.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)`;
    canvas.near.style.transform = `translate(${(sx * 2.4).toFixed(2)}px,${(sy * 2.4).toFixed(2)}px)`;
  }

  return {
    start(root) {
      canvas = { mid: root.querySelector('#mid'), near: root.querySelector('#near'), scene: root.querySelector('#scene') };
      mc = canvas.mid.getContext('2d'); nc = canvas.near.getContext('2d');
      photos = [...root.querySelectorAll('.photo')];
      fit(); addEventListener('resize', fit);
      if (still) { canvas.mid.remove(); canvas.near.remove(); return; }
      const src = getComputedStyle(photos[0]).backgroundImage.slice(5, -2), img = new Image();
      img.onload = () => makeSprites(img); img.src = src;
      for (let i = 0; i < 8; i += 1) { spawn(); walkers[i].u = rand(0.05, 0.95); }
      requestAnimationFrame(frame);
    },
    ambulance() {
      if (still || !walkers) return;
      strobe = 12;
      for (const lane of [LANES[0], LANES[2]]) spawn({ lane, out: false, kind: 'gurney', speed: 0.16, crew: [person(), person()] });
    },
    codeBlue() {
      if (still) return;
      code = 10; nearIn = 0.3;
      for (const lane of [LANES[0], LANES[1], LANES[2], LANES[3]]) spawn({ lane, out: false, speed: 0.34, crew: [person()] });
      spawn({ lane: LANES[0], out: false, kind: 'cart', speed: 0.3, crew: [person()] });
      spawn({ lane: LANES[2], out: false, kind: 'cart', speed: 0.3, crew: [person()] });
    },
    setBusy(v) { busy = Math.max(0, Math.min(1, v)); },
  };
})();
