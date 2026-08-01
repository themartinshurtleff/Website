import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { claimPendingAffiliate, recordAffiliateVisit } from '@/lib/affiliateAttribution'

export default function ReferralPage() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const campaign = searchParams.get('utm_campaign') || searchParams.get('campaign')
    const query = searchParams.toString()

    recordAffiliateVisit(slug, {
      landingPath: `/pricing${query ? `?${query}` : ''}`,
      campaign,
      referrer: document.referrer,
    }).then(async () => {
      if (user) await claimPendingAffiliate().catch(() => null)
      if (active) navigate(`/pricing?ref=${encodeURIComponent(slug)}`, { replace: true })
    }).catch(() => {
      if (active) setFailed(true)
    })

    return () => { active = false }
  }, [navigate, searchParams, slug, user])

  return (
    <main className="min-h-screen bg-[#08090a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-white/10 bg-[#0c0d0f] p-8 text-center">
        <img className="mx-auto h-7 w-auto" src="/assets/text-logo.png" alt="TradeNet" />
        {failed ? (
          <>
            <h1 className="mt-8 text-2xl font-semibold">Referral link not found</h1>
            <p className="mt-3 text-sm text-[#9ca0a8]">This link is inactive or no longer available.</p>
            <Link className="mt-7 inline-flex border border-[#e8bd42] px-5 py-2.5 text-sm font-semibold text-[#e8bd42]" to="/pricing">
              View TradeNet plans
            </Link>
          </>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-[#b8bbc1]">
            <Loader2 className="animate-spin text-[#e8bd42]" size={17} />
            Opening TradeNet
          </div>
        )}
      </div>
    </main>
  )
}
