import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PLANS, startCheckout } from '@/lib/checkout'

const planFeatures = [
  'Live BTC, ETH, and SOL market data',
  'Footprint, DOM, Tape, and multi-venue charts',
  'Liquidation and orderbook heatmaps',
  'OI, CVD, VAP, and bar statistics',
  'Lua indicators and terminal data taps',
  'Backtesting and paper-first execution',
  'Saved desktop workspaces and beta updates',
]

function checkoutMessage(error) {
  if (error?.message === 'existing_subscription') {
    return 'This account already has a Stripe subscription. Manage it from your account page.'
  }
  if (error?.message === 'waitlist_discount_not_configured') {
    return 'Your founding offer was recognized, but checkout is not ready yet. Please contact support so we do not charge you the wrong amount.'
  }
  if (error?.message === 'stripe_price_mismatch') {
    return 'Checkout is paused because the configured Stripe price does not match the price shown here. Please contact support.'
  }
  return 'Checkout is unavailable right now. Please try again in a moment.'
}

export default function PricingSection({ standalone = false }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [buyingPlan, setBuyingPlan] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')

  const tier = profile?.access_tier || 'waitlist'
  const hasAccess = tier !== 'free' && tier !== 'waitlist'

  async function handleBuy(plan) {
    if (loading) return
    if (!user) {
      navigate(`/signup?return=${encodeURIComponent('/pricing')}`)
      return
    }
    if (hasAccess) {
      navigate('/account')
      return
    }

    setCheckoutError('')
    setBuyingPlan(plan)
    try {
      const url = await startCheckout(plan)
      window.location.assign(url)
    } catch (error) {
      console.error('checkout failed', error)
      setCheckoutError(checkoutMessage(error))
      setBuyingPlan(null)
    }
  }

  const buttonLabel = (plan) => {
    if (buyingPlan === plan) return 'Opening secure checkout...'
    if (hasAccess) return 'View active access'
    if (!user) return 'Create account to continue'
    return plan === 'annual' ? 'Choose annual' : 'Choose monthly'
  }

  return (
    <section
      id="pricing"
      ref={ref}
      className={`tn-pricing${standalone ? ' tn-pricing-standalone' : ''}`}
      aria-labelledby="pricing-title"
    >
      <div className="tn-container">
        <motion.header
          className="tn-pricing-heading"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
        >
          <p className="tn-kicker">Beta launch pricing</p>
          <h2 id="pricing-title">Direct access to the full TradeNet terminal.</h2>
          <p>
            One Pro plan, billed monthly or annually. Both options unlock the same terminal and server-backed market data.
          </p>
        </motion.header>

        <motion.div
          className="tn-price-grid"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <article className="tn-price-card">
            <div className="tn-plan-heading">
              <div>
                <p className="tn-plan-name">Pro Monthly</p>
                <p className="tn-plan-caption">Full access with monthly billing</p>
              </div>
            </div>
            <div className="tn-price-line">
              <span className="tn-price-value">${PLANS.monthly.priceUsd}</span>
              <span className="tn-price-cadence">/ month</span>
            </div>
            <p className="tn-renewal-copy">Renews monthly until cancelled.</p>
            <ul className="tn-plan-features">
              {planFeatures.map((feature) => (
                <li key={feature}><Check size={15} />{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className="tn-plan-button tn-plan-button-secondary"
              onClick={() => handleBuy('monthly')}
              disabled={Boolean(buyingPlan) || loading}
            >
              {buttonLabel('monthly')}
              {!buyingPlan && <ArrowRight size={16} />}
            </button>
          </article>

          <article className="tn-price-card tn-price-card-featured">
            <div className="tn-plan-heading">
              <div>
                <p className="tn-plan-name">Pro Annual</p>
                <p className="tn-plan-caption">Twelve months of full access</p>
              </div>
              <span className="tn-plan-badge">Best value</span>
            </div>
            <div className="tn-price-line">
              <span className="tn-price-value">${PLANS.annual.priceUsd}</span>
              <span className="tn-price-cadence">/ year</span>
            </div>
            <p className="tn-renewal-copy">
              ${PLANS.annual.monthlyEquivalentUsd}/month equivalent. Renews annually until cancelled.
            </p>
            <ul className="tn-plan-features">
              {planFeatures.map((feature) => (
                <li key={feature}><Check size={15} />{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className="tn-plan-button tn-plan-button-primary"
              onClick={() => handleBuy('annual')}
              disabled={Boolean(buyingPlan) || loading}
            >
              {buttonLabel('annual')}
              {!buyingPlan && <ArrowRight size={16} />}
            </button>
          </article>
        </motion.div>

        {checkoutError && <p className="tn-checkout-error" role="alert">{checkoutError}</p>}

        <motion.div
          className="tn-founding-offer"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.22 }}
        >
          <ShieldCheck size={22} />
          <div>
            <h3>Founding waitlist pricing is recognized automatically.</h3>
            <p>
              Sign in with the same email used on the original TradeNet waitlist. The server checks that email against the protected waitlist and applies the eligible launch offer in Stripe Checkout.
            </p>
          </div>
          <div className="tn-secure-checkout">
            <LockKeyhole size={14} />
            Secure checkout by Stripe
          </div>
        </motion.div>

        <div className="tn-pricing-footnote">
          <p>TradeNet is software for market analysis and execution tooling. It is not a broker or custodian.</p>
          <Link to="/terms-of-service">Billing terms <ArrowRight size={13} /></Link>
        </div>
      </div>
    </section>
  )
}
