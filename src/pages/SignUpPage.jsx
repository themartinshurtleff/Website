import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function SignUpPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

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
      await signUp(email.trim().toLowerCase(), password)
      navigate('/account')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
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
        <h1 className="text-3xl font-black text-[#FAFAFA] mb-2">Create Account</h1>
        <p className="text-sm text-[#71717A] mb-8">
          Save your login for beta launch access. Already have an account?{' '}
          <Link to="/login" className="text-[#c9a84c] hover:text-[#f0c040] transition-colors">Sign in</Link>
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
