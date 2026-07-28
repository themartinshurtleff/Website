import { supabase } from '@/lib/supabase'
import { BETA_CHECKOUT_VISIBLE } from '@/lib/launchConfig'

export const PLANS = {
  monthly: {
    key: 'monthly',
    name: 'Pro Monthly',
    standardPriceUsd: 39,
    foundingIntroPriceUsd: 19,
    foundingIntroIntervals: 3,
    foundingRenewalPriceUsd: 29,
    cadence: 'month',
  },
  annual: {
    key: 'annual',
    name: 'Pro Annual',
    standardPriceUsd: 384,
    standardMonthlyEquivalentUsd: 32,
    foundingIntroPriceUsd: 199,
    foundingIntroIntervals: 1,
    foundingRenewalPriceUsd: 284,
    cadence: 'year',
  },
}

async function invokeFunction(name, body) {
  const options = body === undefined ? {} : { body }
  const { data, error } = await supabase.functions.invoke(name, options)
  if (error) {
    try {
      const payload = await error.context?.json()
      if (payload?.error) throw new Error(payload.error)
    } catch (contextError) {
      if (
        contextError instanceof Error &&
        contextError.message !== 'Unexpected end of JSON input'
      ) {
        throw contextError
      }
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function isCheckoutVisible() {
  return BETA_CHECKOUT_VISIBLE
}

export async function getPricingContext() {
  return await invokeFunction('pricing-context', {})
}

export async function startCheckout(plan) {
  if (!BETA_CHECKOUT_VISIBLE || !PLANS[plan]) throw new Error('checkout_hidden')
  const data = await invokeFunction('stripe-checkout', {
    plan,
    request_id: crypto.randomUUID(),
  })
  if (!data?.url) throw new Error('missing_redirect_url')
  return data.url
}

export async function openBillingPortal() {
  const data = await invokeFunction('stripe-portal')
  if (!data?.url) throw new Error('missing_redirect_url')
  return data.url
}

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
