import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
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

const noHeaderRoutes = ['/indicator', '/terms-of-service', '/contact', '/thankyou']
const noFooterRoutes = ['/thankyou']
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

export default function App() {
  const location    = useLocation()
  const showHeader  = !noHeaderRoutes.includes(location.pathname)
  const showFooter  = !noFooterRoutes.includes(location.pathname)
  return (
    <>
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
          <Route path="/thankyou"        element={<PageWrapper><ThankYouPage       /></PageWrapper>} />
          {/* Auth routes — uncomment at launch */}
          {/* <Route path="/signup"      element={<PageWrapper><SignUpPage         /></PageWrapper>} /> */}
          {/* <Route path="/login"       element={<PageWrapper><LoginPage          /></PageWrapper>} /> */}
          {/* <Route path="/account"     element={<PageWrapper><AccountPage        /></PageWrapper>} /> */}
        </Routes>
      </AnimatePresence>
      {showFooter && <Footer />}
      <Analytics />
      <SpeedInsights />
    </>
  )
}
