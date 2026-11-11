#!/usr/bin/env node
/* Draws the raster brand files from src/brand/mark.svg and the screenshots, into src/brand/.
 *   node scripts/brand.mjs
 * Needs Google Chrome (through scripts/shot.mjs) and cwebp. The results are committed, so
 * build.mjs and the hosting build need neither. Run again after changing the mark or screenshots. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(here, 'src/brand'), tmp = mkdtempSync(join(tmpdir(), 'ns-brand-'));
const mark = readFileSync(join(brand, 'mark.svg'), 'utf8');
const shot = (html, out, w, h) => {
  const page = join(tmp, `p${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#0d1724}</style>${html}`);
  execFileSync('node', [join(here, 'scripts/shot.mjs'), page, out, `--w=${w}`, `--h=${h}`, '--wait=500'], { stdio: 'ignore' });
};

/* app icons are opaque squares: iOS and Android round the corners themselves */
const square = mark.replace(/rx="14"/, 'rx="0"');
const icon = (size, pad = 0) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#0d1724"><div style="width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px">${square.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`;
for (const [name, size, pad] of [['apple-touch-icon.png', 180, 0.04], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12], ['fav-16.png', 16, 0], ['fav-32.png', 32, 0], ['fav-48.png', 48, 0]]) shot(icon(size, pad), join(brand, name), size, size);

/* favicon.ico holds the 16, 32 and 48 pixel PNGs */
const pngs = [16, 32, 48].map((s) => [s, readFileSync(join(brand, `fav-${s}.png`))]);
const head = Buffer.alloc(6 + pngs.length * 16);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
let offset = head.length;
pngs.forEach(([s, buf], k) => {
  const e = 6 + k * 16;
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += buf.length;
});
writeFileSync(join(brand, 'favicon.ico'), Buffer.concat([head, ...pngs.map(([, b]) => b)]));
for (const s of [16, 32, 48]) rmSync(join(brand, `fav-${s}.png`));

/* the social card: what a link to the game looks like when someone shares it */
const photo = join(here, 'src/assets/er-floor.jpg'), board = join(here, 'screenshots/board.png');
shot(`<div style="position:relative;width:1200px;height:630px;overflow:hidden;font-family:Tahoma,'Segoe UI',Verdana,sans-serif;color:#fff">
  <div style="position:absolute;inset:-30px;background:url('file://${photo}') center/cover;filter:blur(7px) saturate(.75) brightness(.55)"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,15,24,.96) 0%,rgba(9,15,24,.86) 46%,rgba(9,15,24,.25) 100%)"></div>
  <img src="file://${board}" style="position:absolute;left:640px;top:96px;width:720px;border-radius:8px;box-shadow:0 30px 80px rgba(0,0,0,.6);border:10px solid #1b2129">
  <div style="position:absolute;left:72px;top:78px;width:560px">
    <div style="display:flex;align-items:center;gap:16px"><div style="width:64px;height:64px">${mark}</div><div style="font-size:26px;font-weight:700;letter-spacing:.2em">NIGHT SHIFT</div></div>
    <div style="font-size:54px;line-height:1.1;font-weight:700;margin-top:56px">Twelve hours.<br>Twenty-one beds.<br><span style="color:#ffb454">You decide who gets one.</span></div>
    <div style="font-size:24px;line-height:1.4;color:#c9d2de;margin-top:28px">Run an emergency department at night, in your browser.</div>
  </div></div>`, join(tmp, 'og.png'), 1200, 630);
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', join(tmp, 'og.png'), '--out', join(brand, 'og.jpg')], { stdio: 'ignore' });

/* web copies of the photo and screenshots for the landing page and the game */
const webp = (src, out, q = 78) => execFileSync('cwebp', ['-quiet', '-q', String(q), src, '-o', out]);
webp(photo, join(here, 'src/assets/er-floor.webp'), 74);
for (const n of ['board', 'guide-mode', 'phone']) webp(join(here, `screenshots/${n}.png`), join(brand, `${n}.webp`), 80);
rmSync(tmp, { recursive: true, force: true });
console.log('brand files written to src/brand and src/assets');
