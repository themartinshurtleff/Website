import { supabase } from '@/lib/supabase'

const VISITOR_KEY = 'tradenet_affiliate_visitor_v1'
const PENDING_KEY = 'tradenet_affiliate_pending_v1'

function browserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function visitorId() {
  const storage = browserStorage()
  if (!storage) return crypto.randomUUID()
  const existing = storage.getItem(VISITOR_KEY)
  if (validUuid(existing)) return existing
  const created = crypto.randomUUID()
  storage.setItem(VISITOR_KEY, created)
  return created
}

function readPending() {
  const storage = browserStorage()
  if (!storage) return null
  try {
    const pending = JSON.parse(storage.getItem(PENDING_KEY) || 'null')
    if (!validUuid(pending?.click_token) || Date.parse(pending?.expires_at) <= Date.now()) {
      storage.removeItem(PENDING_KEY)
      return null
    }
    return pending
  } catch {
    storage.removeItem(PENDING_KEY)
    return null
  }
}

function rememberFirstTouch(payload) {
  const storage = browserStorage()
  if (!storage || readPending()) return
  if (!validUuid(payload?.click_token) || !payload?.expires_at) return
  storage.setItem(PENDING_KEY, JSON.stringify({
    click_token: payload.click_token,
    affiliate_slug: payload.affiliate_slug,
    expires_at: payload.expires_at,
  }))
}

async function functionError(error, fallback) {
  const response = error?.context
  if (response instanceof Response) {
    try {
      const body = await response.clone().json()
      return new Error(body?.error || fallback)
    } catch {
      return new Error(fallback)
    }
  }
  return new Error(error?.message || fallback)
}

export async function recordAffiliateVisit(slug, options = {}) {
  const { data, error } = await supabase.functions.invoke('affiliate-click', {
    body: {
      slug,
      visitor_id: visitorId(),
      landing_path: options.landingPath || '/pricing',
      campaign: options.campaign || null,
      referrer: options.referrer || null,
    },
  })
  if (error) throw await functionError(error, 'affiliate_click_failed')
  if (data?.error) throw new Error(data.error)
  rememberFirstTouch(data)
  return data
}

export async function claimPendingAffiliate() {
  const pending = readPending()
  if (!pending) return { status: 'no_pending_attribution' }

  const { data, error } = await supabase.functions.invoke('affiliate-claim', {
    body: { click_token: pending.click_token },
  })
  if (error) {
    const parsed = await functionError(error, 'affiliate_claim_failed')
    if ([
      'affiliate_click_invalid',
      'affiliate_not_active',
      'affiliate_click_already_claimed',
    ].includes(parsed.message)) {
      browserStorage()?.removeItem(PENDING_KEY)
    }
    throw parsed
  }
  if (data?.error) throw new Error(data.error)
  if (['attributed', 'already_attributed'].includes(data?.status)) {
    browserStorage()?.removeItem(PENDING_KEY)
  }
  return data
}

export function hasPendingAffiliate() {
  return Boolean(readPending())
}
