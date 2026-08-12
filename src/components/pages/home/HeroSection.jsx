import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowRight, ExternalLink } from 'lucide-react'
import TerminalLoopVideo from '@/components/media/TerminalLoopVideo'
import { useAuth } from '@/contexts/AuthContext'
import {
  PRIMARY_LAUNCH_LABEL,
  PRIMARY_LAUNCH_PATH,
  WEB_TERMINAL_URL,
} from '@/lib/launchConfig'

const OrderflowTopology = lazy(() => import('./OrderflowTopology'))

const reveal = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.78, delay, ease: [0.22, 1, 0.36, 1] },
    transitionEnd: { filter: 'none' },
  }),
}

export default function HeroSection() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()

  const handlePrimaryAction = () => {
    if (user) {
      window.open(WEB_TERMINAL_URL, '_blank', 'noopener,noreferrer')
      return
    }
    navigate(PRIMARY_LAUNCH_PATH)
  }

  const showTerminal = () => {
    document.getElementById('terminal-showcase')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="tn-hero" aria-labelledby="tn-hero-title">
      <motion.figure
        className="tn-hero-stage"
        initial={reduceMotion ? false : { opacity: 0, scale: 1.035, clipPath: 'inset(0 0 100% 0)' }}
        animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0% 0)', transitionEnd: { clipPath: 'none' } }}
        transition={{ duration: reduceMotion ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <TerminalLoopVideo
          alt="TradeNet Terminal multi-pane orderflow workspace"
          pauseDuringScroll
          priority
        />
        <Suspense fallback={null}>
          <OrderflowTopology />
        </Suspense>
        {!reduceMotion && <span className="tn-hero-print-scan" aria-hidden="true" />}
      </motion.figure>

      <div className="tn-hero-copy">
        <motion.h1
          id="tn-hero-title"
          initial={reduceMotion ? false : { opacity: 0, x: -18, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)', transitionEnd: { clipPath: 'none' } }}
          transition={{ duration: reduceMotion ? 0 : 0.82, delay: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            className="tn-hero-title-logo"
            src="/assets/terminal-logo-noglow-black.svg"
            alt="TradeNet Terminal"
          />
        </motion.h1>
        <motion.p className="tn-hero-tagline" variants={reveal} custom={0.4} initial={reduceMotion ? false : 'hidden'} animate="visible">
          Crypto market intelligence and orderflow
        </motion.p>
        <motion.p className="tn-hero-intro" variants={reveal} custom={0.5} initial={reduceMotion ? false : 'hidden'} animate="visible">
          Every available crypto pair across Binance, Bybit, OKX, and Hyperliquid, with full multi-venue orderflow for BTC, ETH, and SOL.
        </motion.p>
        <motion.div className="tn-hero-actions" variants={reveal} custom={0.6} initial={reduceMotion ? false : 'hidden'} animate="visible">
          <button className="tn-button-primary" onClick={handlePrimaryAction}>
            {user ? 'Launch Terminal' : PRIMARY_LAUNCH_LABEL}
            {user ? <ExternalLink size={16} /> : <ArrowRight size={16} />}
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
