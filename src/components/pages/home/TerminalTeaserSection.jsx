import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Layers, Target, Zap, LayoutGrid } from 'lucide-react'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

const showcasePanels = [
  {
    icon:   Layers,
    title:  'Trading + Risk Controls',
    body:   'Bitunix execution controls sit beside the chart, with position monitoring, order history, TP/SL, and reduce-only controls in the same workspace.',
    image:  '/tradinghero.png',
    alt:    'TradeNet trading workspace with order controls',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.15)',
  },
  {
    icon:   Target,
    title:  'Liquidations + Footprint',
    body:   'Server-owned liquidation heatmap levels and live liquidation bubbles pair with footprint volume, delta, CVD, and OI context.',
    image:  '/liqheatmap & footprint.png',
    alt:    'TradeNet liquidation heatmap and footprint workspace',
    accent: '#c9a84c',
    bg:     'rgba(201,168,76,0.08)',
    border: 'rgba(201,168,76,0.15)',
  },
  {
    icon:   Zap,
    title:  'OB Heatmap + Depth',
    body:   'Orderbook heatmaps show resting liquidity over time while the depth panel keeps per-exchange, aggregate, and proxy data modes explicit.',
    image:  '/obheatmap & dom.png',
    alt:    'TradeNet orderbook heatmap and aggregated depth workspace',
    accent: '#22C55E',
    bg:     'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.15)',
  },
  {
    icon:   LayoutGrid,
    title:  'Tauri Workspace',
    body:   'A Rust-owned desktop shell handles trusted native state while the web UI owns the charting, DOM, tape, panels, and interaction layer.',
    image:  '/hero.png',
    alt:    'TradeNet multi-panel terminal workspace',
    accent: '#A78BFA',
    bg:     'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.15)',
  },
]

export default function TerminalTeaserSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section
      ref={ref}
      className="py-28 bg-black border-y border-white/[0.04] relative overflow-hidden"
    >
      <div
        className="absolute top-0 right-0 w-[500px] h-[400px] opacity-[0.04] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #c9a84c, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="section-container relative">
        <motion.div
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12"
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <div>
            <span className="eyebrow-gold mb-4 block w-fit">Launching soon - TradeNet Terminal</span>
            <h2 className="text-[clamp(28px,3.8vw,48px)] font-black tracking-[-0.03em] text-[#FAFAFA] leading-[1.08]">
              A trading terminal built<br />
              <span className="gradient-text-gold">from the ground up.</span>
            </h2>
          </div>
          <button
            onClick={() => navigate('/terminal')}
            className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-[#c9a84c] hover:text-[#f0c040] transition-colors group"
          >
            See full details
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>

        <motion.figure
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="rounded-[22px] border border-white/[0.08] bg-[#050506] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        >
          <img
            src="/hero.png"
            alt="TradeNet Terminal multi-panel workspace"
            className="w-full aspect-[1920/1030] object-contain rounded-[16px]"
            loading="lazy"
          />
        </motion.figure>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showcasePanels.map(({ icon: Icon, title, body, image, alt, accent, bg, border }, i) => (
            <motion.article
              key={title}
              className="grid grid-cols-1 xl:grid-cols-[1.18fr_0.82fr] gap-4 items-stretch rounded-[22px] border border-white/[0.07] bg-[#050506] p-2"
              variants={fadeUp}
              custom={i + 2}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
            >
              <img
                src={image}
                alt={alt}
                className="w-full h-full min-h-[210px] object-contain rounded-[16px] bg-black"
                loading="lazy"
              />
              <div className="flex flex-col justify-center gap-3 p-4 sm:p-5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#FAFAFA] mb-1">{title}</p>
                  <p className="text-xs text-[#71717A] leading-relaxed">{body}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-white/[0.04]"
          variants={fadeUp}
          custom={7}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <button
            onClick={() => navigate('/terminal')}
            className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Join Launch Waitlist
            <ArrowRight size={14} />
          </button>
          <p className="text-sm text-[#52525B]">
            Pricing is paused while beta launch access is staged.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
