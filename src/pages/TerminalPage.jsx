import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  Layers, Target, Zap, LayoutGrid, CheckCircle2, Check, ArrowRight, X as XIcon,
} from 'lucide-react'
import AuroraBackground from '@/components/common/AuroraBackground'

// Animation helpers
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

// Data
const valueProps = [
  {
    icon: Layers,
    title: 'Aggregated Core Markets',
    body: 'BTC, ETH, and SOL views route across Binance, Bybit, OKX, and Hyperliquid where the terminal supports true aggregate data.',
    accent: '#c9a84c',
    bg: 'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.18)',
  },
  {
    icon: Target,
    title: 'Liquidation Intelligence',
    body: 'Server-owned liquidation heatmaps, live liquidation rows, and notional filters surface forced-flow context around price.',
    accent: '#c9a84c',
    bg: 'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.18)',
  },
  {
    icon: Zap,
    title: 'Tauri Desktop Core',
    body: 'A Rust-owned desktop shell protects credentials and trusted state while the web UI owns fast chart, DOM, tape, and workspace rendering.',
    accent: '#22C55E',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.18)',
  },
  {
    icon: LayoutGrid,
    title: 'Orderflow Toolkit',
    body: 'Footprint charts, DOM ladder, time and sales, liquidation heatmap, orderbook heatmap, Lua scripts, and workspace templates.',
    accent: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.18)',
  },
]

const features = [
  {
    eyebrow: 'Execution Surface',
    title: 'Trading Controls Stay Inside the Terminal',
    body: 'The trading workspace connects chart context to Bitunix execution controls, position monitoring, and order management while the Tauri shell keeps trusted state, credentials, and trading commands Rust-owned.',
    bullets: [
      'Bitunix trading integration staged behind beta access',
      'Order ticket, leverage, margin, TP/SL, and reduce-only controls',
      'Positions, open orders, order history, and trade history in the bottom dock',
      'Rust-owned secure state for credentials, sessions, and trading actions',
    ],
    placeholder: 'TradeNet trading workspace',
    imageSrc: '/tradinghero.png',
    reverse: false,
  },
  {
    eyebrow: 'Core Market View',
    title: 'Multi-Exchange Aggregation for BTC, ETH, and SOL',
    body: "TradeNet's aggregated views focus on the core futures markets first: Binance, Bybit, OKX, and Hyperliquid coverage for BTC, ETH, and SOL where aggregate routes are supported.",
    bullets: [
      'Aggregated candles, trades, volume, and footprint data from aggr-server',
      'Backend-owned OI, OI CVD, liquidation events, and heatmap routes',
      'Per-exchange and aggregate data modes are labeled separately',
      'Workspace templates pair charts with DOM and Time & Sales panes',
    ],
    placeholder: 'Aggregated orderflow workspace',
    imageSrc: '/hero.png',
    reverse: true,
  },
  {
    eyebrow: 'Liquidations + Footprint',
    title: 'Liquidation Heatmap With Footprint Confirmation',
    body: 'The liquidation workspace pairs server-side liquidation heatmap levels and live liquidation bubbles with a footprint pane, so sweep zones can be checked against actual bid/ask volume, delta, CVD, and OI context.',
    bullets: [
      'Historical liquidation heatmap overlays with USD notional filters',
      'Live long and short liquidation bubbles on the chart',
      'Footprint panes expose bid/ask volume, delta, CVD, and OI indicators',
      'Backend owns liquidation rows, OI, OI CVD, and heatmap data',
    ],
    placeholder: 'Liquidation heatmap and footprint workspace',
    imageSrc: '/liqheatmap & footprint.png',
    reverse: false,
  },
  {
    eyebrow: 'Market Depth',
    title: 'Orderbook Heatmap and True Aggregated Depth',
    body: 'Orderbook heatmap views show where resting liquidity sits and moves, while the depth panel is designed around explicit per-exchange, aggregate, or proxy labels so traders know exactly what feed they are reading.',
    bullets: [
      'OB heatmap rendering uses noise filtering and scaled intensity for readability',
      'Depth ladders separate Binance, Bybit, OKX, and Hyperliquid columns',
      'True aggregated DOM and Tape routes live in aggr-server while frontend integration is staged',
      'Temporary proxy paths must be labeled instead of shown as aggregate data',
    ],
    placeholder: 'Orderbook heatmap and aggregated DOM workspace',
    imageSrc: '/obheatmap & dom.png',
    reverse: true,
  },
  {
    eyebrow: 'Workspace',
    title: 'Workspace Layouts for Real Orderflow Work',
    body: 'The terminal is built around a Tauri desktop shell with a web UI dedicated to layout, chrome, chart interaction, DOM, tape, settings panels, and high-frequency canvas/WebGL rendering.',
    bullets: [
      'Chart styles include candlestick, footprint, heatmap, comparison, DOM, and Time & Sales workflows',
      'Templates include one-chart, split, grid, focus, and Flow Desk layouts',
      'Web UI owns visual surfaces while Rust owns trusted native integration',
      'Lua scripts read pane-loaded data rather than querying backend routes directly',
    ],
    placeholder: 'Workspace layout',
    imageSrc: '/hero.png',
    reverse: false,
  },
]

const techSpecs = [
  { key: 'Shell',        val: 'Tauri v2',                desc: 'Native desktop packaging, updater path, windows, filesystem, and secure host integration' },
  { key: 'Trusted Core', val: 'Rust services',           desc: 'Credentials, auth/session handling, trading commands, persistence, logs, and native bridges stay Rust-owned' },
  { key: 'UI',           val: 'React + TypeScript',      desc: 'Workspace chrome, pane controls, modals, settings, chart interaction, DOM, and tape surfaces' },
  { key: 'Rendering',    val: 'Canvas/WebGL path',       desc: 'High-frequency chart, footprint, heatmap, and orderflow views are built for measured rendering load' },
  { key: 'Scripting',    val: 'Lua IDE + data taps',     desc: 'Monaco-based Lua authoring with pane-local access to loaded footprint, heatmap, tape, L1, OI, and liquidation state' },
  { key: 'Data Routing', val: 'Backend + aggr-server',   desc: 'Python owns OI, liquidations, and heatmaps; aggr-server owns aggregated trades, klines, footprints, DOM, and tape' },
]

const compareRows = [
  { feature: 'Multi-exchange aggregation', tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Crypto-native',             tn: true,  bm: 'Partial', atas: 'Partial', tv: true  },
  { feature: 'Liquidation heatmap + events', tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Native desktop app',        tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'Freeform pane canvas',      tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Aggregated OI / CVD',       tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'In-terminal Lua IDE',       tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Footprint charts',          tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'DOM ladder',               tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'Direct beta access',        tn: true,  bm: false, atas: false,  tv: false },
]

function Cell({ val }) {
  if (val === true)      return <span className="text-[#22C55E]"><Check size={15} className="inline" /></span>
  if (val === false)     return <span className="text-[#3F3F46]"><XIcon size={14} className="inline" /></span>
  return <span className="text-[#71717A] text-xs">{val}</span>
}

// Section components
function ValueProps() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-black" ref={ref}>
      <div className="section-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {valueProps.map(({ icon: Icon, title, body, accent, bg, border }, i) => (
            <motion.div
              key={title}
              className="bento-card p-6 flex flex-col gap-4"
              variants={fadeUp}
              custom={i}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Icon size={18} style={{ color: accent }} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#FAFAFA] mb-1.5">{title}</h3>
                <p className="text-sm text-[#71717A] leading-relaxed">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ feature, index }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const { eyebrow, title, body, bullets, placeholder, imageSrc, reverse } = feature
  const layoutClass = reverse
    ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:[&>*:first-child]:order-2'
    : 'lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]'

  return (
    <section
      ref={ref}
      className={`py-28 ${index % 2 === 0 ? 'bg-black' : 'bg-black'} border-t border-white/[0.04]`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className={`grid grid-cols-1 gap-12 xl:gap-16 items-center ${layoutClass}`}>
          {/* Text */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: reverse ? 20 : -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow-gold">{eyebrow}</span>
            <h2 className="text-[clamp(26px,3.2vw,40px)] font-black tracking-[-0.03em] text-[#FAFAFA] leading-[1.1]">
              {title}
            </h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[1.75]">{body}</p>
            <ul className="space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-[#A1A1AA]">
                  <CheckCircle2 size={14} className="text-[#c9a84c] flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? -20 : 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src={imageSrc}
              alt={placeholder}
              className="w-full rounded-[22px] border border-white/[0.08] object-contain bg-[#050506] shadow-2xl"
              loading="lazy"
              style={{ aspectRatio: '16/9' }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function TechSpecs() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-black border-t border-white/[0.04]" ref={ref}>
      <div className="section-container">
        <motion.div
          className="mb-12"
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <span className="eyebrow-gold mb-4 block w-fit">Under the Hood</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-black tracking-[-0.03em] text-[#FAFAFA]">
            Zero-compromise architecture
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {techSpecs.map(({ key, val, desc }, i) => (
            <motion.div
              key={key}
              className="bento-card p-5 space-y-1.5"
              variants={fadeUp}
              custom={i + 1}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-[#3F3F46]">{key}</p>
              <p className="text-[15px] font-bold text-[#FAFAFA]">{val}</p>
              <p className="text-xs text-[#71717A] leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ComparisonTable() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-black border-t border-white/[0.04]" ref={ref}>
      <div className="section-container">
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
        >
          <span className="eyebrow-gold mb-4 block w-fit">How We Compare</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-black tracking-[-0.03em] text-[#FAFAFA]">
            Built for crypto orderflow.
          </h2>
        </motion.div>

        <motion.div
          className="bento-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <div className="overflow-x-auto">
            <table className="compare-table w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-widest text-[#71717A]">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-[#c9a84c] compare-col-highlight">
                    TradeNet
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-[#71717A]">
                    Bookmap
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-[#71717A]">
                    ATAS
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-[#71717A]">
                    TradingView
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(({ feature, tn, bm, atas, tv }) => (
                  <tr key={feature}>
                    <td className="px-6 py-3.5 text-sm text-[#A1A1AA] text-left">{feature}</td>
                    <td className="px-6 py-3.5 text-center compare-col-highlight"><Cell val={tn} /></td>
                    <td className="px-6 py-3.5 text-center"><Cell val={bm} /></td>
                    <td className="px-6 py-3.5 text-center"><Cell val={atas} /></td>
                    <td className="px-6 py-3.5 text-center"><Cell val={tv} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// Main page
export default function TerminalPage() {
  const heroRef    = useRef(null)
  const heroInView = useInView(heroRef, { once: true })

  return (
    <main className="bg-black">

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden bg-black pt-20"
      >
        <AuroraBackground />

        {/* Edge vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, #09090B 100%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[0.86fr_1.14fr] gap-10 xl:gap-14 items-center">
            {/* Left copy */}
            <div className="space-y-8">
              <motion.div
                variants={fadeUp}
                custom={0}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
              >
                <span className="eyebrow-gold">Public Beta Access</span>
              </motion.div>

              <motion.div
                className="space-y-3"
                variants={fadeUp}
                custom={1}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
              >
                <h1 className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.01] tracking-[-0.04em] text-[#FAFAFA]">
                  Professional Orderflow.<br />
                  Core Futures Markets.<br />
                  <span className="gradient-text-gold">One Terminal.</span>
                </h1>
              </motion.div>

              <motion.p
                variants={fadeUp}
                custom={2}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
                className="text-[17px] text-[#A1A1AA] leading-[1.75] max-w-[500px]"
              >
                TradeNet Quantum aggregates live orderflow from Binance, Bybit, OKX, and Hyperliquid
                into a single terminal. The new Tauri architecture keeps credentials and trusted
                actions in Rust while the UI focuses on fast charts, panes, Lua tools, DOM, and tape.
              </motion.p>

              <motion.div
                variants={fadeUp}
                custom={3}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
                className="flex flex-wrap gap-3"
              >
                <Link to="/pricing" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold">
                  View beta pricing <ArrowRight size={15} />
                </Link>
                <Link to="/signup?return=%2Fpricing" className="btn-outline inline-flex items-center px-6 py-3 rounded-md text-sm font-semibold">
                  Create account
                </Link>
              </motion.div>

              {/* Stats row */}
              <motion.div
                variants={fadeUp}
                custom={4}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
                className="grid grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05] max-w-md"
              >
                {[
                  { val: 'Multi',     label: 'Exchange' },
                  { val: 'BTC ETH SOL', label: 'Core' },
                  { val: 'Real-Time', label: 'Heatmaps' },
                  { val: 'Tauri',     label: 'Desktop' },
                ].map(({ val, label }) => (
                  <div key={label} className="flex flex-col items-center justify-center gap-1 py-4 px-2 bg-[#0e0e10]">
                    <span className="text-base font-black tracking-tight gradient-text-gold text-center leading-tight">{val}</span>
                    <span className="text-[10px] text-[#71717A] text-center leading-tight">{label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right hero image */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={heroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src="/herogif.gif"
                alt="TradeNet Quantum Terminal live orderflow workspace"
                className="w-full rounded-[22px] border border-white/[0.08] shadow-2xl object-contain object-center bg-[#050506]"
                loading="eager"
                style={{ aspectRatio: '16/9' }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <ValueProps />

      {/* Feature deep-dives */}
      {features.map((f, i) => (
        <FeatureRow key={f.title} feature={f} index={i} />
      ))}

      {/* Tech specs */}
      <TechSpecs />

      {/* Comparison table */}
      <ComparisonTable />

      {/* Bottom access CTA */}
      <section
        id="terminal-pricing"
        className="py-28 bg-black border-t border-white/[0.06]"
      >
        <div className="section-container grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-14 items-end">
          <div className="max-w-2xl">
            <span className="eyebrow-gold mb-6 inline-block">Beta Access</span>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-black leading-[1.06] mb-5">
              <span className="text-[#FAFAFA]">Use the full TradeNet terminal</span><br />
              <span className="gradient-text-gold">with one Pro account.</span>
            </h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[1.75] max-w-xl">
              Monthly and annual plans unlock the same terminal, market data, research tools, and paper-first execution workflow.
            </p>
          </div>
          <div>
            <ul className="space-y-2.5 mb-8">
              {[
                'One login across the website and desktop terminal',
                'Server-verified access on every protected request',
                'Monthly or annual billing through Stripe',
                'Original waitlist pricing matched by account email',
              ].map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-sm text-[#A1A1AA]">
                  <CheckCircle2 size={14} className="text-[#c9a84c] flex-shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>
            <Link to="/pricing" className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-md text-sm font-bold">
              Compare plans <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
