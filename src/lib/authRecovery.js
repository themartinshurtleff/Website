const PASSWORD_RECOVERY_KEY = 'tradenet_password_recovery_pending'

export function markPasswordRecoveryPending() {
  try {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, '1')
  } catch {
    // Session storage may be unavailable in strict browser contexts.
  }
}

export function clearPasswordRecoveryPending() {
  try {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY)
  } catch {
    // Session storage may be unavailable in strict browser contexts.
  }
}

export function hasPasswordRecoveryPending() {
  try {
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

export function getRecoveryHashSession() {
  const hash = window.location.hash?.replace(/^#/, '')
  if (!hash) return null

  const params = new URLSearchParams(hash)
  if (params.get('type') !== 'recovery') return null

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  }
}

export function isPasswordRecoveryUrl() {
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('type') === 'recovery') return true

  const hash = window.location.hash?.replace(/^#/, '')
  if (!hash) return false

  const hashParams = new URLSearchParams(hash)
  return hashParams.get('type') === 'recovery'
}
