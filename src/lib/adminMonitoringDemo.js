import { AGGR_RANGE_QUERY_IDS, MONITORING_RANGES } from '@/lib/adminMonitoring'

const TITLES = {
  host_cpu_percent: ['host', 'Host CPU', 'percent'],
  host_memory_percent: ['host', 'Host memory', 'percent'],
  host_disk_percent: ['host', 'Root disk', 'percent'],
  host_network_receive_bps: ['host', 'Network receive', 'bytes_per_second'],
  host_network_transmit_bps: ['host', 'Network transmit', 'bytes_per_second'],
  host_disk_read_bps: ['host', 'Disk read', 'bytes_per_second'],
  host_disk_write_bps: ['host', 'Disk write', 'bytes_per_second'],
  aggr_process_cpu_percent: ['aggr', 'Aggr process CPU', 'percent_of_one_core'],
  aggr_process_rss_bytes: ['aggr', 'Aggr process RSS', 'bytes'],
  event_loop_p99_ms: ['aggr', 'Event-loop delay p99', 'milliseconds'],
  vap_worker_cpu_percent: ['vap_footprint', 'VAP worker CPU', 'percent_of_one_core'],
  vap_worker_rss_bytes: ['vap_footprint', 'VAP worker RSS', 'bytes'],
  requests_per_minute: ['requests', 'Requests per minute', 'requests_per_minute'],
  nginx_requests_per_minute: ['requests', 'Nginx requests per minute', 'requests_per_minute'],
  responses_5xx_per_minute: ['requests', '5xx responses', 'requests_per_minute'],
  request_latency_p95_ms: ['requests', 'Request latency p95', 'milliseconds'],
  authenticated_requests_per_minute: ['security', 'Authenticated requests', 'requests_per_minute'],
  unauthenticated_requests_per_minute: ['security', 'Unauthenticated requests', 'requests_per_minute'],
  auth_denied_per_minute: ['security', 'Auth denials', 'requests_per_minute'],
  jwt_rejected_per_minute: ['security', 'JWT rejects', 'requests_per_minute'],
  ws_clients: ['streams', 'WebSocket clients', 'connections'],
  ws_egress_bps: ['streams', 'WebSocket egress', 'bytes_per_second'],
  ws_backpressure_per_minute: ['streams', 'WebSocket backpressure', 'events_per_minute'],
  exchange_message_age_seconds: ['streams', 'Exchange message age', 'seconds'],
  archive_lag_seconds: ['storage', 'Archive lag', 'seconds'],
  archive_ready_files: ['storage', 'Archive ready files', 'files'],
  archive_upload_failures: ['storage', 'Archive upload failures', 'failures'],
  vap_worker_age_seconds: ['vap_footprint', 'VAP worker heartbeat age', 'seconds'],
  vap_worker_failures: ['vap_footprint', 'VAP worker failures', 'failures'],
  backend_heatmap_frame_age_seconds: ['backend_heatmaps', 'Backend frame age', 'seconds'],
  backend_heatmap_cache_hit_percent: ['backend_heatmaps', 'Heatmap cache hit rate', 'percent'],
  backend_archive_lag_seconds: ['backend_storage', 'Backend archive lag', 'seconds'],
}

const BASES = {
  host_cpu_percent: [21, 8],
  host_memory_percent: [34, 2],
  host_disk_percent: [24, 0.2],
  host_network_receive_bps: [320000, 130000],
  host_network_transmit_bps: [940000, 280000],
  host_disk_read_bps: [2100000, 820000],
  host_disk_write_bps: [4800000, 1600000],
  aggr_process_cpu_percent: [17, 6],
  aggr_process_rss_bytes: [812000000, 22000000],
  event_loop_p99_ms: [26, 8],
  vap_worker_cpu_percent: [7, 4],
  vap_worker_rss_bytes: [286000000, 9000000],
  requests_per_minute: [42, 13],
  nginx_requests_per_minute: [58, 17],
  responses_5xx_per_minute: [0.05, 0.08],
  request_latency_p95_ms: [74, 24],
  authenticated_requests_per_minute: [31, 9],
  unauthenticated_requests_per_minute: [11, 5],
  auth_denied_per_minute: [0.8, 0.7],
  jwt_rejected_per_minute: [0.15, 0.2],
  ws_clients: [18, 3],
  ws_egress_bps: [740000, 240000],
  ws_backpressure_per_minute: [0.02, 0.04],
  exchange_message_age_seconds: [2.4, 1.8],
  archive_lag_seconds: [0, 0],
  archive_ready_files: [0, 0],
  archive_upload_failures: [0, 0],
  vap_worker_age_seconds: [11, 5],
  vap_worker_failures: [0, 0],
  backend_heatmap_frame_age_seconds: [24, 10],
  backend_heatmap_cache_hit_percent: [93, 2],
  backend_archive_lag_seconds: [0, 0],
}

function wavePoints(now, durationMs, count, base, amplitude, phase = 0) {
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(1, count - 1)
    const wave = Math.sin((progress * Math.PI * 5) + phase)
    const detail = Math.sin((progress * Math.PI * 17) + phase) * 0.2
    return [
      Math.round(now - durationMs + (durationMs * progress)),
      Math.max(0, base + (amplitude * (wave + detail))),
    ]
  })
}

function result(id, mode, series, now, range) {
  const [section, title, unit] = TITLES[id] || ['overview', id, 'count']
  return {
    ok: true,
    id,
    section,
    title,
    unit,
    mode,
    from_ms: mode === 'range' ? now - range.durationMs : null,
    to_ms: now,
    step_ms: mode === 'range' ? range.aggrStepMs : null,
    result_type: mode === 'range' ? 'matrix' : 'vector',
    series,
  }
}

function rangeResult(id, now, range, index) {
  const [base, amplitude] = BASES[id] || [1, 0.2]
  const dimensions = id === 'exchange_message_age_seconds'
    ? [{ exchange: 'binance', symbol: 'BTC' }, { exchange: 'bybit', symbol: 'BTC' }, { exchange: 'okx', symbol: 'BTC' }]
    : id === 'ws_clients'
      ? [{ stream: 'tape' }, { stream: 'dom' }]
      : [{}]

  return result(id, 'range', dimensions.map((metric, seriesIndex) => ({
    metric,
    points: wavePoints(
      now,
      range.durationMs,
      90,
      base * (1 + (seriesIndex * 0.18)),
      amplitude,
      index + seriesIndex,
    ),
  })), now, range)
}

function instant(id, value, now, metric = {}) {
  const range = MONITORING_RANGES['6h']
  return result(id, 'instant', [{ metric, points: [[now, value]] }], now, range)
}

function makeSnapshot(rangeResults, now) {
  const current = rangeResults.map((rangeResultEntry) => ({
    ...rangeResultEntry,
    mode: 'instant',
    from_ms: null,
    step_ms: null,
    result_type: 'vector',
    series: rangeResultEntry.series.map((series) => ({
      metric: series.metric,
      points: [series.points[series.points.length - 1]],
    })),
  }))

  return {
    schema_version: 1,
    generated_at_ms: now,
    results: [
      ...current,
      result('services_up', 'instant', ['aggr', 'backend', 'nginx', 'node', 'prometheus'].map((job) => ({ metric: { job }, points: [[now, 1]] })), now, MONITORING_RANGES['6h']),
      result('alerts_firing', 'instant', [], now, MONITORING_RANGES['6h']),
      result('systemd_services_active', 'instant', ['aggr-api', 'vap-worker'].map((service) => ({ metric: { service }, points: [[now, 1]] })), now, MONITORING_RANGES['6h']),
      instant('host_load_1m', 0.78, now),
      instant('aggr_process_rss_bytes', 812000000, now),
      instant('aggr_heap_used_bytes', 438000000, now),
      instant('aggr_open_fds', 128, now),
      instant('requests_last_hour', 2518, now),
      instant('archive_upload_enabled', 1, now),
      instant('archive_spool_bytes', 10700000000, now),
      instant('archive_readthrough_fetches_per_minute', 2.4, now),
      instant('archive_readthrough_failures', 0, now),
      instant('archive_cache_bytes', 1840000000, now),
      instant('archive_read_pool_active', 1, now),
      instant('archive_read_pool_queue_depth', 0, now),
      instant('archive_heavy_job_queue_depth', 0, now),
      instant('archive_last_upload_age_seconds', 18, now),
      instant('influx_write_failures', 0, now),
      instant('influx_last_write_age_seconds', 1.2, now),
      instant('vap_worker_duration_seconds', 4.8, now),
      instant('vap_worker_rss_bytes', 286000000, now),
      instant('vap_worker_queue_depth', 0, now),
      result('vap_hot_tile_age_ms', 'instant', ['BTC', 'ETH', 'SOL'].map((symbol, index) => ({ metric: { symbol, exchange: 'all', timeframe: '1m' }, points: [[now, 2200 + (index * 900)]] })), now, MONITORING_RANGES['6h']),
      instant('vap_manifest_rejections', 0, now),
      instant('vap_tile_failures', 0, now),
      result('backend_heatmap_frames_available', 'instant', ['BTC', 'ETH', 'SOL'].map((symbol) => ({ metric: { symbol }, points: [[now, 720]] })), now, MONITORING_RANGES['6h']),
      result('backend_heatmap_tiles_by_status', 'instant', [
        { metric: { status: 'ready' }, points: [[now, 53394]] },
        { metric: { status: 'stale' }, points: [[now, 1256]] },
        { metric: { status: 'queued' }, points: [[now, 0]] },
      ], now, MONITORING_RANGES['6h']),
      instant('backend_heatmap_oldest_queued_ms', 0, now),
      instant('backend_heatmap_blocking_builds', 0, now),
      instant('backend_oi_poll_age_seconds', 5.2, now),
      instant('backend_liq_event_age_seconds', 94, now),
      instant('backend_archive_worker_age_seconds', 28, now),
      instant('backend_archive_pending_partitions', 0, now),
    ],
  }
}

function makeBackendSummary(now) {
  const traffic = (minutes, multiplier) => ({
    window_minutes: minutes,
    requests: Math.round(31 * minutes * multiplier),
    requests_per_minute: 31 * multiplier,
    response_bytes: Math.round(2100000 * minutes * multiplier),
    inflight: 3,
    inflight_max_since_start: 19,
    status: { '2xx': Math.round(29.8 * minutes), '3xx': 0, '4xx': Math.round(1.1 * minutes), '5xx': 1 },
    auth: { authenticated: Math.round(24 * minutes), admin: 2, public: Math.round(6 * minutes), shadow: 0, denied_missing: 12, denied_invalid: 3, denied_forbidden: 1, rate_limited: 0, unknown: 0 },
    unique_authenticated_users: minutes <= 5 ? 8 : 23,
    latency_ms: { avg: 38, p50: 25, p95: 120, p99: 310, max: 870 },
    top_routes: [
      { route: 'heatmap_tiles', requests: 824, errors: 1, response_bytes: 91200000, latency_ms_p95: 180, latency_ms_max: 620 },
      { route: 'oi_history', requests: 511, errors: 0, response_bytes: 28400000, latency_ms_p95: 95, latency_ms_max: 240 },
      { route: 'liq_events', requests: 284, errors: 0, response_bytes: 11800000, latency_ms_p95: 62, latency_ms_max: 180 },
      { route: 'health', requests: 191, errors: 0, response_bytes: 84000, latency_ms_p95: 12, latency_ms_max: 32 },
    ],
    top_denied_reasons: [
      { reason: 'missing_bearer', count: 12 },
      { reason: 'invalid_token', count: 3 },
      { reason: 'admin_required', count: 1 },
    ],
    top_denied_ips: [
      { source: '203.0.113.20', count: 9, reason: 'missing_bearer' },
      { source: '198.51.100.42', count: 4, reason: 'invalid_token' },
    ],
  })

  return {
    schema_version: 1,
    service: 'backend-python',
    generated_at_ms: now,
    monitor_started_at_ms: now - 7 * 60 * 60 * 1000,
    process_started_at_ms: now - 7 * 60 * 60 * 1000,
    monitoring_enabled: true,
    history_persistent: true,
    retention_minutes: 4320,
    sample_interval_seconds: 5,
    resources: {
      available: true,
      sampled_at_ms: now,
      cpu_count: 4,
      host_cpu_percent: 27.4,
      load_1m: 0.94,
      load_5m: 0.82,
      load_15m: 0.78,
      memory_total_bytes: 16750372454,
      memory_available_bytes: 10500000000,
      memory_used_percent: 37.3,
      disk_total_bytes: 161000000000,
      disk_free_bytes: 120000000000,
      disk_used_percent: 25.5,
      net_rx_bytes_per_second: 145000,
      net_tx_bytes_per_second: 910000,
      service_cpu_percent: 112,
      service_rss_bytes: 7210000000,
      api_cpu_percent: 13,
      api_rss_bytes: 2210000000,
      archive_worker_cpu_percent: 3.8,
      archive_worker_rss_bytes: 480000000,
      heatmap_worker_cpu_percent: 95,
      heatmap_worker_rss_bytes: 4520000000,
      process_groups: {
        api: { count: 1, cpu_percent: 13, rss_bytes: 2210000000 },
        archive_worker: { count: 1, cpu_percent: 3.8, rss_bytes: 480000000 },
        heatmap_worker: { count: 5, cpu_percent: 95, rss_bytes: 4520000000 },
      },
    },
    traffic: {
      last_1m: traffic(1, 1.1),
      last_5m: traffic(5, 1.03),
      last_60m: traffic(60, 1),
      last_24h: traffic(1440, 0.88),
    },
    operations: {
      auth: {
        required: true,
        entitlement_fetch_attempts_total: 4822,
        entitlement_fetch_failures_total: 2,
        verified_token_cache_size: 31,
        revocation_entries: 0,
        websocket_connections: 14,
        websocket_subjects: 11,
      },
      archive: {
        enabled: true,
        upload_enabled: true,
        upload_configured: true,
        records_written_total: 12499238,
        records_failed_total: 0,
        pending_partitions: 0,
        uploadable_pending_partitions: 0,
        partitions_uploaded_total: 8421,
        upload_failures_total: 0,
        spool_bytes: 1820000000,
        lag_seconds: 1.8,
        worker_heartbeat_age_ms: 28000,
      },
      pipelines: {
        exchanges: {
          binance: { last_message_ts_ms: now - 1200, age_ms: 1200, connected: true },
          bybit: { last_message_ts_ms: now - 2100, age_ms: 2100, connected: true },
          okx: { last_message_ts_ms: now - 1800, age_ms: 1800, connected: true },
        },
        oi: {
          BTC: { history_samples: 7200, last_poll_age_ms: 5200, aggregated_oi: 18400000000 },
          ETH: { history_samples: 7200, last_poll_age_ms: 4800, aggregated_oi: 9200000000 },
          SOL: { history_samples: 7200, last_poll_age_ms: 5700, aggregated_oi: 2100000000 },
        },
        liquidations: {
          BTC: { buffer_events: 1224, last_event_age_ms: 94000 },
          ETH: { buffer_events: 1081, last_event_age_ms: 131000 },
          SOL: { buffer_events: 902, last_event_age_ms: 74000 },
        },
      },
      heatmaps: {
        symbols: {
          BTC: { liq: { frames: 720, last_frame_age_ms: 18000 }, orderbook: { frames: 720, last_frame_age_ms: 11000, synced: true, bid_levels: 1000, ask_levels: 1000 } },
          ETH: { liq: { frames: 720, last_frame_age_ms: 23000 }, orderbook: { frames: 720, last_frame_age_ms: 16000, synced: true, bid_levels: 1000, ask_levels: 1000 } },
          SOL: { liq: { frames: 720, last_frame_age_ms: 31000 }, orderbook: { frames: 720, last_frame_age_ms: 21000, synced: true, bid_levels: 1000, ask_levels: 1000 } },
        },
        registry: { jobs_by_status: { ready: 53394, stale: 1256, queued: 0, building: 0 }, oldest_queued_age_ms: 0, oldest_building_age_ms: 0 },
        stores: {
          generic_tile_cache: { available: true, hits: 88214, misses: 1402, entries: 7200, bytes: 1840000000 },
          v3_products: { available: true, local_hits: 42108, s3_hits: 608, writes: 39211, upload_failures: 0, read_failures: 0 },
          ob_v4_products: { available: true, local_hits: 46106, s3_hits: 794, writes: 52380, upload_failures: 0, read_failures: 0 },
        },
      },
      workers: {
        heatmap: Array.from({ length: 4 }, (_, index) => ({
          worker_id: String(index + 1),
          pid: 12740 + index,
          heartbeat_age_ms: 1800 + (index * 420),
          healthy: true,
          last_error: '',
          roles: {
            queue: index === 0,
            liq_hot: index === 1,
            ob_v4_hot: index === 2,
            ob_v4_primitive: index === 3,
          },
          registry: { jobs_by_status: { ready: 53394, stale: 1256 }, oldest_queued_age_ms: 0, oldest_building_age_ms: 0 },
          last_ticks: { hot_publish: { duration_ms: 41 + index, result: 'ok' } },
        })),
      },
    },
    health: {
      status: 'ok',
      checks: [
        { name: 'disk', status: 'ok', detail: '25.5% used' },
        { name: 'memory', status: 'ok', detail: '37.3% used' },
        { name: 'auth', status: 'ok', detail: 'enforced' },
        { name: 'archive', status: 'ok', detail: 'pending=0 heartbeat_age_ms=28000' },
        { name: 'exchanges', status: 'ok', detail: 'disconnected=none' },
        { name: 'heatmap_materializer', status: 'ok', detail: 'queued=0 oldest_building_age_ms=0' },
      ],
    },
  }
}

function makeBackendRange(now, range) {
  const count = Math.min(180, Math.max(60, Math.floor(range.backendWindowMinutes / range.backendStepMinutes)))
  return {
    schema_version: 1,
    service: 'backend-python',
    generated_at_ms: now,
    window_minutes: range.backendWindowMinutes,
    step_minutes: range.backendStepMinutes,
    history_from_ms: now - Math.min(range.durationMs, 3 * 24 * 60 * 60 * 1000),
    retention_minutes: 4320,
    points: Array.from({ length: count }, (_, index) => {
      const progress = index / Math.max(1, count - 1)
      const wave = Math.sin(progress * Math.PI * 7)
      const requests = Math.max(0, 31 + (wave * 10)) * range.backendStepMinutes
      return {
        t: Math.round(now - range.durationMs + (range.durationMs * progress)),
        step_minutes: range.backendStepMinutes,
        requests,
        response_bytes: requests * 72000,
        status: { '2xx': requests * 0.965, '3xx': 0, '4xx': requests * 0.034, '5xx': requests * 0.001 },
        auth: { authenticated: requests * 0.78, admin: 0, public: requests * 0.18, shadow: 0, denied_missing: requests * 0.025, denied_invalid: requests * 0.004, denied_forbidden: requests * 0.001, rate_limited: 0, unknown: 0 },
        unique_authenticated_users: 18 + Math.max(0, wave * 6),
        latency_ms: { avg: 36 + (wave * 6), p50: 25, p95: 105 + (wave * 24), p99: 290 + (wave * 45), max: 720 },
        resources: {
          host_cpu_percent_avg: 28 + (wave * 11),
          host_cpu_percent_max: 48 + (wave * 14),
          service_cpu_percent_avg: 110 + (wave * 32),
          service_cpu_percent_max: 180 + (wave * 44),
          api_cpu_percent_avg: 13 + (wave * 4),
          heatmap_worker_cpu_percent_avg: 92 + (wave * 28),
          memory_used_percent_avg: 37 + (wave * 1.2),
          disk_used_percent_max: 25.5,
        },
      }
    }),
  }
}

export function createMonitoringDemoData(rangeKey = '6h') {
  const now = Date.now()
  const range = MONITORING_RANGES[rangeKey] || MONITORING_RANGES['6h']
  const rangeResults = AGGR_RANGE_QUERY_IDS.map((id, index) => rangeResult(id, now, range, index))

  return {
    catalog: {
      schema_version: 1,
      max_range_ms: 2592000000,
      max_points: 1500,
      max_queries: 32,
      queries: AGGR_RANGE_QUERY_IDS.map((id) => {
        const [section, title, unit] = TITLES[id]
        return { id, section, title, unit, modes: ['instant', 'range'] }
      }),
    },
    aggrSnapshot: makeSnapshot(rangeResults, now),
    aggrRange: { schema_version: 1, generated_at_ms: now, results: rangeResults },
    aggrSecurity: {
      generated_at_ms: now,
      window_ms: Math.min(range.durationMs, 24 * 60 * 60 * 1000),
      tracked_sources: 3,
      total_denied: 27,
      sources: [
        { source: '203.0.113.20', count: 14, total_since_process_start: 82, first_seen_ms: now - 3300000, last_seen_ms: now - 18000, reasons: { invalid_token: 13, origin_mismatch: 1 }, routes: { klines: 5, vap_footprint_manifest: 9 }, statuses: { 401: 13, 403: 1 } },
        { source: '198.51.100.42', count: 8, total_since_process_start: 31, first_seen_ms: now - 2800000, last_seen_ms: now - 148000, reasons: { missing_token: 8 }, routes: { other: 8 }, statuses: { 401: 8 } },
        { source: '192.0.2.18', count: 5, total_since_process_start: 7, first_seen_ms: now - 1900000, last_seen_ms: now - 420000, reasons: { invalid_token: 5 }, routes: { oi_history: 5 }, statuses: { 401: 5 } },
      ],
    },
    backendSummary: makeBackendSummary(now),
    backendRange: makeBackendRange(now, range),
  }
}
