const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const COMPACT_FORMAT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const MONITORING_COLORS = {
  gold: '#e8bd46',
  cyan: '#42d9d0',
  blue: '#5aa9ff',
  green: '#4ed38a',
  red: '#ff6577',
  orange: '#ff9d57',
  violet: '#a78bfa',
  gray: '#8a8f98',
}

export function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function getPath(object, path, fallback = null) {
  const value = path.split('.').reduce((current, key) => current?.[key], object)
  return value === undefined || value === null ? fallback : value
}

export function formatBytes(value, compact = false) {
  const number = finiteNumber(value)
  if (number === null) return 'Unavailable'
  if (number === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(Math.abs(number)) / Math.log(1024)), units.length - 1)
  const amount = number / (1024 ** index)
  const digits = compact || Math.abs(amount) >= 100 ? 0 : 1
  return `${amount.toFixed(digits)} ${units[index]}`
}

export function formatDurationSeconds(value) {
  const seconds = finiteNumber(value)
  if (seconds === null) return 'Unavailable'
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  if (seconds < 60) return `${NUMBER_FORMAT.format(seconds)} s`
  if (seconds < 3600) return `${NUMBER_FORMAT.format(seconds / 60)} min`
  if (seconds < 86400) return `${NUMBER_FORMAT.format(seconds / 3600)} hr`
  return `${NUMBER_FORMAT.format(seconds / 86400)} d`
}

export function formatMonitoringValue(value, unit = '', options = {}) {
  const number = finiteNumber(value)
  if (number === null) return 'Unavailable'

  switch (unit) {
    case 'percent':
    case 'percent_of_one_core':
      return `${NUMBER_FORMAT.format(number)}%`
    case 'bytes':
      return formatBytes(number, options.compact)
    case 'bytes_per_second':
      return `${formatBytes(number, true)}/s`
    case 'milliseconds':
      return number >= 1000
        ? formatDurationSeconds(number / 1000)
        : `${NUMBER_FORMAT.format(number)} ms`
    case 'seconds':
      return formatDurationSeconds(number)
    case 'state':
      return number > 0 ? 'Online' : 'Offline'
    case 'requests_per_minute':
    case 'events_per_minute':
    case 'fetches_per_minute':
      return `${NUMBER_FORMAT.format(number)}/min`
    case 'load':
      return number.toFixed(2)
    case 'connections':
    case 'descriptors':
    case 'files':
    case 'workers':
    case 'jobs':
    case 'chunks':
    case 'frames':
    case 'tiles':
    case 'requests':
    case 'alerts':
    case 'failures':
    case 'rejections':
    case 'venues':
    case 'partitions':
    case 'builds':
      return COMPACT_FORMAT.format(Math.round(number))
    default:
      return options.compact ? COMPACT_FORMAT.format(number) : NUMBER_FORMAT.format(number)
  }
}

export function formatTimestamp(value, includeDate = false) {
  const timestamp = finiteNumber(value)
  if (timestamp === null) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    ...(includeDate ? { month: 'short', day: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatRelativeTime(value, now = Date.now()) {
  const timestamp = finiteNumber(value)
  if (timestamp === null) return 'Never'
  const seconds = Math.max(0, (now - timestamp) / 1000)
  return seconds < 2 ? 'Just now' : `${formatDurationSeconds(seconds)} ago`
}

export function metricLabel(metric = {}) {
  const preferred = [
    'alertname',
    'service',
    'job',
    'stream',
    'route',
    'status',
    'auth',
    'reason',
    'exchange',
    'venue',
    'symbol',
    'timeframe',
  ]

  const parts = preferred
    .filter((key) => metric[key] !== undefined && metric[key] !== '')
    .map((key) => `${key === 'job' || key === 'service' ? '' : `${key}: `}${metric[key]}`)

  if (parts.length) return parts.join(' / ')

  const remaining = Object.entries(metric)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${value}`)

  return remaining.join(' / ') || 'Total'
}

export function getAggrResult(payload, id) {
  return payload?.results?.find((result) => result.id === id) || null
}

export function latestPoint(series) {
  const points = series?.points || []
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = finiteNumber(points[index]?.[1])
    if (value !== null) return [points[index][0], value]
  }
  return null
}

export function latestRows(payload, id) {
  const result = getAggrResult(payload, id)
  if (!result?.ok) return []

  return (result.series || [])
    .map((series) => {
      const point = latestPoint(series)
      return point ? {
        label: metricLabel(series.metric),
        metric: series.metric || {},
        timestamp: point[0],
        value: point[1],
        unit: result.unit,
      } : null
    })
    .filter(Boolean)
}

export function latestValue(payload, id, aggregate = 'first') {
  const rows = latestRows(payload, id)
  if (!rows.length) return null
  if (aggregate === 'sum') return rows.reduce((total, row) => total + row.value, 0)
  if (aggregate === 'max') return Math.max(...rows.map((row) => row.value))
  return rows[0].value
}

export function aggrChartSeries(payload, id, options = {}) {
  const result = getAggrResult(payload, id)
  if (!result?.ok) return []

  const colors = options.colors || Object.values(MONITORING_COLORS)
  return (result.series || [])
    .slice(0, options.limit || 8)
    .map((series, index) => ({
      id: `${id}-${index}-${metricLabel(series.metric)}`,
      name: options.label && result.series.length === 1 ? options.label : metricLabel(series.metric),
      color: colors[index % colors.length],
      unit: result.unit,
      points: (series.points || [])
        .map(([timestamp, value]) => [finiteNumber(timestamp), finiteNumber(value)])
        .filter(([timestamp, value]) => timestamp !== null && value !== null),
    }))
    .filter((series) => series.points.length)
}

export function combineAggrChartSeries(payload, specs) {
  return specs.flatMap((spec) => aggrChartSeries(payload, spec.id, {
    label: spec.label,
    limit: spec.limit || 1,
    colors: [spec.color],
  }))
}

export function backendChartSeries(points = [], specs = []) {
  return specs.map((spec) => ({
    id: spec.id || spec.path,
    name: spec.label,
    color: spec.color,
    unit: spec.unit,
    points: points
      .map((point) => {
        const rawValue = finiteNumber(getPath(point, spec.path))
        const value = rawValue === null || !spec.transform
          ? rawValue
          : finiteNumber(spec.transform(rawValue, point))
        return [finiteNumber(point.t), value]
      })
      .filter(([timestamp, value]) => timestamp !== null && value !== null),
  })).filter((series) => series.points.length)
}

export function toneForStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (['ok', 'healthy', 'active', 'online', 'up', 'ready'].includes(normalized)) return 'ok'
  if (['warning', 'stale', 'degraded', 'pending'].includes(normalized)) return 'warning'
  if (['critical', 'error', 'failed', 'offline', 'down'].includes(normalized)) return 'critical'
  return 'neutral'
}

export function safeEntries(object) {
  return Object.entries(object || {})
}
