import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { supabase } from '@/lib/supabase'
import {
  hasPasswordRecoveryPending,
  isPasswordRecoveryUrl,
  markPasswordRecoveryPending,
} from '@/lib/authRecovery'
import Header             from '@/components/layout/Header'
import Footer             from '@/components/layout/Footer'
// import FreeGuidePopup     from '@/components/common/FreeGuidePopup'
import ScrollToTop        from '@/components/common/ScrollToTop'
import HomePage           from '@/pages/HomePage'
import TerminalPage       from '@/pages/TerminalPage'
import IndicatorPage      from '@/pages/IndicatorPage'
import AboutPage          from '@/pages/AboutPage'
import ContactPage        from '@/pages/ContactPage'
import CaseStudiesPage    from '@/pages/CaseStudiesPage'
import TermsOfServicePage from '@/pages/TermsOfServicePage'
import ThankYouPage       from '@/pages/ThankYouPage'
import SignUpPage         from '@/pages/SignUpPage'
import LoginPage          from '@/pages/LoginPage'
import AccountPage        from '@/pages/AccountPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage  from '@/pages/ResetPasswordPage'
import AuthConfirmPage    from '@/pages/AuthConfirmPage'

const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'))

const BLOG_URL = 'https://www.tradenet.org/docs/blog'

const noHeaderRoutes = ['/indicator', '/terms-of-service', '/contact', '/thankyou', '/admin/dashboard']
const noFooterRoutes = ['/thankyou', '/admin/dashboard']
// const noPopupRoutes  = ['/thankyou']

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

function PasswordRecoveryRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const isAuthConfirmRoute = window.location.pathname === '/auth/confirm'

    function redirectToReset() {
      if (window.location.pathname === '/reset-password') return
      navigate(`/reset-password${window.location.hash || ''}`, { replace: true })
    }

    if (!isAuthConfirmRoute && (isPasswordRecoveryUrl() || hasPasswordRecoveryPending())) {
      markPasswordRecoveryPending()
      redirectToReset()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecoveryPending()
        redirectToReset()
      }
    })

    return () => subscription.unsubscribe()
  }, [location.pathname, navigate])

  return null
}

function ExternalRedirect({ basePath, destination }) {
  const location = useLocation()

  useEffect(() => {
    const suffix = location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length)
      : ''
    window.location.replace(`${destination}${suffix}${location.search}${location.hash}`)
  }, [basePath, destination, location.hash, location.pathname, location.search])

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <p className="text-sm text-[#A1A1AA]">Redirecting...</p>
    </main>
  )
}

export default function App() {
  const location    = useLocation()
  const showHeader  = !noHeaderRoutes.includes(location.pathname)
  const showFooter  = !noFooterRoutes.includes(location.pathname)
  return (
    <>
      <PasswordRecoveryRedirect />
      <ScrollToTop />
      {showHeader && <Header />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"                element={<PageWrapper><HomePage           /></PageWrapper>} />
          <Route path="/terminal"        element={<PageWrapper><TerminalPage       /></PageWrapper>} />
          <Route path="/indicator"       element={<PageWrapper><IndicatorPage      /></PageWrapper>} />
          <Route path="/about"           element={<PageWrapper><AboutPage          /></PageWrapper>} />
          <Route path="/contact"         element={<PageWrapper><ContactPage        /></PageWrapper>} />
          <Route path="/case-studies"    element={<PageWrapper><CaseStudiesPage    /></PageWrapper>} />
          <Route path="/terms-of-service"element={<PageWrapper><TermsOfServicePage /></PageWrapper>} />
          <Route path="/blog/*"          element={<ExternalRedirect basePath="/blog"  destination={BLOG_URL} />} />
          <Route path="/blogs/*"         element={<ExternalRedirect basePath="/blogs" destination={BLOG_URL} />} />
          <Route path="/thankyou"        element={<PageWrapper><ThankYouPage       /></PageWrapper>} />
          <Route path="/signup"          element={<PageWrapper><SignUpPage         /></PageWrapper>} />
          <Route path="/login"           element={<PageWrapper><LoginPage          /></PageWrapper>} />
          <Route path="/forgot-password" element={<PageWrapper><ForgotPasswordPage /></PageWrapper>} />
          <Route path="/reset-password"  element={<PageWrapper><ResetPasswordPage  /></PageWrapper>} />
          <Route path="/auth/confirm"    element={<PageWrapper><AuthConfirmPage    /></PageWrapper>} />
          <Route path="/account"         element={<PageWrapper><AccountPage        /></PageWrapper>} />
          <Route path="/pricing"         element={<Navigate to="/terminal" replace />} />
          <Route path="/buy"             element={<Navigate to="/terminal" replace />} />
          <Route
            path="/admin/dashboard"
            element={(
              <Suspense fallback={<main className="min-h-screen bg-[#08090a]" />}>
                <AdminDashboardPage />
              </Suspense>
            )}
          />
        </Routes>
      </AnimatePresence>
      {showFooter && <Footer />}
      <Analytics />
      <SpeedInsights />
    </>
  )
}
