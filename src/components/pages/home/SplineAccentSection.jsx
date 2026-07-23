import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function SplineAccentSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section
      ref={ref}
      className="bg-black py-20 border-t border-white/[0.04]"
    >
      <div className="section-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* Spline iframe — left side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
            style={{ height: '520px' }}
          >
            {/* Top + bottom fades so it blends into black bg */}
            <div
              className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black to-transparent pointer-events-none"
              style={{ zIndex: 1 }}
            />
            <div
              className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black to-transparent pointer-events-none"
              style={{ zIndex: 1 }}
            />
            <iframe
              src="https://my.spline.design/claritystream-YE8Qyl8eFduegZseCqQ3p844/"
              width="100%"
              height="100%"
              title="Clarity Stream 3D"
              style={{
                display: 'block',
                border: 'none',
                background: 'transparent',
                borderRadius: '1.25rem',
              }}
            />
          </motion.div>

          {/* Text — right side */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: 'none' }}
          >
            <span className="eyebrow">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
              Community & Education
            </span>

            <h2 className="text-[clamp(30px,4vw,52px)] font-black tracking-[-0.03em] leading-[1.08]">
              <span className="text-[#FAFAFA]">We Don't Just Give</span><br />
              <span className="gradient-text-gold">Signals. We Build</span><br />
              <span className="text-[#FAFAFA]">Real Traders.</span>
            </h2>

            <p className="text-[16px] text-[#A1A1AA] leading-[1.75] max-w-[420px]">
              From institutional-grade education to live trade breakdowns and 24/7 community
              support — TradeNet gives you the knowledge to make your own calls, not just
              follow someone else's.
            </p>

            <ul className="space-y-3">
              {[
                'Live trade setups with full rationale',
                'Exclusive education & trading streams',
                'Community of profitable traders',
                'Lessons from top analysts',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm text-[#A1A1AA]"
                >
                  <span className="w-1 h-1 rounded-full bg-[#c9a84c] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div style={{ pointerEvents: 'auto' }}>
              <button
                onClick={() => navigate('/pricing')}
                className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px]"
              >
                View Pro Pricing
                <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
