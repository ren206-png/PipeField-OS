// ============================================================
// Map Supabase auth errors to plain-language messages for end users.
// Raw details (status, code, message) belong in the console, not the UI.
// ============================================================

export interface FriendlyAuthError {
  message: string
  needsConfirm: boolean
}

export function friendlyAuthError(error: { message: string; status?: number; code?: string }): FriendlyAuthError {
  const msg = error.message.toLowerCase()
  if (error.code === 'email_not_confirmed' || msg.includes('not confirmed')) {
    return { message: 'Please confirm your email address before signing in.', needsConfirm: true }
  }
  if (error.code === 'invalid_credentials' || msg.includes('invalid login')) {
    return { message: 'Incorrect email or password.', needsConfirm: false }
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit' || msg.includes('rate limit')) {
    return { message: 'Too many sign-in attempts. Please wait a minute and try again.', needsConfirm: false }
  }
  return { message: 'Sign-in failed. Please try again.', needsConfirm: false }
}
