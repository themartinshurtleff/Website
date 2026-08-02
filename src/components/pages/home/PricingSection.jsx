import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import WaitlistForm from '@/components/common/WaitlistForm'
import { useAuth } from '@/contexts/AuthContext'
import { BETA_CHECKOUT_VISIBLE } from '@/lib/launchConfig'
import { getPricingContext, PLANS, startCheckout } from '@/lib/checkout'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
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

const planFeatures = [
  'Live BTC, ETH, and SOL market data',
  'Footprint, DOM, Tape, and multi-venue charts',
  'Liquidation and orderbook heatmaps',
  'OI, CVD, VAP, and bar statistics',
  'Lua indicators and terminal data taps',
  'Backtesting and paper-first execution',
  'Saved desktop workspaces and beta updates',
]

const freePlanFeatures = [
  'Free TradeNet account',
  'BTC market preview',
  '5 minute and higher timeframes',
  'Basic candles and volume',
  'No credit card required',
]

function checkoutMessage(error) {
  const code = error?.message
  if (code === 'existing_subscription' || code === 'founding_offer_already_redeemed') {
    return 'This account already has a Stripe subscription. Manage or update it from the account page.'
  }
  if (code === 'payment_recovery_unavailable') {
    return 'Your earlier payment is still pending but cannot be reopened safely. Manage billing from the account page or contact support.'
  }
  if (code === 'checkout_in_progress') {
    return 'Checkout is being prepared. Wait a few seconds, then try again.'
  }
  if (code === 'founding_offer_reservation_active') {
    return 'Another founding checkout is still open. Close it, wait a few seconds, then choose your plan again.'
  }
  if (code === 'founding_offer_not_invited') {
    return 'Your founding rate is reserved, but your invitation wave has not opened yet.'
  }
  if (code === 'founding_offer_expired') {
    return 'The founding claim window for this account has expired.'
  }
  if (code === 'founding_offer_capacity_reached') {
    return 'The founding purchase allocation is currently full.'
  }
  if (code === 'founding_offer_deadline_too_close') {
    return 'This claim window is too close to expiration to begin a new checkout. Contact support.'
  }
  if (
    code === 'checkout_disabled' ||
    code === 'public_checkout_disabled' ||
    code === 'founding_checkout_disabled'
  ) {
    return 'Checkout is still locked while this launch wave is being staged.'
  }
  if (code === 'stripe_price_configuration_error') {
    return 'Checkout is paused because Stripe pricing did not pass server validation.'
  }
  return 'Checkout is unavailable right now. Please try again in a moment.'
}

function WaitlistPricingSection({ standalone = false }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()

  return (
    <section
      id="pricing"
      className={`${standalone ? 'min-h-screen pt-40 ' : ''}py-28 bg-black relative overflow-hidden`}
      ref={ref}
    >
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
              <h2 className="text-[clamp(34px,4.6vw,58px)] font-black leading-[1.04]">
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
                    <h3 className="text-2xl font-black text-[#FAFAFA]">
                      Waitlist-first rollout
                    </h3>
                  </div>
                  <span className="w-fit rounded-full bg-[#c9a84c] text-black text-[11px] font-black uppercase tracking-widest px-3 py-1.5">
                    Checkout closed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-white/[0.06]">
                {launchSteps.map(({ icon: Icon, title, body }, index) => (
                  <div key={title} className="p-6 border-white/[0.06] sm:border-r last:border-r-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#c9a84c]/10 border border-[#c9a84c]/20 mb-4">
                      <Icon size={17} className="text-[#c9a84c]" />
                    </div>
                    <p className="text-sm font-bold text-[#FAFAFA] mb-2">{title}</p>
                    <p className="text-xs text-[#71717A] leading-relaxed">{body}</p>
                    <p className="text-[10px] text-[#3F3F46] mt-4 font-semibold uppercase tracking-wider">
                      Step {index + 1}
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

function offerHeading(offer, signedIn) {
  if (!signedIn) {
    return {
      title: 'Founding access is checked after sign in.',
      body: 'Use the account email tied to the original TradeNet waitlist. Eligibility and pricing are selected server-side.',
    }
  }
  if (offer?.state === 'eligible') {
    return {
      title: 'Your founding rate is reserved.',
      body: 'Your account matches the original waitlist. Checkout opens when your invitation wave begins, and the seven-day window starts then.',
    }
  }
  if (offer?.state === 'invited' || offer?.state === 'reserved') {
    const deadline = offer?.claim_deadline
      ? new Date(offer.claim_deadline).toLocaleString()
      : null
    return {
      title: 'Founding pricing is unlocked for this account.',
      body: deadline
        ? `Your private claim window closes ${deadline}. The renewal rate is shown before Checkout.`
        : 'Your private claim window is active. The renewal rate is shown before Checkout.',
    }
  }
  if (offer?.state === 'expired') {
    return {
      title: 'The founding claim window has ended.',
      body: 'Standard beta pricing applies to this account when public checkout is available.',
    }
  }
  if (offer?.state === 'account_conflict') {
    return {
      title: 'This founding email is already linked.',
      body: 'Contact TradeNet support before purchasing so the offer is not attached to the wrong account.',
    }
  }
  return {
    title: 'One Pro plan, billed monthly or annually.',
    body: 'Both options unlock the same terminal and server-backed market data.',
  }
}

function CheckoutPricingSection({ standalone = false }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const [context, setContext] = useState(null)
  const [contextError, setContextError] = useState('')
  const [buyingPlan, setBuyingPlan] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')

  const tier = profile?.access_tier || 'waitlist'
  const hasAccess = tier !== 'free' && tier !== 'waitlist'
  const offer = context?.offer || {}
  const usesFoundingPrice =
    offer?.eligible === true &&
    ['eligible', 'invited', 'reserved'].includes(offer?.state)
  const offerCopy = offerHeading(offer, Boolean(user))

  useEffect(() => {
    if (loading) return undefined
    let cancelled = false
    setContextError('')
    getPricingContext()
      .then((next) => {
        if (!cancelled) setContext(next)
      })
      .catch((error) => {
        console.error('pricing context failed', error)
        if (!cancelled) setContextError('Pricing status could not be verified. Checkout remains locked.')
      })
    return () => {
      cancelled = true
    }
  }, [loading, user?.id])

  function canStart(plan) {
    if (loading || buyingPlan) return false
    if (!user || hasAccess) return true
    if (!context || contextError) return false
    if (offer?.state === 'account_conflict' || offer?.state === 'redeemed') return false
    if (!context.checkout_enabled) return false
    if (usesFoundingPrice) return offer?.can_claim === true
    return context.public_checkout_enabled === true && Boolean(PLANS[plan])
  }

  async function handleBuy(plan) {
    if (loading) return
    if (!user) {
      navigate(`/signup?return=${encodeURIComponent('/#pricing')}`)
      return
    }
    if (hasAccess) {
      navigate('/account')
      return
    }
    if (!canStart(plan)) return

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

  function handleFree() {
    navigate(user ? '/account' : '/signup')
  }

  function buttonLabel(plan) {
    if (buyingPlan === plan) return 'Opening secure checkout...'
    if (hasAccess) return 'View active access'
    if (!user) return 'Create account to check access'
    if (!context || loading) return 'Checking account access...'
    if (offer?.state === 'eligible') return 'Waiting for your invite'
    if (offer?.state === 'account_conflict') return 'Contact support'
    if (usesFoundingPrice && !offer?.can_claim) return 'Founding checkout unavailable'
    if (!context.checkout_enabled) return 'Checkout paused'
    if (!usesFoundingPrice && !context.public_checkout_enabled) return 'Invite access only'
    return plan === 'annual' ? 'Choose annual' : 'Choose monthly'
  }

  const monthlyPrice = usesFoundingPrice
    ? PLANS.monthly.foundingIntroPriceUsd
    : PLANS.monthly.standardPriceUsd
  const annualPrice = usesFoundingPrice
    ? PLANS.annual.foundingIntroPriceUsd
    : PLANS.annual.standardPriceUsd

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
          <h2 id="pricing-title">Free preview or the full terminal.</h2>
          <p>
            Start with a free account, or unlock every desktop terminal feature with
            monthly or annual Pro. Founding terms are selected automatically after sign in.
          </p>
        </motion.header>

        <motion.div
          className="tn-price-grid"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <article className="tn-price-card tn-price-card-free">
            <div className="tn-plan-heading">
              <div>
                <p className="tn-plan-name">Free</p>
                <p className="tn-plan-caption">A limited BTC market preview</p>
              </div>
              <span className="tn-plan-badge tn-plan-badge-neutral">No card</span>
            </div>
            <div className="tn-price-line">
              <span className="tn-price-value">$0</span>
              <span className="tn-price-cadence">/ forever</span>
            </div>
            <p className="tn-renewal-copy">
              Web preview only. Desktop access and protected orderflow tools require Pro.
            </p>
            <ul className="tn-plan-features">
              {freePlanFeatures.map((feature) => (
                <li key={feature}><Check size={15} />{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className="tn-plan-button tn-plan-button-secondary"
              onClick={handleFree}
            >
              {user ? 'View your account' : 'Start free'}
              <ArrowRight size={16} />
            </button>
          </article>

          <article className="tn-price-card">
            <div className="tn-plan-heading">
              <div>
                <p className="tn-plan-name">Pro Monthly</p>
                <p className="tn-plan-caption">Full access with monthly billing</p>
              </div>
              {usesFoundingPrice && <span className="tn-plan-badge">Founding</span>}
            </div>
            <div className="tn-price-line">
              <span className="tn-price-value">${monthlyPrice}</span>
              <span className="tn-price-cadence">/ month</span>
            </div>
            <p className="tn-renewal-copy">
              {usesFoundingPrice
                ? `$${PLANS.monthly.foundingIntroPriceUsd}/month for the first three months, then $${PLANS.monthly.foundingRenewalPriceUsd}/month.`
                : 'Renews monthly until cancelled.'}
            </p>
            <ul className="tn-plan-features">
              {planFeatures.map((feature) => (
                <li key={feature}><Check size={15} />{feature}</li>
              ))}
            </ul>
            <button
              type="button"
              className="tn-plan-button tn-plan-button-secondary"
              onClick={() => handleBuy('monthly')}
              disabled={!canStart('monthly')}
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
              <span className="tn-plan-badge">
                {usesFoundingPrice ? 'Founding' : 'Best value'}
              </span>
            </div>
            <div className="tn-price-line">
              <span className="tn-price-value">${annualPrice}</span>
              <span className="tn-price-cadence">/ year</span>
            </div>
            <p className="tn-renewal-copy">
              {usesFoundingPrice
                ? `$${PLANS.annual.foundingIntroPriceUsd} for the first year, then $${PLANS.annual.foundingRenewalPriceUsd}/year.`
                : `$${PLANS.annual.standardMonthlyEquivalentUsd}/month equivalent. Renews annually until cancelled.`}
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
              disabled={!canStart('annual')}
            >
              {buttonLabel('annual')}
              {!buyingPlan && <ArrowRight size={16} />}
            </button>
          </article>
        </motion.div>

        {(checkoutError || contextError) && (
          <p className="tn-checkout-error" role="alert">{checkoutError || contextError}</p>
        )}

        <motion.div
          className="tn-founding-offer"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.22 }}
        >
          <ShieldCheck size={22} />
          <div>
            <h3>{offerCopy.title}</h3>
            <p>{offerCopy.body}</p>
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

export default function PricingSection({ standalone = false }) {
  return BETA_CHECKOUT_VISIBLE
    ? <CheckoutPricingSection standalone={standalone} />
    : <WaitlistPricingSection standalone={standalone} />
}
