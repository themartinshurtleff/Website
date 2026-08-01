import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  createAffiliate,
  getAffiliateDetail,
  listAffiliates,
  recordAffiliatePayout,
  updateAffiliate,
} from '@/lib/adminAffiliates'
import '@/styles/admin-affiliates.css'

function integer(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
    maximumFractionDigits: 2,
  }).format(integer(cents) / 100)
}

function count(value) {
  return new Intl.NumberFormat('en-US').format(integer(value))
}

function dateTime(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function conversionRate(affiliate) {
  const clicks = integer(affiliate.unique_clicks)
  return clicks ? `${((integer(affiliate.paid_customers) / clicks) * 100).toFixed(1)}%` : '0.0%'
}

function totals(affiliates) {
  return affiliates.reduce((result, affiliate) => {
    result.clicks += integer(affiliate.total_clicks)
    result.accounts += integer(affiliate.attributed_accounts)
    result.customers += integer(affiliate.paid_customers)
    result.revenue += integer(affiliate.net_collected_cents)
    result.pending += integer(affiliate.pending_commission_cents)
    result.available += integer(affiliate.available_commission_cents)
    result.paid += integer(affiliate.paid_commission_cents)
    return result
  }, { clicks: 0, accounts: 0, customers: 0, revenue: 0, pending: 0, available: 0, paid: 0 })
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="affiliate-metric">
      <div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
      {Icon && <Icon size={18} />}
    </div>
  )
}

function Empty({ children }) {
  return <div className="affiliate-empty">{children}</div>
}

const DEMO_AFFILIATE = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'jay',
  display_name: 'Jay Prints',
  status: 'active',
  commission_bps: 3000,
  attribution_window_days: 30,
  commission_months: 12,
  hold_days: 30,
  minimum_payout_cents: 5000,
  currency: 'usd',
  total_clicks: 284,
  unique_clicks: 231,
  attributed_accounts: 47,
  paid_customers: 18,
  net_collected_cents: 432500,
  gross_collected_cents: 451900,
  refunded_cents: 19400,
  gross_commission_cents: 135570,
  reversed_commission_cents: 5820,
  pending_commission_cents: 49650,
  available_commission_cents: 30200,
  paid_commission_cents: 49900,
}

const DEMO_DETAIL = {
  attributions: [
    { id: 'demo-a1', user_id: 'demo-u1', email: 'alex@example.com', attributed_at: '2026-07-18T18:20:00Z', commission_started_at: '2026-07-18T18:34:00Z' },
    { id: 'demo-a2', user_id: 'demo-u2', email: 'trader@example.com', attributed_at: '2026-07-22T16:05:00Z', commission_started_at: '2026-07-24T15:40:00Z' },
    { id: 'demo-a3', user_id: 'demo-u3', email: 'market@example.com', attributed_at: '2026-07-29T20:14:00Z', commission_started_at: null },
  ],
  commissions: [
    { id: 'demo-c1', user_id: 'demo-u1', email: 'alex@example.com', currency: 'usd', collected_cents: 19900, refunded_cents: 0, commission_cents: 5970, reversed_commission_cents: 0, paid_at: '2026-07-18T18:34:00Z', available_at: '2026-08-17T18:34:00Z' },
    { id: 'demo-c2', user_id: 'demo-u2', email: 'trader@example.com', currency: 'usd', collected_cents: 3900, refunded_cents: 0, commission_cents: 1170, reversed_commission_cents: 0, paid_at: '2026-07-24T15:40:00Z', available_at: '2026-08-23T15:40:00Z' },
  ],
  payouts: [
    { id: 'demo-p1', currency: 'usd', amount_cents: 49900, status: 'paid', reference: 'ACH 8174', paid_at: '2026-07-31T15:00:00Z' },
  ],
}

export default function AffiliatesPanel({ demo = false }) {
  const [affiliates, setAffiliates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [payoutReference, setPayoutReference] = useState('')
  const [payoutNotes, setPayoutNotes] = useState('')
  const [payoutConfirmation, setPayoutConfirmation] = useState('')

  const selected = affiliates.find((row) => row.id === selectedId) || null
  const summary = useMemo(() => totals(affiliates), [affiliates])

  const loadDetail = useCallback(async (affiliateId) => {
    if (!affiliateId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      if (demo) {
        setDetail(DEMO_DETAIL)
        return
      }
      setDetail(await getAffiliateDetail(affiliateId))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setDetailLoading(false)
    }
  }, [demo])

  const load = useCallback(async (preserveSelection = true) => {
    setError('')
    setLoading(true)
    try {
      if (demo) {
        setAffiliates([DEMO_AFFILIATE])
        setSelectedId(DEMO_AFFILIATE.id)
        await loadDetail(DEMO_AFFILIATE.id)
        return
      }
      const result = await listAffiliates()
      const rows = result?.affiliates || []
      setAffiliates(rows)
      const nextId = preserveSelection && rows.some((row) => row.id === selectedId)
        ? selectedId
        : rows[0]?.id || null
      setSelectedId(nextId)
      await loadDetail(nextId)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [demo, loadDetail, selectedId])

  useEffect(() => { load(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function selectAffiliate(affiliateId) {
    setSelectedId(affiliateId)
    setError('')
    await loadDetail(affiliateId)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setWorking(true)
    setError('')
    try {
      const result = await createAffiliate(createName, createSlug)
      setCreateName('')
      setCreateSlug('')
      setShowCreate(false)
      await load(false)
      if (result?.affiliate?.id) await selectAffiliate(result.affiliate.id)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setWorking(false)
    }
  }

  async function handleStatus(event, affiliate) {
    event.stopPropagation()
    setWorking(true)
    setError('')
    try {
      await updateAffiliate(affiliate.id, affiliate.display_name, event.target.value)
      await load(true)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setWorking(false)
    }
  }

  async function copyLink(event, affiliate) {
    event.stopPropagation()
    const link = `https://www.tradenet.org/r/${affiliate.slug}`
    await navigator.clipboard.writeText(link)
    setCopied(affiliate.id)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function handlePayout(event) {
    event.preventDefault()
    if (!selected) return
    setWorking(true)
    setError('')
    try {
      await recordAffiliatePayout(
        selected.id,
        selected.currency,
        payoutReference,
        payoutNotes,
        payoutConfirmation,
      )
      setPayoutReference('')
      setPayoutNotes('')
      setPayoutConfirmation('')
      await load(true)
    } catch (payoutError) {
      setError(payoutError.message)
    } finally {
      setWorking(false)
    }
  }

  const conversionRows = useMemo(() => {
    if (!detail) return []
    return (detail.attributions || []).map((attribution) => {
      const commissions = (detail.commissions || []).filter((row) => row.user_id === attribution.user_id)
      return {
        ...attribution,
        paid_invoices: commissions.length,
        revenue: commissions.reduce((sum, row) => sum + integer(row.collected_cents) - integer(row.refunded_cents), 0),
        commission: commissions.reduce((sum, row) => sum + integer(row.commission_cents) - integer(row.reversed_commission_cents), 0),
      }
    })
  }, [detail])

  return (
    <div className="affiliate-admin">
      <header className="affiliate-heading">
        <div>
          <span>AFFILIATE REVENUE</span>
          <h1>Partners and conversions</h1>
          <p>Stripe-collected revenue, commission liability, and recorded payouts.</p>
        </div>
        <div>
          <button type="button" className="affiliate-icon-button" onClick={() => load(true)} disabled={loading} title="Refresh affiliate data">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button type="button" className="affiliate-primary" onClick={() => setShowCreate((value) => !value)} disabled={demo}>
            <Plus size={15} /> New affiliate
          </button>
        </div>
      </header>

      {error && <div className="affiliate-error" role="alert">{error}</div>}

      {showCreate && (
        <form className="affiliate-create" onSubmit={handleCreate}>
          <label>Affiliate name<input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Jay Prints" maxLength={100} required /></label>
          <label>Link slug<div><span>tradenet.org/r/</span><input value={createSlug} onChange={(event) => setCreateSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="jay" minLength={3} maxLength={50} required /></div></label>
          <button className="affiliate-primary" type="submit" disabled={working}>{working ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} Create</button>
        </form>
      )}

      <div className="affiliate-metrics">
        <Metric label="Referral clicks" value={count(summary.clicks)} detail={`${count(summary.accounts)} attributed accounts`} icon={ExternalLink} />
        <Metric label="Paid customers" value={count(summary.customers)} detail="Unique converted accounts" icon={Users} />
        <Metric label="Net revenue" value={money(summary.revenue)} detail="Collected less refunds" icon={BadgeDollarSign} />
        <Metric label="Commission owed" value={money(summary.pending + summary.available)} detail={`${money(summary.available)} available`} />
        <Metric label="Commission paid" value={money(summary.paid)} detail="Recorded manual payouts" icon={Check} />
      </div>

      {loading && !affiliates.length ? (
        <div className="affiliate-loading"><Loader2 className="spin" size={20} /> Loading affiliate ledger</div>
      ) : !affiliates.length ? (
        <Empty>No affiliates have been created.</Empty>
      ) : (
        <div className="affiliate-layout">
          <section className="affiliate-list" aria-label="Affiliates">
            {affiliates.map((affiliate) => (
              <article key={affiliate.id} className={selectedId === affiliate.id ? 'active' : ''} onClick={() => selectAffiliate(affiliate.id)}>
                <div className="affiliate-list-title">
                  <span className={`affiliate-status is-${affiliate.status}`} />
                  <div><strong>{affiliate.display_name}</strong><small>/r/{affiliate.slug}</small></div>
                  <button type="button" onClick={(event) => copyLink(event, affiliate)} title="Copy referral link" aria-label="Copy referral link">
                    {copied === affiliate.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="affiliate-list-stats">
                  <span><small>Customers</small><strong>{count(affiliate.paid_customers)}</strong></span>
                  <span><small>Net revenue</small><strong>{money(affiliate.net_collected_cents, affiliate.currency)}</strong></span>
                  <span><small>Conversion</small><strong>{conversionRate(affiliate)}</strong></span>
                </div>
                <select value={affiliate.status} onClick={(event) => event.stopPropagation()} onChange={(event) => handleStatus(event, affiliate)} disabled={working} aria-label={`${affiliate.display_name} status`}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </article>
            ))}
          </section>

          <section className="affiliate-detail">
            {detailLoading || !selected ? (
              <div className="affiliate-loading"><Loader2 className="spin" size={18} /> Loading partner</div>
            ) : (
              <>
                <div className="affiliate-detail-heading">
                  <div><span>SELECTED PARTNER</span><h2>{selected.display_name}</h2></div>
                  <a href={`https://www.tradenet.org/r/${selected.slug}`} target="_blank" rel="noreferrer">Open link <ExternalLink size={13} /></a>
                </div>

                <div className="affiliate-terms">
                  <span><small>Rate</small><strong>{integer(selected.commission_bps) / 100}%</strong></span>
                  <span><small>Attribution</small><strong>{selected.attribution_window_days} days</strong></span>
                  <span><small>Commission term</small><strong>{selected.commission_months} months</strong></span>
                  <span><small>Hold</small><strong>{selected.hold_days} days</strong></span>
                  <span><small>Payout minimum</small><strong>{money(selected.minimum_payout_cents, selected.currency)}</strong></span>
                </div>

                <div className="affiliate-balance">
                  <div><span>Pending</span><strong>{money(selected.pending_commission_cents, selected.currency)}</strong></div>
                  <div><span>Available</span><strong>{money(selected.available_commission_cents, selected.currency)}</strong></div>
                  <div><span>Reversed</span><strong>{money(selected.reversed_commission_cents, selected.currency)}</strong></div>
                  <div><span>Paid</span><strong>{money(selected.paid_commission_cents, selected.currency)}</strong></div>
                </div>

                <div className="affiliate-section-heading"><h3>Attributed accounts</h3><span>{conversionRows.length}</span></div>
                {conversionRows.length ? (
                  <div className="affiliate-table-wrap">
                    <table><thead><tr><th>Account</th><th>Attributed</th><th>Invoices</th><th>Revenue</th><th>Commission</th></tr></thead>
                      <tbody>{conversionRows.map((row) => <tr key={row.id}><td>{row.email || row.user_id}</td><td>{dateTime(row.attributed_at)}</td><td>{row.paid_invoices}</td><td>{money(row.revenue, selected.currency)}</td><td>{money(row.commission, selected.currency)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <Empty>No attributed accounts yet.</Empty>}

                <div className="affiliate-section-heading"><h3>Commission ledger</h3><span>{detail?.commissions?.length || 0}</span></div>
                {detail?.commissions?.length ? (
                  <div className="affiliate-table-wrap">
                    <table><thead><tr><th>Paid</th><th>Account</th><th>Collected</th><th>Commission</th><th>Available</th></tr></thead>
                      <tbody>{detail.commissions.map((row) => <tr key={row.id}><td>{dateTime(row.paid_at)}</td><td>{row.email || row.user_id}</td><td>{money(integer(row.collected_cents) - integer(row.refunded_cents), row.currency)}</td><td>{money(integer(row.commission_cents) - integer(row.reversed_commission_cents), row.currency)}</td><td>{dateTime(row.available_at)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <Empty>No paid Stripe invoices yet.</Empty>}

                <div className="affiliate-section-heading"><h3>Payouts</h3><span>{detail?.payouts?.length || 0}</span></div>
                {detail?.payouts?.length ? (
                  <div className="affiliate-payout-history">{detail.payouts.map((row) => <div key={row.id}><span><strong>{money(row.amount_cents, row.currency)}</strong><small>{row.reference}</small></span><span><strong>{row.status}</strong><small>{dateTime(row.paid_at || row.created_at)}</small></span></div>)}</div>
                ) : <Empty>No payouts recorded.</Empty>}

                {integer(selected.available_commission_cents) > 0 && (
                  <form className="affiliate-payout-form" onSubmit={handlePayout}>
                    <div><span>RECORD MANUAL PAYOUT</span><strong>{money(selected.available_commission_cents, selected.currency)}</strong></div>
                    <label>Payment reference<input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Bank, PayPal, or transaction reference" required /></label>
                    <label>Notes<input value={payoutNotes} onChange={(event) => setPayoutNotes(event.target.value)} placeholder="Optional" /></label>
                    <label>Confirmation<input value={payoutConfirmation} onChange={(event) => setPayoutConfirmation(event.target.value.toUpperCase())} placeholder="Type PAID" required /></label>
                    <button className="affiliate-primary" type="submit" disabled={working || payoutConfirmation !== 'PAID'}>{working ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Record payout</button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
