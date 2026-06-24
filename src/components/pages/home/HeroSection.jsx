import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import ScrollIndicator from '@/components/common/ScrollIndicator'

const stats = [
  { value: 'Multi',     label: 'Exchange' },
  { value: '3,000+',    label: 'Symbols' },
  { value: 'Real-Time', label: 'Prediction' },
  { value: 'Tauri',     label: 'Desktop' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
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
      className="relative min-h-[94vh] flex flex-col bg-black overflow-hidden border-b border-white/[0.04]"
      style={{ isolation: 'isolate' }}
    >
      <img
        src="/herogif.gif"
        alt="TradeNet Quantum Terminal live orderflow workspace"
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
      />

      <div
        className="absolute inset-0 hidden md:block pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.9) 34%, rgba(0,0,0,0.42) 62%, rgba(0,0,0,0.18) 100%)',
        }}
      />
      <div
        className="absolute inset-0 md:hidden pointer-events-none"
        style={{ zIndex: 1, background: 'rgba(0,0,0,0.76)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 24%, transparent 64%, rgba(0,0,0,0.96) 100%)',
        }}
      />
      <div
        className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <div
        className="relative flex flex-col flex-1 justify-center pt-24 pb-20"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        <div className="section-container w-full">
          <div className="w-full md:max-w-[540px] lg:max-w-[580px] xl:max-w-[610px] space-y-7">
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
              <span className="eyebrow-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
                Launching Soon - Waitlist Now Open
              </span>
            </motion.div>

            <motion.div
              className="space-y-1"
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.01] text-[#FAFAFA]">
                See What the Market
              </h1>
              <h1 className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.01] gradient-text-gold">
                Is About to Do.
              </h1>
            </motion.div>

            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="text-[17px] text-[#D4D4D8] leading-[1.75] max-w-[470px]"
            >
              TradeNet Terminal delivers real-time liquidation prediction,
              aggregated order flow, and multi-exchange derivatives analytics
              in a Tauri desktop terminal built for the beta launch.
              Built for traders who trade differently.
            </motion.p>

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
                  <span className="text-base font-black gradient-text-gold text-center leading-tight">{value}</span>
                  <span className="text-[10px] text-[#71717A] text-center leading-tight">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      <div
        className="relative flex justify-center pb-6"
        style={{ zIndex: 2, pointerEvents: 'auto' }}
      >
        <ScrollIndicator />
      </div>
    </section>
  )
}
