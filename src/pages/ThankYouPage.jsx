import { motion } from 'framer-motion'
import { CheckCircle2, BookOpen, Mic, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(201,168,76,0.06), transparent)' }}
      />

      <div className="relative w-full max-w-xl">
        {/* Checkmark */}
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="visible"
          className="flex justify-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#c9a84c]/10 border border-[#c9a84c]/25 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-[#c9a84c]" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="visible"
          className="text-[clamp(32px,5vw,48px)] font-black tracking-[-0.035em] leading-[1.06] text-center mb-3"
        >
          <span className="text-[#FAFAFA]">You're on the list.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="visible"
          className="text-center text-[16px] text-[#A1A1AA] leading-[1.7] mb-10 max-w-md mx-auto"
        >
          You just locked in your spot as an early beta tester for TradeNet Terminal.
          You're one step closer to trading with tools nobody else has.
        </motion.p>

        {/* Discord CTA */}
        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[#c9a84c]/20 bg-[#c9a84c]/[0.03] p-7 mb-8"
        >
          <p className="text-sm font-bold text-[#c9a84c] uppercase tracking-wider mb-3">Next Step</p>
          <p className="text-[15px] text-[#A1A1AA] leading-[1.7] mb-5">
            Join the Discord to activate your beta access. Once you're inside, head to the
            <span className="text-[#FAFAFA] font-medium"> role selection channel </span>
            and grab the <span className="text-[#FAFAFA] font-medium">Beta Tester</span> role — this unlocks
            the full beta testing section of the server.
          </p>
          <a
            href="https://discord.gg/tradenet"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl text-[15px]"
          >
            Join the Discord
          </a>
        </motion.div>

        {/* What you get */}
        <motion.div
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate="visible"
          className="mb-10"
        >
          <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-4 text-center">What you get as a beta tester</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bento-card p-4 text-center space-y-2">
              <BookOpen size={16} className="text-[#c9a84c] mx-auto" />
              <p className="text-sm text-[#A1A1AA] leading-snug">Exclusive trading education from top crypto traders</p>
            </div>
            <div className="bento-card p-4 text-center space-y-2">
              <Mic size={16} className="text-[#c9a84c] mx-auto" />
              <p className="text-sm text-[#A1A1AA] leading-snug">Regular live Q&A sessions on the terminal and strategies</p>
            </div>
            <div className="bento-card p-4 text-center space-y-2">
              <Users size={16} className="text-[#c9a84c] mx-auto" />
              <p className="text-sm text-[#A1A1AA] leading-snug">Direct access to the team building the product</p>
            </div>
          </div>
        </motion.div>

        {/* A word from Martin */}
        <motion.div
          variants={fadeUp}
          custom={5}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-white/[0.06] bg-black p-7"
        >
          <p className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider mb-4">A word from Martin, TradeNet Founder</p>
          <div className="text-[15px] text-[#A1A1AA] leading-[1.8] space-y-3">
            <p>
              I started building this terminal because I was tired of watching the same tools fail traders
              over and over again. Delayed data. Broken heatmaps. Platforms that charged a premium to show
              you what already happened.
            </p>
            <p>
              TradeNet Terminal is different. It's the first platform that predicts where liquidations
              will cluster — before the market gets there. That's not a marketing line. That's what
              we validated live during the February Iran strike, and it's what you're about to get
              your hands on.
            </p>
            <p>
              You joining this early means a lot. Seriously. The feedback from beta testers is
              what shapes this into something no one else can compete with.
            </p>
            <p className="text-[#FAFAFA] font-semibold">Welcome to the team.</p>
            <p className="text-[#c9a84c] font-bold">— Martin Shurtleff</p>
          </div>
        </motion.div>

        {/* Back to home */}
        <motion.div
          variants={fadeUp}
          custom={6}
          initial="hidden"
          animate="visible"
          className="text-center mt-8"
        >
          <Link to="/" className="text-sm text-[#71717A] hover:text-[#A1A1AA] transition-colors">
            ← Back to TradeNet
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
