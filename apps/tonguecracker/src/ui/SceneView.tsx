import type { Scene, Thing } from '../engine/scene'

const PAINT: Record<string, string> = {
  red: '#c8443a',
  blue: '#3f6bb5',
  green: '#3f8a52',
  gold: '#c99b25',
}

interface Props {
  scene: Scene
  size?: number
  muted?: boolean
}

/**
 * The picture the sentence is about.
 *
 * Every distinction the language can mark has to survive a glance: shape, colour,
 * size, one versus many, and who is doing what to whom. The relation is drawn as a
 * connector rather than written, because the moment a word appears in the picture
 * the puzzle is over.
 */
export function SceneView({ scene, size = 200, muted = false }: Props) {
  const height = size * 0.56
  const midline = height / 2

  return (
    <svg
      viewBox={`0 0 ${size} ${height}`}
      className={`scene${muted ? ' muted' : ''}`}
      role="img"
      aria-label={describe(scene)}
    >
      <Group thing={scene.subject} cx={size * 0.2} cy={midline} unit={size} />
      <Connector verb={scene.verb} from={size * 0.36} to={size * 0.64} y={midline} />
      <Group thing={scene.object} cx={size * 0.8} cy={midline} unit={size} />
    </svg>
  )
}

function Group({ thing, cx, cy, unit }: { thing: Thing; cx: number; cy: number; unit: number }) {
  const radius = (thing.size === 'big' ? 0.085 : 0.05) * unit
  const spread = radius * 1.25
  const offsets =
    thing.count === 1
      ? [[0, 0]]
      : thing.count === 2
        ? [
            [-spread, 0],
            [spread, 0],
          ]
        : [
            [-spread, spread * 0.7],
            [spread, spread * 0.7],
            [0, -spread * 0.85],
          ]

  return (
    <g fill={PAINT[thing.color]}>
      {offsets.map(([dx, dy], index) => (
        <Mark key={index} shape={thing.shape} cx={cx + dx} cy={cy + dy} radius={radius} />
      ))}
    </g>
  )
}

function Mark({ shape, cx, cy, radius }: { shape: string; cx: number; cy: number; radius: number }) {
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={radius} />
  if (shape === 'square') {
    return <rect x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} rx={radius * 0.16} />
  }
  if (shape === 'triangle') {
    return (
      <polygon
        points={`${cx},${cy - radius} ${cx + radius},${cy + radius * 0.8} ${cx - radius},${cy + radius * 0.8}`}
      />
    )
  }
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI / 5) * index - Math.PI / 2
    const reach = index % 2 === 0 ? radius : radius * 0.45
    return `${cx + Math.cos(angle) * reach},${cy + Math.sin(angle) * reach}`
  })
  return <polygon points={points.join(' ')} />
}

function Connector({ verb, from, to, y }: { verb: string; from: number; to: number; y: number }) {
  const stroke = '#3a3730'

  if (verb === 'chases') {
    return (
      <g stroke={stroke} strokeWidth={2} fill={stroke}>
        <line x1={from} y1={y} x2={to - 6} y2={y} />
        <polygon points={`${to},${y} ${to - 9},${y - 5} ${to - 9},${y + 5}`} stroke="none" />
      </g>
    )
  }

  if (verb === 'watches') {
    return (
      <g stroke={stroke} strokeWidth={1.6} fill="none">
        <line x1={from} y1={y} x2={to} y2={y} strokeDasharray="4 4" />
        <circle cx={(from + to) / 2} cy={y} r={5.5} />
        <circle cx={(from + to) / 2} cy={y} r={1.8} fill={stroke} />
      </g>
    )
  }

  // carries: a cradle under the line, the object resting in it
  return (
    <g stroke={stroke} strokeWidth={2} fill="none">
      <line x1={from} y1={y} x2={to} y2={y} />
      <path d={`M ${to - 12} ${y} q 12 14 24 0`} />
    </g>
  )
}

function describe(scene: Scene): string {
  const part = (thing: Thing) =>
    `${thing.count === 1 ? 'one' : thing.count} ${thing.size} ${thing.color} ${thing.shape}${
      thing.count === 1 ? '' : 's'
    }`
  return `${part(scene.subject)} ${scene.verb} ${part(scene.object)}`
}
