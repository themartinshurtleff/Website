import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Layers, Target, Zap, LayoutGrid, CheckCircle2, Check, X as XIcon,
} from 'lucide-react'
import AuroraBackground from '@/components/common/AuroraBackground'
import WaitlistForm from '@/components/common/WaitlistForm'
import ImagePlaceholder from '@/components/common/ImagePlaceholder'

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const valueProps = [
  {
    icon: Layers,
    title: '4 Exchanges, 1 View',
    body:  'Aggregated orderflow from Binance, Bybit, OKX, and Hyperliquid — unified into a single footprint chart. True price discovery.',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.18)',
  },
  {
    icon: Target,
    title: 'Liquidation Prediction',
    body:  'Not just historical data — predict where liquidations will cluster before they happen. Proprietary server-side algorithm, real-time.',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.18)',
  },
  {
    icon: Zap,
    title: 'Native Performance',
    body:  'Built in Rust. GPU-accelerated via wgpu. Handles thousands of trades per second without a stutter — no Electron, no browser overhead.',
    accent: '#22C55E',
    bg:     'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.18)',
  },
  {
    icon: LayoutGrid,
    title: 'Professional Toolkit',
    body:  'Footprint charts, DOM ladder, time & sales, liquidation heatmap, orderbook heatmap. Every tool a serious futures trader needs.',
    accent: '#A78BFA',
    bg:     'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.18)',
  },
]

const features = [
  {
    eyebrow: 'Flagship Chart',
    title:   'Footprint Charts Built for Crypto Futures',
    body:    'Price-grouped, interval-aggregated trade data overlaid on OHLC candlesticks. Three cluster modes — Bid/Ask, Volume Profile, and Delta Profile — give you a complete picture of how volume is distributed at each price level.',
    bullets: [
      'Bid/Ask, Volume Profile, and Delta Profile modes',
      'Imbalance highlighting — stacked and diagonal',
      'Naked Point of Control (POC) detection',
      '9-row Bar Statistics panel',
      '24H CVD and OI CVD (server-computed)',
      'Liquidation data per candle',
    ],
    placeholder: 'Footprint Chart',
    reverse: false,
  },
  {
    eyebrow: 'Unique to TradeNet',
    title:   'Multi-Exchange Aggregation — See the Real Market',
    body:    "Most terminals show you one exchange. TradeNet's AGGREGATED ticker combines live orderflow from all four major crypto futures exchanges into a single unified view. No other desktop terminal does this.",
    bullets: [
      'Binance, Bybit, OKX, and Hyperliquid — all in one feed',
      'BTC, ETH, and SOL supported across exchanges',
      'Aggregated 24H CVD and Open Interest CVD',
      'Switch between per-exchange and aggregated view instantly',
    ],
    placeholder: 'Aggregated Orderflow',
    reverse: true,
  },
  {
    eyebrow: 'Proprietary Intelligence',
    title:   'Liquidation Prediction — Before It Happens',
    body:    'Most tools show you where liquidations already occurred. TradeNet predicts where they will cluster — in real time, server-side, using proprietary algorithms. Combined with a 12-hour historical heatmap, you see the full picture.',
    bullets: [
      '12-hour historical liquidation grid overlay',
      'Live cluster level prediction with USD notional',
      'Aggregated across Binance, Bybit, and OKX',
      'Configurable minimum notional filter',
    ],
    placeholder: 'Liquidation Heatmap',
    reverse: false,
  },
  {
    eyebrow: 'Market Depth',
    title:   'Orderbook Heatmap & DOM Ladder',
    body:    '30-second resolution, 12-hour historical orderbook heatmap lets you see where large resting orders have sat and moved. Paired with a real-time DOM ladder showing L2 depth with trade volume overlay.',
    bullets: [
      'p50 / p95 percentile normalization for clean rendering',
      'Large resting orders rendered as colored bands',
      'Real-time L2 depth with recent trade volume overlay',
      'Grouped price levels and configurable tick size',
    ],
    placeholder: 'Orderbook Heatmap',
    reverse: true,
  },
  {
    eyebrow: 'Workspace',
    title:   'Built for Multi-Monitor Power-User Setups',
    body:    "Pop any pane into its own window. Arrange charts and panels in any grid configuration. Link groups keep multiple panes in sync — switch one ticker and every linked view updates instantly.",
    bullets: [
      'Pop-out any pane to its own window',
      'Pane grid — split into any arrangement',
      'Link groups A–I for instant ticker sync',
      'Named layouts — save, load, clone, and restore',
    ],
    placeholder: 'Workspace Layout',
    reverse: false,
  },
]

const techSpecs = [
  { key: 'Language',   val: 'Rust 2024',              desc: 'Memory-safe, zero-cost abstractions, no GC pauses' },
  { key: 'GUI',        val: 'Iced 0.13+',             desc: 'Daemon mode, native multi-window desktop' },
  { key: 'Rendering',  val: 'wgpu (GPU)',              desc: 'All charts GPU-accelerated via canvas::Program' },
  { key: 'Async',      val: 'Tokio',                  desc: 'Concurrent WebSocket streams via Iced subscriptions' },
  { key: 'WebSocket',  val: 'rustls + tungstenite',   desc: 'Custom TLS, exchange-direct data feeds' },
  { key: 'Platform',   val: 'Win · macOS · Linux',    desc: 'True native — no Electron, no browser runtime' },
]

const compareRows = [
  { feature: 'Multi-exchange aggregation', tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Crypto-native',             tn: true,  bm: 'Partial', atas: 'Partial', tv: true  },
  { feature: 'Liquidation prediction',    tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Native desktop app',        tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'GPU-accelerated rendering', tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Aggregated OI / CVD',       tn: true,  bm: false, atas: false,  tv: false  },
  { feature: 'Footprint charts',          tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'DOM ladder',               tn: true,  bm: true,  atas: true,   tv: false  },
  { feature: 'Free during beta',          tn: true,  bm: false, atas: false,  tv: 'Partial' },
]

function Cell({ val }) {
  if (val === true)      return <span className="text-[#22C55E]"><Check size={15} className="inline" /></span>
  if (val === false)     return <span className="text-[#3F3F46]"><XIcon size={14} className="inline" /></span>
  return <span className="text-[#71717A] text-xs">{val}</span>
}

// ─── Section components ───────────────────────────────────────────────────────
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
  const { eyebrow, title, body, bullets, placeholder, reverse } = feature

  return (
    <section
      ref={ref}
      className={`py-24 ${index % 2 === 0 ? 'bg-black' : 'bg-black'} border-t border-white/[0.04]`}
    >
      <div className="section-container">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-20 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
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
              src="/hero.png"
              alt={placeholder}
              className="w-full rounded-[20px] border border-white/[0.07] object-cover"
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
            The only terminal built for crypto.
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TerminalPage() {
  const heroRef    = useRef(null)
  const heroInView = useInView(heroRef, { once: true })

  return (
    <main className="bg-black">

      {/* ── Hero ── */}
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

        <div className="relative section-container py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center">
            {/* Left — copy */}
            <div className="space-y-8">
              <motion.div
                variants={fadeUp}
                custom={0}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
              >
                <span className="eyebrow-gold">v0.8.6 — Closed Beta</span>
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
                  Every Exchange.<br />
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
                into a single footprint chart. With proprietary liquidation prediction and GPU-accelerated
                rendering built in Rust — no browser, no lag, no compromises.
              </motion.p>

              <motion.div
                variants={fadeUp}
                custom={3}
                initial="hidden"
                animate={heroInView ? 'visible' : 'hidden'}
              >
                <WaitlistForm />
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
                  { val: '3,000+',    label: 'Symbols' },
                  { val: 'Real-Time', label: 'Prediction' },
                  { val: 'Native',    label: 'Desktop' },
                ].map(({ val, label }) => (
                  <div key={label} className="flex flex-col items-center justify-center gap-1 py-4 px-2 bg-[#0e0e10]">
                    <span className="text-base font-black tracking-tight gradient-text-gold text-center leading-tight">{val}</span>
                    <span className="text-[10px] text-[#71717A] text-center leading-tight">{label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — hero image placeholder */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={heroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src="/hero.png"
                alt="TradeNet Terminal"
                className="w-full rounded-[20px] border border-white/[0.07] shadow-2xl object-cover"
                style={{ aspectRatio: '16/9' }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Value props ── */}
      <ValueProps />

      {/* ── Feature deep-dives ── */}
      {features.map((f, i) => (
        <FeatureRow key={f.title} feature={f} index={i} />
      ))}

      {/* ── Tech specs ── */}
      <TechSpecs />

      {/* ── Comparison table ── */}
      <ComparisonTable />

      {/* ── Bottom waitlist CTA ── */}
      <section
        id="terminal-waitlist"
        className="py-32 bg-black border-t border-white/[0.04] relative overflow-hidden"
      >
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(201,168,76,0.05), transparent 70%)',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent" />

        <div className="section-container relative">
          <div className="max-w-xl">
            <span className="eyebrow-gold mb-6 inline-block">Closed Beta</span>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-black tracking-[-0.035em] leading-[1.06] mb-5">
              <span className="text-[#FAFAFA]">Get early access to</span><br />
              <span className="gradient-text-gold">Quantum Terminal</span>
            </h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[1.75] mb-8 max-w-md">
              We're onboarding a limited number of professional traders. Join the waitlist and
              we'll reach out when a spot opens.
            </p>

            <ul className="space-y-2.5 mb-8">
              {[
                'Free during the beta period',
                'Direct feedback channel with the team',
                'Early access to new features',
                'Windows, macOS, and Linux builds',
              ].map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-sm text-[#A1A1AA]">
                  <CheckCircle2 size={14} className="text-[#c9a84c] flex-shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>

            <WaitlistForm />

            {/* Social proof */}
            <p className="text-xs text-[#3F3F46] mt-8 pt-6 border-t border-white/[0.04]">
              Joining 1,000+ traders already in the TradeNet community
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
