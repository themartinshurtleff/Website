import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const venues = ['Binance', 'Bybit', 'OKX', 'Hyperliquid']

const screens = [
  { src: '/hero.png', position: 'center 18%' },
  { src: '/obheatmap & dom.png', position: 'center' },
  { src: '/liqheatmap & footprint.png', position: 'center' },
  { src: '/tradinghero.png', position: 'center' },
]

export default function MarketCoverageSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-90px' })
  const navigate = useNavigate()
  const { user } = useAuth()

  function showPricing() {
    navigate('/#pricing')
    setTimeout(
      () => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }),
      20,
    )
  }

  return (
    <section ref={ref} className="tn-market-coverage" aria-labelledby="market-coverage-title">
      <div className="tn-market-mosaic" aria-hidden="true">
        {screens.map((screen) => (
          <figure key={screen.src}>
            <img src={screen.src} alt="" loading="lazy" style={{ objectPosition: screen.position }} />
          </figure>
        ))}
      </div>
      <div className="tn-market-shade" aria-hidden="true" />

      <motion.div
        className="tn-market-copy"
        initial={{ opacity: 0, y: 26 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 id="market-coverage-title">
          Binance, Bybit, OKX, and Hyperliquid.
          <span>One terminal built to read them together.</span>
        </h2>
        <p>
          Keep heatmaps, footprint, depth, Tape, OI, and CVD in the same workspace instead
          of rebuilding the trade across separate exchange tabs.
        </p>
        <div className="tn-market-actions">
          <button
            type="button"
            className="tn-market-primary"
            onClick={() => navigate(user ? '/account' : '/signup')}
          >
            {user ? 'Open your account' : 'Create free account'}
            <ArrowRight size={16} />
          </button>
          <button type="button" className="tn-market-secondary" onClick={showPricing}>
            Compare plans
            <ArrowDown size={15} />
          </button>
        </div>
        {!user && <small>No credit card required.</small>}
      </motion.div>

      <motion.ul
        className="tn-venue-rail"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.28 }}
        aria-label="Supported core futures venues"
      >
        {venues.map((venue) => <li key={venue}>{venue}</li>)}
      </motion.ul>
    </section>
  )
}
