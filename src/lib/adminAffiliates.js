import { supabase } from '@/lib/supabase'

export class AffiliateApiError extends Error {
  constructor(message, { code = 'affiliate_request_failed', status = 0 } = {}) {
    super(message)
    this.name = 'AffiliateApiError'
    this.code = code
    this.status = status
  }
}

const MESSAGES = {
  affiliate_tracking_disabled: 'Affiliate tracking is not enabled in this environment.',
  missing_auth: 'Sign in is required.',
  invalid_auth: 'Your session is no longer valid. Sign in again.',
  mfa_required: 'Complete multi-factor authentication to continue.',
  admin_required: 'This account no longer has administrator access.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  affiliate_slug_exists: 'That affiliate slug is already in use.',
  affiliate_slug_invalid: 'Use 3 to 50 lowercase letters, numbers, or hyphens.',
  affiliate_name_invalid: 'Enter a valid affiliate name.',
  payout_balance_empty: 'This affiliate has no matured commission balance.',
  payout_minimum_not_met: 'The available balance has not reached the payout minimum.',
  payout_confirmation_required: 'Type PAID to confirm the payout was sent.',
  payout_reference_required: 'Add the external payment reference before recording the payout.',
}

async function invoke(body, allowRefresh = true) {
  const { data, error } = await supabase.functions.invoke('affiliate-admin', { body })
  if (!error) return data

  let payload = null
  const response = error?.context
  if (response instanceof Response) {
    try { payload = await response.clone().json() } catch { payload = null }
  }
  const status = response instanceof Response ? response.status : 0
  const code = payload?.error || 'affiliate_request_failed'

  if (status === 401 && allowRefresh) {
    const refreshed = await supabase.auth.refreshSession()
    if (!refreshed.error && refreshed.data.session) return invoke(body, false)
  }

  throw new AffiliateApiError(
    MESSAGES[code] || 'The affiliate service could not complete the request.',
    { code, status },
  )
}

export function listAffiliates() {
  return invoke({ action: 'list' })
}

export function getAffiliateDetail(affiliateId) {
  return invoke({ action: 'detail', affiliate_id: affiliateId })
}

export function createAffiliate(displayName, slug) {
  return invoke({
    action: 'create',
    display_name: displayName,
    slug,
  })
}

export function updateAffiliate(affiliateId, displayName, status) {
  return invoke({
    action: 'update',
    affiliate_id: affiliateId,
    display_name: displayName,
    status,
  })
}

export function recordAffiliatePayout(affiliateId, currency, reference, notes, confirmationText) {
  return invoke({
    action: 'record_payout',
    affiliate_id: affiliateId,
    currency,
    reference,
    notes,
    confirmed: true,
    confirmation_text: confirmationText,
  })
}
