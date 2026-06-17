// Shopify checkout binding.
// ----------------------------------------------------------------------------
// The buy flow is account-first: the user must be logged in, and we attach
// note_attributes.profile_id = their Supabase user id to the cart so the
// shopify-webhook binds the purchase to the right account deterministically
// (no email guessing). See agent-tasks-2026-06-15 §1.6 / §0.5.9.
//
// Branded checkout lives on the custom domain shop.tradenet.org (Shopify is the
// merchant of record; PCI stays on Shopify).
//
// IMPORTANT: a subscription-only variant CANNOT be added via the colon permalink
// (`/cart/{v}:1?selling_plan=` errors, `/cart/{v}:1,selling_plan:` 404s on this
// store). The format Shopify actually accepts is the /cart/add endpoint:
//   /cart/add?id={VARIANT}&selling_plan={PLAN}&quantity=1
//             &properties[_profile_id]={uid}&return_to=/checkout
// - selling_plan makes it a recurring subscription (verified reaching /checkouts).
// - the profile_id rides as a LINE-ITEM PROPERTY `_profile_id` (leading underscore
//   = hidden from the storefront). The webhook reads it from line_items[].properties
//   (it also still checks note_attributes for back-compat).
// - return_to=/checkout jumps straight to payment instead of the cart page.
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
  const params = new URLSearchParams({
    id: p.variantId,
    selling_plan: p.sellingPlanId,
    quantity: '1',
    'properties[_profile_id]': profileId,
    return_to: '/checkout',
  })
  return `${CHECKOUT_DOMAIN}/cart/add?${params.toString()}`
}

// Manage-subscription portal = Shopify "new customer accounts" page.
// IMPORTANT: new customer accounts must live on a subdomain of the Shopify
// PRIMARY domain (verified: help.shopify.com 2026 — "a subdomain of your primary
// domain name"). The store's primary domain is shop.tradenet.org, so the account
// subdomain must be account.SHOP.tradenet.org — NOT account.tradenet.org (that's
// a sibling of the primary, which Shopify refuses -> 403 + no managed cert).
// Connect it in Settings > Customer accounts > Change domain (DNS: CNAME
// account.shop.tradenet.org -> shops.myshopify.com). Served at fixed paths
// (/authentication/login, /orders, /account/pages/<id>); the root redirects to
// sign-in / the account home where the customer manages their plan. Dormant until
// the cert provisions. If you pick a different prefix, change this one line.
export const MANAGE_SUBSCRIPTION_URL = 'https://account.shop.tradenet.org'

// Terminal download (filled when the desktop build ships a public URL).
export const TERMINAL_DOWNLOAD_URL = null
