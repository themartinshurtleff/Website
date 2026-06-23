import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import ScrollIndicator from '@/components/common/ScrollIndicator'
import LiquidationHeatmap from '@/components/common/LiquidationHeatmap'

const stats = [
  { value: 'Multi',      label: 'Exchange'           },
  { value: '3,000+',     label: 'Symbols'            },
  { value: 'Real-Time',  label: 'Prediction'        },
  { value: 'Tauri',      label: 'Desktop'           },
]

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function HeroSection() {
  const navigate = useNavigate()

  function scrollToLaunchAccess() {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      className="relative min-h-screen flex flex-col bg-black overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      {/* ── Liquidation heatmap background ── */}
      <LiquidationHeatmap />

      {/* ── Gradient overlays for text legibility ── */}
      <div
        className="absolute inset-0 hidden md:block pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.05) 75%)',
        }}
      />
      <div
        className="absolute inset-0 md:hidden pointer-events-none"
        style={{ zIndex: 1, background: 'rgba(0,0,0,0.6)' }}
      />
      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* ── Content — left column, pointer-events-none wrapper ── */}
      <div
        className="relative flex flex-col flex-1 justify-center pt-24 pb-20"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        <div className="section-container w-full">
          <div className="w-full md:max-w-[520px] lg:max-w-[540px] xl:max-w-[580px] space-y-7">

            {/* Eyebrow */}
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
              <span className="eyebrow-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
                Launching Soon - Waitlist Now Open
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div
              className="space-y-1"
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.01] tracking-[-0.04em] text-[#FAFAFA]">
                See What the Market
              </h1>
              <h1 className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.01] tracking-[-0.04em] gradient-text-gold">
                Is About to Do.
              </h1>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="text-[17px] text-[#A1A1AA] leading-[1.75] max-w-[440px]"
            >
              TradeNet Terminal delivers real-time liquidation prediction,
              aggregated order flow, and multi-exchange derivatives analytics
              in a Tauri desktop terminal built for the beta launch.
              Built for traders who trade differently.
            </motion.p>

            {/* CTAs — pointer-events-auto */}
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-3"
              style={{ pointerEvents: 'auto' }}
            >
              <button
                onClick={() => navigate('/terminal')}
                className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold px-6 py-3 rounded-xl text-[15px] transition-colors shadow-[0_0_20px_rgba(201,168,76,0.15)]"
              >
                Join the Waitlist
                <ArrowRight size={16} />
              </button>
              <button
                onClick={scrollToLaunchAccess}
                className="btn-outline inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px]"
              >
                Launch Access
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-4 gap-px bg-white/[0.07] rounded-2xl overflow-hidden border border-white/[0.07] max-w-[400px]"
            >
              {stats.map(({ value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center gap-1 py-4 px-2 bg-black/80 backdrop-blur-sm"
                >
                  <span className="text-base font-black tracking-tight gradient-text-gold text-center leading-tight">{value}</span>
                  <span className="text-[10px] text-[#71717A] text-center leading-tight">{label}</span>
                </div>
              ))}
            </motion.div>

          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="relative flex justify-center pb-6"
        style={{ zIndex: 2, pointerEvents: 'auto' }}
      >
        <ScrollIndicator />
      </div>
    </section>
  )
}
