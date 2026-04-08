import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Zap, RefreshCw } from 'lucide-react'
import FeatureList from '@/components/pages/indicator/FeatureList'
// import Footer from '@/components/layout/Footer'

const images = [
  'https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/2debc5cbf1d7ba94744a2daf0c1ebd27.gif',
  'https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/a877d69666ee643f0f0fc1a40e86c44d.png',
  'https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/ed7e9b9be4d9b12ef98cda19965441c7.png',
]

const stats = [
  { value: '87%', label: 'Avg. Win-Rate*' },
  { value: '2.9:1', label: 'Avg. Risk/Reward*' },
  { value: '15min', label: 'Avg Setup' },
]

const included = [
  'Complete All-In-One Indicator',
  'Adjustable Settings',
  'Full Documentation',
  'Smart-Money Integration',
  'Live Trade Breakdowns',
]

const trustBadges = [
  { icon: Zap, label: 'Instant Access' },
  { icon: ShieldCheck, label: '7-Day Free Trial' },
  { icon: RefreshCw, label: 'Lifetime Updates' },
]

export default function IndicatorPage() {
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setActive((p) => (p + 1) % images.length), 10000)
    return () => clearInterval(intervalRef.current)
  }, [])

  function prev() { setActive((p) => (p - 1 + images.length) % images.length) }
  function next() { setActive((p) => (p + 1) % images.length) }

  return (
    <>
      {/* Custom nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="section-container flex items-center justify-between h-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-white transition-colors">
            <ArrowLeft size={15} /> Back to Home
          </Link>
          <img
            src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/6725a03a8625d8a52b24236d4aa8163e.png"
            alt="TradeNet"
            className="h-7 w-auto"
          />
          <a
            href="https://whop.com/joined/tradenet/products/tradenet-pro/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold px-5 py-2 text-sm rounded-lg"
          >
            Get Access Now
          </a>
        </div>
      </nav>

      <main className="bg-black pt-16 min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/a19189dd19fd4125a3e51f4da20ecd14.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="absolute inset-0 bg-black/85" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(201,168,76,0.06), transparent)' }}
          />

          <div className="relative section-container py-24">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <span className="eyebrow">Proprietary Indicator Suite</span>
                <h1 className="text-[clamp(36px,5vw,64px)] font-black tracking-[-0.04em] leading-[1.03]">
                  <span className="text-[#FAFAFA]">Fusion v2 Indicator</span><br />
                  <span className="gradient-text-gold">Plug N' Play Profitability.</span>
                </h1>
                <p className="text-[17px] text-[#A1A1AA] max-w-xl mx-auto leading-[1.75]">
                  Our exclusive TradingView indicator is trusted by real traders every day — not for signals that look
                  good in hindsight, but for entries that actually play out.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06] max-w-sm mx-auto mt-8">
                  {stats.map(({ value, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 py-4 bg-black">
                      <span className="text-2xl font-black tracking-tight gradient-text-gold">{value}</span>
                      <span className="text-xs text-[#71717A] text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Carousel */}
        <section className="py-16 border-t border-white/[0.06]">
          <div className="section-container">
            <div className="relative max-w-4xl mx-auto">
              <div className="rounded-2xl overflow-hidden border border-white/[0.08] aspect-video relative">
                {images.map((src, i) => (
                  <motion.img
                    key={src}
                    src={src}
                    alt="Fusion v2 Indicator"
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={false}
                    animate={{ opacity: i === active ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                ))}
              </div>
              {/* Controls */}
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full glass border border-white/[0.1] flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full glass border border-white/[0.1] flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <ArrowRight size={16} />
              </button>
              <div className="flex justify-center gap-2 mt-4">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`rounded-full transition-all ${i === active ? 'w-6 h-1.5 bg-[#c9a84c]' : 'w-1.5 h-1.5 bg-white/20'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What's Included + Offer */}
        <section className="py-16 border-t border-white/[0.06]">
          <div className="section-container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* What's included */}
              <div className="bento-card p-8 space-y-5">
                <h3 className="text-xl font-bold text-[#FAFAFA]">What's Included</h3>
                <FeatureList items={included} />
              </div>

              {/* Limited time offer */}
              <div className="gradient-border p-8 space-y-4">
                <span className="eyebrow text-xs">Limited Time Offer</span>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black text-[#FAFAFA] tracking-tight">$79</span>
                  <div className="pb-1">
                    <p className="text-sm text-[#71717A] line-through">was $279</p>
                    <p className="text-sm font-bold text-[#c9a84c]">71% OFF</p>
                  </div>
                </div>
                <p className="text-[15px] text-[#A1A1AA] leading-relaxed">
                  Get the complete indicator, education, and strategy suite plus 30 days of live trading room access for just $79.
                </p>
                <a
                  href="https://whop.com/joined/tradenet/products/tradenet-pro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold block text-center px-6 py-3 rounded-xl text-[15px] font-bold"
                >
                  Get Instant Access
                </a>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {trustBadges.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <Icon size={16} className="text-[#c9a84c]" />
                      <span className="text-[11px] text-[#71717A] text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-20 border-t border-white/[0.06] relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(201,168,76,0.04), transparent)' }}
          />
          <div className="section-container text-center relative space-y-6">
            <h2 className="text-[clamp(28px,4vw,48px)] font-black tracking-[-0.03em]">
              <span className="gradient-text-gold">Ready to Trade with Confidence?</span>
            </h2>
            <a
              href="https://whop.com/joined/tradenet/products/tradenet-pro/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px]"
            >
              Get Access Now <ArrowRight size={16} />
            </a>
            <div className="flex flex-wrap justify-center gap-4">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-[#71717A]">
                  <Icon size={14} className="text-[#c9a84c]" /> {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="section-container py-8 border-t border-white/[0.04]">
          <p className="text-xs text-[#71717A]/60 text-center max-w-2xl mx-auto leading-relaxed">
            *Win-rate and risk/reward ratios are based on historical backtesting and are not a guarantee of future performance. Trading involves substantial risk of loss. Past results do not guarantee future results.
          </p>
        </div>
      </main>
    </>
  )
}
