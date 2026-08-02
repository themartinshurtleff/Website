import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight } from 'lucide-react'
import {
  PRIMARY_LAUNCH_LABEL,
  PRIMARY_LAUNCH_PATH,
} from '@/lib/launchConfig'

const OrderflowTopology = lazy(() => import('./OrderflowTopology'))

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function HeroSection() {
  const navigate = useNavigate()

  const showTerminal = () => {
    document.getElementById('terminal-showcase')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="tn-hero" aria-labelledby="tn-hero-title">
      <motion.figure
        className="tn-hero-stage"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src="/herogif.gif"
          alt="TradeNet Terminal multi-pane orderflow workspace"
          loading="eager"
          fetchpriority="high"
        />
        <Suspense fallback={null}>
          <OrderflowTopology />
        </Suspense>
        <figcaption>Current desktop beta / market structure visualization</figcaption>
      </motion.figure>

      <div className="tn-hero-copy">
        <motion.h1 id="tn-hero-title" variants={reveal} custom={0.08} initial="hidden" animate="visible">
          <img
            className="tn-hero-title-logo"
            src="/assets/terminal-logo-noglow-black.svg"
            alt="TradeNet Terminal"
          />
        </motion.h1>
        <motion.p className="tn-hero-tagline" variants={reveal} custom={0.14} initial="hidden" animate="visible">
          Market intelligence and orderflow
        </motion.p>
        <motion.p className="tn-hero-intro" variants={reveal} custom={0.19} initial="hidden" animate="visible">
          Multi-venue heatmaps, footprint charts, DOM, Tape, OI, CVD, Lua indicators, backtesting, and paper-first execution for BTC, ETH, and SOL.
        </motion.p>
        <motion.div className="tn-hero-actions" variants={reveal} custom={0.27} initial="hidden" animate="visible">
          <button className="tn-button-primary" onClick={() => navigate(PRIMARY_LAUNCH_PATH)}>
            {PRIMARY_LAUNCH_LABEL}
            <ArrowRight size={16} />
          </button>
          <button className="tn-button-secondary" onClick={showTerminal}>
            Explore the terminal
            <ArrowDown size={15} />
          </button>
        </motion.div>
      </div>
    </section>
  )
}
