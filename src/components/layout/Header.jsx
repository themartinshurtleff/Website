import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, Activity, Download, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import {
  PRIMARY_LAUNCH_LABEL,
  PRIMARY_LAUNCH_PATH,
} from '@/lib/launchConfig'

const navLinks = [
  { label: 'Terminal',  to: '/#terminal-showcase' },
  { label: 'Features',  to: '/#features'          },
  { label: 'Pricing',   to: '/#pricing'           },
  { label: 'Docs',      to: '/docs',  external: true },
  { label: 'Blog',      to: '/blog', external: true },
  { label: 'About',     to: '/about'         },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, profile, signOut } = useAuth()
  const isAdmin = profile?.access_tier === 'admin'
  const hasDesktopAccess = ['referral_verified', 'beta', 'pro', 'admin'].includes(profile?.access_tier)
  const isHomePage = location.pathname === '/'

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
      navigate(to)
      setTimeout(
        () => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }),
        location.pathname === path ? 20 : 350,
      )
    } else {
      navigate(to)
    }
  }

  function handlePrimaryLaunchAction() {
    handleNav(PRIMARY_LAUNCH_PATH, false)
  }

  const isActive = (to) => {
    if (to.includes('#')) {
      const [path, hash] = to.split('#')
      return location.pathname === path && location.hash === `#${hash}`
    }
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <header
      className={`site-header ${isHomePage ? 'site-header-home' : ''} fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/90 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl'
          : 'bg-transparent'
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-[70px]">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <img
              src="/assets/text-logo.png"
              alt="TradeNet"
              className="h-[30px] w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNav(link.to, link.external)}
                className={`site-nav-link px-3.5 py-2 text-sm transition-colors duration-150 ${
                  isActive(link.to)
                    ? 'text-[#FAFAFA] bg-white/[0.06]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* CTA — auth-aware */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <a
                  href="https://app.tradenet.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="site-header-cta flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-4 py-2 rounded-md transition-colors"
                >
                  Open Terminal
                  <ExternalLink size={14} />
                </a>
                {hasDesktopAccess && (
                  <button
                    onClick={() => navigate('/download')}
                    title="Download terminal"
                    className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                  >
                    <Download size={15} />
                    <span className="hidden xl:inline">Download</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin/dashboard')}
                    title="System monitoring"
                    aria-label="System monitoring"
                    className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                  >
                    <Activity size={15} />
                    <span className="hidden xl:inline">Monitoring</span>
                  </button>
                )}
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                >
                  <User size={15} />
                  Account
                </button>
                <button
                  onClick={async () => { await signOut(); navigate('/') }}
                  aria-label="Sign out"
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
                <button
                  onClick={handlePrimaryLaunchAction}
                  className="site-header-cta flex items-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2 rounded-md transition-colors"
                >
                  {PRIMARY_LAUNCH_LABEL}
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-[#A1A1AA] hover:text-white transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-xl overflow-hidden"
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
              <div className="pt-2 border-t border-white/[0.06] mt-2 space-y-2">
                {user ? (
                  <>
                    <a
                      href="https://app.tradenet.org/"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2.5 rounded-md transition-colors"
                    >
                      Open Terminal
                      <ExternalLink size={15} />
                    </a>
                    {hasDesktopAccess && (
                      <button
                        onClick={() => navigate('/download')}
                        className="w-full flex items-center justify-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors px-5 py-2.5"
                      >
                        <Download size={15} /> Download Terminal
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="w-full flex items-center justify-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors px-5 py-2.5"
                      >
                        <Activity size={15} /> Monitoring
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/account')}
                      className="w-full flex items-center justify-center gap-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors px-5 py-2.5"
                    >
                      <User size={15} /> Account
                    </button>
                    <button
                      onClick={async () => { await signOut(); navigate('/') }}
                      className="w-full text-sm text-[#71717A] hover:text-red-400 transition-colors px-5 py-2.5"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors px-5 py-2.5"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={handlePrimaryLaunchAction}
                      className="w-full bg-[#c9a84c] hover:bg-[#f0c040] text-black font-semibold text-sm px-5 py-2.5 rounded-md transition-colors"
                    >
                      {PRIMARY_LAUNCH_LABEL}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
