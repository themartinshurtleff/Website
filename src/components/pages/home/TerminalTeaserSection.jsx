import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Layers, Target, Zap, LayoutGrid } from 'lucide-react'


const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

const highlights = [
  {
    icon:   Layers,
    title:  '4 Exchanges, 1 View',
    body:   'Aggregated orderflow from Binance, Bybit, OKX, and Hyperliquid in one footprint chart.',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.15)',
  },
  {
    icon:   Target,
    title:  'Liquidation Prediction',
    body:   'Predict where liquidations will cluster — proprietary real-time algorithm.',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.15)',
  },
  {
    icon:   Zap,
    title:  'Native Rust Performance',
    body:   'GPU-accelerated. No Electron. Thousands of trades per second, zero stutter.',
    accent: '#22C55E',
    bg:     'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.15)',
  },
  {
    icon:   LayoutGrid,
    title:  'Complete Toolkit',
    body:   'Footprint charts, heatmaps, DOM ladder, time & sales — everything in one place.',
    accent: '#A78BFA',
    bg:     'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.15)',
  },
]

export default function TerminalTeaserSection() {
  const ref      = useRef(null)
  const inView   = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section
      ref={ref}
      className="py-28 bg-black border-y border-white/[0.04] relative overflow-hidden"
    >
      {/* Ambient blue tint */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[400px] opacity-[0.04] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #c9a84c, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="section-container relative">
        {/* Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12"
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <div>
            <span className="eyebrow-gold mb-4 block w-fit">New — TradeNet Terminal</span>
            <h2 className="text-[clamp(28px,3.8vw,48px)] font-black tracking-[-0.03em] text-[#FAFAFA] leading-[1.08]">
              A trading terminal built<br />
              <span className="gradient-text-gold">from the ground up.</span>
            </h2>
          </div>
          <button
            onClick={() => navigate('/terminal')}
            className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-[#c9a84c] hover:text-[#f0c040] transition-colors group"
          >
            See full details
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>

        {/* Bento grid — image + 4 highlight cards */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* Main image placeholder */}
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="lg:row-span-2"
          >
            <img
              src="/hero.png"
              alt="TradeNet Terminal"
              className="w-full h-full min-h-[240px] object-cover rounded-[20px] border border-white/[0.07]"
            />
          </motion.div>

          {/* 4 highlight cards — 2×2 on large, stacked on small */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {highlights.map(({ icon: Icon, title, body, accent, bg, border }, i) => (
              <motion.div
                key={title}
                className="bento-card p-5 flex flex-col gap-3"
                variants={fadeUp}
                custom={i + 2}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#FAFAFA] mb-1">{title}</p>
                  <p className="text-xs text-[#71717A] leading-relaxed">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <motion.div
          className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-white/[0.04]"
          variants={fadeUp}
          custom={7}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <button
            onClick={() => navigate('/terminal')}
            className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Join the Waitlist
            <ArrowRight size={14} />
          </button>
          <p className="text-sm text-[#52525B]">
            Currently in closed beta · v0.8.6
          </p>
        </motion.div>
      </div>
    </section>
  )
}
