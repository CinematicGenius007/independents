/**
 * The tile patterns, constructed rather than traced.
 *
 * Each painted tile in the set is a small piece of ornament with exact
 * symmetry, so it is cheaper — and truer — to build it from that symmetry than
 * to draw it freehand: one motif, then the reflections and rotations that the
 * real tile has. Everything here is in a 24-unit box centred on (12, 12), and
 * every function returns an SVG path string, computed once at load.
 */

type Point = [number, number]

const C = 12
const fmt = (n: number) => n.toFixed(2)
const polygon = (points: Point[]) => `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`
const unit = (deg: number): Point => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]

// ----------------------------------------------------------- turquoise star

/**
 * The eight-pointed star of the turquoise tile: a Lemoyne star, eight rhombi
 * whose 45° corners all meet at the centre.
 *
 * A rhombus of side `s` along direction θ has its corners at 0, s·u(θ−22.5°),
 * s·(u(θ−22.5°) + u(θ+22.5°)) and s·u(θ+22.5°); its far tip lies 2s·cos 22.5°
 * from the centre. Each rhombus is then shrunk towards its own middle, which
 * opens the thin white lines that run between them on the real tile.
 */
export function lemoyneStar(tip: number, gap: number): string[] {
  const side = tip / (2 * Math.cos(Math.PI / 8))
  return Array.from({ length: 8 }, (_, i) => {
    const theta = i * 45 - 90
    const a = unit(theta - 22.5)
    const b = unit(theta + 22.5)
    const corners: Point[] = [
      [0, 0],
      [side * a[0], side * a[1]],
      [side * (a[0] + b[0]), side * (a[1] + b[1])],
      [side * b[0], side * b[1]],
    ]
    // Pull every corner towards the rhombus's centre by `gap` along its own diagonal.
    const mid: Point = [(corners[2][0]) / 2, (corners[2][1]) / 2]
    return polygon(
      corners.map(([x, y]) => {
        const dx = x - mid[0]
        const dy = y - mid[1]
        const length = Math.hypot(dx, dy) || 1
        return [C + x - (dx / length) * gap, C + y - (dy / length) * gap]
      }),
    )
  })
}

/** A square of half-width `half` with its corners cut back by `cut`: the white field. */
export function chamferedSquare(half: number, cut: number): string {
  const lo = C - half
  const hi = C + half
  return polygon([
    [lo + cut, lo],
    [hi - cut, lo],
    [hi, lo + cut],
    [hi, hi - cut],
    [hi - cut, hi],
    [lo + cut, hi],
    [lo, hi - cut],
    [lo, lo + cut],
  ])
}

// ---------------------------------------------------------- shared builders

/** A circle as a path, so it can sit in the same list as the polygons. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`
}

/** A diamond (square on point) centred on (x, y), `h` from centre to each point. */
function diamond(x: number, y: number, h: number): Point[] {
  return [
    [x, y - h],
    [x + h, y],
    [x, y + h],
    [x - h, y],
  ]
}

/**
 * A closed band round a spine: walks the spine, and either side of it lays a
 * half-width of `width(s)`, where s runs 0→1 by arc length. The band therefore
 * tapers wherever `width` does, which is what gives the curls their thick
 * middle and pointed ends.
 */
function band(spine: Point[], width: (s: number) => number): Point[] {
  const n = spine.length
  const lens = [0]
  for (let i = 1; i < n; i++) {
    lens.push(lens[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]))
  }
  const total = lens[n - 1] || 1
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < n; i++) {
    const s = lens[i] / total
    const a = spine[Math.max(0, i - 1)]
    const b = spine[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const length = Math.hypot(dx, dy) || 1
    const w = width(s) / 2
    left.push([spine[i][0] + (-dy / length) * w, spine[i][1] + (dx / length) * w])
    right.push([spine[i][0] + (dy / length) * w, spine[i][1] + (-dx / length) * w])
  }
  return [...left, ...right.reverse()]
}

/**
 * A curl: a logarithmic spiral wound about `eye`, running out at both ends —
 * a fat tail that ends at `tail` (at the axis finial), and a slim inner tail
 * that ends at `innerTail` (near the centre). The band swells from a point at
 * the outer tail, is fattest on the outer sweep, stays full round the eye and
 * thins away to a point at the inner tail.
 */
function curl(
  eye: Point,
  r0: number,
  k: number,
  turns: number,
  tail: Point,
  wmax: number,
  innerTail: Point,
): Point[] {
  // the spiral, wound from the outer end in towards the eye. The sense (+1
  // here) is chosen to match the real tile: the eye opens in towards the
  // centre of the tile.
  const spiral: Point[] = []
  const steps = 48
  const phiEnd = turns * 2 * Math.PI
  // The winding angle is set so the spiral leaves its eye heading for the tail.
  const towards = Math.atan2(tail[1] - eye[1], tail[0] - eye[0])
  const lean = Math.atan(k)
  const base = towards + lean - Math.PI / 2 - phiEnd
  for (let i = 0; i <= steps; i++) {
    const phi = (phiEnd * i) / steps
    const r = r0 * Math.exp(k * phi)
    const a = base + phi
    spiral.push([eye[0] + r * Math.cos(a), eye[1] + r * Math.sin(a)])
  }

  // a curve leaving a join along its tangent and arriving at `to` heading
  // along `arrive` (if given), so tails can hook over as they end
  const runOut = (join: Point, dir: Point, to: Point, arrive?: Point): Point[] => {
    const L = Math.hypot(to[0] - join[0], to[1] - join[1])
    const c1: Point = [join[0] + dir[0] * L * 0.5, join[1] + dir[1] * L * 0.5]
    const a = arrive ?? norm([to[0] - c1[0], to[1] - c1[1]])
    const c2: Point = [to[0] - a[0] * L * 0.35, to[1] - a[1] * L * 0.35]
    const out: Point[] = []
    for (let i = 1; i <= 18; i++) {
      const t = i / 18
      const u = 1 - t
      out.push([
        u ** 3 * join[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * to[0],
        u ** 3 * join[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * to[1],
      ])
    }
    return out
  }

  const exit = spiral[spiral.length - 1]
  const inner = spiral[0]
  const tOut: Point = [exit[0] - spiral[spiral.length - 2][0], exit[1] - spiral[spiral.length - 2][1]]
  const tIn: Point = [inner[0] - spiral[1][0], inner[1] - spiral[1][1]]
  const norm = (p: Point): Point => {
    const l = Math.hypot(p[0], p[1]) || 1
    return [p[0] / l, p[1] / l]
  }

  const spine = [
    ...runOut(exit, norm(tOut), tail, [0.45, 1]).reverse(),
    ...spiral.slice().reverse(),
    ...runOut(inner, norm(tIn), innerTail),
  ]

  // fat through the outer sweep and the eye, thin at both tails. A few
  // control points, joined with cosine steps, so the profile has a shoulder
  // where the band slips through the eye.
  const profile: Array<[number, number]> = [
    [0.0, 0.02],
    [0.16, 0.9],
    [0.4, 1.0],
    [0.6, 0.85],
    [0.75, 0.62],
    [0.88, 0.34],
    [1.0, 0.04],
  ]
  return band(spine, s => {
    let i = 0
    while (i < profile.length - 2 && profile[i + 1][0] < s) i++
    const [s0, w0] = profile[i]
    const [s1, w1] = profile[i + 1]
    const t = Math.min(1, Math.max(0, (s - s0) / (s1 - s0)))
    const blend = (1 - Math.cos(t * Math.PI)) / 2
    return wmax * (w0 + (w1 - w0) * blend)
  })
}

/** Applies the eight symmetries of the square (D4) to one motif given as points. */
function dihedral(points: Point[]): Point[][] {
  const out: Point[][] = []
  for (const mirror of [1, -1]) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const [cos, sin] = unit(quarter * 90)
      out.push(
        points.map(([x, y]) => {
          const mx = x * mirror
          return [C + mx * cos - y * sin, C + mx * sin + y * cos]
        }),
      )
    }
  }
  return out
}

/**
 * An acanthus leaf: a quadratic spine from `a` through `ctrl` to `b`, swelling
 * as sin(πs) and serrated along its outer edge by a sawtooth of `teeth` teeth.
 */
function acanthus(a: Point, ctrl: Point, b: Point, width: number, teeth: number): Point[] {
  const steps = teeth * 6
  const spine = (s: number): Point => [
    (1 - s) ** 2 * a[0] + 2 * (1 - s) * s * ctrl[0] + s ** 2 * b[0],
    (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * ctrl[1] + s ** 2 * b[1],
  ]
  const normal = (s: number): Point => {
    const dx = 2 * (1 - s) * (ctrl[0] - a[0]) + 2 * s * (b[0] - ctrl[0])
    const dy = 2 * (1 - s) * (ctrl[1] - a[1]) + 2 * s * (b[1] - ctrl[1])
    const length = Math.hypot(dx, dy) || 1
    return [-dy / length, dx / length]
  }
  const outer: Point[] = []
  const inner: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const p = spine(s)
    const n = normal(s)
    const swell = width * Math.sin(Math.PI * s) * (1 - 0.35 * s)
    const saw = 1 + 1.2 * ((s * teeth) % 1)
    outer.push([p[0] + n[0] * swell * saw, p[1] + n[1] * swell * saw])
    inner.push([p[0] - n[0] * swell * 0.45, p[1] - n[1] * swell * 0.45])
  }
  return [...outer, ...inner.reverse()]
}

/** The four rotations of a motif about the tile centre. */
function rotations(points: Point[]): Point[][] {
  return [0, 1, 2, 3].map(quarter => {
    const [cos, sin] = unit(quarter * 90)
    return points.map(([x, y]) => [C + x * cos - y * sin, C + x * sin + y * cos] as Point)
  })
}

/** A kite from `from` to `to`, widest (`width`) at `at` of the way along. */
function kite(from: Point, to: Point, width: number, at = 0.4): Point[] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy)
  const n: Point = [(-dy / length) * (width / 2), (dx / length) * (width / 2)]
  const m: Point = [from[0] + dx * at, from[1] + dy * at]
  return [from, [m[0] + n[0], m[1] + n[1]], to, [m[0] - n[0], m[1] - n[1]]]
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

/** A four-pointed star with concave sides, points on the axes. */
function concaveStar(outer: number, waist: number): Point[] {
  const tips: Point[] = [
    [0, -outer],
    [outer, 0],
    [0, outer],
    [-outer, 0],
  ]
  const w = waist * Math.SQRT1_2
  const ins: Point[] = [
    [w, -w],
    [w, w],
    [-w, w],
    [-w, -w],
  ]
  const out: Point[] = []
  for (let i = 0; i < 4; i++) {
    const a = tips[i]
    const b = ins[i]
    // a quadratic bowing in towards the centre
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const ctrl: Point = [mid[0] * 0.42, mid[1] * 0.42]
    for (let j = 0; j <= 6; j++) {
      const t = j / 6
      const u = 1 - t
      out.push([u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]])
    }
  }
  // close back to the first tip
  const a = tips[3]
  const b = tips[0]
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const ctrl: Point = [mid[0] * 0.42, mid[1] * 0.42]
  for (let j = 1; j <= 6; j++) {
    const t = j / 6
    const u = 1 - t
    out.push([u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]])
  }
  return out
}

// ------------------------------------------------------------ yellow damask

/**
 * The yellow tile's damask, with the square's full symmetry. On each axis a
 * pair of facing curls flanks a small diamond finial by the edge: each curl's
 * fat tail runs up to hook beside the finial, its eye sits out towards the
 * diagonal, and its slim inner tail runs back in towards the centre. Ragged
 * serrated flames fill each corner. Small diamond studs sit between each pair
 * of curls, and a four-pointed star sits at the centre.
 */
export function damask(): { fills: string[] } {
  const fills: string[] = []
  const add = (motif: Point[]) => fills.push(...dihedral(motif).map(polygon))

  // the curl band: from the finial hook, out through the eye, back in towards
  // the centre
  add(curl([-3.3, -5.5], 0.7, 0.19, 1.15, [-1.15, -9.75], 2.0, [-2.05, -2.45]))

  // ragged flames into the corners: one big along the diagonal, one flanking
  add(acanthus([-5.9, -5.9], [-8.4, -8.1], [-9.9, -9.9], 1.9, 4))
  add(acanthus([-4.6, -8.3], [-4.5, -10.3], [-2.9, -11.3], 1.0, 3))

  // studs: between each pair of curls on the axis, and the finial diamond
  fills.push(polygon(rotations(diamond(0, -4.7, 0.4))[0]))
  fills.push(polygon(rotations(diamond(0, -10.3, 0.38))[0]))

  // the centre star
  fills.push(polygon(concaveStar(2.0, 0.72).map(([x, y]) => [C + x, C + y] as Point)))

  return { fills }
}

/**
 * The black tile's lattice, built square to the axes and laid on the tile
 * turned 45°: four rosettes of chunky dots at the middle of each side, laced
 * together by pairs of slim arcs; thin bars running corner to corner through
 * the centre, with arrow heads pointing in at the centre and a moth of wedges
 * and a diamond where each bar reaches its corner.
 *
 * The rosettes' hearts and the diamonds are squares here, so that they read
 * as diamonds once the tile is turned.
 */
export function lattice(): { fills: string[]; holes: string[] } {
  const q = 5.0
  const fills: string[] = []
  const holes: string[] = []

  // the rosettes: an outer ring of eight chunky dots, an inner ring of eight
  // small petals pointing in, and a small diamond at the heart
  for (const [[cx, cy]] of rotations([[q, -q]])) {
    for (let i = 0; i < 8; i++) {
      const [x, y] = unit(i * 45)
      fills.push(circlePath(cx + 2.15 * x, cy + 2.15 * y, 0.62))
    }
    for (let i = 0; i < 8; i++) {
      const [x, y] = unit(i * 45 + 22.5)
      fills.push(polygon(kite([cx + 1.15 * x, cy + 1.15 * y], [cx + 0.4 * x, cy + 0.4 * y], 0.45, 0.4)))
    }
    // a square here reads as a diamond once the tile is turned
    fills.push(polygon(rect(cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3)))
  }

  // One arm — everything belonging to the up axis, rotated four ways about
  // the centre afterwards: the thin bar running corner to corner through the
  // centre (the bar weaves through the arcs), the arrow head pointing in at
  // the centre, the stud partway along the bar, the moth (two wedges and a
  // diamond) out at the corner, and the pair of slim arcs lacing the two
  // rosettes beside this axis together.
  const norm = (p: Point): Point => {
    const l = Math.hypot(p[0], p[1]) || 1
    return [p[0] / l, p[1] / l]
  }

  const arm: Point[][] = [
    // the bar, thin, running from the moth in past the centre
    rect(-0.14, -9.3, 0.14, -1.3),
    // the arrow head pointing in at the centre
    kite([0, -4.2], [0, -2.7], 1.2, 0.35),
    // the stud partway along the bar
    rect(-0.3, -5.75, 0.3, -5.15),
    // the small diamond out towards the corner
    kite([0, -9.7], [0, -10.8], 1.15, 0.5),
    // the moth's two wedges, between the outer arc and the diamond
    kite([0, -9.5], [1.55, -8.9], 0.75, 0.4),
    kite([0, -9.5], [-1.55, -8.9], 0.75, 0.4),
  ]

  // the pair of slim arcs between the two rosettes beside this axis
  const A: Point = [q, -q]
  const B: Point = [-q, -q]
  for (const midDist of [-6.35, -4.55]) {
    const mid: Point = [0, midDist]
    const dA = norm([mid[0] - A[0], mid[1] - A[1]])
    const dB = norm([mid[0] - B[0], mid[1] - B[1]])
    const start: Point = [A[0] + dA[0] * 2.35, A[1] + dA[1] * 2.35]
    const end: Point = [B[0] + dB[0] * 2.35, B[1] + dB[1] * 2.35]
    const ctrl: Point = [2 * mid[0] - (start[0] + end[0]) / 2, 2 * mid[1] - (start[1] + end[1]) / 2]
    const spine: Point[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const u = 1 - t
      spine.push([
        u * u * start[0] + 2 * u * t * ctrl[0] + t * t * end[0],
        u * u * start[1] + 2 * u * t * ctrl[1] + t * t * end[1],
      ])
    }
    // a dumbbell: slim at the waist, fattening towards each end
    arm.push(band(spine, s => 0.22 + 0.3 * Math.pow(Math.sin(Math.PI * s), 3)))
  }

  for (const motif of arm) fills.push(...rotations(motif).map(polygon))

  // the small diamond where the bars cross
  fills.push(polygon(rect(-0.3, -0.3, 0.3, 0.3)))

  return { fills, holes }
}
