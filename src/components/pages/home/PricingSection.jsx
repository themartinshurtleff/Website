import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Bell, CheckCircle2, Clock, ShieldCheck, UserPlus } from 'lucide-react'
import WaitlistForm from '@/components/common/WaitlistForm'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

const launchSteps = [
  {
    icon: Bell,
    title: 'Join the waitlist',
    body: 'We are collecting launch interest before opening public paid plans.',
  },
  {
    icon: UserPlus,
    title: 'Create an account',
    body: 'Accounts stay open, so beta access can be attached to the same login used in the terminal.',
  },
  {
    icon: ShieldCheck,
    title: 'Access is gated',
    body: 'Supabase entitlements remain server-side; the terminal checks access before protected requests run.',
  },
]

const included = [
  'Launch notifications before public purchase links return',
  'Priority beta onboarding for selected traders',
  'Account-based terminal access when your invite is approved',
  'No early checkout or surprise charge while launch access is paused',
]

export default function PricingSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section id="pricing" className="py-28 bg-black relative overflow-hidden" ref={ref}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(201,168,76,0.06), transparent 70%)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent" />

      <div className="section-container relative">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-14 items-center"
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          <motion.div className="space-y-7" variants={fadeUp} custom={0}>
            <span className="eyebrow-gold">
              <Clock size={13} />
              Launching Soon
            </span>

            <div className="space-y-4">
              <h2 className="text-[clamp(34px,4.6vw,58px)] font-black tracking-[-0.035em] leading-[1.04]">
                <span className="text-[#FAFAFA]">Pricing is paused.</span><br />
                <span className="gradient-text-gold">Launch access opens next.</span>
              </h2>
              <p className="text-[16px] text-[#A1A1AA] leading-[1.75] max-w-xl">
                We are holding checkout while the terminal moves into beta launch readiness.
                Join the waitlist now and we will notify you when controlled access opens.
              </p>
            </div>

            <div className="max-w-xl">
              <WaitlistForm source="launch_waitlist" />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/signup')}
                className="btn-outline inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px]"
              >
                Create Account
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => navigate('/terminal')}
                className="inline-flex items-center gap-2 text-[#c9a84c] hover:text-[#f0c040] font-semibold text-[14px] transition-colors"
              >
                View terminal details
                <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={1}>
            <div
              className="rounded-[20px] border border-[#c9a84c]/25 bg-[#09090B] overflow-hidden"
              style={{ boxShadow: '0 0 44px rgba(201,168,76,0.08)' }}
            >
              <div className="p-6 sm:p-8 border-b border-white/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#c9a84c] mb-2">
                      Beta Launch Status
                    </p>
                    <h3 className="text-2xl font-black text-[#FAFAFA] tracking-[-0.02em]">
                      Waitlist-first rollout
                    </h3>
                  </div>
                  <span className="w-fit rounded-full bg-[#c9a84c] text-black text-[11px] font-black uppercase tracking-widest px-3 py-1.5">
                    Checkout closed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-white/[0.06]">
                {launchSteps.map(({ icon: Icon, title, body }, i) => (
                  <div key={title} className="p-6 border-white/[0.06] sm:border-r last:border-r-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#c9a84c]/10 border border-[#c9a84c]/20 mb-4">
                      <Icon size={17} className="text-[#c9a84c]" />
                    </div>
                    <p className="text-sm font-bold text-[#FAFAFA] mb-2">{title}</p>
                    <p className="text-xs text-[#71717A] leading-relaxed">{body}</p>
                    <p className="text-[10px] text-[#3F3F46] mt-4 font-semibold uppercase tracking-wider">
                      Step {i + 1}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-6 sm:p-8">
                <p className="text-sm font-bold text-[#FAFAFA] mb-4">What joining gets you</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {included.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#A1A1AA] leading-relaxed">
                      <CheckCircle2 size={15} className="text-[#c9a84c] flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
