/* Bedside monitor traces. Every <canvas data-wave="ecg|pleth|resp"> on the page is
 * redrawn each frame from the values in its data attributes, so the app can rebuild
 * its HTML freely and the traces keep scrolling without a flicker.
 * Shapes are synthesized from the patient's actual rate and rhythm:
 *   sinus  P wave, narrow QRS, T wave
 *   stemi  the same with the ST segment lifted into the T wave
 *   af     no P waves, irregular R-R intervals, fibrillating baseline
 *   vf     chaotic, no complexes (cardiac arrest) */
export const Waves = (() => {
  const gauss = (x, mu, sd) => Math.exp(-((x - mu) ** 2) / (2 * sd * sd));
  const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

  function ecg(time, hr, rhythm) {
    if (rhythm === 'vf' || hr <= 0) return 0.32 * Math.sin(time * 31) * Math.sin(time * 7.3) + 0.2 * Math.sin(time * 19.7 + 1) + 0.1 * Math.sin(time * 47);
    const beats = (time * hr) / 60 + 1000, n = Math.floor(beats); let ph = beats - n;
    if (rhythm === 'af') { ph = Math.min(0.999, ph * (0.78 + 0.5 * hash(n))); }
    let y = 0;
    if (rhythm !== 'af') y += 0.12 * gauss(ph, 0.14, 0.025); else y += 0.035 * Math.sin(time * 41) + 0.025 * Math.sin(time * 67);
    y += -0.1 * gauss(ph, 0.255, 0.008) + 1.0 * gauss(ph, 0.28, 0.011) - 0.24 * gauss(ph, 0.305, 0.01);
    y += 0.28 * gauss(ph, 0.5, 0.05);
    if (rhythm === 'stemi') y += 0.3 * (1 / (1 + Math.exp(-(ph - 0.315) * 220))) * (1 / (1 + Math.exp((ph - 0.5) * 40)));
    return y;
  }
  function pleth(time, hr, spo2) {
    if (hr <= 0) return 0.02 * Math.sin(time * 9);
    const ph = ((((time * hr) / 60 + 0.22) % 1) + 1) % 1, amp = Math.max(0.25, (spo2 - 60) / 40);
    return amp * (gauss(ph, 0.2, 0.09) + 0.42 * gauss(ph, 0.45, 0.11));
  }
  const resp = (time, rr) => (rr <= 0 ? 0 : 0.5 + 0.5 * Math.sin((time * rr * Math.PI * 2) / 60));

  function draw(cv, now) {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    if (cv.width !== w * 2) { cv.width = w * 2; cv.height = h * 2; }
    const c = cv.getContext('2d'), d = cv.dataset, kind = d.wave;
    const hr = +d.hr, rr = +d.rr, spo2 = +d.spo2, secs = +(d.secs || 6);
    c.clearRect(0, 0, cv.width, cv.height);
    c.strokeStyle = kind === 'ecg' ? '#4dff5e' : kind === 'pleth' ? '#45d7ff' : '#ffe14d';
    c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath();
    const W2 = cv.width, H2 = cv.height;
    for (let x = 0; x < W2; x += 2) {
      const time = now - ((W2 - x) / W2) * secs;
      let v;
      if (kind === 'ecg') v = 0.72 - ecg(time, hr, d.rhythm) * 0.56;
      else if (kind === 'pleth') v = 0.86 - pleth(time, hr, spo2) * 0.7;
      else v = 0.85 - resp(time, rr) * 0.7;
      const y = v * H2;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  function loop(ms) {
    const now = ms / 1000;
    for (const cv of document.querySelectorAll('canvas[data-wave]')) draw(cv, now);
    requestAnimationFrame(loop);
  }
  return { start() { requestAnimationFrame(loop); } };
})();
