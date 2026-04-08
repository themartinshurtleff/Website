import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { BookOpen, ArrowRight } from 'lucide-react'

export default function HandguideSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-black border-y border-white/[0.04]" ref={ref}>
      <div className="section-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">
          {/* Text */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">Free & Exclusive Guide</span>
            <h2 className="text-[clamp(28px,3.5vw,44px)] font-black tracking-[-0.03em] leading-[1.1]">
              <span className="text-[#FAFAFA]">Your Ultimate</span><br />
              <span className="gradient-text-gold">Crypto Futures Handguide</span>
            </h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[1.75] max-w-md">
              Our super-solid 90-page handguide contains literally everything you need to know about how to trade crypto
              futures. Written by traders, for traders — no fluff, no filler.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
                <BookOpen size={15} className="text-[#c9a84c]" />
              </div>
              <span className="text-sm text-[#A1A1AA]">90 pages of institutional-grade education</span>
            </div>
            <a
              href="https://whop.com/joined/tradenet/products/tradenet-starter/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px]"
            >
              Access for Free
              <ArrowRight size={15} />
            </a>
          </motion.div>

          {/* Book visual */}
          <motion.div
            className="relative flex justify-center lg:justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative">
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #c9a84c, transparent 60%)', filter: 'blur(50px)' }}
              />
              <img
                src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/332a3dbc236387758b1e6b6fd0211701.png"
                alt="Crypto Futures Handguide"
                className="relative w-full max-w-[340px] h-auto rounded-2xl object-cover shadow-2xl"
                style={{ transform: 'perspective(1000px) rotateY(5deg) rotateX(-2deg)' }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
