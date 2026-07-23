import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, MailCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function SignUpPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const rawReturn = params.get('return') || '/account'
  const isSafeReturn = rawReturn.startsWith('/') && !rawReturn.startsWith('//')
  const returnTo = isSafeReturn ? rawReturn : '/account'

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
      const normalizedEmail = email.trim().toLowerCase()
      const redirectTo = new URL(returnTo, window.location.origin).toString()
      const data = await signUp(normalizedEmail, password, redirectTo)
      if (data.session) navigate(returnTo)
      else setConfirmationEmail(normalizedEmail)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationEmail) {
    return (
      <main className="bg-black min-h-screen pt-24 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto mb-5 w-12 h-12 rounded-md bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
            <MailCheck size={20} className="text-[#c9a84c]" />
          </div>
          <h1 className="text-3xl font-black text-[#FAFAFA] mb-3">Check Your Email</h1>
          <p className="text-sm text-[#71717A] leading-relaxed">
            We sent a verification link to <span className="text-[#D4D4D8]">{confirmationEmail}</span>. Confirm it to finish creating your TradeNet account.
          </p>
          <Link
            to={`/login?return=${encodeURIComponent(returnTo)}`}
            className="mt-7 inline-flex items-center gap-2 text-sm text-[#c9a84c] hover:text-[#f0c040] transition-colors"
          >
            Continue to sign in <ArrowRight size={14} />
          </Link>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="bg-black min-h-screen pt-24 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-3xl font-black text-[#FAFAFA] mb-2">Create Account</h1>
        <p className="text-sm text-[#71717A] mb-8">
          Use the same email across the website and desktop terminal. Already have an account?{' '}
          <Link to={`/login?return=${encodeURIComponent(returnTo)}`} className="text-[#c9a84c] hover:text-[#f0c040] transition-colors">Sign in</Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#71717A] uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-black border border-white/[0.08] text-[#FAFAFA] placeholder-[#3F3F46] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c9a84c]/40 transition-colors"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs text-[#71717A] uppercase tracking-wider block mb-1.5">Password</label>
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
            {loading ? 'Creating account...' : 'Create Account'}
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>

        <p className="text-[11px] text-[#3F3F46] mt-6 text-center leading-relaxed">
          By creating an account you agree to our{' '}
          <Link to="/terms-of-service" className="underline hover:text-[#71717A]">Terms of Service</Link>.
        </p>
      </motion.div>
    </main>
  )
}
