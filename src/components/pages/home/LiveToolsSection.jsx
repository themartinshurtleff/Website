import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { BarChart3, Braces, Layers3, Pause, Play } from 'lucide-react'

const revealGroup = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.12,
      staggerChildren: 0.12,
    },
  },
}

const revealCard = {
  hidden: { opacity: 0, y: 52, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
  },
}

const cardInteraction = {
  whileHover: { y: -8, scale: 1.012 },
  whileFocus: { y: -6, scale: 1.008 },
  transition: { type: 'spring', stiffness: 260, damping: 22 },
}

function setFocusPoint(event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = Math.min(94, Math.max(6, ((event.clientX - bounds.left) / bounds.width) * 100))
  const y = Math.min(92, Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100))
  event.currentTarget.style.setProperty('--focus-x', `${x}%`)
  event.currentTarget.style.setProperty('--focus-y', `${y}%`)
}

export default function LiveToolsSection() {
  const ref = useRef(null)
  const revealed = useInView(ref, { once: true, margin: '-90px' })
  const active = useInView(ref, { margin: '140px 0px 140px 0px' })
  const [heatmapFocused, setHeatmapFocused] = useState(false)
  const [heatmapPinned, setHeatmapPinned] = useState(false)
  const [footprintFocused, setFootprintFocused] = useState(false)
  const [footprintPinned, setFootprintPinned] = useState(false)
  const [replayPaused, setReplayPaused] = useState(false)

  function handlePreviewKey(event, setter) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setter((current) => !current)
  }

  return (
    <section ref={ref} className={`tn-live-tools${active ? ' is-active' : ''}`}>
      <div className="tn-container">
        <motion.header
          className="tn-live-tools-heading"
          initial={{ opacity: 0, y: 46, filter: 'blur(10px)' }}
          animate={revealed ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>Built for live orderflow analysis.</h2>
          <p>Heatmaps, Footprint, and Lua replay stay connected to the same chart, symbol, and saved workspace.</p>
        </motion.header>

        <motion.div
          className="tn-live-tools-grid"
          variants={revealGroup}
          initial="hidden"
          animate={revealed ? 'visible' : 'hidden'}
        >
          <motion.article
            className="tn-live-tool-card tn-live-tool-heatmap"
            variants={revealCard}
            tabIndex={0}
            {...cardInteraction}
          >
            <div className="tn-live-tool-copy">
              <div className="tn-live-tool-title">
                <span><Layers3 size={17} /></span>
                <h3>Aggregated heatmap</h3>
              </div>
              <p>Watch resting liquidity build, pull, and trade across supported venues while price moves through it.</p>
            </div>
            <div
              className={`tn-motion-visual tn-terminal-panel-preview tn-panel-heatmap${heatmapFocused || heatmapPinned ? ' is-focused' : ''}${heatmapPinned ? ' is-pinned' : ''}`}
              style={{ '--focus-x': '54%', '--focus-y': '56%' }}
              role="button"
              tabIndex={0}
              aria-label="Inspect and pin the orderbook heatmap"
              aria-pressed={heatmapPinned}
              onPointerEnter={() => setHeatmapFocused(true)}
              onPointerMove={(event) => { if (!heatmapPinned) setFocusPoint(event) }}
              onPointerLeave={() => { if (!heatmapPinned) setHeatmapFocused(false) }}
              onFocus={() => setHeatmapFocused(true)}
              onBlur={() => { if (!heatmapPinned) setHeatmapFocused(false) }}
              onClick={() => setHeatmapPinned((current) => !current)}
              onKeyDown={(event) => handlePreviewKey(event, setHeatmapPinned)}
            >
              <img
                src="/panel-previews/heatmap.webp"
                alt="TradeNet aggregated orderbook heatmap with crypto candles and liquidity"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <span className="tn-panel-crosshair" aria-hidden="true"><i /><b /></span>
            </div>
          </motion.article>

          <motion.article
            className="tn-live-tool-card tn-live-tool-footprint"
            variants={revealCard}
            tabIndex={0}
            {...cardInteraction}
          >
            <div className="tn-live-tool-copy">
              <div className="tn-live-tool-title">
                <span><BarChart3 size={17} /></span>
                <h3>Footprint + Delta</h3>
              </div>
              <p>Bid and ask volume update inside each candle with Delta, imbalance, POC, and bar statistics attached.</p>
            </div>
            <div
              className={`tn-motion-visual tn-terminal-panel-preview tn-panel-footprint${footprintFocused || footprintPinned ? ' is-focused' : ''}${footprintPinned ? ' is-pinned' : ''}`}
              style={{ '--focus-x': '62%', '--focus-y': '54%' }}
              role="button"
              tabIndex={0}
              aria-label="Inspect and pin the Footprint chart"
              aria-pressed={footprintPinned}
              onPointerEnter={() => setFootprintFocused(true)}
              onPointerMove={(event) => { if (!footprintPinned) setFocusPoint(event) }}
              onPointerLeave={() => { if (!footprintPinned) setFootprintFocused(false) }}
              onFocus={() => setFootprintFocused(true)}
              onBlur={() => { if (!footprintPinned) setFootprintFocused(false) }}
              onClick={() => setFootprintPinned((current) => !current)}
              onKeyDown={(event) => handlePreviewKey(event, setFootprintPinned)}
            >
              <img
                src="/panel-previews/footprint.webp"
                alt="TradeNet Footprint chart with purple sell volume, green buy volume, Delta, OI Delta, and POC rows"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <span className="tn-panel-crosshair" aria-hidden="true"><i /><b /></span>
            </div>
          </motion.article>

          <motion.article
            className="tn-live-tool-card tn-live-tool-replay"
            variants={revealCard}
            tabIndex={0}
            {...cardInteraction}
          >
            <div className="tn-live-tool-copy">
              <div className="tn-live-tool-title">
                <span><Braces size={17} /></span>
                <h3>Lua replay</h3>
              </div>
              <p>Run custom market logic against terminal data, then inspect the signals, chart output, and logs together.</p>
            </div>
            <div className={`tn-motion-visual tn-terminal-panel-preview tn-panel-lua${replayPaused ? ' is-manually-paused' : ''}`}>
              <img
                className="tn-lua-replay-base"
                src="/panel-previews/lua-replay-clean.png"
                alt="TradeNet chart and Lua editor before the custom indicator is applied"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <img
                className="tn-lua-replay-overlay"
                src="/panel-previews/lua-replay-indicator.png"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
              <span className="tn-panel-replay-head" aria-hidden="true" />
              <div className="tn-panel-replay-controls">
                <button
                  type="button"
                  className="tn-replay-play"
                  aria-label={replayPaused ? 'Resume Lua replay' : 'Pause Lua replay'}
                  onClick={() => setReplayPaused((current) => !current)}
                >
                  {replayPaused
                    ? <Play size={13} fill="currentColor" />
                    : <Pause size={13} fill="currentColor" />}
                </button>
                <span className="tn-replay-track" aria-hidden="true"><i /></span>
              </div>
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  )
}
