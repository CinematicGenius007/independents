import type { Scene, Thing } from '../engine/scene'

/**
 * Scenes drawn in the flat line-art system of the reference sheet: one weight of
 * black outline, rounded joins, flat fills, nothing shaded. It suits the game as
 * well as it suits a poster — every distinction the language can mark has to
 * survive a glance, and outlines survive being small.
 */

const PAINT: Record<string, string> = {
  red: '#ec2d5b',
  blue: '#1b6ef3',
  green: '#12a05c',
  gold: '#f2a81d',
}

const STROKE = '#101010'

interface Props {
  scene: Scene
  size?: number
}

export function SceneView({ scene, size = 220 }: Props) {
  const height = size * 0.54
  const midline = height / 2

  return (
    <svg
      viewBox={`0 0 ${size} ${height}`}
      className="scene"
      role="img"
      aria-label={describe(scene)}
    >
      <Group thing={scene.subject} cx={size * 0.21} cy={midline} unit={size} />
      <Connector verb={scene.verb} from={size * 0.37} to={size * 0.63} y={midline} />
      <Group thing={scene.object} cx={size * 0.79} cy={midline} unit={size} />
    </svg>
  )
}

function Group({ thing, cx, cy, unit }: { thing: Thing; cx: number; cy: number; unit: number }) {
  const radius = (thing.size === 'big' ? 0.082 : 0.05) * unit
  const spread = radius * 1.3
  const offsets =
    thing.count === 1
      ? [[0, 0]]
      : thing.count === 2
        ? [
            [-spread, 0],
            [spread, 0],
          ]
        : [
            [-spread, spread * 0.66],
            [spread, spread * 0.66],
            [0, -spread * 0.8],
          ]

  return (
    <g fill={PAINT[thing.color]} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round">
      {offsets.map(([dx, dy], index) => (
        <Mark key={index} shape={thing.shape} cx={cx + dx} cy={cy + dy} radius={radius} />
      ))}
    </g>
  )
}

function Mark({ shape, cx, cy, radius }: { shape: string; cx: number; cy: number; radius: number }) {
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={radius} />
  if (shape === 'square') {
    return <rect x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} rx={radius * 0.22} />
  }
  if (shape === 'triangle') {
    return (
      <polygon
        points={`${cx},${cy - radius} ${cx + radius},${cy + radius * 0.82} ${cx - radius},${cy + radius * 0.82}`}
      />
    )
  }
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI / 5) * index - Math.PI / 2
    const reach = index % 2 === 0 ? radius : radius * 0.46
    return `${cx + Math.cos(angle) * reach},${cy + Math.sin(angle) * reach}`
  })
  return <polygon points={points.join(' ')} />
}

function Connector({ verb, from, to, y }: { verb: string; from: number; to: number; y: number }) {
  if (verb === 'chases') {
    return (
      <g stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill={STROKE}>
        <line x1={from} y1={y} x2={to - 7} y2={y} />
        <polygon points={`${to},${y} ${to - 11},${y - 6} ${to - 11},${y + 6}`} stroke="none" />
      </g>
    )
  }

  if (verb === 'watches') {
    return (
      <g stroke={STROKE} strokeWidth={2.4} fill="none" strokeLinecap="round">
        <line x1={from} y1={y} x2={to} y2={y} strokeDasharray="1 7" />
        <path d={`M ${(from + to) / 2 - 11} ${y} q 11 -9 22 0 q -11 9 -22 0`} />
        <circle cx={(from + to) / 2} cy={y} r={2.6} fill={STROKE} />
      </g>
    )
  }

  return (
    <g stroke={STROKE} strokeWidth={2.6} fill="none" strokeLinecap="round">
      <line x1={from} y1={y} x2={to - 10} y2={y} />
      <path d={`M ${to - 14} ${y - 5} q 7 14 14 0`} />
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
