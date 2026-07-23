import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const stages = [
  {
    number: '01',
    label: 'Market data',
    title: 'Read orderflow and market structure.',
    body: 'Build a multi-venue market view without moving between separate charting and analytics tools.',
    features: [
      ['Heatmaps', 'Liquidation and orderbook'],
      ['Footprint', 'Volume, Delta, imbalance'],
      ['Depth', 'DOM and live Tape'],
      ['Context', 'OI, CVD, VAP, profiles'],
    ],
  },
  {
    number: '02',
    label: 'Research',
    title: 'Build indicators and test the idea.',
    body: 'Write, validate, and replay your own market logic without exporting data into another application.',
    features: [
      ['Lua editor', 'Custom indicators and logs'],
      ['Data taps', 'Terminal data in scripts'],
      ['Light tests', 'Fast visible-range replay'],
      ['Deep tests', 'Broader strategy validation'],
    ],
  },
  {
    number: '03',
    label: 'Execution',
    title: 'Manage the trade in the same layout.',
    body: 'Keep the order, position, and original market context visible together while beta execution is validated.',
    features: [
      ['Chart orders', 'Place and manage visually'],
      ['Risk', 'TP, SL, reduce-only'],
      ['Strategies', 'Advanced order workflows'],
      ['Order Center', 'Positions and history'],
    ],
  },
]

export default function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="tn-system">
      <div className="tn-container">
        <motion.header
          className="tn-system-heading"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div>
            <p className="tn-kicker">Terminal workflow</p>
            <h2>Market data, research, and execution in one layout.</h2>
          </div>
          <p>TradeNet keeps the tools used to read, test, and manage a setup inside one saved desktop workspace.</p>
        </motion.header>

        <div className="tn-workflow-list">
          {stages.map((stage, index) => (
            <motion.article
              key={stage.number}
              initial={{ opacity: 0, x: index % 2 === 0 ? -18 : 18 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.62, delay: 0.1 + index * 0.1 }}
            >
              <div className="tn-stage-meta">
                <span className="tn-stage-number">{stage.number}</span>
                <p className="tn-stage-label">{stage.label}</p>
              </div>
              <div className="tn-stage-copy">
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
              <dl className="tn-stage-features">
                {stage.features.map(([name, detail]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            </motion.article>
          ))}
        </div>

        <motion.div
          className="tn-architecture"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.42 }}
        >
          <p>Native Tauri desktop shell. Canvas and WebGL market rendering. Saved workspaces and explicit data states.</p>
          <a href="/docs">
            Read the documentation
            <ArrowUpRight size={15} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
