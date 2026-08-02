import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'

const productViews = [
  {
    id: 'full-desk',
    image: '/newshowcase/fullflowdesk.png',
    alt: 'TradeNet six-pane canvas workspace with heatmaps, orderbooks, Tape, and Delta',
    label: 'Full desk',
    title: 'Six panes. One saved canvas.',
    body: 'Build the desk around the way you trade. This canvas keeps BTC and ETH charts, aggregated orderbooks, Tape, heatmaps, and Delta visible at the same time.',
    details: ['Freeform canvas', 'Multi-symbol panes', 'Saved workspaces'],
  },
  {
    id: 'orderbook-heatmap',
    image: '/newshowcase/obheatmap.png',
    alt: 'TradeNet orderbook heatmap with historical liquidity and live price action',
    label: 'Orderbook heatmap',
    title: 'See liquidity form, move, and disappear.',
    body: 'Historical orderbook depth is rendered directly behind price so resting liquidity, pulled walls, and reactions stay visible instead of vanishing with the live book.',
    details: ['Historical depth', 'Venue-aware liquidity', 'Speed of Tape'],
  },
  {
    id: 'footprint',
    image: '/newshowcase/footprint.png',
    alt: 'TradeNet footprint chart with bid and ask volume, Delta, bar statistics, and volume bubbles',
    label: 'Footprint',
    title: 'Read the trade inside each candle.',
    body: 'Bid and ask volume, Delta, imbalances, volume bubbles, bar statistics, and Tape speed stay aligned to the exact candle and price where the activity occurred.',
    details: ['Bid x ask volume', 'Delta and imbalance', 'Bar statistics'],
  },
  {
    id: 'liquidation-heatmap',
    image: '/newshowcase/liqheatmap.png',
    alt: 'TradeNet liquidation heatmap with observed long and short liquidation events',
    label: 'Liquidations',
    title: 'Track leverage before and after it breaks.',
    body: 'Estimated liquidation structure and observed liquidation prints share the chart, making it easier to see where leveraged positioning is concentrated and where it actually unwinds.',
    details: ['Liquidation heatmap', 'Observed events', 'Long and short flow'],
  },
  {
    id: 'tpo',
    image: '/newshowcase/TPO.png',
    alt: 'TradeNet TPO profile showing session value areas, point of control, and initial balance',
    label: 'TPO',
    title: 'Follow the auction session by session.',
    body: 'TPO profiles place each session\'s distribution, point of control, value area, and initial balance directly against price for clear auction-market context.',
    details: ['Session profiles', 'POC, VAH, and VAL', 'Initial balance'],
  },
  {
    id: 'lua',
    image: '/newshowcase/luaalgo.png',
    alt: 'TradeNet Lua editor beneath a chart running a custom market-structure algorithm',
    label: 'Lua and algorithms',
    title: 'Build market logic inside the terminal.',
    body: 'Write, validate, and run custom Lua indicators against terminal-owned data. Keep the editor, diagnostics, logs, and chart output in the same workspace.',
    details: ['Integrated Lua editor', 'Terminal data taps', 'Chart output and logs'],
  },
]

export default function TerminalTeaserSection() {
  const ref = useRef(null)
  const [activeId, setActiveId] = useState(productViews[0].id)
  const inView = useInView(ref, { once: true, margin: '-90px' })
  const activeView = productViews.find((view) => view.id === activeId) ?? productViews[0]

  return (
    <section id="terminal-showcase" ref={ref} className="tn-products">
      <div className="tn-container">
        <motion.header
          className="tn-section-heading"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div>
            <h2>See the current terminal in full.</h2>
          </div>
          <p>Start with the six-pane canvas, then open the individual orderflow, profile, and research tools that make up the desk.</p>
        </motion.header>

        <motion.div
          className="tn-product-explorer"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, delay: 0.08 }}
        >
          <div id="features" className="tn-product-tabs" role="tablist" aria-label="Terminal features">
            {productViews.map((view, index) => {
              const selected = activeView.id === view.id
              return (
                <button
                  key={view.id}
                  id={`terminal-tab-${view.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="terminal-view-panel"
                  className={selected ? 'is-active' : ''}
                  onClick={() => setActiveId(view.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{view.label}</strong>
                  <small>{view.title}</small>
                </button>
              )
            })}
          </div>

          <div className="tn-product-content">
            <div
              id="terminal-view-panel"
              className="tn-product-screen"
              role="tabpanel"
              aria-labelledby={`terminal-tab-${activeView.id}`}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeView.id}
                  src={activeView.image}
                  alt={activeView.alt}
                  loading={activeView.id === 'full-desk' ? 'eager' : 'lazy'}
                  initial={{ opacity: 0, scale: 1.01 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                />
              </AnimatePresence>
              <div className="tn-product-screen-meta" aria-hidden="true">
                <span>TradeNet Terminal</span>
                <span>Desktop beta</span>
              </div>
            </div>

            <div className="tn-product-detail">
              <div>
                <h3>{activeView.title}</h3>
              </div>
              <p>{activeView.body}</p>
              <ul>
                {activeView.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
