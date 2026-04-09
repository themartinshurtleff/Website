import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function WaitlistForm({ className = '', source = 'website' }) {
  const [email, setEmail]       = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!isValid) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    const { error: dbError } = await supabase
      .from('waitlist')
      .upsert({ email: trimmed, source }, { onConflict: 'email' })

    setLoading(false)

    if (dbError) {
      setError('Something went wrong. Please try again.')
      return
    }

    navigate('/thankyou')
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          placeholder="your@email.com"
          className="flex-1 min-w-0 bg-black border border-white/[0.08] text-[#FAFAFA] placeholder-[#3F3F46] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c9a84c]/40 transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="flex-shrink-0 flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Waitlist'}
          {!loading && <ArrowRight size={14} />}
        </button>
      </form>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-[#3F3F46] mt-2.5">Currently in closed beta · Early access coming soon</p>
    </div>
  )
}
