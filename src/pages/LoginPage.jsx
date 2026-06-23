import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const resetComplete = params.get('reset') === '1'

  // Only honor in-app relative returns (defense against open redirect): a
  // single-leading-slash path (not '//host') or a bare '#fragment'. Anything
  // absolute/protocol-relative falls back to /account.
  const rawReturn = params.get('return') || '/account'
  const isSafeReturn =
    (rawReturn.startsWith('/') && !rawReturn.startsWith('//')) || rawReturn.startsWith('#')
  const returnTo = isSafeReturn ? rawReturn : '/account'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email.trim().toLowerCase(), password)
      navigate(returnTo)
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
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
        <h1 className="text-3xl font-black text-[#FAFAFA] mb-2">Sign In</h1>
        <p className="text-sm text-[#71717A] mb-8">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[#c9a84c] hover:text-[#f0c040] transition-colors">Create one</Link>
        </p>

        {resetComplete && (
          <div
            className="rounded-xl p-3 mb-5"
            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)' }}
          >
            <p className="text-sm text-[#A1A1AA]">Password updated. Sign in with your new password.</p>
          </div>
        )}

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#71717A] uppercase tracking-wider">Password</label>
              <Link to="/forgot-password" className="text-xs text-[#c9a84c] hover:text-[#f0c040] transition-colors">
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-black border border-white/[0.08] text-[#FAFAFA] placeholder-[#3F3F46] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c9a84c]/40 transition-colors"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-bold text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>
      </motion.div>
    </main>
  )
}
