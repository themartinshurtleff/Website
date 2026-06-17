import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isCheckoutConfigured, buildCheckoutUrl } from '@/lib/checkout'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

function Check({ text, gold }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-[#A1A1AA]">
      <CheckCircle2 size={14} className={`${gold ? 'text-[#c9a84c]' : 'text-[#c9a84c]/70'} flex-shrink-0 mt-0.5`} />
      {text}
    </li>
  )
}

const proFeatures = [
  'All coins (BTC, ETH, SOL + more)',
  'Real-time self-calibrating liquidation prediction heatmap',
  'Real-time orderbook heatmap',
  'Unlimited charts & layouts',
  'Full footprint charts (multi-exchange)',
  'Bar stats panel (all 9 rows)',
  'Full OI tools & CVD',
  'Liq bubbles overlay',
  'No watermark on screenshots',
  'Priority support',
]

const freeFeatures = [
  'BTC only',
  'Delayed liquidation heatmap (5 min delay)',
  '1 chart layout',
  'Orderbook heatmap',
  'Footprint chart',
  'Watermarked screenshots',
  'Requires Bitunix signup via referral link',
]

export default function PricingSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()
  const { user } = useAuth()

  function goToWaitlist() {
    navigate('/terminal')
    setTimeout(() => document.getElementById('terminal-waitlist')?.scrollIntoView({ behavior: 'smooth' }), 350)
  }

  // Account-first buy flow. Until Shopify variant ids are configured, checkout
  // is not live -> fall back to the waitlist so the page still works.
  function handleBuy(plan) {
    if (!isCheckoutConfigured(plan)) {
      goToWaitlist()
      return
    }
    if (!user) {
      navigate('/login?return=' + encodeURIComponent('/#pricing'))
      return
    }
    const url = buildCheckoutUrl(plan, user.id)  // note_attributes.profile_id = user.id
    if (url) window.location.href = url
    else goToWaitlist()
  }

  const buyLabel = isCheckoutConfigured() ? 'Get Pro' : 'Join Waitlist'

  return (
    <section id="pricing" className="py-28 bg-black relative overflow-hidden" ref={ref}>
      {/* Subtle ambient gradient */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.04] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, #c9a84c, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="section-container">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <span className="eyebrow mb-4">Pricing</span>
          <h2 className="text-[clamp(32px,4vw,48px)] font-black tracking-[-0.03em] text-[#FAFAFA] mt-4">
            Simple Pricing. Serious Edge.
          </h2>
          <p className="text-[#A1A1AA] mt-4 text-[16px] max-w-md mx-auto">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">

          {/* ── Free ── */}
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="relative flex flex-col"
          >
            <div className="bento-card flex-1 flex flex-col p-7 gap-6">
              <div>
                <p className="text-sm font-semibold text-[#71717A] mb-4">Free</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-[48px] font-black tracking-tight text-[#FAFAFA]">$0</span>
                  <span className="text-sm text-[#71717A] mb-3">/mo</span>
                </div>
                <p className="text-sm text-[#A1A1AA]">Get started with the essentials.</p>
              </div>
              <ul className="flex flex-col gap-2.5 flex-1">
                {freeFeatures.map((f) => <Check key={f} text={f} />)}
              </ul>
              <p className="text-[11px] text-[#71717A] leading-relaxed border-t border-white/[0.05] pt-3">
                Free access is powered by our exchange partnership. Sign up to Bitunix through our link — no deposit required.
              </p>
              <button
                onClick={goToWaitlist}
                className="btn-outline text-center text-[14px] px-5 py-3 rounded-xl font-semibold mt-auto block w-full"
              >
                Join Waitlist
              </button>
            </div>
          </motion.div>

          {/* ── Pro Annual (Featured) ── */}
          <motion.div
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="relative flex flex-col"
          >
            <div
              className="flex-1 flex flex-col scale-[1.02] origin-bottom rounded-[20px] relative"
              style={{
                background: '#000',
                border: '1px solid rgba(201,168,76,0.4)',
                boxShadow: '0 0 30px rgba(201,168,76,0.08), 0 0 60px rgba(201,168,76,0.04)',
              }}
            >
              <div className="flex flex-col flex-1 p-7 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-semibold text-[#c9a84c]">Pro</span>
                      <span className="text-xs text-[#71717A] ml-2">Billed Annually</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#09090B] bg-[#c9a84c] px-2.5 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[48px] font-black tracking-tight text-[#FAFAFA]">$384.99</span>
                    <span className="text-sm text-[#71717A] mb-3">/yr</span>
                  </div>
                  <p className="text-sm text-[#A1A1AA]">
                    Billed once a year. Lock your price for 12 months.
                  </p>
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {proFeatures.map((f) => <Check key={f} text={f} gold />)}
                </ul>
                <button
                  onClick={() => handleBuy('annual')}
                  className="btn-gold text-center text-[14px] px-5 py-3 rounded-xl font-bold mt-auto w-full"
                >
                  {buyLabel}
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Pro Monthly ── */}
          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="relative flex flex-col"
          >
            <div className="bento-card flex-1 flex flex-col p-7 gap-6">
              <div>
                <div className="mb-4">
                  <span className="text-sm font-semibold text-[#71717A]">Pro</span>
                  <span className="text-xs text-[#71717A] ml-2">Billed Monthly</span>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-[48px] font-black tracking-tight text-[#FAFAFA]">$29.99</span>
                  <span className="text-sm text-[#71717A] mb-3">/mo</span>
                </div>
                <p className="text-sm text-[#A1A1AA]">
                  Billed monthly. Cancel anytime.
                </p>
              </div>
              <ul className="flex flex-col gap-2.5 flex-1">
                {proFeatures.map((f) => <Check key={f} text={f} />)}
              </ul>
              <button
                onClick={() => handleBuy('monthly')}
                className="btn-outline text-center text-[14px] px-5 py-3 rounded-xl font-semibold mt-auto block w-full"
              >
                {buyLabel}
              </button>
            </div>
          </motion.div>

        </div>

        {/* Below cards */}
        <motion.div
          className="mt-10 text-center space-y-5"
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <p className="text-sm text-[#71717A]">
            Elite tier — coming soon. Join the waitlist to be notified when early access opens.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
