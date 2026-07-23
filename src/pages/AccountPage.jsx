import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Shield, LogOut, RefreshCw, Download, ExternalLink, Activity } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { openBillingPortal, TERMINAL_DOWNLOAD_URL } from '@/lib/checkout'

// access_tier (derived security tier) -> display. NOT subscription_tier.
const tierLabels = {
  waitlist:          'No active plan',
  free:              'Free',
  referral_verified: 'Referral (Bitunix)',
  beta:              'Beta',
  pro:               'Pro',
  admin:             'Admin',
}

const statusLabels = {
  waitlist: 'Inactive',
  active:   'Active',
  comped:   'Comped',
  past_due: 'Payment past due',
  revoked:  'Revoked',
}

export default function AccountPage() {
  const { user, profile, loading, signOut, refreshAccess } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [activating, setActivating] = useState(params.get('activating') === '1')
  const pollRef = useRef(null)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [loading, user, navigate])

  const tier = profile?.access_tier || 'waitlist'
  const isElevated = tier !== 'free' && tier !== 'waitlist'
  const canManageBilling = profile?.billing_provider === 'stripe' && Boolean(
    profile?.stripe_customer_id || profile?.billing_customer_id,
  )

  // Activation-race poll: after returning from checkout (?activating=1), refresh
  // the session (re-mints claims) immediately, then every ~3s until the plan
  // lands or we time out at 30s. `cancelled` guards against stale async writes
  // after unmount/re-run.
  useEffect(() => {
    if (!activating || !user) return
    let elapsed = 0
    let cancelled = false

    const finish = () => {
      if (cancelled) return
      clearInterval(pollRef.current)
      setActivating(false)
      const next = new URLSearchParams(params)
      next.delete('activating')
      setParams(next, { replace: true })
    }

    const tick = async () => {
      const p = await refreshAccess()
      if (cancelled) return
      const t = p?.access_tier
      if ((t && t !== 'free' && t !== 'waitlist') || elapsed >= 30000) finish()
    }

    tick() // immediate, don't wait 3s for the first check
    pollRef.current = setInterval(() => { elapsed += 3000; tick() }, 3000)

    return () => { cancelled = true; clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activating, user])

  if (loading || !user) {
    return (
      <main className="bg-black min-h-screen pt-24 flex items-center justify-center">
        <p className="text-[#71717A] text-sm">Loading...</p>
      </main>
    )
  }

  const status = profile?.access_status || 'waitlist'
  const expires = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null

  async function handleRefresh() {
    setRefreshing(true)
    try { await refreshAccess() } finally { setRefreshing(false) }
  }

  async function handleManageSubscription() {
    setPortalError('')
    setPortalLoading(true)
    try {
      const url = await openBillingPortal()
      window.location.href = url
    } catch (e) {
      console.error('billing portal failed', e)
      setPortalError('Subscription management is unavailable. Please try again in a moment.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <main className="bg-black min-h-screen pt-24">
      <div className="section-container py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg mx-auto space-y-6"
        >
          <h1 className="text-3xl font-black text-[#FAFAFA]">Account</h1>

          {activating && (
            <div className="rounded-xl p-4 flex items-center gap-3"
                 style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <RefreshCw size={15} className="text-[#c9a84c] animate-spin" />
              <p className="text-sm text-[#A1A1AA]">Activating your plan… this usually takes a few seconds.</p>
            </div>
          )}

          {/* Profile card */}
          <div className="bento-card p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
                <User size={20} className="text-[#c9a84c]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#FAFAFA]">{user.email}</p>
                <p className="text-xs text-[#71717A]">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="border-t border-white/[0.05] pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-[#71717A]" />
                <span className="text-sm text-[#A1A1AA]">{user.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-[#71717A]" />
                <span className="text-sm text-[#A1A1AA]">
                  Plan:{' '}
                  <span className={isElevated ? 'text-[#c9a84c] font-semibold' : 'text-[#71717A]'}>
                    {tierLabels[tier] || tier}
                  </span>
                  <span className="text-[#52525B]"> · {statusLabels[status] || status}</span>
                </span>
              </div>
              {expires && isElevated && (
                <div className="flex items-center gap-3">
                  <RefreshCw size={14} className="text-[#71717A]" />
                  <span className="text-sm text-[#A1A1AA]">
                    Renews / expires {expires.toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-white/[0.05] pt-4 flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Refresh access
              </button>
              {canManageBilling && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <ExternalLink size={14} />
                  {portalLoading ? 'Opening portal...' : 'Manage subscription'}
                </button>
              )}
            </div>
            {portalError && (
              <p className="text-sm text-red-400">{portalError}</p>
            )}
          </div>

          {/* Terminal download — desktop-eligible tiers only (the desktop app
              refuses free; terminal_access is true for free too, so gate on
              isElevated, not terminal_access). */}
          {isElevated && TERMINAL_DOWNLOAD_URL && (
            <a
              href={TERMINAL_DOWNLOAD_URL}
              className="bento-card p-5 flex items-center gap-3 hover:border-[#c9a84c]/30 transition-colors"
            >
              <Download size={18} className="text-[#c9a84c]" />
              <div>
                <p className="text-sm font-bold text-[#FAFAFA]">Download TradeNet Terminal</p>
                <p className="text-xs text-[#71717A]">Windows & macOS · log in with this account</p>
              </div>
            </a>
          )}

          {tier === 'admin' && (
            <Link
              to="/admin/dashboard"
              className="bento-card p-5 flex items-center gap-3 hover:border-[#c9a84c]/30 transition-colors"
            >
              <Activity size={18} className="text-[#42d9d0]" />
              <div>
                <p className="text-sm font-bold text-[#FAFAFA]">System Monitoring</p>
                <p className="text-xs text-[#71717A]">Backend, aggr, streams, storage, and security</p>
              </div>
            </Link>
          )}

          {/* Upgrade prompt for accounts without terminal access */}
          {!isElevated && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
            >
              <p className="text-sm text-[#A1A1AA]">
                This account does not have active terminal access.{' '}
                <Link to="/pricing" className="text-[#c9a84c] hover:text-[#f0c040] font-semibold transition-colors">
                  Choose a Pro plan -&gt;
                </Link>
              </p>
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-[#71717A] hover:text-red-400 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </motion.div>
      </div>
    </main>
  )
}
