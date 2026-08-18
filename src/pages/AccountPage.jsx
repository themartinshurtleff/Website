import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MonitorUp,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { openBillingPortal } from '@/lib/checkout'
import {
  changePassword,
  deleteAccount,
  requestEmailChange,
  syncAccountEmail,
} from '@/lib/accountSettings'
import { BETA_CHECKOUT_VISIBLE } from '@/lib/launchConfig'
import '@/styles/account-page.css'

const tierLabels = {
  waitlist: 'Waitlist',
  free: 'Free',
  referral_verified: 'Referral',
  beta: 'Beta',
  pro: 'Pro',
  admin: 'Admin',
}

const statusLabels = {
  waitlist: 'On the waitlist',
  active: 'Active',
  comped: 'Lifetime access',
  past_due: 'Payment past due',
  revoked: 'Revoked',
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, disabled }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="account-field" htmlFor={id}>
      <span>{label}</span>
      <span className="account-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="account-password-toggle"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={visible ? 'Hide password' : 'Show password'}
          disabled={disabled}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  )
}

function InlineResult({ result }) {
  if (!result?.message) return null
  const success = result.type === 'success'
  return (
    <div
      className={`account-inline-result ${success ? 'is-success' : 'is-error'}`}
      role={success ? 'status' : 'alert'}
    >
      {success ? <Check size={15} /> : <AlertTriangle size={15} />}
      <span>{result.message}</span>
    </div>
  )
}

export default function AccountPage() {
  const { user, profile, loading, signOut, refreshAccess } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [activating, setActivating] = useState(params.get('activating') === '1')
  const [activeEditor, setActiveEditor] = useState(null)
  const [emailForm, setEmailForm] = useState({ email: '', password: '' })
  const [emailResult, setEmailResult] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordResult, setPasswordResult] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteForm, setDeleteForm] = useState({ email: '', password: '' })
  const [deleteResult, setDeleteResult] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const pollRef = useRef(null)
  const emailSyncStartedRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [loading, user, navigate])

  const tier = profile?.access_tier || 'waitlist'
  const status = profile?.access_status || 'waitlist'
  const isElevated = tier !== 'free' && tier !== 'waitlist'
  const hasBillingHistory = Boolean(
    profile?.billing_provider ||
    profile?.billing_customer_id ||
    profile?.stripe_customer_id ||
    profile?.stripe_subscription_id,
  )
  const canManageBilling = profile?.billing_provider === 'stripe' && Boolean(
    profile?.stripe_customer_id || profile?.billing_customer_id,
  )
  const deletionRequiresSupport = tier === 'admin' || hasBillingHistory
  const emailChanged = params.get('email_changed') === '1'

  useEffect(() => {
    if (!emailChanged || !user?.id || emailSyncStartedRef.current) return
    emailSyncStartedRef.current = true
    syncAccountEmail()
      .then(() => refreshAccess())
      .catch(error => console.warn('account email sync delayed', error))
    // Run once after Supabase confirms the new address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailChanged, user?.id])

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
      const nextProfile = await refreshAccess()
      if (cancelled) return
      const nextTier = nextProfile?.access_tier
      if ((nextTier && nextTier !== 'free' && nextTier !== 'waitlist') || elapsed >= 30000) finish()
    }

    tick()
    pollRef.current = setInterval(() => { elapsed += 3000; tick() }, 3000)
    return () => { cancelled = true; clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activating, user])

  if (loading || !user) {
    return (
      <main className="account-page account-loading">
        <Loader2 size={18} className="animate-spin" />
        <span>Loading account...</span>
      </main>
    )
  }

  const expires = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const joined = user.created_at ? new Date(user.created_at) : null

  function dismissEmailChanged() {
    const next = new URLSearchParams(params)
    next.delete('email_changed')
    setParams(next, { replace: true })
  }

  function openEditor(name) {
    setActiveEditor(current => current === name ? null : name)
    setEmailResult(null)
    setPasswordResult(null)
  }

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
    } catch (error) {
      console.error('billing portal failed', error)
      setPortalError('Subscription management is unavailable. Try again in a moment.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleEmailChange(event) {
    event.preventDefault()
    setEmailResult(null)
    setEmailLoading(true)
    try {
      await requestEmailChange(user.email, emailForm.password, emailForm.email)
      setEmailForm({ email: '', password: '' })
      setEmailResult({
        type: 'success',
        message: 'Confirmation instructions were sent. Complete the email verification before using the new address.',
      })
    } catch (error) {
      setEmailResult({ type: 'error', message: error.message || 'The email change could not be started.' })
    } finally {
      setEmailLoading(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    setPasswordResult(null)

    if (passwordForm.next.length < 8) {
      setPasswordResult({ type: 'error', message: 'The new password must be at least 8 characters.' })
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordResult({ type: 'error', message: 'The new passwords do not match.' })
      return
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordResult({ type: 'error', message: 'Choose a new password that differs from the current one.' })
      return
    }

    setPasswordLoading(true)
    try {
      const result = await changePassword(passwordForm.current, passwordForm.next)
      setPasswordForm({ current: '', next: '', confirm: '' })
      setPasswordResult({
        type: 'success',
        message: result.otherSessionsRevoked
          ? 'Password updated. Other signed-in sessions were revoked.'
          : 'Password updated. Review active sessions if another device may still be signed in.',
      })
    } catch (error) {
      setPasswordResult({ type: 'error', message: error.message || 'The password could not be updated.' })
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleDeleteAccount(event) {
    event.preventDefault()
    setDeleteResult(null)
    setDeleteLoading(true)
    try {
      await deleteAccount(user.email, deleteForm.password)
      try { await signOut({ scope: 'local' }) } catch { /* Account no longer exists. */ }
      window.location.replace('/')
    } catch (error) {
      setDeleteResult({ type: 'error', message: error.message || 'The account could not be deleted.' })
      setDeleteLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <main className="account-page">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42 }}
        className="account-container"
      >
        <header className="account-heading">
          <div>
            <h1>Account settings</h1>
            <p>Manage your TradeNet identity, access, billing, and security.</p>
          </div>
          <button type="button" className="account-signout" onClick={handleSignOut}>
            <LogOut size={15} />
            Sign out
          </button>
        </header>

        {(activating || emailChanged) && (
          <div className={`account-notice ${emailChanged ? 'is-success' : ''}`} role="status">
            {activating ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
            <div>
              <strong>{activating ? 'Activating your plan' : 'Email address updated'}</strong>
              <span>
                {activating
                  ? 'Access usually updates within a few seconds.'
                  : 'Your confirmed email is now used for TradeNet sign-in.'}
              </span>
            </div>
            {emailChanged && (
              <button type="button" onClick={dismissEmailChanged} aria-label="Dismiss email update notice" title="Dismiss">
                <X size={15} />
              </button>
            )}
          </div>
        )}

        <div className="account-primary-grid">
          <section className="account-panel account-overview-panel">
            <div className="account-panel-heading">
              <span className="account-panel-icon"><UserRound size={18} /></span>
              <div>
                <h2>Account overview</h2>
                <p>Your identity and current access.</p>
              </div>
            </div>

            <div className="account-identity">
              <div>
                <strong>{user.email}</strong>
                <span>{user.email_confirmed_at ? 'Verified email' : 'Email verification pending'}</span>
              </div>
              <span className={`account-tier ${isElevated ? 'is-elevated' : ''}`}>
                {tierLabels[tier] || tier}
              </span>
            </div>

            <dl className="account-facts">
              <div>
                <dt>Access status</dt>
                <dd>{statusLabels[status] || status}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{joined ? joined.toLocaleDateString() : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>{expires && isElevated ? 'Renews or expires' : 'Platform'}</dt>
                <dd>{expires && isElevated ? expires.toLocaleDateString() : 'Web terminal'}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="account-text-action"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Syncing access...' : 'Refresh access'}
            </button>
          </section>

          <section className="account-panel account-access-panel">
            <div className="account-panel-heading">
              <span className="account-panel-icon is-cyan"><MonitorUp size={18} /></span>
              <div>
                <h2>Terminal and billing</h2>
                <p>Open the terminal or manage your plan.</p>
              </div>
            </div>

            <div className="account-action-list">
              <a href="https://app.tradenet.org/" className="account-action-row account-action-primary">
                <span><MonitorUp size={17} /></span>
                <div><strong>Open web terminal</strong><small>Launch TradeNet in your browser</small></div>
                <ExternalLink size={15} />
              </a>

              {isElevated && (
                <Link to="/download" className="account-action-row">
                  <span><Download size={17} /></span>
                  <div><strong>Desktop terminal</strong><small>Download the signed Windows build</small></div>
                  <ArrowRight size={15} />
                </Link>
              )}

              {canManageBilling && (
                <button
                  type="button"
                  className="account-action-row"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                >
                  <span>{portalLoading ? <Loader2 size={17} className="animate-spin" /> : <ExternalLink size={17} />}</span>
                  <div><strong>Manage subscription</strong><small>Payment method, invoices, or cancellation</small></div>
                  <ArrowRight size={15} />
                </button>
              )}

              {tier === 'admin' && (
                <Link to="/admin/dashboard" className="account-action-row">
                  <span><Activity size={17} /></span>
                  <div><strong>System monitoring</strong><small>Infrastructure and security dashboard</small></div>
                  <ArrowRight size={15} />
                </Link>
              )}

              {!isElevated && (
                <Link
                  to={BETA_CHECKOUT_VISIBLE ? '/pricing' : '/terminal'}
                  className="account-action-row"
                >
                  <span><ShieldCheck size={17} /></span>
                  <div>
                    <strong>{BETA_CHECKOUT_VISIBLE ? 'Upgrade access' : 'Terminal access'}</strong>
                    <small>{BETA_CHECKOUT_VISIBLE ? 'Review your available plans' : 'Review current availability'}</small>
                  </div>
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
            {portalError && <p className="account-panel-error" role="alert">{portalError}</p>}
          </section>
        </div>

        <section className="account-panel account-security-panel">
          <div className="account-panel-heading">
            <span className="account-panel-icon"><ShieldCheck size={18} /></span>
            <div>
              <h2>Security</h2>
              <p>Confirm your current password before sensitive changes.</p>
            </div>
          </div>

          <div className="account-setting-row">
            <div className="account-setting-summary">
              <span><Mail size={17} /></span>
              <div>
                <strong>Email address</strong>
                <small>{user.email}</small>
              </div>
            </div>
            <button type="button" className="account-secondary-button" onClick={() => openEditor('email')}>
              {activeEditor === 'email' ? 'Cancel' : 'Change email'}
            </button>
          </div>

          {activeEditor === 'email' && (
            <form className="account-setting-form" onSubmit={handleEmailChange}>
              <label className="account-field" htmlFor="account-new-email">
                <span>New email</span>
                <input
                  id="account-new-email"
                  type="email"
                  value={emailForm.email}
                  onChange={event => setEmailForm(current => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={emailLoading}
                  required
                />
              </label>
              <PasswordField
                id="account-email-password"
                label="Current password"
                value={emailForm.password}
                onChange={event => setEmailForm(current => ({ ...current, password: event.target.value }))}
                placeholder="Confirm your identity"
                autoComplete="current-password"
                disabled={emailLoading}
              />
              <div className="account-form-footer">
                <p>Supabase will send confirmation instructions before the address changes.</p>
                <button type="submit" className="account-primary-button" disabled={emailLoading}>
                  {emailLoading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {emailLoading ? 'Sending...' : 'Send confirmation'}
                </button>
              </div>
              <InlineResult result={emailResult} />
            </form>
          )}

          {activeEditor !== 'email' && <InlineResult result={emailResult} />}

          <div className="account-setting-row">
            <div className="account-setting-summary">
              <span><KeyRound size={17} /></span>
              <div>
                <strong>Password</strong>
                <small>Update your password and revoke other sessions</small>
              </div>
            </div>
            <button type="button" className="account-secondary-button" onClick={() => openEditor('password')}>
              {activeEditor === 'password' ? 'Cancel' : 'Change password'}
            </button>
          </div>

          {activeEditor === 'password' && (
            <form className="account-setting-form account-password-form" onSubmit={handlePasswordChange}>
              <PasswordField
                id="account-current-password"
                label="Current password"
                value={passwordForm.current}
                onChange={event => setPasswordForm(current => ({ ...current, current: event.target.value }))}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={passwordLoading}
              />
              <PasswordField
                id="account-new-password"
                label="New password"
                value={passwordForm.next}
                onChange={event => setPasswordForm(current => ({ ...current, next: event.target.value }))}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                disabled={passwordLoading}
              />
              <PasswordField
                id="account-confirm-password"
                label="Confirm new password"
                value={passwordForm.confirm}
                onChange={event => setPasswordForm(current => ({ ...current, confirm: event.target.value }))}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                disabled={passwordLoading}
              />
              <div className="account-form-footer">
                <p>Your current browser remains signed in after the change.</p>
                <button type="submit" className="account-primary-button" disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  {passwordLoading ? 'Updating...' : 'Update password'}
                </button>
              </div>
              <InlineResult result={passwordResult} />
            </form>
          )}

          {activeEditor !== 'password' && <InlineResult result={passwordResult} />}
        </section>

        <section className="account-danger-zone">
          <div>
            <span><Trash2 size={17} /></span>
            <div>
              <h2>Delete account</h2>
              <p>
                {deletionRequiresSupport
                  ? 'Billing-linked and administrator accounts require a reviewed deletion request.'
                  : 'Permanently remove your account, profile, waitlist entry, and access.'}
              </p>
            </div>
          </div>

          {deletionRequiresSupport ? (
            <a
              className="account-danger-button"
              href={`mailto:support@tradenet.org?subject=${encodeURIComponent('TradeNet account deletion request')}`}
            >
              Request deletion
            </a>
          ) : (
            <Dialog.Root
              open={deleteOpen}
              onOpenChange={open => {
                if (deleteLoading) return
                setDeleteOpen(open)
                if (!open) {
                  setDeleteForm({ email: '', password: '' })
                  setDeleteResult(null)
                }
              }}
            >
              <Dialog.Trigger asChild>
                <button type="button" className="account-danger-button">Delete account</button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="account-dialog-overlay" />
                <Dialog.Content className="account-dialog-content">
                  <div className="account-dialog-heading">
                    <span><AlertTriangle size={19} /></span>
                    <div>
                      <Dialog.Title>Delete your TradeNet account?</Dialog.Title>
                      <Dialog.Description>This cannot be undone.</Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button type="button" aria-label="Close deletion dialog" title="Close" disabled={deleteLoading}>
                        <X size={17} />
                      </button>
                    </Dialog.Close>
                  </div>

                  <p className="account-dialog-copy">
                    Your authentication account, profile, waitlist record, and TradeNet access will be removed. Security and legally required transaction records may be retained.
                  </p>

                  <form onSubmit={handleDeleteAccount}>
                    <label className="account-field" htmlFor="account-delete-email">
                      <span>Type your email to confirm</span>
                      <input
                        id="account-delete-email"
                        type="email"
                        value={deleteForm.email}
                        onChange={event => setDeleteForm(current => ({ ...current, email: event.target.value }))}
                        placeholder={user.email}
                        autoComplete="off"
                        disabled={deleteLoading}
                        required
                      />
                    </label>
                    <PasswordField
                      id="account-delete-password"
                      label="Current password"
                      value={deleteForm.password}
                      onChange={event => setDeleteForm(current => ({ ...current, password: event.target.value }))}
                      placeholder="Confirm your identity"
                      autoComplete="current-password"
                      disabled={deleteLoading}
                    />
                    <InlineResult result={deleteResult} />
                    <div className="account-dialog-actions">
                      <Dialog.Close asChild>
                        <button type="button" className="account-secondary-button" disabled={deleteLoading}>Cancel</button>
                      </Dialog.Close>
                      <button
                        type="submit"
                        className="account-delete-confirm"
                        disabled={
                          deleteLoading ||
                          !deleteForm.password ||
                          deleteForm.email.trim().toLowerCase() !== user.email.toLowerCase()
                        }
                      >
                        {deleteLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        {deleteLoading ? 'Deleting...' : 'Permanently delete'}
                      </button>
                    </div>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </section>

        <footer className="account-footer-note">
          <CalendarDays size={14} />
          Access and billing data may take a few seconds to update after a purchase or cancellation.
        </footer>
      </motion.div>
    </main>
  )
}
