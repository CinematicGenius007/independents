/**
 * Draws the favicon, app icons and share images into public/.
 *
 * Run it after changing the artwork:
 *
 *   mkdir /tmp/ttt-icons && cd /tmp/ttt-icons && npm i sharp opentype.js \
 *     @fontsource/space-grotesk @fontsource/jetbrains-mono
 *   ICON_DEPS=/tmp/ttt-icons node scripts/make-icons.mjs
 *
 * The tools are not project dependencies on purpose: the generated files are
 * committed, so building the app never needs them. Headlines are converted to
 * outlines so the images look the same wherever they are rendered.
 */

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const deps = process.env.ICON_DEPS
if (!deps) throw new Error('Set ICON_DEPS to the folder where sharp and opentype.js are installed.')
const require = createRequire(path.join(deps, '/'))
const sharp = require('sharp')
const opentype = require('opentype.js')

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const C = { bg: '#0B0D10', panel: '#14181D', line: '#2A3038', grid: '#3A424C', text: '#E8E6DF', dim: '#8A919B', signal: '#FF5A36', x: '#7FD6E8' }

const load = (file) => {
  const b = readFileSync(path.join(deps, 'node_modules', file))
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const heading = load('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff')
const mono = load('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff')

/** Lays text out glyph by glyph, which keeps every glyph's outline intact. */
function layout(font, text, size, letterSpacing = 0) {
  const scale = size / font.unitsPerEm
  let x = 0
  const glyphs = []
  let prev = null
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    if (prev) {
      const kern = font.getKerningValue(prev, glyph)
      if (Number.isFinite(kern)) x += kern * scale
    }
    glyphs.push({ glyph, x })
    x += glyph.advanceWidth * scale + letterSpacing * size
    prev = glyph
  }
  return { glyphs, width: x }
}
/** An outline from the glyph's own units, scaled and placed by hand. */
function outline(glyph, ox, oy, scale) {
  const n = (v) => +v.toFixed(2)
  const px = (c) => n(ox + c * scale)
  const py = (c) => n(oy - c * scale)
  return glyph.path.commands
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${px(c.x)} ${py(c.y)}`
      if (c.type === 'Q') return `Q${px(c.x1)} ${py(c.y1)} ${px(c.x)} ${py(c.y)}`
      if (c.type === 'C') return `C${px(c.x1)} ${py(c.y1)} ${px(c.x2)} ${py(c.y2)} ${px(c.x)} ${py(c.y)}`
      return 'Z'
    })
    .join('')
}
const textPath = (font, text, x, y, size, fill, letterSpacing = 0) => {
  const { glyphs } = layout(font, text, size, letterSpacing)
  const scale = size / font.unitsPerEm
  const d = glyphs.map(({ glyph, x: gx }) => outline(glyph, x + gx, y, scale)).join('')
  return `<path fill="${fill}" d="${d}"/>`
}
const textWidth = (font, text, size, letterSpacing = 0) => layout(font, text, size, letterSpacing).width

/** The mark: a 3×3 board, the middle cell forced (orange), an X and an O. */
function mark({ x0, y0, size, stroke, lines = C.grid, mono: monochrome = false }) {
  const cell = size / 3
  const s = (k) => (stroke * k).toFixed(2)
  const px = (v) => v.toFixed(2)
  const ink = (c) => (monochrome ? '#000' : c)
  let g = ''
  for (let i = 1; i < 3; i++) {
    g += `<path d="M${px(x0 + i * cell)} ${px(y0)}V${px(y0 + size)}M${px(x0)} ${px(y0 + i * cell)}H${px(x0 + size)}" stroke="${ink(lines)}" stroke-width="${s(0.9)}" stroke-linecap="round" fill="none"/>`
  }
  // forced cell
  const inset = cell * 0.12
  g += `<rect x="${px(x0 + cell + inset)}" y="${px(y0 + cell + inset)}" width="${px(cell - inset * 2)}" height="${px(cell - inset * 2)}" rx="${px(cell * 0.12)}" fill="${monochrome ? 'none' : 'rgba(255,90,54,0.16)'}" stroke="${ink(C.signal)}" stroke-width="${s(1)}"/>`
  // X, top left
  const a = cell * 0.26
  const b = cell * 0.74
  g += `<path d="M${px(x0 + a)} ${px(y0 + a)}L${px(x0 + b)} ${px(y0 + b)}M${px(x0 + b)} ${px(y0 + a)}L${px(x0 + a)} ${px(y0 + b)}" stroke="${ink(C.x)}" stroke-width="${s(1.5)}" stroke-linecap="round" fill="none"/>`
  // O, bottom right
  g += `<circle cx="${px(x0 + cell * 2.5)}" cy="${px(y0 + cell * 2.5)}" r="${px(cell * 0.25)}" stroke="${ink(C.text)}" stroke-width="${s(1.5)}" fill="none"/>`
  return g
}

const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${extra}>${body}</svg>`

// ── Icons ────────────────────────────────────────────────────────────────────

const icon = ({ rounded, inset }) =>
  svg(
    512,
    512,
    `<rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${C.bg}"/>` + mark({ x0: inset, y0: inset, size: 512 - inset * 2, stroke: 11 }),
  )

const faviconSvg = svg(
  64,
  64,
  `<rect width="64" height="64" rx="14" fill="${C.bg}"/>` + mark({ x0: 12, y0: 12, size: 40, stroke: 2.6 }),
)
const pinned = svg(16, 16, mark({ x0: 1, y0: 1, size: 14, stroke: 0.9, mono: true }))

// ── Share image ──────────────────────────────────────────────────────────────

function board(x0, y0, size) {
  // A mid-game position: boards 0 and 8 taken, the centre forced.
  const gap = size * 0.04
  const small = (size - gap * 2) / 3
  const cell = small / 3
  const marks = {
    1: 'X..O.....', 2: '..X..O...', 3: 'O.XX.....', 4: 'XO.....X.', 5: '....X...O', 6: 'X.....OO.', 7: '..X..O...',
  }
  let g = ''
  for (let b = 0; b < 9; b++) {
    const bx = x0 + (b % 3) * (small + gap)
    const by = y0 + Math.floor(b / 3) * (small + gap)
    const forced = b === 4
    const won = b === 0 ? 'X' : b === 8 ? 'O' : null
    if (forced) g += `<rect x="${bx}" y="${by}" width="${small}" height="${small}" rx="14" fill="rgba(255,90,54,0.1)" stroke="${C.signal}" stroke-width="2.5"/>`
    const lineCol = forced ? 'rgba(255,90,54,0.45)' : C.line
    let inner = ''
    for (let i = 1; i < 3; i++) inner += `<path d="M${bx + i * cell} ${by + cell * 0.12}V${by + small - cell * 0.12}M${bx + cell * 0.12} ${by + i * cell}H${bx + small - cell * 0.12}" stroke="${lineCol}" stroke-width="1.6" fill="none"/>`
    const cells = marks[b] ?? (won === 'X' ? 'X.O.XO...' : won === 'O' ? '.O.XO...X' : '.........')
    for (let c = 0; c < 9; c++) {
      const v = cells[c]
      const cx = bx + (c % 3) * cell + cell / 2
      const cy = by + Math.floor(c / 3) * cell + cell / 2
      const r = cell * 0.22
      if (v === 'X') inner += `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="${C.x}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`
      if (v === 'O') inner += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${C.text}" stroke-width="3.2" fill="none"/>`
    }
    g += `<g opacity="${won ? 0.22 : 1}">${inner}</g>`
    if (won === 'X') {
      const r = small * 0.3
      const cx = bx + small / 2
      const cy = by + small / 2
      g += `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="${C.x}" stroke-width="12" stroke-linecap="round" fill="none"/>`
    }
    if (won === 'O') g += `<circle cx="${bx + small / 2}" cy="${by + small / 2}" r="${small * 0.3}" stroke="${C.text}" stroke-width="12" fill="none"/>`
  }
  return g
}

function ogImage() {
  const title1 = 'Ultimate'
  const title2 = 'TTT'
  const size = 132
  const ls = -0.03
  let g = `<rect width="1200" height="630" fill="${C.bg}"/>`
  g += `<rect x="40" y="40" width="1120" height="550" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>`
  g += textPath(mono, 'ULTIMATE TTT / 9x9', 90, 110, 20, C.dim, 0.14)
  g += textPath(heading, title1, 84, 270, size, C.text, ls)
  g += textPath(heading, title2, 84, 270 + size * 0.92, size, C.text, ls)
  g += textPath(heading, '.', 84 + textWidth(heading, title2, size, ls) + 4, 270 + size * 0.92, size, C.signal, ls)
  g += textPath(mono, 'A board inside a board.', 90, 500, 22, C.dim)
  g += textPath(mono, 'Where you play decides where they must.', 90, 534, 22, C.dim)
  g += board(690, 90, 430)
  return svg(1200, 630, g)
}

const og = ogImage()

// ── Write ────────────────────────────────────────────────────────────────────

const files = {
  'favicon.svg': faviconSvg,
  'safari-pinned-tab.svg': pinned,
  'icon.svg': icon({ rounded: true, inset: 96 }),
  'og-image.svg': og,
}
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(out, name), content)

const png = (svgText, size, file) => sharp(Buffer.from(svgText), { density: 300 }).resize(size.w ?? size, size.h ?? size).png({ compressionLevel: 9, palette: false }).toFile(path.join(out, file))

await png(icon({ rounded: true, inset: 96 }), 192, 'icon-192.png')
await png(icon({ rounded: true, inset: 96 }), 512, 'icon-512.png')
await png(icon({ rounded: false, inset: 150 }), 512, 'icon-maskable-512.png')
await png(icon({ rounded: false, inset: 110 }), 180, 'apple-touch-icon.png')
await png(faviconSvg, 32, 'favicon-32.png')
await png(og, { w: 1200, h: 630 }, 'og-image.png')

// A one-image .ico for the browsers that still ask for /favicon.ico.
const ico32 = await sharp(Buffer.from(faviconSvg), { density: 300 }).resize(32, 32).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
header.writeUInt8(32, 6) // width
header.writeUInt8(32, 7) // height
header.writeUInt16LE(1, 12) // planes
header.writeUInt16LE(32, 14) // bits per pixel
header.writeUInt32LE(ico32.length, 14 + 4) // size
header.writeUInt32LE(22, 18) // offset
writeFileSync(path.join(out, 'favicon.ico'), Buffer.concat([header, ico32]))
console.log('done')
