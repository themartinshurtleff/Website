// Stripe customer portal binding.
// ----------------------------------------------------------------------------
// Public checkout is intentionally absent while the website is in waitlist
// mode. Existing Stripe customers can still manage an active subscription.
// ----------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

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

export async function openBillingPortal() {
  return await invokeBillingFunction('stripe-portal')
}

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
