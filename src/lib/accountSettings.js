import { supabase } from '@/lib/supabase'

const ERROR_MESSAGES = {
  invalid_current_password: 'The current password is incorrect.',
  current_password_required: 'Enter your current password.',
  confirmation_email_mismatch: 'Type your current email address exactly as shown.',
  billing_review_required: 'This account has billing or commission history and must be reviewed before deletion.',
  admin_account_protected: 'Administrator accounts cannot be deleted from the website.',
  account_not_found: 'This account no longer exists.',
  invalid_auth: 'Your session has expired. Sign in again.',
  missing_auth: 'Sign in again before changing account settings.',
  origin_denied: 'Account deletion is not available from this site origin.',
  account_delete_failed: 'The account could not be deleted. No changes were made.',
}

export class AccountSettingsError extends Error {
  constructor(code, message = null, status = 0) {
    super(message || ERROR_MESSAGES[code] || 'The account change could not be completed.')
    this.name = 'AccountSettingsError'
    this.code = code
    this.status = status
  }
}

function authError(error, fallback) {
  const code = error?.code || 'account_update_failed'
  const messages = {
    invalid_credentials: 'The current password is incorrect.',
    weak_password: error?.message || 'Choose a stronger password.',
    same_password: 'Choose a password you have not used for this account.',
    email_exists: 'That email address is already connected to an account.',
    user_already_exists: 'That email address is already connected to an account.',
    email_address_invalid: 'Enter a valid email address.',
    over_email_send_rate_limit: 'Too many email requests were made. Wait a few minutes and try again.',
    reauthentication_needed: 'Confirm your identity again before changing this setting.',
  }
  return new AccountSettingsError(code, messages[code] || error?.message || fallback)
}

async function responsePayload(error) {
  const response = error?.context
  if (!(response instanceof Response)) return null
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

export async function changePassword(currentPassword, newPassword) {
  const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser()
  const currentUser = currentUserData?.user
  if (currentUserError || !currentUser?.id || !currentUser.email) {
    throw new AccountSettingsError('missing_auth')
  }

  // Reauthenticate explicitly so the current password is verified even if the
  // hosted Auth setting that requires it on update is ever changed.
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  })
  if (signInError || signInData.user?.id !== currentUser.id) {
    throw new AccountSettingsError('invalid_current_password')
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  })
  if (error) throw authError(error, 'The password could not be updated.')

  const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
  return {
    user: data.user,
    otherSessionsRevoked: !revokeError,
  }
}

export async function requestEmailChange(currentEmail, currentPassword, newEmail) {
  const normalizedCurrent = currentEmail.trim().toLowerCase()
  const normalizedNext = newEmail.trim().toLowerCase()
  if (normalizedNext === normalizedCurrent) {
    throw new AccountSettingsError('email_unchanged', 'Enter a different email address.')
  }

  const { data: signInData, error: signInError } = await supabase.auth
    .signInWithPassword({ email: normalizedCurrent, password: currentPassword })
  if (signInError) throw authError(signInError, 'The current password could not be verified.')
  if (!signInData.user || signInData.user.email?.toLowerCase() !== normalizedCurrent) {
    throw new AccountSettingsError('invalid_current_password')
  }

  const redirectTo = new URL('/auth/confirm', window.location.origin).toString()
  const { data, error } = await supabase.auth.updateUser(
    { email: normalizedNext },
    { emailRedirectTo: redirectTo },
  )
  if (error) throw authError(error, 'The email change could not be started.')
  return data
}

export async function syncAccountEmail() {
  const { data, error } = await supabase.functions.invoke('sync-account-email', { body: {} })
  if (!error && data?.synced) return data

  const payload = await responsePayload(error)
  const status = error?.context instanceof Response ? error.context.status : 0
  const code = payload?.error || 'account_email_sync_failed'
  throw new AccountSettingsError(code, 'Your sign-in email changed, but billing details could not be synced.', status)
}

async function invokeDeleteAccount(body, allowRefresh = true) {
  const { data, error } = await supabase.functions.invoke('delete-account', { body })
  if (!error) return data

  const payload = await responsePayload(error)
  const status = error.context instanceof Response ? error.context.status : 0
  const code = payload?.error || 'account_delete_failed'

  if (status === 401 && allowRefresh) {
    const refreshed = await supabase.auth.refreshSession()
    if (!refreshed.error && refreshed.data.session) {
      return invokeDeleteAccount(body, false)
    }
  }

  throw new AccountSettingsError(code, ERROR_MESSAGES[code], status)
}

export async function deleteAccount(currentEmail, password) {
  const data = await invokeDeleteAccount({
    confirmation_email: currentEmail.trim().toLowerCase(),
    password,
  })
  if (!data?.deleted) throw new AccountSettingsError('account_delete_failed')
  return data
}
