import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MONITORING_RANGES,
  fetchAggrCatalog,
  fetchAggrRange,
  fetchAggrSecurity,
  fetchAggrSnapshot,
  fetchBackendRange,
  fetchBackendSummary,
  isRetryableMonitoringError,
} from '@/lib/adminMonitoring'
import { createMonitoringDemoData } from '@/lib/adminMonitoringDemo'

const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_ADMIN_MONITORING_DEMO === '1'

function initialState() {
  return {
    catalog: null,
    aggrSnapshot: null,
    aggrRange: null,
    aggrSecurity: null,
    backendSummary: null,
    backendRange: null,
  }
}

export function useAdminMonitoring({ enabled, rangeKey, securityVisible }) {
  const [data, setData] = useState(initialState)
  const [errors, setErrors] = useState({})
  const [forbidden, setForbidden] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const controllers = useRef(new Map())
  const nextAllowedAt = useRef(new Map())
  const generation = useRef(0)

  const commit = useCallback((key, value) => {
    setData((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const run = useCallback(async (key, task, options = {}) => {
    if ((!enabled && !DEMO_MODE) || forbidden || authFailed) return null
    const activeController = controllers.current.get(key)
    if (activeController && !options.force) return null
    if (activeController) {
      activeController.abort()
      controllers.current.delete(key)
    }
    if (!options.force && Date.now() < (nextAllowedAt.current.get(key) || 0)) return null

    const controller = new AbortController()
    controllers.current.set(key, controller)

    try {
      const result = await task(controller.signal)
      commit(key, result)
      nextAllowedAt.current.delete(key)
      return result
    } catch (error) {
      if (error?.name === 'AbortError') return null

      if (error?.status === 401) setAuthFailed(true)
      if (error?.status === 403) setForbidden(true)
      if (isRetryableMonitoringError(error)) {
        nextAllowedAt.current.set(key, Date.now() + Math.max(error.retryAfterMs || 0, 15000))
      }
      setErrors((current) => ({ ...current, [key]: error }))
      return null
    } finally {
      if (controllers.current.get(key) === controller) controllers.current.delete(key)
    }
  }, [authFailed, commit, enabled, forbidden])

  const resetAuthorization = useCallback(() => {
    setForbidden(false)
    setAuthFailed(false)
    nextAllowedAt.current.clear()
    setErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([, error]) => error?.status !== 401 && error?.status !== 403),
    ))
  }, [])

  const loadCatalog = useCallback((force = false) => run(
    'catalog',
    (signal) => fetchAggrCatalog(signal),
    { force },
  ), [run])

  const loadAggrSnapshot = useCallback((force = false) => run(
    'aggrSnapshot',
    (signal) => fetchAggrSnapshot(signal),
    { force },
  ), [run])

  const loadBackendSummary = useCallback((force = false) => run(
    'backendSummary',
    (signal) => fetchBackendSummary(signal),
    { force },
  ), [run])

  const loadAggrRange = useCallback((force = false, catalogOverride = null) => {
    const catalog = catalogOverride || data.catalog
    if (!catalog) return Promise.resolve(null)
    const currentGeneration = generation.current
    return run('aggrRange', async (signal) => {
      const result = await fetchAggrRange({ rangeKey, catalog, signal })
      if (currentGeneration !== generation.current) throw new DOMException('Stale range', 'AbortError')
      return result
    }, { force })
  }, [data.catalog, rangeKey, run])

  const loadBackendRange = useCallback((force = false) => {
    const currentGeneration = generation.current
    return run('backendRange', async (signal) => {
      const result = await fetchBackendRange({ rangeKey, signal })
      if (currentGeneration !== generation.current) throw new DOMException('Stale range', 'AbortError')
      return result
    }, { force })
  }, [rangeKey, run])

  const loadSecurity = useCallback((force = false) => run(
    'aggrSecurity',
    (signal) => fetchAggrSecurity({
      windowMs: MONITORING_RANGES[rangeKey]?.durationMs || MONITORING_RANGES['6h'].durationMs,
      signal,
    }),
    { force },
  ), [rangeKey, run])

  const refreshAll = useCallback(async () => {
    if (DEMO_MODE) {
      setData(createMonitoringDemoData(rangeKey))
      return
    }

    setRefreshing(true)
    try {
      const catalog = data.catalog || await loadCatalog(true)
      await Promise.all([
        loadAggrSnapshot(true),
        loadBackendSummary(true),
        loadAggrRange(true, catalog),
        loadBackendRange(true),
        ...(securityVisible ? [loadSecurity(true)] : []),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [data.catalog, loadAggrRange, loadAggrSnapshot, loadBackendRange, loadBackendSummary, loadCatalog, loadSecurity, rangeKey, securityVisible])

  useEffect(() => {
    if (!DEMO_MODE) return undefined
    const update = () => setData(createMonitoringDemoData(rangeKey))
    update()
    const interval = window.setInterval(update, 5000)
    return () => window.clearInterval(interval)
  }, [rangeKey])

  useEffect(() => {
    if (DEMO_MODE || !enabled || forbidden) return undefined
    loadCatalog()
    return undefined
  }, [enabled, forbidden, loadCatalog])

  useEffect(() => {
    if (DEMO_MODE || !enabled || forbidden) return undefined
    loadAggrSnapshot()
    loadBackendSummary()

    const aggrInterval = window.setInterval(() => {
      if (!document.hidden) loadAggrSnapshot()
    }, 15000)
    const backendInterval = window.setInterval(() => {
      if (!document.hidden) loadBackendSummary()
    }, 5000)

    return () => {
      window.clearInterval(aggrInterval)
      window.clearInterval(backendInterval)
    }
  }, [enabled, forbidden, loadAggrSnapshot, loadBackendSummary])

  useEffect(() => {
    if (DEMO_MODE || !enabled || forbidden || !data.catalog) return undefined
    generation.current += 1
    controllers.current.get('aggrRange')?.abort()
    controllers.current.get('backendRange')?.abort()
    controllers.current.delete('aggrRange')
    controllers.current.delete('backendRange')
    loadAggrRange()
    loadBackendRange()

    const interval = window.setInterval(() => {
      if (document.hidden) return
      loadAggrRange()
      loadBackendRange()
    }, 45000)

    return () => window.clearInterval(interval)
  }, [data.catalog, enabled, forbidden, loadAggrRange, loadBackendRange, rangeKey])

  useEffect(() => {
    if (DEMO_MODE || !enabled || forbidden || !securityVisible) return undefined
    loadSecurity()
    const interval = window.setInterval(() => {
      if (!document.hidden) loadSecurity()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [enabled, forbidden, loadSecurity, securityVisible])

  useEffect(() => {
    if (DEMO_MODE || !enabled || forbidden) return undefined
    const onVisibility = () => {
      if (document.hidden) return
      loadAggrSnapshot()
      loadBackendSummary()
      loadAggrRange()
      loadBackendRange()
      if (securityVisible) loadSecurity()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled, forbidden, loadAggrRange, loadAggrSnapshot, loadBackendRange, loadBackendSummary, loadSecurity, securityVisible])

  useEffect(() => () => {
    controllers.current.forEach((controller) => controller.abort())
    controllers.current.clear()
  }, [])

  const lastUpdatedAt = useMemo(() => Math.max(
    data.aggrSnapshot?.generated_at_ms || 0,
    data.aggrRange?.generated_at_ms || 0,
    data.backendSummary?.generated_at_ms || 0,
    data.backendRange?.generated_at_ms || 0,
  ), [data])

  const loading = !data.aggrSnapshot && !data.backendSummary

  return {
    ...data,
    errors,
    forbidden,
    authFailed,
    loading,
    refreshing,
    lastUpdatedAt,
    isDemo: DEMO_MODE,
    refreshAll,
    resetAuthorization,
  }
}
