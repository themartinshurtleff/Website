import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function FreeGuidePopup() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('hasSeenFreeGuidePopup')) return
    const t = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    setShow(false)
    sessionStorage.setItem('hasSeenFreeGuidePopup', '1')
  }

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[900] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
          />
          {/* Modal */}
          <motion.div
            className="fixed z-[901] inset-0 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="relative w-full max-w-md glass-gold rounded-2xl overflow-hidden">
              {/* Gradient accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

              <button
                onClick={dismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#71717A] hover:text-white hover:bg-white/[0.07] transition-colors z-10"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col sm:flex-row gap-6 p-6">
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/20 blur-xl rounded-lg" />
                    <img
                      src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/3ac41fd62c6de3d3ff13e6953d09120c.png"
                      alt="Free Trading Guide"
                      className="relative w-28 h-auto rounded-lg object-cover"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-4">
                  <div>
                    <div className="eyebrow mb-3 text-xs">Free & Exclusive</div>
                    <h3 className="text-lg font-bold text-[#FAFAFA] leading-tight mb-2">
                      Your Ultimate Crypto Futures Handguide
                    </h3>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed">
                      90 pages of everything you need to trade crypto futures profitably. Completely free.
                    </p>
                    <p className="text-xs text-[#c9a84c] mt-2 font-semibold">⚡ 12 spots left</p>
                  </div>
                  <Link
                    to="/terminal"
                    onClick={dismiss}
                    className="btn-gold text-center text-sm px-5 py-2.5 rounded-lg w-full"
                  >
                    CLAIM FREE GUIDE
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
