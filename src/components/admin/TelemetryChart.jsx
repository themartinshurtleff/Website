import { useMemo, useRef, useState } from 'react'
import { formatMonitoringValue, formatTimestamp } from '@/lib/adminMonitoringData'

const WIDTH = 1000
const HEIGHT = 220
const TOP = 12
const BOTTOM = 202

function nearestPoint(points, timestamp) {
  if (!points?.length) return null
  let low = 0
  let high = points.length - 1

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle][0] < timestamp) low = middle + 1
    else high = middle
  }

  const next = points[low]
  const previous = points[Math.max(0, low - 1)]
  return Math.abs(next[0] - timestamp) < Math.abs(previous[0] - timestamp) ? next : previous
}

export default function TelemetryChart({
  title,
  description,
  series = [],
  unit,
  minValue,
  maxValue,
  height = 260,
}) {
  const containerRef = useRef(null)
  const [hoverRatio, setHoverRatio] = useState(null)

  const model = useMemo(() => {
    const populated = series.filter((entry) => entry.points?.length)
    const points = populated.flatMap((entry) => entry.points)
    if (!points.length) return null

    const timestamps = points.map((point) => point[0])
    const values = points.map((point) => point[1])
    const from = Math.min(...timestamps)
    const to = Math.max(...timestamps)
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const includeZero = rawMin >= 0
    const floor = minValue ?? (includeZero ? 0 : rawMin)
    const ceilingBase = maxValue ?? rawMax
    const ceiling = ceilingBase <= floor
      ? floor + 1
      : maxValue !== undefined
        ? maxValue
        : ceilingBase * 1.08

    const x = (timestamp) => ((timestamp - from) / Math.max(1, to - from)) * WIDTH
    const y = (value) => BOTTOM - (((value - floor) / Math.max(0.0001, ceiling - floor)) * (BOTTOM - TOP))

    return {
      from,
      to,
      floor,
      ceiling,
      populated: populated.map((entry) => ({
        ...entry,
        path: entry.points.map(([timestamp, value], index) => (
          `${index === 0 ? 'M' : 'L'} ${x(timestamp).toFixed(2)} ${y(value).toFixed(2)}`
        )).join(' '),
      })),
      x,
      y,
    }
  }, [maxValue, minValue, series])

  const hover = useMemo(() => {
    if (!model || hoverRatio === null) return null
    const timestamp = model.from + ((model.to - model.from) * hoverRatio)
    const rows = model.populated.map((entry) => ({
      ...entry,
      point: nearestPoint(entry.points, timestamp),
    })).filter((entry) => entry.point)
    const anchor = rows[0]?.point?.[0] ?? timestamp
    return { timestamp: anchor, rows, x: model.x(anchor) }
  }, [hoverRatio, model])

  function updateHover(event) {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setHoverRatio(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)))
  }

  const displayUnit = unit || model?.populated[0]?.unit || ''

  return (
    <section className="monitor-chart-panel" style={{ '--monitor-chart-height': `${height}px` }}>
      <div className="monitor-panel-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {model && (
          <div className="monitor-chart-legend" aria-label={`${title} legend`}>
            {model.populated.map((entry) => (
              <span key={entry.id}>
                <i style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {!model ? (
        <div className="monitor-chart-empty">No samples in this range</div>
      ) : (
        <div
          ref={containerRef}
          className="monitor-chart-canvas"
          onPointerMove={updateHover}
          onPointerLeave={() => setHoverRatio(null)}
        >
          <div className="monitor-chart-axis monitor-chart-axis-top">
            {formatMonitoringValue(model.ceiling, displayUnit, { compact: true })}
          </div>
          <div className="monitor-chart-axis monitor-chart-axis-bottom">
            {formatMonitoringValue(model.floor, displayUnit, { compact: true })}
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${title} time series`}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                x2={WIDTH}
                y1={TOP + ((BOTTOM - TOP) * ratio)}
                y2={TOP + ((BOTTOM - TOP) * ratio)}
                className="monitor-chart-gridline"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {model.populated.map((entry) => (
              <path
                key={entry.id}
                d={entry.path}
                fill="none"
                stroke={entry.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {hover && (
              <line
                x1={hover.x}
                x2={hover.x}
                y1={TOP}
                y2={BOTTOM}
                className="monitor-chart-crosshair"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          <div className="monitor-chart-times">
            <span>{formatTimestamp(model.from, true)}</span>
            <span>{formatTimestamp(model.to, true)}</span>
          </div>

          {hover && (
            <div
              className={`monitor-chart-tooltip ${hoverRatio > 0.68 ? 'align-right' : ''}`}
              style={{ left: `${hoverRatio * 100}%` }}
            >
              <time>{formatTimestamp(hover.timestamp, true)}</time>
              {hover.rows.map((entry) => (
                <div key={entry.id}>
                  <span><i style={{ backgroundColor: entry.color }} />{entry.name}</span>
                  <strong>{formatMonitoringValue(entry.point[1], entry.unit || displayUnit, { compact: true })}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
