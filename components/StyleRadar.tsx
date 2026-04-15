'use client'

import { StyleModel, STYLE_LABELS } from '@/types'

interface StyleRadarProps {
  current: StyleModel
  previous?: StyleModel
  size?: number
}

export default function StyleRadar({ current, previous, size = 160 }: StyleRadarProps) {
  const dimensions = Object.keys(STYLE_LABELS) as (keyof StyleModel)[]
  const n = dimensions.length
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38

  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2

  function getPoint(index: number, value: number) {
    const angle = startAngle + index * angleStep
    return {
      x: cx + r * value * Math.cos(angle),
      y: cy + r * value * Math.sin(angle),
    }
  }

  function getAxisEnd(index: number) {
    return getPoint(index, 1)
  }

  // Build polygon path from values
  function buildPath(model: StyleModel) {
    return dimensions.map((dim, i) => {
      const pt = getPoint(i, model[dim])
      return `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
    }).join(' ') + ' Z'
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map(ring => (
        <polygon
          key={ring}
          points={dimensions.map((_, i) => {
            const pt = getPoint(i, ring)
            return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
          }).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth="0.5"
        />
      ))}

      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const end = getAxisEnd(i)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={end.x.toFixed(1)} y2={end.y.toFixed(1)}
            stroke="#334155"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Previous model (ghost) */}
      {previous && (
        <path
          d={buildPath(previous)}
          fill="rgba(100,116,139,0.15)"
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="3,2"
        />
      )}

      {/* Current model */}
      <path
        d={buildPath(current)}
        fill="rgba(99,102,241,0.2)"
        stroke="#6366f1"
        strokeWidth="1.5"
      />

      {/* Data points */}
      {dimensions.map((dim, i) => {
        const pt = getPoint(i, current[dim])
        return (
          <circle
            key={dim}
            cx={pt.x.toFixed(1)}
            cy={pt.y.toFixed(1)}
            r="2.5"
            fill="#6366f1"
          />
        )
      })}

      {/* Labels */}
      {dimensions.map((dim, i) => {
        const label = STYLE_LABELS[dim].label
        const offset = 10
        const angle = startAngle + i * angleStep
        const lx = cx + (r + offset) * Math.cos(angle)
        const ly = cy + (r + offset) * Math.sin(angle)
        const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle'

        return (
          <text
            key={dim}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="7"
            fill="#94a3b8"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
