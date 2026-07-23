import { supabase } from '@/lib/supabase'

const AGGR_BASE = (import.meta.env.VITE_AGGR_API_BASE || 'https://proxy.tradenet.org/aggr').replace(/\/$/, '')
const BACKEND_BASE = (import.meta.env.VITE_BACKEND_API_BASE || 'https://api.tradenet.org').replace(/\/$/, '')

export const MONITORING_RANGES = {
  '1h': {
    label: '1H',
    durationMs: 60 * 60 * 1000,
    aggrStepMs: 15 * 1000,
    backendWindowMinutes: 60,
    backendStepMinutes: 1,
  },
  '6h': {
    label: '6H',
    durationMs: 6 * 60 * 60 * 1000,
    aggrStepMs: 60 * 1000,
    backendWindowMinutes: 360,
    backendStepMinutes: 1,
  },
  '24h': {
    label: '24H',
    durationMs: 24 * 60 * 60 * 1000,
    aggrStepMs: 2 * 60 * 1000,
    backendWindowMinutes: 1440,
    backendStepMinutes: 5,
  },
  '3d': {
    label: '3D',
    durationMs: 3 * 24 * 60 * 60 * 1000,
    aggrStepMs: 15 * 60 * 1000,
    backendWindowMinutes: 4320,
    backendStepMinutes: 15,
  },
  '7d': {
    label: '7D',
    durationMs: 7 * 24 * 60 * 60 * 1000,
    aggrStepMs: 15 * 60 * 1000,
    backendWindowMinutes: 10080,
    backendStepMinutes: 60,
  },
}

export const AGGR_RANGE_QUERY_IDS = [
  'host_cpu_percent',
  'host_memory_percent',
  'host_disk_percent',
  'host_network_receive_bps',
  'host_network_transmit_bps',
  'host_disk_read_bps',
  'host_disk_write_bps',
  'aggr_process_cpu_percent',
  'aggr_process_rss_bytes',
  'event_loop_p99_ms',
  'vap_worker_cpu_percent',
  'vap_worker_rss_bytes',
  'requests_per_minute',
  'nginx_requests_per_minute',
  'responses_5xx_per_minute',
  'request_latency_p95_ms',
  'authenticated_requests_per_minute',
  'unauthenticated_requests_per_minute',
  'auth_denied_per_minute',
  'jwt_rejected_per_minute',
  'ws_clients',
  'ws_egress_bps',
  'ws_backpressure_per_minute',
  'exchange_message_age_seconds',
  'archive_lag_seconds',
  'archive_ready_files',
  'archive_upload_failures',
  'vap_worker_age_seconds',
  'vap_worker_failures',
  'backend_heatmap_frame_age_seconds',
  'backend_heatmap_cache_hit_percent',
  'backend_archive_lag_seconds',
]

export class MonitoringApiError extends Error {
  constructor(message, { status = 0, code = 'monitoring_request_failed', details = null, retryAfterMs = 0 } = {}) {
    super(message)
    this.name = 'MonitoringApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfterMs = retryAfterMs
  }
}

function retryAfterMs(response) {
  const value = response.headers.get('retry-after')
  if (!value) return 0

  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)

  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0
}

async function getAccessToken(forceRefresh = false) {
  const result = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession()

  if (result.error) {
    throw new MonitoringApiError(result.error.message, {
      status: 401,
      code: 'supabase_session_error',
    })
  }

  const token = result.data.session?.access_token
  if (!token) {
    throw new MonitoringApiError('Sign in is required to view monitoring.', {
      status: 401,
      code: 'auth_required',
    })
  }

  return token
}

async function parseResponse(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    throw new MonitoringApiError('The monitoring service returned an invalid response.', {
      status: response.status,
      code: 'invalid_monitoring_response',
    })
  }
}

async function requestJson(url, options = {}, allowRefresh = true) {
  const token = await getAccessToken(false)
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (response.status === 401 && allowRefresh) {
    const refreshedToken = await getAccessToken(true)
    const retry = await fetch(url, {
      ...options,
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshedToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })

    return handleResponse(retry)
  }

  return handleResponse(response)
}

async function handleResponse(response) {
  const body = await parseResponse(response)
  if (response.ok) return body

  throw new MonitoringApiError(
    body?.message || body?.detail || `Monitoring request failed with status ${response.status}.`,
    {
      status: response.status,
      code: body?.code || body?.error || 'monitoring_request_failed',
      details: body?.details || null,
      retryAfterMs: retryAfterMs(response),
    },
  )
}

export function fetchAggrCatalog(signal) {
  return requestJson(`${AGGR_BASE}/admin/monitoring/catalog`, { signal })
}

export function fetchAggrSnapshot(signal) {
  return requestJson(`${AGGR_BASE}/admin/monitoring/snapshot`, { signal })
}

export function fetchAggrRange({ rangeKey, catalog, signal }) {
  const range = MONITORING_RANGES[rangeKey] || MONITORING_RANGES['6h']
  const now = Date.now()
  const allowed = new Set((catalog?.queries || []).map((query) => query.id))
  const ids = AGGR_RANGE_QUERY_IDS.filter((id) => allowed.has(id))

  if (!ids.length) {
    throw new MonitoringApiError('The monitoring catalog did not expose any dashboard time-series queries.', {
      code: 'monitoring_catalog_empty',
    })
  }

  return requestJson(`${AGGR_BASE}/admin/monitoring/query`, {
    method: 'POST',
    signal,
    body: JSON.stringify({
      queries: ids.map((id) => ({
        id,
        mode: 'range',
        from_ms: now - range.durationMs,
        to_ms: now,
        step_ms: range.aggrStepMs,
      })),
    }),
  })
}

export function fetchAggrSecurity({ windowMs, signal }) {
  const boundedWindow = Math.min(windowMs, 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    window_ms: String(boundedWindow),
    limit: '50',
  })

  return requestJson(`${AGGR_BASE}/admin/monitoring/security?${params}`, { signal })
}

export function fetchBackendSummary(signal) {
  return requestJson(`${BACKEND_BASE}/v2/admin/monitoring/summary`, { signal })
}

export function fetchBackendRange({ rangeKey, signal }) {
  const range = MONITORING_RANGES[rangeKey] || MONITORING_RANGES['6h']
  const params = new URLSearchParams({
    window_minutes: String(range.backendWindowMinutes),
    step_minutes: String(range.backendStepMinutes),
  })

  return requestJson(`${BACKEND_BASE}/v2/admin/monitoring/timeseries?${params}`, { signal })
}

export function isRetryableMonitoringError(error) {
  return error?.status === 429 || error?.status === 503 || error?.code === 'prometheus_timeout'
}
