/* The emergency department behind the monitor. Drawn small and blurred by CSS, so it
 * reads as a living room out of focus: staff crossing, stretchers rolling in, the
 * ambulance bay flashing. It reacts to the game: arrivals bring a stretcher run,
 * a Code Blue sends people sprinting. */
const Backdrop = (() => {
  const W = 480, H = 270, HORIZON = 118;
  const SCRUBS = ['#1f3f6e', '#1b7f86', '#3f73b8', '#27506b', '#e9edf2', '#6b3fa0', '#2a8f5b'];
  let ctx, people = [], last = 0, flash = 0, code = 0, busy = 0.5;

  const rand = (a, b) => a + Math.random() * (b - a);
  function person(fast) {
    const depth = rand(0.25, 1);                         // 0 far, 1 near
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { x: dir > 0 ? -30 : W + 30, depth, dir, speed: (fast ? rand(70, 110) : rand(14, 34)) * (0.45 + depth * 0.7), color: SCRUBS[Math.floor(rand(0, SCRUBS.length))], phase: rand(0, 6), gurney: false, pause: 0 };
  }
  function stretcher() {
    const p = person(true); p.gurney = true; p.depth = rand(0.55, 0.9); p.dir = 1; p.x = W * 0.5; p.fromBay = 1; p.color = '#c9d400';
    return p;
  }

  function drawRoom(t) {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#7f93a6'); g.addColorStop(1, '#c4d2dc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON);
    for (let i = 0; i < 6; i += 1) {                     // ceiling light panels
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(30 + i * 78, 14 + (i % 2) * 5, 44, 5);
    }
    for (let i = 0; i < 8; i += 1) {                     // curtained bays along the back wall
      const x = i * 60 + 2, isDoor = i === 3 || i === 4;
      if (isDoor) continue;
      ctx.fillStyle = i % 2 ? '#8fc3c9' : '#a9d3d0'; ctx.fillRect(x, 44, 54, HORIZON - 44);
      ctx.fillStyle = 'rgba(20,40,60,.18)'; for (let k = 0; k < 6; k += 1) ctx.fillRect(x + 4 + k * 9, 44, 2, HORIZON - 44);
      ctx.fillStyle = '#10202c'; ctx.fillRect(x + 16, 30, 20, 11);                    // wall monitor
      ctx.fillStyle = ['#4dff5e', '#45d7ff', '#ffe14d'][i % 3]; ctx.fillRect(x + 18, 34 + Math.sin(t * 3 + i) * 2, 16, 1.5);
    }
    // ambulance bay doors
    ctx.fillStyle = '#0c1a2a'; ctx.fillRect(184, 40, 112, HORIZON - 40);
    const amb = flash > 0 ? 0.35 + 0.35 * Math.sin(t * 14) : 0.06;
    ctx.fillStyle = `rgba(255,40,40,${amb})`; ctx.fillRect(184, 40, 56, HORIZON - 40);
    ctx.fillStyle = `rgba(60,110,255,${flash > 0 ? 0.7 - amb : 0.06})`; ctx.fillRect(240, 40, 56, HORIZON - 40);
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(206, 32, 68, 7);
    // floor
    const f = ctx.createLinearGradient(0, HORIZON, 0, H);
    f.addColorStop(0, '#93a5b2'); f.addColorStop(1, '#dfe7ec');
    ctx.fillStyle = f; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(150, HORIZON, 180, H - HORIZON);   // light pooling on the lino
    if (code > 0) { ctx.fillStyle = `rgba(220,20,50,${0.12 + 0.1 * Math.sin(t * 8)})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawPerson(p, t) {
    const s = 0.45 + p.depth * 0.85, y = HORIZON + 6 + p.depth * (H - HORIZON - 38);
    const bob = Math.sin(t * (p.speed / 6) + p.phase) * 1.2 * s;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x, y + 2, 9 * s, 2.5 * s, 0, 0, 7); ctx.fill();
    if (p.gurney) {
      ctx.fillStyle = '#f4f6f8'; ctx.fillRect(p.x - 22 * s, y - 16 * s, 44 * s, 6 * s);
      ctx.fillStyle = '#5b6b7c'; ctx.fillRect(p.x - 20 * s, y - 10 * s, 2 * s, 10 * s); ctx.fillRect(p.x + 18 * s, y - 10 * s, 2 * s, 10 * s);
      ctx.fillStyle = '#d98c6a'; ctx.beginPath(); ctx.arc(p.x + 16 * s, y - 18 * s, 3 * s, 0, 7); ctx.fill();
      body(p.x - 28 * s, y, s, '#c9d400', bob); body(p.x + 28 * s, y, s, '#c9d400', -bob);
    } else body(p.x, y, s, p.color, bob);
  }
  function body(x, y, s, color, bob) {
    ctx.fillStyle = '#26323f'; ctx.fillRect(x - 3.5 * s, y - 14 * s, 3 * s, 14 * s + bob); ctx.fillRect(x + 0.5 * s, y - 14 * s, 3 * s, 14 * s - bob);
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - 5 * s, y - 31 * s, 10 * s, 19 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#d8a383'; ctx.beginPath(); ctx.arc(x, y - 35 * s, 3.6 * s, 0, 7); ctx.fill();
  }

  function frame(now) {
    const t = now / 1000, dt = Math.min(0.05, t - last); last = t;
    flash = Math.max(0, flash - dt); code = Math.max(0, code - dt);
    const want = Math.round(10 + busy * 16);
    if (people.length < want && Math.random() < 0.09) people.push(person(code > 0 && Math.random() < 0.6));
    drawRoom(t);
    people.sort((a, b) => a.depth - b.depth);
    for (const p of people) {
      if (p.pause > 0) p.pause -= dt; else { p.x += p.dir * p.speed * dt; if (!p.gurney && Math.random() < 0.002) p.pause = rand(0.8, 3); }
      drawPerson(p, t);
    }
    people = people.filter((p) => p.x > -60 && p.x < W + 60);
    // the nurses' station we are sitting at, out of focus in the foreground
    ctx.fillStyle = '#2b3743'; ctx.fillRect(0, H - 26, W, 26);
    ctx.fillStyle = '#3b4a59'; ctx.fillRect(0, H - 30, W, 5);
    requestAnimationFrame(frame);
  }

  return {
    start(canvas) { canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); requestAnimationFrame(frame); for (let i = 0; i < 9; i += 1) { const p = person(false); p.x = rand(0, W); people.push(p); } },
    ambulance() { flash = 9; people.push(stretcher()); },
    codeBlue() { code = 10; for (let i = 0; i < 4; i += 1) people.push(person(true)); },
    setBusy(k) { busy = Math.max(0, Math.min(1, k)); },
  };
})();
