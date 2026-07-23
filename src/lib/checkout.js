// Stripe billing binding.
// ----------------------------------------------------------------------------
// The buy flow is account-first. The browser asks Supabase for a Checkout
// Session; Supabase binds the Stripe customer/session to the current profile and
// the webhook later reconciles access through recalc_entitlements().
// ----------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

const CHECKOUT_ENABLED = true

export const PLANS = {
  monthly: {
    key: 'monthly',
    name: 'Pro Monthly',
    priceUsd: 39,
    cadence: 'month',
  },
  annual: {
    key: 'annual',
    name: 'Pro Annual',
    priceUsd: 384,
    cadence: 'year',
    monthlyEquivalentUsd: 32,
  },
}

export function isCheckoutConfigured(plan = 'monthly') {
  return CHECKOUT_ENABLED && Boolean(PLANS[plan])
}

async function invokeBillingFunction(name, body) {
  const options = body === undefined ? {} : { body }
  const { data, error } = await supabase.functions.invoke(name, options)
  if (error) {
    try {
      const payload = await error.context?.json()
      if (payload?.error) throw new Error(payload.error)
    } catch (contextError) {
      if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') {
        throw contextError
      }
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('missing_redirect_url')
  return data.url
}

export async function startCheckout(plan) {
  if (!isCheckoutConfigured(plan)) throw new Error('unknown_plan')
  return await invokeBillingFunction('stripe-checkout', { plan })
}

export async function openBillingPortal() {
  return await invokeBillingFunction('stripe-portal')
}

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
