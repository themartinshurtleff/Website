import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CircleOff,
  Cpu,
  Database,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Waves,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { MONITORING_RANGES } from '@/lib/adminMonitoring'
import {
  MONITORING_COLORS,
  aggrChartSeries,
  backendChartSeries,
  combineAggrChartSeries,
  finiteNumber,
  formatBytes,
  formatDurationSeconds,
  formatMonitoringValue,
  formatRelativeTime,
  formatTimestamp,
  getPath,
  latestRows,
  latestValue,
  safeEntries,
  toneForStatus,
} from '@/lib/adminMonitoringData'
import { useAdminMonitoring } from '@/hooks/useAdminMonitoring'
import TelemetryChart from '@/components/admin/TelemetryChart'
import '@/styles/admin-dashboard.css'

const LOCAL_DEMO = import.meta.env.DEV && import.meta.env.VITE_ADMIN_MONITORING_DEMO === '1'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'compute', label: 'Compute', icon: Cpu },
  { id: 'traffic', label: 'Traffic', icon: Activity },
  { id: 'streams', label: 'Streams', icon: Radio },
  { id: 'storage', label: 'Storage', icon: Database },
  { id: 'heatmaps', label: 'Heatmaps', icon: Waves },
  { id: 'security', label: 'Security', icon: ShieldAlert },
]

const ERROR_LABELS = {
  catalog: 'Aggr catalog',
  aggrSnapshot: 'Aggr snapshot',
  aggrRange: 'Aggr history',
  aggrSecurity: 'Security sources',
  backendSummary: 'Backend summary',
  backendRange: 'Backend history',
}

function titleFromKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function inferredUnit(key) {
  const normalized = String(key || '').toLowerCase()
  if (normalized.includes('bytes_per_second')) return 'bytes_per_second'
  if (normalized.endsWith('_bytes') || normalized.includes('rss_bytes')) return 'bytes'
  if (normalized.endsWith('_ms') || normalized.includes('duration_ms') || normalized.includes('age_ms')) return 'milliseconds'
  if (normalized.endsWith('_seconds') || normalized.includes('age_seconds') || normalized.includes('lag_seconds')) return 'seconds'
  if (normalized.includes('percent') || normalized.endsWith('_pct')) return 'percent'
  return ''
}

function displayScalar(value, key = '', explicitUnit = '') {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
  if (typeof value === 'string') return value
  return formatMonitoringValue(value, explicitUnit || inferredUnit(key), { compact: true })
}

function flattenScalars(value, prefix = '', output = [], limit = 40) {
  if (output.length >= limit || value === null || value === undefined) return output
  if (typeof value !== 'object' || Array.isArray(value)) {
    output.push({ key: prefix, value })
    return output
  }

  Object.entries(value).forEach(([key, child]) => {
    if (output.length >= limit) return
    const path = prefix ? `${prefix}.${key}` : key
    if (child !== null && typeof child === 'object') flattenScalars(child, path, output, limit)
    else output.push({ key: path, value: child })
  })
  return output
}

function StatusPill({ status, children }) {
  const tone = toneForStatus(status)
  return (
    <span className={`monitor-status-pill is-${tone}`}>
      <i />
      {children || status || 'Unknown'}
    </span>
  )
}

function Metric({ label, value, unit = '', tone = 'neutral', detail }) {
  return (
    <div className={`monitor-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{displayScalar(value, label, unit)}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

function MetricGrid({ children, columns = 4 }) {
  return <div className={`monitor-metric-grid columns-${columns}`}>{children}</div>
}

function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`monitor-panel ${className}`}>
      <div className="monitor-panel-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="monitor-section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function EmptyState({ message = 'No data returned' }) {
  return (
    <div className="monitor-empty-state">
      <CircleOff size={16} />
      <span>{message}</span>
    </div>
  )
}

function KeyValueGrid({ data, limit = 20, emptyMessage, exclude = [] }) {
  const rows = flattenScalars(data, '', [], limit).filter((row) => !exclude.some((key) => row.key.includes(key)))
  if (!rows.length) return <EmptyState message={emptyMessage} />

  return (
    <div className="monitor-key-grid">
      {rows.map((row) => (
        <div key={row.key}>
          <span>{titleFromKey(row.key.split('.').join(' / '))}</span>
          <strong>{displayScalar(row.value, row.key)}</strong>
        </div>
      ))}
    </div>
  )
}

function DataTable({ columns, rows, emptyMessage = 'No records returned', rowKey }) {
  if (!rows?.length) return <EmptyState message={emptyMessage} />
  return (
    <div className="monitor-table-wrap">
      <table className="monitor-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render ? column.render(row, index) : displayScalar(row[column.key], column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SourceErrors({ errors, aggrSnapshot, aggrRange }) {
  const rows = Object.entries(errors || {}).map(([key, error]) => ({
    key,
    label: ERROR_LABELS[key] || key,
    message: error?.message || 'Unavailable',
  }))
  const resultErrors = [aggrSnapshot, aggrRange]
    .flatMap((payload) => payload?.results || [])
    .filter((result) => result?.ok === false)
    .filter((result, index, all) => all.findIndex((candidate) => candidate.id === result.id) === index)
    .map((result) => ({
      key: `query-${result.id}`,
      label: result.title || titleFromKey(result.id),
      message: result.message || result.error || 'Query unavailable',
    }))
  const allRows = [...rows, ...resultErrors]
  if (!allRows.length) return null
  return (
    <div className="monitor-source-errors">
      {allRows.map((row) => (
        <div key={row.key}>
          <AlertTriangle size={15} />
          <span><strong>{row.label}</strong>{row.message}</span>
        </div>
      ))}
    </div>
  )
}

function AccessScreen({ kind, onRefresh }) {
  const navigate = useNavigate()
  const config = kind === 'signin'
    ? {
        icon: LockKeyhole,
        title: 'Admin sign-in required',
        body: 'Sign in with the Supabase account that has the TradeNet admin entitlement.',
        action: 'Sign in',
      }
    : kind === 'loading'
      ? {
          icon: RefreshCw,
          title: 'Checking admin access',
          body: 'Reading the current Supabase profile and access token.',
          action: null,
        }
      : {
          icon: ShieldAlert,
          title: 'Admin access required',
          body: 'This account does not currently have access to TradeNet monitoring.',
          action: 'Refresh access',
        }
  const Icon = config.icon

  return (
    <main className="monitor-access-screen">
      <Link to="/" className="monitor-access-logo"><img src="/assets/text-logo.png" alt="TradeNet" /></Link>
      <div>
        <Icon size={25} className={kind === 'loading' ? 'spin' : ''} />
        <span>ADMIN MONITORING</span>
        <h1>{config.title}</h1>
        <p>{config.body}</p>
        <div className="monitor-access-actions">
          {kind === 'signin' && <button onClick={() => navigate('/login?return=%2Fadmin%2Fdashboard')}>{config.action}</button>}
          {kind === 'denied' && <button onClick={onRefresh}>{config.action}</button>}
          <Link to="/account">Back to account</Link>
        </div>
      </div>
    </main>
  )
}

function serviceStatus(snapshot, backendSummary) {
  const serviceRows = latestRows(snapshot, 'services_up')
  const aggrHealthy = serviceRows.length > 0 && serviceRows.every((row) => row.value > 0)
  const backendStatus = backendSummary?.health?.status
  if (!serviceRows.length && !backendStatus) return 'unknown'
  if (!aggrHealthy || backendStatus === 'critical') return 'critical'
  if (
    (snapshot?.generated_at_ms && Date.now() - snapshot.generated_at_ms > 45000)
    || (backendSummary?.generated_at_ms && Date.now() - backendSummary.generated_at_ms > 20000)
  ) return 'warning'
  if (backendStatus === 'warning') return 'warning'
  return 'ok'
}

function freshnessClass(timestamp, staleAfterMs) {
  if (!timestamp) return ''
  return Date.now() - timestamp > staleAfterMs ? 'stale' : 'online'
}

function OverviewView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary, backendRange } = monitor
  const healthChecks = backendSummary?.health?.checks || []
  const serviceRows = latestRows(aggrSnapshot, 'services_up')
  const systemdRows = latestRows(aggrSnapshot, 'systemd_services_active')
  const alerts = latestRows(aggrSnapshot, 'alerts_firing')
  const backendTraffic = backendSummary?.traffic?.last_60m || {}
  const currentStatus = serviceStatus(aggrSnapshot, backendSummary)

  const cpuSeries = [
    ...combineAggrChartSeries(aggrRange, [
      { id: 'host_cpu_percent', label: 'Aggr host', color: MONITORING_COLORS.gold },
    ]),
    ...backendChartSeries(backendRange?.points, [
      { id: 'backend-host', path: 'resources.host_cpu_percent_avg', label: 'Backend host', color: MONITORING_COLORS.cyan, unit: 'percent' },
    ]),
  ]
  const requestSeries = [
    ...combineAggrChartSeries(aggrRange, [
      { id: 'requests_per_minute', label: 'Aggr', color: MONITORING_COLORS.gold },
    ]),
    ...backendChartSeries(backendRange?.points, [
      {
        id: 'backend-rpm',
        path: 'requests',
        label: 'Backend',
        color: MONITORING_COLORS.cyan,
        unit: 'requests_per_minute',
        transform: (value, point) => value / Math.max(1, finiteNumber(point.step_minutes) || 1),
      },
    ]),
  ]

  return (
    <>
      <SectionHeading eyebrow="FLEET OVERVIEW" title="Production at a glance" description="Current service health, traffic, and resource pressure across both market-data hosts." />

      <MetricGrid columns={6}>
        <Metric label="Fleet health" value={currentStatus === 'ok' ? 'Operational' : titleFromKey(currentStatus)} tone={currentStatus} />
        <Metric label="Aggr host CPU" value={latestValue(aggrSnapshot, 'host_cpu_percent')} unit="percent" />
        <Metric label="Backend host CPU" value={backendSummary?.resources?.host_cpu_percent} unit="percent" />
        <Metric label="Requests / min" value={(latestValue(aggrSnapshot, 'requests_per_minute') || 0) + (backendTraffic.requests_per_minute || 0)} unit="requests_per_minute" />
        <Metric label="Active users / 60m" value={backendTraffic.unique_authenticated_users} />
        <Metric label="WebSocket clients" value={latestValue(aggrSnapshot, 'ws_clients', 'sum')} unit="connections" />
      </MetricGrid>

      {alerts.length > 0 && (
        <Panel title="Firing alerts" description="Server-owned Prometheus rules requiring attention." className="is-alert">
          <div className="monitor-alert-list">
            {alerts.map((alert) => (
              <div key={alert.label}>
                <AlertTriangle size={16} />
                <strong>{alert.label}</strong>
                <span>{formatMonitoringValue(alert.value, alert.unit)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="monitor-chart-grid">
        <TelemetryChart title="Host CPU" description="Whole-host utilization, normalized to 0-100%." series={cpuSeries} unit="percent" minValue={0} maxValue={100} />
        <TelemetryChart title="Customer request rate" description="Monitoring polls are excluded from these totals." series={requestSeries} unit="requests_per_minute" />
      </div>

      <div className="monitor-split-grid">
        <Panel title="Targets and service units" description="Prometheus target state, systemd units, and backend process lifetime.">
          <div className="monitor-service-list">
            {serviceRows.length ? serviceRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <StatusPill status={row.value > 0 ? 'online' : 'offline'}>{row.value > 0 ? 'Online' : 'Offline'}</StatusPill>
              </div>
            )) : <EmptyState message="Target state unavailable" />}
            {systemdRows.map((row) => (
              <div key={`systemd-${row.label}`}>
                <span>systemd / {row.label}</span>
                <StatusPill status={row.value > 0 ? 'online' : 'offline'}>{row.value > 0 ? 'Active' : 'Inactive'}</StatusPill>
              </div>
            ))}
            {backendSummary?.process_started_at_ms && (
              <div>
                <span>backend process uptime</span>
                <strong>{formatDurationSeconds((Date.now() - backendSummary.process_started_at_ms) / 1000)}</strong>
              </div>
            )}
            {backendSummary?.monitor_started_at_ms && (
              <div>
                <span>monitoring started</span>
                <strong>{formatTimestamp(backendSummary.monitor_started_at_ms, true)}</strong>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Backend health checks" description="Subsystem states reported independently by the Python backend.">
          <div className="monitor-health-list">
            {healthChecks.length ? healthChecks.map((check) => (
              <div key={check.name}>
                <StatusPill status={check.status}>{check.status}</StatusPill>
                <span><strong>{titleFromKey(check.name)}</strong><small>{check.detail}</small></span>
              </div>
            )) : <EmptyState message="Backend health checks unavailable" />}
          </div>
        </Panel>
      </div>
    </>
  )
}

function ComputeView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary, backendRange } = monitor
  const resources = backendSummary?.resources || {}
  const processGroups = safeEntries(resources.process_groups).map(([name, row]) => ({ name, ...row }))

  const aggrHostSeries = combineAggrChartSeries(aggrRange, [
    { id: 'host_cpu_percent', label: 'CPU', color: MONITORING_COLORS.gold },
    { id: 'host_memory_percent', label: 'Memory', color: MONITORING_COLORS.cyan },
    { id: 'host_disk_percent', label: 'Disk', color: MONITORING_COLORS.violet },
  ])
  const backendCpuSeries = backendChartSeries(backendRange?.points, [
    { path: 'resources.host_cpu_percent_avg', label: 'Host', color: MONITORING_COLORS.cyan, unit: 'percent' },
    { path: 'resources.api_cpu_percent_avg', label: 'API', color: MONITORING_COLORS.gold, unit: 'percent_of_one_core' },
    { path: 'resources.heatmap_worker_cpu_percent_avg', label: 'Heatmaps', color: MONITORING_COLORS.violet, unit: 'percent_of_one_core' },
  ])
  const ioSeries = combineAggrChartSeries(aggrRange, [
    { id: 'host_network_receive_bps', label: 'Network RX', color: MONITORING_COLORS.cyan },
    { id: 'host_network_transmit_bps', label: 'Network TX', color: MONITORING_COLORS.gold },
    { id: 'host_disk_read_bps', label: 'Disk read', color: MONITORING_COLORS.blue },
    { id: 'host_disk_write_bps', label: 'Disk write', color: MONITORING_COLORS.violet },
  ])
  const processMemorySeries = combineAggrChartSeries(aggrRange, [
    { id: 'aggr_process_rss_bytes', label: 'Aggr API', color: MONITORING_COLORS.gold },
    { id: 'vap_worker_rss_bytes', label: 'VAP worker', color: MONITORING_COLORS.cyan },
  ])

  return (
    <>
      <SectionHeading eyebrow="COMPUTE" title="Hosts and processes" description="Whole-host pressure and per-process resource use. Process CPU can exceed 100% across cores." />
      <MetricGrid columns={6}>
        <Metric label="Aggr CPU" value={latestValue(aggrSnapshot, 'aggr_process_cpu_percent')} unit="percent_of_one_core" />
        <Metric label="Event loop p99" value={latestValue(aggrSnapshot, 'event_loop_p99_ms')} unit="milliseconds" />
        <Metric label="Aggr RSS" value={latestValue(aggrSnapshot, 'aggr_process_rss_bytes')} unit="bytes" />
        <Metric label="Backend service CPU" value={resources.service_cpu_percent} unit="percent_of_one_core" />
        <Metric label="Backend service RSS" value={resources.service_rss_bytes} unit="bytes" />
        <Metric label="Backend load 1m" value={resources.load_1m} unit="load" />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="Aggr host saturation" description="CPU, memory, and root filesystem utilization." series={aggrHostSeries} unit="percent" minValue={0} maxValue={100} />
        <TelemetryChart title="Backend process CPU" description="Host percentage and Linux per-process CPU semantics." series={backendCpuSeries} unit="percent" minValue={0} />
        <TelemetryChart title="Aggr network and disk I/O" description="Non-loopback network and host disk throughput." series={ioSeries} unit="bytes_per_second" />
        <TelemetryChart title="Aggr process memory" description="Resident memory for the API and VAP prebuilder." series={processMemorySeries} unit="bytes" />
      </div>

      <div className="monitor-split-grid">
        <Panel title="Backend process groups" description="Current process count, CPU, and resident memory.">
          <DataTable
            rows={processGroups}
            rowKey={(row) => row.name}
            columns={[
              { key: 'name', label: 'Process', render: (row) => <strong>{titleFromKey(row.name)}</strong> },
              { key: 'count', label: 'Count' },
              { key: 'cpu_percent', label: 'CPU', render: (row) => formatMonitoringValue(row.cpu_percent, 'percent_of_one_core') },
              { key: 'rss_bytes', label: 'RSS', render: (row) => formatBytes(row.rss_bytes) },
            ]}
          />
        </Panel>
        <Panel title="Aggr process state" description="Current API runtime and service manager values.">
          <KeyValueGrid data={{
            process_cpu_percent: latestValue(aggrSnapshot, 'aggr_process_cpu_percent'),
            process_rss_bytes: latestValue(aggrSnapshot, 'aggr_process_rss_bytes'),
            heap_used_bytes: latestValue(aggrSnapshot, 'aggr_heap_used_bytes'),
            open_fds: latestValue(aggrSnapshot, 'aggr_open_fds'),
            event_loop_p99_ms: latestValue(aggrSnapshot, 'event_loop_p99_ms'),
            host_load_1m: latestValue(aggrSnapshot, 'host_load_1m'),
          }} />
        </Panel>
      </div>
    </>
  )
}

function TrafficView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary, backendRange } = monitor
  const traffic = backendSummary?.traffic?.last_60m || {}
  const points = backendRange?.points || []
  const backendRpm = backendChartSeries(points, [{
    path: 'requests',
    label: 'Backend',
    color: MONITORING_COLORS.cyan,
    unit: 'requests_per_minute',
    transform: (value, point) => value / Math.max(1, finiteNumber(point.step_minutes) || 1),
  }])
  const statusSeries = backendChartSeries(points, [
    { path: 'status.2xx', label: '2xx', color: MONITORING_COLORS.green, unit: 'requests' },
    { path: 'status.4xx', label: '4xx', color: MONITORING_COLORS.orange, unit: 'requests' },
    { path: 'status.5xx', label: '5xx', color: MONITORING_COLORS.red, unit: 'requests' },
  ])
  const latencySeries = [
    ...backendChartSeries(points, [
      { path: 'latency_ms.p50', label: 'Backend p50', color: MONITORING_COLORS.green, unit: 'milliseconds' },
      { path: 'latency_ms.p95', label: 'Backend p95', color: MONITORING_COLORS.cyan, unit: 'milliseconds' },
      { path: 'latency_ms.p99', label: 'Backend p99', color: MONITORING_COLORS.violet, unit: 'milliseconds' },
    ]),
    ...combineAggrChartSeries(aggrRange, [
      { id: 'request_latency_p95_ms', label: 'Aggr p95', color: MONITORING_COLORS.gold },
    ]),
  ]

  return (
    <>
      <SectionHeading eyebrow="TRAFFIC" title="Requests and latency" description="Customer traffic only. Successful monitoring polls and private metric scrapes are excluded." />
      <MetricGrid columns={6}>
        <Metric label="Aggr requests / min" value={latestValue(aggrSnapshot, 'requests_per_minute')} unit="requests_per_minute" />
        <Metric label="Aggr requests / hour" value={latestValue(aggrSnapshot, 'requests_last_hour')} />
        <Metric label="Backend requests / min" value={traffic.requests_per_minute} unit="requests_per_minute" />
        <Metric label="Backend response bytes" value={traffic.response_bytes} unit="bytes" />
        <Metric label="Backend p95" value={traffic.latency_ms?.p95} unit="milliseconds" />
        <Metric label="Backend 5xx / hour" value={traffic.status?.['5xx']} tone={(traffic.status?.['5xx'] || 0) > 0 ? 'warning' : 'ok'} />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="Backend request rate" description="Normalized to requests per minute for every selected range." series={backendRpm} unit="requests_per_minute" />
        <TelemetryChart title="Backend response classes" description="Counts per effective backend time-series bucket." series={statusSeries} />
        <TelemetryChart title="Request latency" description="Bounded histogram estimates for backend plus aggr p95." series={latencySeries} unit="milliseconds" />
        <TelemetryChart title="Aggr edge traffic" description="Application requests compared with the whole proxy edge." series={combineAggrChartSeries(aggrRange, [
          { id: 'requests_per_minute', label: 'Aggr application', color: MONITORING_COLORS.gold },
          { id: 'nginx_requests_per_minute', label: 'Proxy nginx', color: MONITORING_COLORS.cyan },
          { id: 'responses_5xx_per_minute', label: 'Aggr 5xx', color: MONITORING_COLORS.red },
        ])} unit="requests_per_minute" />
      </div>

      <Panel title="Backend top routes" description="Fixed route labels ranked over the last 60 minutes.">
        <DataTable
          rows={traffic.top_routes || []}
          rowKey={(row) => row.route}
          columns={[
            { key: 'route', label: 'Route', render: (row) => <code>{row.route}</code> },
            { key: 'requests', label: 'Requests' },
            { key: 'errors', label: 'Errors' },
            { key: 'response_bytes', label: 'Response', render: (row) => formatBytes(row.response_bytes) },
            { key: 'latency_ms_p95', label: 'p95', render: (row) => formatMonitoringValue(row.latency_ms_p95, 'milliseconds') },
            { key: 'latency_ms_max', label: 'Max', render: (row) => formatMonitoringValue(row.latency_ms_max, 'milliseconds') },
          ]}
        />
      </Panel>
    </>
  )
}

function StreamsView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary } = monitor
  const pipelines = backendSummary?.operations?.pipelines || {}
  const exchanges = safeEntries(pipelines.exchanges).map(([name, row]) => ({ name, ...row }))
  const oiRows = safeEntries(pipelines.oi).map(([symbol, row]) => ({ symbol, ...row }))
  const liquidationRows = safeEntries(pipelines.liquidations).map(([symbol, row]) => ({ symbol, ...row }))

  return (
    <>
      <SectionHeading eyebrow="LIVE STREAMS" title="Market-data freshness" description="Exchange input age, client streams, DOM state, open interest, and liquidation buffers." />
      <MetricGrid columns={6}>
        <Metric label="WS clients" value={latestValue(aggrSnapshot, 'ws_clients', 'sum')} unit="connections" />
        <Metric label="WS egress" value={latestValue(aggrSnapshot, 'ws_egress_bps', 'sum')} unit="bytes_per_second" />
        <Metric label="Backpressure / min" value={latestValue(aggrSnapshot, 'ws_backpressure_per_minute', 'sum')} unit="events_per_minute" />
        <Metric label="Stale DOM venues" value={latestValue(aggrSnapshot, 'dom_stale_venues', 'sum')} />
        <Metric label="Backend WS subjects" value={getPath(backendSummary, 'operations.auth.websocket_subjects', getPath(backendSummary, 'operations.auth.current_websocket_subjects'))} />
        <Metric label="Backend WS connections" value={getPath(backendSummary, 'operations.auth.websocket_connections', getPath(backendSummary, 'operations.auth.current_websocket_connections'))} />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="WebSocket clients" description="Connected clients grouped by stream." series={aggrChartSeries(aggrRange, 'ws_clients', { limit: 6 })} />
        <TelemetryChart title="Exchange message age" description="Last trade message age by venue and symbol." series={aggrChartSeries(aggrRange, 'exchange_message_age_seconds', { limit: 8 })} unit="seconds" />
        <TelemetryChart title="WebSocket egress" description="Payload throughput across Tape, DOM, and legacy streams." series={aggrChartSeries(aggrRange, 'ws_egress_bps', { limit: 6 })} unit="bytes_per_second" />
        <TelemetryChart title="Slow-client pressure" description="Skip and close events caused by backpressure." series={aggrChartSeries(aggrRange, 'ws_backpressure_per_minute', { limit: 6 })} unit="events_per_minute" />
      </div>

      <Panel title="Backend exchange inputs" description="Direct backend pipeline connectivity and last-message age.">
        <DataTable
          rows={exchanges}
          rowKey={(row) => row.name}
          columns={[
            { key: 'name', label: 'Exchange', render: (row) => <strong>{titleFromKey(row.name)}</strong> },
            { key: 'connected', label: 'State', render: (row) => <StatusPill status={row.connected ? 'online' : 'offline'}>{row.connected ? 'Connected' : 'Disconnected'}</StatusPill> },
            { key: 'age_ms', label: 'Message age', render: (row) => displayScalar(row.age_ms ?? ((row.age_seconds ?? 0) * 1000), 'age_ms') },
            { key: 'last_message_ts_ms', label: 'Last message', render: (row) => row.last_message_ts_ms ? formatTimestamp(row.last_message_ts_ms, true) : 'Unavailable' },
          ]}
        />
      </Panel>

      <div className="monitor-split-grid">
        <Panel title="Open interest" description="Current aggregate and hot-history freshness by symbol.">
          <DataTable
            rows={oiRows}
            rowKey={(row) => row.symbol}
            columns={[
              { key: 'symbol', label: 'Symbol', render: (row) => <strong>{row.symbol}</strong> },
              { key: 'history_samples', label: 'Samples', render: (row) => displayScalar(row.history_samples ?? row.hot_history_count) },
              { key: 'aggregated_oi', label: 'Aggregate OI', render: (row) => displayScalar(row.aggregated_oi ?? row.current_aggregate_oi) },
              { key: 'last_poll_age_ms', label: 'Poll age', render: (row) => displayScalar(row.last_poll_age_ms ?? ((row.poll_age_seconds ?? 0) * 1000), 'last_poll_age_ms') },
            ]}
          />
        </Panel>
        <Panel title="Liquidation buffers" description="Event retention and newest event age. Quiet markets can legitimately be old.">
          <DataTable
            rows={liquidationRows}
            rowKey={(row) => row.symbol}
            columns={[
              { key: 'symbol', label: 'Symbol', render: (row) => <strong>{row.symbol}</strong> },
              { key: 'buffer_events', label: 'Events', render: (row) => displayScalar(row.buffer_events ?? row.retained_event_count) },
              { key: 'last_event_age_ms', label: 'Newest age', render: (row) => displayScalar(row.last_event_age_ms ?? ((row.newest_event_age_seconds ?? 0) * 1000), 'last_event_age_ms') },
            ]}
          />
        </Panel>
      </div>
    </>
  )
}

function StorageView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary } = monitor
  const archive = backendSummary?.operations?.archive || {}

  return (
    <>
      <SectionHeading eyebrow="STORAGE" title="Archives and persistence" description="Influx freshness, raw archive flow, read-through cache, and queue pressure on both hosts." />
      <MetricGrid columns={6}>
        <Metric label="Influx write age" value={latestValue(aggrSnapshot, 'influx_last_write_age_seconds')} unit="seconds" />
        <Metric label="Influx failures / hour" value={latestValue(aggrSnapshot, 'influx_write_failures')} tone={(latestValue(aggrSnapshot, 'influx_write_failures') || 0) > 0 ? 'critical' : 'ok'} />
        <Metric label="Aggr archive lag" value={latestValue(aggrSnapshot, 'archive_lag_seconds')} unit="seconds" />
        <Metric label="Aggr ready files" value={latestValue(aggrSnapshot, 'archive_ready_files')} />
        <Metric label="Backend archive lag" value={archive.lag_seconds} unit="seconds" />
        <Metric label="Backend pending" value={archive.uploadable_pending_partitions ?? archive.pending_partitions} />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="Aggr archive queue" description="Oldest upload lag and sealed ready-file count." series={combineAggrChartSeries(aggrRange, [
          { id: 'archive_lag_seconds', label: 'Lag seconds', color: MONITORING_COLORS.gold },
          { id: 'archive_ready_files', label: 'Ready files', color: MONITORING_COLORS.cyan },
        ])} />
        <TelemetryChart title="Archive failures" description="Rolling-hour upload failures for the aggr raw archive." series={aggrChartSeries(aggrRange, 'archive_upload_failures')} />
      </div>

      <div className="monitor-split-grid">
        <Panel title="Aggr archive and cold reads" description="Current upload, spool, read cache, and worker queue state.">
          <KeyValueGrid data={{
            upload_enabled: latestValue(aggrSnapshot, 'archive_upload_enabled'),
            spool_bytes: latestValue(aggrSnapshot, 'archive_spool_bytes'),
            ready_files: latestValue(aggrSnapshot, 'archive_ready_files'),
            upload_failures: latestValue(aggrSnapshot, 'archive_upload_failures'),
            last_upload_age_seconds: latestValue(aggrSnapshot, 'archive_last_upload_age_seconds'),
            readthrough_fetches_per_minute: latestValue(aggrSnapshot, 'archive_readthrough_fetches_per_minute'),
            readthrough_failures: latestValue(aggrSnapshot, 'archive_readthrough_failures'),
            cache_bytes: latestValue(aggrSnapshot, 'archive_cache_bytes'),
            read_pool_active: latestValue(aggrSnapshot, 'archive_read_pool_active'),
            read_pool_queue_depth: latestValue(aggrSnapshot, 'archive_read_pool_queue_depth'),
            heavy_job_queue_depth: latestValue(aggrSnapshot, 'archive_heavy_job_queue_depth'),
          }} />
        </Panel>
        <Panel title="Backend archive" description="Worker heartbeat, upload state, cache activity, and bounded failures.">
          <KeyValueGrid data={archive} limit={30} exclude={['last_error']} />
        </Panel>
      </div>
    </>
  )
}

function HeatmapsView({ monitor }) {
  const { aggrSnapshot, aggrRange, backendSummary } = monitor
  const heatmaps = backendSummary?.operations?.heatmaps || {}
  const workers = backendSummary?.operations?.workers?.heatmap || []
  const symbols = safeEntries(heatmaps.symbols).map(([symbol, row]) => ({ symbol, ...row }))
  const stores = safeEntries(heatmaps.stores).map(([name, row]) => ({ name, ...row }))
  const vapHotTiles = latestRows(aggrSnapshot, 'vap_hot_tile_age_ms')

  return (
    <>
      <SectionHeading eyebrow="HEATMAPS" title="Materialization pipeline" description="Frame freshness, tile registry pressure, hot stores, VAP builds, and every backend heatmap worker." />
      <MetricGrid columns={6}>
        <Metric label="Cache hit rate" value={latestValue(aggrSnapshot, 'backend_heatmap_cache_hit_percent')} unit="percent" />
        <Metric label="Oldest queued tile" value={latestValue(aggrSnapshot, 'backend_heatmap_oldest_queued_ms')} unit="milliseconds" />
        <Metric label="Blocking builds" value={latestValue(aggrSnapshot, 'backend_heatmap_blocking_builds')} tone={(latestValue(aggrSnapshot, 'backend_heatmap_blocking_builds') || 0) > 0 ? 'critical' : 'ok'} />
        <Metric label="VAP worker age" value={latestValue(aggrSnapshot, 'vap_worker_age_seconds')} unit="seconds" />
        <Metric label="VAP pass duration" value={latestValue(aggrSnapshot, 'vap_worker_duration_seconds')} unit="seconds" />
        <Metric label="Healthy workers" value={`${workers.filter((worker) => worker.healthy).length}/${workers.length || 0}`} tone={workers.length && workers.every((worker) => worker.healthy) ? 'ok' : 'warning'} />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="Backend frame age" description="Liquidation and orderbook frame age exposed through the aggr Prometheus gateway." series={aggrChartSeries(aggrRange, 'backend_heatmap_frame_age_seconds', { limit: 8 })} unit="seconds" />
        <TelemetryChart title="Heatmap cache hit rate" description="Backend product cache hits across the selected range." series={aggrChartSeries(aggrRange, 'backend_heatmap_cache_hit_percent')} unit="percent" minValue={0} maxValue={100} />
        <TelemetryChart title="VAP worker heartbeat" description="Age of the separate VAP and footprint prebuilder heartbeat." series={aggrChartSeries(aggrRange, 'vap_worker_age_seconds')} unit="seconds" />
        <TelemetryChart title="VAP worker resources" description="Per-process CPU for the separate prebuilder." series={aggrChartSeries(aggrRange, 'vap_worker_cpu_percent')} unit="percent_of_one_core" />
      </div>

      <div className="monitor-split-grid">
        <Panel title="VAP build state" description="Current prebuilder queue, failures, and serving rejections.">
          <KeyValueGrid data={{
            worker_heartbeat_age_seconds: latestValue(aggrSnapshot, 'vap_worker_age_seconds'),
            worker_pass_duration_seconds: latestValue(aggrSnapshot, 'vap_worker_duration_seconds'),
            worker_cpu_percent: latestValue(aggrSnapshot, 'vap_worker_cpu_percent'),
            worker_rss_bytes: latestValue(aggrSnapshot, 'vap_worker_rss_bytes'),
            worker_failures: latestValue(aggrSnapshot, 'vap_worker_failures'),
            queued_chunks: latestValue(aggrSnapshot, 'vap_worker_queue_depth'),
            manifest_rejections: latestValue(aggrSnapshot, 'vap_manifest_rejections'),
            tile_failures: latestValue(aggrSnapshot, 'vap_tile_failures'),
          }} />
        </Panel>
        <Panel title="VAP hot tiles" description="Current source age by symbol, venue, and timeframe.">
          <DataTable
            rows={vapHotTiles}
            rowKey={(row) => row.label}
            columns={[
              { key: 'label', label: 'Source', render: (row) => <code>{row.label}</code> },
              { key: 'value', label: 'Age', render: (row) => formatMonitoringValue(row.value, 'milliseconds') },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Backend heatmap symbols" description="Current liquidations and orderbook buffers by symbol.">
        <DataTable
          rows={symbols}
          rowKey={(row) => row.symbol}
          columns={[
            { key: 'symbol', label: 'Symbol', render: (row) => <strong>{row.symbol}</strong> },
            { key: 'liq_frames', label: 'Liq frames', render: (row) => displayScalar(row.liq?.frames ?? row.liq_frame_count) },
            { key: 'liq_age', label: 'Liq age', render: (row) => displayScalar(row.liq?.last_frame_age_ms ?? ((row.liq_frame_age_seconds ?? 0) * 1000), 'age_ms') },
            { key: 'ob_frames', label: 'OB frames', render: (row) => displayScalar(row.orderbook?.frames ?? row.ob_frame_count) },
            { key: 'ob_age', label: 'OB age', render: (row) => displayScalar(row.orderbook?.last_frame_age_ms ?? ((row.ob_frame_age_seconds ?? 0) * 1000), 'age_ms') },
            { key: 'synced', label: 'Orderbook', render: (row) => <StatusPill status={(row.orderbook?.synced ?? row.ob_synced) ? 'online' : 'offline'}>{(row.orderbook?.synced ?? row.ob_synced) ? 'Synced' : 'Unsynced'}</StatusPill> },
            { key: 'depth', label: 'Depth', render: (row) => {
              const bid = row.orderbook?.bid_levels
              const ask = row.orderbook?.ask_levels
              return bid !== undefined ? `${bid} / ${ask}` : displayScalar(row.ob_depth)
            } },
          ]}
        />
      </Panel>

      <Panel title="Heatmap workers" description="One heartbeat per materializer child with owned roles and most recent lane activity.">
        <DataTable
          rows={workers}
          rowKey={(row) => row.worker_id}
          columns={[
            { key: 'worker_id', label: 'Worker', render: (row) => <strong>Worker {row.worker_id}</strong> },
            { key: 'healthy', label: 'State', render: (row) => <StatusPill status={row.healthy ? 'online' : 'critical'}>{row.healthy ? 'Healthy' : 'Unhealthy'}</StatusPill> },
            { key: 'heartbeat_age_ms', label: 'Heartbeat', render: (row) => displayScalar(row.heartbeat_age_ms, 'heartbeat_age_ms') },
            { key: 'roles', label: 'Roles', render: (row) => <div className="monitor-tag-list">{safeEntries(row.roles).filter(([, active]) => active).map(([role]) => <span key={role}>{titleFromKey(role)}</span>)}</div> },
            { key: 'last_ticks', label: 'Last ticks', render: (row) => {
              const ticks = safeEntries(row.last_ticks)
              return ticks.length ? <span>{ticks.slice(0, 2).map(([name, tick]) => `${titleFromKey(name)} ${displayScalar(tick?.duration_ms, 'duration_ms')} ${tick?.result || ''}`.trim()).join(' / ')}</span> : 'Unavailable'
            } },
            { key: 'last_error', label: 'Last error', render: (row) => row.last_error || 'None' },
          ]}
        />
      </Panel>

      <div className="monitor-split-grid">
        <Panel title="Tile registry" description="Canonical backend tile states and queue age.">
          <KeyValueGrid data={heatmaps.registry} limit={24} />
        </Panel>
        <Panel title="Product stores" description="Local, hot, and S3-backed store counters.">
          {stores.length ? <div className="monitor-store-list">{stores.map((store) => (
            <div key={store.name}>
              <strong>{titleFromKey(store.name)}</strong>
              <KeyValueGrid data={store} limit={8} />
            </div>
          ))}</div> : <EmptyState message="Store metrics unavailable" />}
        </Panel>
      </div>
    </>
  )
}

function SecurityView({ monitor }) {
  const { aggrSnapshot, aggrRange, aggrSecurity, backendSummary } = monitor
  const traffic = backendSummary?.traffic?.last_60m || {}
  const auth = traffic.auth || {}
  const deniedReasons = traffic.top_denied_reasons || []
  const deniedIps = traffic.top_denied_ips || []
  const authOps = backendSummary?.operations?.auth || {}

  return (
    <>
      <SectionHeading eyebrow="SECURITY" title="Authentication and denied sources" description="Bounded auth outcomes from both services. Source addresses remain inside this admin-only view." />
      <MetricGrid columns={6}>
        <Metric label="Tracked aggr sources" value={aggrSecurity?.tracked_sources} />
        <Metric label="Aggr denied" value={aggrSecurity?.total_denied} />
        <Metric label="Backend authenticated" value={auth.authenticated} />
        <Metric label="Backend missing bearer" value={auth.denied_missing} />
        <Metric label="Backend invalid" value={auth.denied_invalid} />
        <Metric label="Backend forbidden" value={auth.denied_forbidden} />
      </MetricGrid>

      <div className="monitor-chart-grid">
        <TelemetryChart title="Authenticated vs unauthenticated" description="Aggr request classification over the selected range." series={combineAggrChartSeries(aggrRange, [
          { id: 'authenticated_requests_per_minute', label: 'Authenticated', color: MONITORING_COLORS.green },
          { id: 'unauthenticated_requests_per_minute', label: 'Unauthenticated', color: MONITORING_COLORS.orange },
        ])} unit="requests_per_minute" />
        <TelemetryChart title="Auth enforcement" description="Denied requests and JWT verification failures." series={combineAggrChartSeries(aggrRange, [
          { id: 'auth_denied_per_minute', label: 'Denied', color: MONITORING_COLORS.orange },
          { id: 'jwt_rejected_per_minute', label: 'JWT rejected', color: MONITORING_COLORS.red },
        ])} unit="requests_per_minute" />
      </div>

      <Panel title="Aggr denied sources" description={`Process-local source detail for the last ${formatDurationSeconds((aggrSecurity?.window_ms || 0) / 1000)}.`}>
        <DataTable
          rows={aggrSecurity?.sources || []}
          rowKey={(row) => row.source}
          columns={[
            { key: 'source', label: 'Source', render: (row) => <code>{row.source}</code> },
            { key: 'count', label: 'Window denied' },
            { key: 'total_since_process_start', label: 'Process total' },
            { key: 'reasons', label: 'Reasons', render: (row) => <div className="monitor-tag-list">{safeEntries(row.reasons).map(([reason, count]) => <span key={reason}>{reason}: {count}</span>)}</div> },
            { key: 'routes', label: 'Routes', render: (row) => <div className="monitor-tag-list">{safeEntries(row.routes).slice(0, 4).map(([route, count]) => <span key={route}>{route}: {count}</span>)}</div> },
            { key: 'last_seen_ms', label: 'Last seen', render: (row) => formatRelativeTime(row.last_seen_ms) },
          ]}
        />
      </Panel>

      <div className="monitor-split-grid">
        <Panel title="Backend denied sources" description="Top source addresses over the last 60 minutes.">
          <DataTable
            rows={deniedIps}
            rowKey={(row) => row.ip || row.source}
            columns={[
              { key: 'ip', label: 'Source', render: (row) => <code>{row.ip || row.source}</code> },
              { key: 'count', label: 'Denied' },
            ]}
          />
        </Panel>
        <Panel title="Backend denial reasons" description="Controlled reason labels over the last 60 minutes.">
          <DataTable
            rows={deniedReasons}
            rowKey={(row) => row.reason}
            columns={[
              { key: 'reason', label: 'Reason', render: (row) => <code>{row.reason}</code> },
              { key: 'count', label: 'Count' },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Backend auth manager" description="Safe counters and gauges only. Tokens and user identifiers are never returned.">
        <KeyValueGrid data={authOps} limit={36} exclude={['token', 'subject', 'user', 'email']} />
      </Panel>
    </>
  )
}

function sectionContent(section, monitor) {
  switch (section) {
    case 'compute': return <ComputeView monitor={monitor} />
    case 'traffic': return <TrafficView monitor={monitor} />
    case 'streams': return <StreamsView monitor={monitor} />
    case 'storage': return <StorageView monitor={monitor} />
    case 'heatmaps': return <HeatmapsView monitor={monitor} />
    case 'security': return <SecurityView monitor={monitor} />
    default: return <OverviewView monitor={monitor} />
  }
}

function LoadingDashboard() {
  return (
    <div className="monitor-loading-grid" aria-label="Loading monitoring data">
      {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, profile, loading: authLoading, refreshAccess, signOut } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('overview')
  const [rangeKey, setRangeKey] = useState('6h')
  const isAdmin = profile?.access_tier === 'admin'
  const monitoring = useAdminMonitoring({
    enabled: Boolean(user && isAdmin),
    rangeKey,
    securityVisible: section === 'security',
  })

  const fleetStatus = useMemo(
    () => serviceStatus(monitoring.aggrSnapshot, monitoring.backendSummary),
    [monitoring.aggrSnapshot, monitoring.backendSummary],
  )

  async function refreshAccessAndData() {
    try {
      await refreshAccess()
      monitoring.resetAuthorization()
    } catch {
      await signOut()
      navigate('/login?return=%2Fadmin%2Fdashboard')
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  if (!LOCAL_DEMO && (authLoading || (user && !profile))) return <AccessScreen kind="loading" />
  if (!LOCAL_DEMO && !user) return <AccessScreen kind="signin" />
  if (!LOCAL_DEMO && !isAdmin) return <AccessScreen kind="denied" onRefresh={refreshAccessAndData} />
  if (monitoring.authFailed) return <AccessScreen kind="signin" />
  if (monitoring.forbidden) return <AccessScreen kind="denied" onRefresh={refreshAccessAndData} />

  return (
    <main className="admin-monitoring">
      <header className="monitor-topbar">
        <div className="monitor-brand">
          <Link to="/" title="TradeNet home"><img src="/assets/text-logo.png" alt="TradeNet" /></Link>
          <span>Operations</span>
        </div>

        <div className="monitor-topbar-status">
          {monitoring.isDemo && <span className="monitor-demo-badge">PREVIEW DATA</span>}
          <StatusPill status={fleetStatus}>{fleetStatus === 'ok' ? 'Systems operational' : titleFromKey(fleetStatus)}</StatusPill>
          <span className="monitor-last-updated">
            Updated {monitoring.lastUpdatedAt ? formatRelativeTime(monitoring.lastUpdatedAt) : 'waiting'}
          </span>
        </div>

        <div className="monitor-topbar-actions">
          <button type="button" onClick={monitoring.refreshAll} disabled={monitoring.refreshing} title="Refresh monitoring data" aria-label="Refresh monitoring data">
            <RefreshCw size={16} className={monitoring.refreshing ? 'spin' : ''} />
          </button>
          <Link to="/account" title="Account" aria-label="Account"><UserRound size={16} /></Link>
          <button type="button" onClick={handleSignOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="monitor-shell">
        <aside className="monitor-sidebar">
          <nav aria-label="Monitoring sections">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={section === item.id ? 'active' : ''}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {section === item.id && <ChevronRight size={14} />}
                </button>
              )
            })}
          </nav>
          <div className="monitor-sidebar-foot">
            <Link to="/account"><ArrowLeft size={14} /> Account</Link>
            <span>Schema v1</span>
          </div>
        </aside>

        <div className="monitor-mobile-nav" role="tablist" aria-label="Monitoring sections">
          {SECTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
                <Icon size={15} />{item.label}
              </button>
            )
          })}
        </div>

        <section className="monitor-content">
          <div className="monitor-content-toolbar">
            <div className="monitor-range-control" aria-label="Monitoring range">
              {Object.entries(MONITORING_RANGES).map(([key, range]) => (
                <button key={key} type="button" className={rangeKey === key ? 'active' : ''} onClick={() => setRangeKey(key)}>{range.label}</button>
              ))}
            </div>
            <div className="monitor-source-freshness">
              <span><i className={freshnessClass(monitoring.aggrSnapshot?.generated_at_ms, 45000)} />Aggr {monitoring.aggrSnapshot ? formatRelativeTime(monitoring.aggrSnapshot.generated_at_ms) : 'waiting'}</span>
              <span><i className={freshnessClass(monitoring.backendSummary?.generated_at_ms, 20000)} />Backend {monitoring.backendSummary ? formatRelativeTime(monitoring.backendSummary.generated_at_ms) : 'waiting'}</span>
            </div>
          </div>

          <SourceErrors errors={monitoring.errors} aggrSnapshot={monitoring.aggrSnapshot} aggrRange={monitoring.aggrRange} />
          {monitoring.loading ? <LoadingDashboard /> : sectionContent(section, monitoring)}
        </section>
      </div>
    </main>
  )
}
