import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { markPasswordRecoveryPending } from '@/lib/authRecovery'

const allowedTypes = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])

function safeRedirectTarget(rawRedirect, type) {
  if (type === 'recovery') return '/reset-password'

  if (rawRedirect) {
    try {
      const url = new URL(rawRedirect, window.location.origin)
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}` || '/account'
      }
    } catch {
      // Fall through to the default below.
    }
  }

  if (type === 'email_change') return '/account'
  return '/account'
}

export default function AuthConfirmPage() {
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    async function confirm() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      const redirectTo = params.get('redirect_to')

      if (!tokenHash || !type || !allowedTypes.has(type)) {
        if (mounted) setError('This verification link is invalid or expired.')
        return
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })

      if (!mounted) return

      if (verifyError) {
        setError(verifyError.message || 'This verification link is invalid or expired.')
        return
      }

      if (type === 'recovery') markPasswordRecoveryPending()

      navigate(safeRedirectTarget(redirectTo, type), { replace: true })
    }

    confirm()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <main className="bg-black min-h-screen pt-24 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        {!error ? (
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
              <Loader2 size={20} className="text-[#c9a84c] animate-spin" />
            </div>
            <h1 className="text-3xl font-black text-[#FAFAFA]">Verifying Link</h1>
            <p className="text-sm text-[#71717A]">Confirming your TradeNet account action...</p>
          </div>
        ) : (
          <div className="space-y-5">
            <h1 className="text-3xl font-black text-[#FAFAFA]">Link Expired</h1>
            <p className="text-sm text-red-400">{error}</p>
            <div className="grid gap-3">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-bold text-sm px-5 py-3 rounded-xl transition-colors"
              >
                Go to Sign In
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/forgot-password"
                className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </main>
  )
}
