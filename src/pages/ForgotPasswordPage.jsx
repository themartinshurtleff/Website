import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { requestPasswordReset } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestPasswordReset(email.trim().toLowerCase(), `${window.location.origin}/reset-password`)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Unable to send reset email.')
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
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#71717A] hover:text-[#FAFAFA] transition-colors mb-8">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <h1 className="text-3xl font-black text-[#FAFAFA] mb-2">Reset Password</h1>
        <p className="text-sm text-[#71717A] mb-8">
          Enter your email and we'll send you a secure reset link.
        </p>

        {sent ? (
          <div className="space-y-5">
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)' }}
            >
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                If an account exists for that email, a reset link is on the way.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="w-full border border-white/[0.08] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-white/[0.16] font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              Send another link
            </button>
          </div>
        ) : (
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

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-bold text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  )
}

