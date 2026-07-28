import { supabase } from '@/lib/supabase'

export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'maintenance', 'critical', 'release']
export const ANNOUNCEMENT_PLATFORMS = ['all', 'web', 'desktop', 'windows', 'macos']
export const ANNOUNCEMENT_CHANNELS = ['beta', 'stable', 'internal']
export const ANNOUNCEMENT_ACCESS_TIERS = ['waitlist', 'free', 'referral_verified', 'beta', 'pro', 'admin']
export const ANNOUNCEMENT_SERVICE_SCOPES = ['all', 'terminal', 'website', 'auth', 'market_data', 'execution']

export class AnnouncementApiError extends Error {
  constructor(message, { status = 0, code = 'announcement_request_failed', field = null, retryAfterMs = 0 } = {}) {
    super(message)
    this.name = 'AnnouncementApiError'
    this.status = status
    this.code = code
    this.field = field
    this.retryAfterMs = retryAfterMs
  }
}

const ERROR_MESSAGES = {
  announcements_disabled: 'Announcement controls are not enabled in this environment.',
  invalid_auth: 'Your session is no longer valid. Sign in again.',
  missing_auth: 'Sign in is required.',
  mfa_required: 'Complete multi-factor authentication to continue.',
  admin_required: 'This account no longer has administrator access.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  revision_conflict: 'This announcement changed since you opened it. Refresh before saving.',
  announcement_archived: 'Archived announcements cannot be changed.',
  announcement_not_found: 'The announcement no longer exists.',
  validation_failed: 'Review the highlighted announcement field.',
  confirmation_required: 'Confirm this action before continuing.',
  publish_confirmation_required: 'Type PUBLISH to confirm this live change.',
  archive_confirmation_required: 'Type ARCHIVE to confirm this removal.',
  origin_denied: 'This site origin is not approved for announcement administration.',
}

async function responseBody(error) {
  const response = error?.context
  if (!(response instanceof Response)) return null
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

function retryAfterMs(error) {
  const response = error?.context
  if (!(response instanceof Response)) return 0
  const raw = response.headers.get('retry-after')
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0
}

async function invoke(body, allowRefresh = true) {
  const { data, error } = await supabase.functions.invoke('admin-announcements', { body })
  if (!error) return data

  const payload = await responseBody(error)
  const status = error.context instanceof Response ? error.context.status : 0
  const code = payload?.error || 'announcement_request_failed'

  if (status === 401 && allowRefresh) {
    const refreshed = await supabase.auth.refreshSession()
    if (!refreshed.error && refreshed.data.session) return invoke(body, false)
  }

  throw new AnnouncementApiError(
    ERROR_MESSAGES[code] || 'The announcement service could not complete the request.',
    {
      status,
      code,
      field: payload?.field || null,
      retryAfterMs: retryAfterMs(error),
    },
  )
}

export function listAnnouncements(status = 'all') {
  return invoke({ action: 'list', status, limit: 100 })
}

export function listAnnouncementAudit(announcementId) {
  return invoke({ action: 'audit', announcement_id: announcementId, limit: 100 })
}

export function createAnnouncementDraft(payload) {
  return invoke({
    action: 'create_draft',
    request_id: crypto.randomUUID(),
    payload,
  })
}

export function updateAnnouncement(announcement, payload, confirmation = null) {
  return invoke({
    action: 'update',
    request_id: crypto.randomUUID(),
    announcement_id: announcement.id,
    expected_revision: announcement.revision,
    payload,
    ...(announcement.status === 'published'
      ? {
          confirmed: true,
          confirmation_text: confirmation,
        }
      : {}),
  })
}

export function publishAnnouncement(announcement, confirmation = null) {
  return invoke({
    action: 'publish',
    request_id: crypto.randomUUID(),
    announcement_id: announcement.id,
    expected_revision: announcement.revision,
    confirmed: true,
    confirmation_text: confirmation,
  })
}

export function archiveAnnouncement(announcement, confirmation = null) {
  return invoke({
    action: 'archive',
    request_id: crypto.randomUUID(),
    announcement_id: announcement.id,
    expected_revision: announcement.revision,
    confirmed: true,
    confirmation_text: confirmation,
  })
}

export function isHighImpact(announcement) {
  return ['critical', 'maintenance'].includes(announcement?.severity) ||
    announcement?.requires_ack === true ||
    announcement?.dismissible === false
}
