import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearPasswordRecoveryPending,
  getRecoveryHashSession,
  hasPasswordRecoveryPending,
} from '@/lib/authRecovery'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { updatePassword, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const markReady = () => {
      if (!mounted) return
      setReady(true)
      setChecking(false)
      setError('')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) markReady()
    })

    async function initRecoverySession() {
      const code = new URLSearchParams(window.location.search).get('code')
      const hashSession = getRecoveryHashSession()

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!mounted) return
        if (exchangeError) {
          setError(exchangeError.message || 'This reset link is invalid or expired.')
          setChecking(false)
          return
        }
        window.history.replaceState(null, '', '/reset-password')
        markReady()
        return
      }

      if (hashSession) {
        const { error: sessionError } = await supabase.auth.setSession(hashSession)
        if (!mounted) return
        if (sessionError) {
          clearPasswordRecoveryPending()
          setError(sessionError.message || 'This reset link is invalid or expired.')
          setChecking(false)
          return
        }
        window.history.replaceState(null, '', '/reset-password')
        markReady()
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session) markReady()
      else {
        if (hasPasswordRecoveryPending()) clearPasswordRecoveryPending()
        setError('This reset link is invalid or expired.')
        setChecking(false)
      }
    }

    initRecoverySession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      clearPasswordRecoveryPending()
      await signOut()
      navigate('/login?reset=1', { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-black min-h-screen pt-24 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-3xl font-black text-[#FAFAFA] mb-2">Choose New Password</h1>
        <p className="text-sm text-[#71717A] mb-8">
          Set a new password for your TradeNet account.
        </p>

        {checking ? (
          <p className="text-sm text-[#71717A]">Verifying reset link...</p>
        ) : !ready ? (
          <div className="space-y-5">
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Link
              to="/forgot-password"
              className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-bold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              Request New Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#71717A] uppercase tracking-wider block mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-black border border-white/[0.08] text-[#FAFAFA] placeholder-[#3F3F46] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c9a84c]/40 transition-colors"
                placeholder="Minimum 8 characters"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-[#71717A] uppercase tracking-wider block mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full bg-black border border-white/[0.08] text-[#FAFAFA] placeholder-[#3F3F46] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c9a84c]/40 transition-colors"
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-bold text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  )
}
