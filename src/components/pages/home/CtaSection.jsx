import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function CtaSection() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section className="py-28 bg-black relative overflow-hidden" ref={ref}>
      {/* Ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,168,76,0.04), transparent 70%)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/15 to-transparent" />

      <div className="section-container relative">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Community CTA */}
          <div className="bento-card p-8 space-y-5" style={{ background: '#000' }}>
            <span className="eyebrow">Community & Indicator</span>
            <h2 className="text-[clamp(24px,3vw,36px)] font-black tracking-[-0.03em] leading-[1.1]">
              <span className="text-[#FAFAFA]">Ready to Elevate</span><br />
              <span className="gradient-text-gold">Your Trading?</span>
            </h2>
            <p className="text-[15px] text-[#A1A1AA]">
              Join 1,000+ traders already using TradeNet to find consistent,
              high-probability setups every day.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://whop.com/joined/tradenet/products/tradenet-pro/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px]"
              >
                Get Access Now
                <ArrowRight size={15} />
              </a>
              <button
                onClick={() => navigate('/case-studies')}
                className="btn-outline inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px]"
              >
                See Reviews
              </button>
            </div>
          </div>

          {/* Terminal CTA */}
          <div
            className="bento-card p-8 space-y-5 relative overflow-hidden"
            style={{ borderColor: 'rgba(201,168,76,0.18)' }}
          >
            {/* Blue ambient */}
            <div
              className="absolute top-0 right-0 w-48 h-48 opacity-[0.08] pointer-events-none"
              style={{
                background: 'radial-gradient(circle, #c9a84c, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <span className="eyebrow-gold relative">Quantum Terminal</span>
            <h2 className="text-[clamp(24px,3vw,36px)] font-black tracking-[-0.03em] leading-[1.1] relative">
              <span className="text-[#FAFAFA]">Professional Orderflow.</span><br />
              <span className="gradient-text-gold">Every Exchange.</span>
            </h2>
            <p className="text-[15px] text-[#A1A1AA] relative">
              Multi-exchange aggregation, liquidation prediction, and GPU-accelerated
              performance. Built in Rust. Currently in closed beta.
            </p>
            <div className="relative">
              <button
                onClick={() => navigate('/terminal')}
                className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-[14px] px-6 py-3 rounded-xl transition-colors"
              >
                Join Terminal Waitlist
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
