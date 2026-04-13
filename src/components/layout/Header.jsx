import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'

const navLinks = [
  { label: 'Home',      to: '/'              },
  { label: 'Terminal',  to: '/terminal'      },
  { label: 'Indicator', to: '/indicator'     },
  { label: 'Docs',      to: '/docs',      external: true },
  { label: 'Blog',      to: '/blog',      external: true },
  { label: 'About',     to: '/about'         },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, signOut } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location])

  function handleNav(to, external) {
    if (external) {
      window.location.href = to
      return
    }
    if (to.includes('#')) {
      const [path, hash] = to.split('#')
      if (location.pathname !== path && path !== '') {
        navigate(path)
        setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 350)
      } else {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      navigate(to)
    }
  }

  function handleWaitlist() {
    navigate('/terminal')
    setTimeout(() => document.getElementById('terminal-waitlist')?.scrollIntoView({ behavior: 'smooth' }), 350)
  }

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/90 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl'
          : 'bg-transparent'
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <img
              src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/efe116b9b5047322099b7e584bf45b6a.png"
              alt="TradeNet"
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNav(link.to, link.external)}
                className={`px-3.5 py-2 text-sm transition-colors duration-150 rounded-md ${
                  isActive(link.to)
                    ? 'text-[#FAFAFA] bg-white/[0.06]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* CTA — auth buttons hidden pre-launch, uncomment when ready */}
          <div className="hidden md:flex items-center gap-3">
            {/* {user ? (
              <>
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                >
                  <User size={15} />
                  Account
                </button>
                <button
                  onClick={async () => { await signOut(); navigate('/') }}
                  className="flex items-center gap-1.5 text-sm text-[#71717A] hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                >
                  Sign In
                </button>
              </>
            )} */}
            <button
              onClick={handleWaitlist}
              className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
            >
              Join Waitlist
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-[#A1A1AA] hover:text-white transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="section-container py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNav(link.to, link.external)}
                  className={`text-left px-3 py-2.5 text-sm rounded-md transition-colors ${
                    isActive(link.to)
                      ? 'text-[#FAFAFA] bg-white/[0.06]'
                      : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              {/* Auth buttons hidden pre-launch, uncomment when ready */}
              <div className="pt-2 border-t border-white/[0.06] mt-2 space-y-2">
                <button
                  onClick={handleWaitlist}
                  className="w-full bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
                >
                  Join Waitlist
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
