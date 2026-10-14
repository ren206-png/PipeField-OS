// ============================================================
// Login error messages shown to end users (incl. App Store reviewers)
// must be plain language: no status codes, raw JSON or dashboard tips.
// ============================================================

import { friendlyAuthError } from '@/lib/auth/friendly-error'

test('wrong email or password', () => {
  expect(friendlyAuthError({ message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' }))
    .toEqual({ message: 'Incorrect email or password.', needsConfirm: false })
})

test('wrong email or password, older error without a code', () => {
  expect(friendlyAuthError({ message: 'Invalid login credentials', status: 400 }).message)
    .toBe('Incorrect email or password.')
})

test('unconfirmed email asks the user to check their inbox', () => {
  expect(friendlyAuthError({ message: 'Email not confirmed', status: 400, code: 'email_not_confirmed' }))
    .toEqual({ message: 'Please confirm your email address before signing in.', needsConfirm: true })
})

test('rate limiting', () => {
  expect(friendlyAuthError({ message: 'Request rate limit reached', status: 429 }).message)
    .toBe('Too many sign-in attempts. Please wait a minute and try again.')
})

test('anything else gets a generic message without internals', () => {
  const { message } = friendlyAuthError({ message: 'captcha protection: request disallowed (no captcha response)', status: 400 })
  expect(message).toBe('Sign-in failed. Please try again.')
  expect(message).not.toMatch(/captcha|supabase|\d{3}/i)
})
