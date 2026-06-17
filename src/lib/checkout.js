// Shopify checkout binding.
// ----------------------------------------------------------------------------
// The buy flow is account-first: the user must be logged in, and we attach
// note_attributes.profile_id = their Supabase user id to the cart so the
// shopify-webhook binds the purchase to the right account deterministically
// (no email guessing). See agent-tasks-2026-06-15 §1.6 / §0.5.9.
//
// Branded checkout lives on the custom domain shop.tradenet.org (Shopify is the
// merchant of record; PCI stays on Shopify). The cart permalink carries the
// variant id, the selling plan (so it checks out as a recurring subscription,
// not a one-time charge), and the profile_id attribute:
//   https://shop.tradenet.org/cart/{VARIANT}:1?selling_plan={PLAN}&attributes[profile_id]={uid}
// ----------------------------------------------------------------------------

const CHECKOUT_DOMAIN = 'https://shop.tradenet.org'

// MASTER SWITCH. true = Buy buttons route to live Shopify subscription checkout
// and charge real cards. The site copy now matches the live Shopify prices
// (Monthly $29.99/mo, Annual $384.99/yr); no "annual saves" framing since annual
// is not the cheaper per-month option.
//
// GO-LIVE PREREQUISITE: the Shopify store password must be OFF — a locked store
// redirects the cart link to /password and checkout fails. Keep the store public
// while selling.
const CHECKOUT_ENABLED = true

// Live Shopify ids (read from the store's public product .js, 2026-06-17).
// product ids (for the webhook allowlist): monthly 9349798396162, annual 9349799018754.
export const PLANS = {
  monthly: { label: 'Pro — Monthly', variantId: '47630993490178', sellingPlanId: '3893231874', priceUsd: 29.99 },
  annual:  { label: 'Pro — Annual',  variantId: '47630994145538', sellingPlanId: '3893166338', priceUsd: 384.99 },
}

export function isCheckoutConfigured(plan = 'monthly') {
  return CHECKOUT_ENABLED && Boolean(PLANS[plan]?.variantId && PLANS[plan]?.sellingPlanId)
}

// Build the branded subscription checkout URL with the profile_id binding.
export function buildCheckoutUrl(plan, profileId) {
  const p = PLANS[plan]
  if (!p?.variantId || !p?.sellingPlanId || !profileId) return null
  const attr = encodeURIComponent('attributes[profile_id]')
  return `${CHECKOUT_DOMAIN}/cart/${p.variantId}:1?selling_plan=${p.sellingPlanId}&${attr}=${encodeURIComponent(profileId)}`
}

// Manage-subscription portal (Shopify customer account). Filled when live.
export const MANAGE_SUBSCRIPTION_URL = `${CHECKOUT_DOMAIN}/account`

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
