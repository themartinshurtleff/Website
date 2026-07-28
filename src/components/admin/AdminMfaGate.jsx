import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function verifiedTotpFactors(data) {
  return (data?.totp || []).filter((factor) => factor.status === 'verified')
}

export default function AdminMfaGate({ children, onVerified }) {
  const [status, setStatus] = useState('loading')
  const [factor, setFactor] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified

  const inspect = useCallback(async () => {
    setError('')
    const [aalResult, factorResult] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
    if (aalResult.error) throw aalResult.error
    if (factorResult.error) throw factorResult.error

    if (aalResult.data?.currentLevel === 'aal2') {
      setStatus('ready')
      setFactor(null)
      await onVerifiedRef.current?.()
      return
    }

    const verified = verifiedTotpFactors(factorResult.data)
    if (verified.length) {
      setFactor(verified[0])
      setStatus('challenge')
    } else {
      setFactor(null)
      setStatus('unenrolled')
    }
  }, [])

  useEffect(() => {
    inspect().catch(() => {
      setError('Multi-factor authentication status could not be loaded.')
      setStatus('error')
    })
  }, [inspect])

  async function beginEnrollment() {
    setWorking(true)
    setError('')
    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      const unverified = (factors.data?.totp || []).filter((item) => item.status !== 'verified')
      const removals = await Promise.all(unverified.map((item) => supabase.auth.mfa.unenroll({ factorId: item.id })))
      const removalError = removals.find((result) => result.error)?.error
      if (removalError) throw removalError

      const result = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'TradeNet Admin',
      })
      if (result.error) throw result.error
      setEnrollment(result.data)
      setFactor(result.data)
      setStatus('enroll')
    } catch (enrollError) {
      setError(enrollError?.message || 'Authenticator enrollment failed.')
    } finally {
      setWorking(false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    if (!factor?.id || !/^\d{6}$/.test(code.trim())) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }

    setWorking(true)
    setError('')
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      })
      if (result.error) throw result.error
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.error) throw refreshed.error
      setCode('')
      await inspect()
    } catch (verifyError) {
      setError(verifyError?.message || 'The authenticator code was not accepted.')
    } finally {
      setWorking(false)
    }
  }

  if (status === 'ready') return children

  return (
    <section className="announcement-mfa-gate" aria-live="polite">
      <div className="announcement-mfa-icon">
        {status === 'loading' ? <Loader2 className="spin" size={24} /> : <ShieldCheck size={24} />}
      </div>
      <div>
        <span className="announcement-eyebrow">ADMIN SECURITY</span>
        <h2>Authenticator verification required</h2>
        {status === 'loading' && <p>Checking the assurance level of this Supabase session.</p>}
        {status === 'unenrolled' && (
          <>
            <p>Publishing controls require a time-based one-time password. Set up an authenticator before continuing.</p>
            <button type="button" className="announcement-primary" onClick={beginEnrollment} disabled={working}>
              <KeyRound size={15} /> Set up authenticator
            </button>
          </>
        )}
        {status === 'enroll' && enrollment?.totp && (
          <>
            <p>Scan this code with your authenticator app, then enter the generated six-digit code.</p>
            <div className="announcement-mfa-enrollment">
              <img src={enrollment.totp.qr_code} alt="TradeNet admin authenticator QR code" />
              <div>
                <span>Manual setup key</span>
                <code>{enrollment.totp.secret}</code>
              </div>
            </div>
          </>
        )}
        {status === 'challenge' && (
          <p>Enter the current code from the authenticator linked to this administrator account.</p>
        )}
        {(status === 'challenge' || status === 'enroll') && (
          <form className="announcement-mfa-form" onSubmit={verifyCode}>
            <label>
              Authenticator code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                placeholder="000000"
                autoFocus
              />
            </label>
            <button type="submit" className="announcement-primary" disabled={working || code.length !== 6}>
              {working ? <Loader2 className="spin" size={15} /> : <ShieldCheck size={15} />}
              Verify
            </button>
          </form>
        )}
        {status === 'error' && (
          <button type="button" className="announcement-secondary" onClick={() => {
            setStatus('loading')
            inspect().catch(() => setStatus('error'))
          }}>
            Try again
          </button>
        )}
        {error && <p className="announcement-form-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}
