import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'

const productViews = [
  {
    id: 'workspace',
    image: '/hero.png',
    alt: 'TradeNet multi-pane workspace with charts, depth, tape, and indicators',
    label: 'Workspace',
    title: 'The full desk stays visible.',
    body: 'Split panes, tab them, pop them out, or move into a freeform canvas. Save the layout and return to the same market context.',
    details: ['Saved layouts', 'Split and canvas panes', 'Pop-out windows'],
  },
  {
    id: 'depth',
    image: '/obheatmap & dom.png',
    alt: 'TradeNet orderbook heatmap and multi-venue depth ladder',
    label: 'Liquidity',
    title: 'Historical depth and the live book.',
    body: 'Orderbook heatmaps show where liquidity developed while the DOM keeps current depth and venue context beside price.',
    details: ['Orderbook heatmap', 'Multi-venue DOM', 'Aggregated depth'],
  },
  {
    id: 'liquidations',
    image: '/liqheatmap & footprint.png',
    alt: 'TradeNet liquidation heatmap beside a footprint chart',
    label: 'Orderflow',
    title: 'Leverage, volume, and Delta on price.',
    body: 'Liquidation structure, observed events, footprint volume, Delta, CVD, and OI remain attached to the chart where they matter.',
    details: ['Liquidation structure', 'Footprint and Delta', 'OI and CVD'],
  },
  {
    id: 'execution',
    image: '/tradinghero.png',
    alt: 'TradeNet trading workspace with chart orders and risk controls',
    label: 'Execution',
    title: 'The position stays beside the thesis.',
    body: 'Paper-first orders, chart overlays, TP and SL controls, advanced strategies, and the Order Center complete the workflow.',
    details: ['Paper-first trading', 'Chart orders', 'TP and SL controls'],
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
            <p className="tn-kicker">Current desktop build</p>
            <h2>Explore the terminal as it exists today.</h2>
          </div>
          <p>Every view below is from the current TradeNet desktop terminal. Select a workspace to inspect it at full size.</p>
        </motion.header>

        <motion.div
          className="tn-product-explorer"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, delay: 0.08 }}
        >
          <div className="tn-product-tabs" role="tablist" aria-label="Terminal views">
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
                loading={activeView.id === 'workspace' ? 'eager' : 'lazy'}
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
              <p className="tn-kicker">{activeView.label}</p>
              <h3>{activeView.title}</h3>
            </div>
            <p>{activeView.body}</p>
            <ul>
              {activeView.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
