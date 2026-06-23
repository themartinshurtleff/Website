// Stripe billing binding.
// ----------------------------------------------------------------------------
// The buy flow is account-first. The browser asks Supabase for a Checkout
// Session; Supabase binds the Stripe customer/session to the current profile and
// the webhook later reconciles access through recalc_entitlements().
// ----------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

// Public checkout is paused during the beta launch waitlist phase.
const CHECKOUT_ENABLED = false

export const PLANS = {}

export function isCheckoutConfigured() {
  return CHECKOUT_ENABLED
}

async function invokeBillingFunction(name, body) {
  const options = body === undefined ? {} : { body }
  const { data, error } = await supabase.functions.invoke(name, options)
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('missing_redirect_url')
  return data.url
}

export async function startCheckout() {
  return null
}

export async function openBillingPortal() {
  return await invokeBillingFunction('stripe-portal')
}

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
