jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))
import { needsBillingCheck } from '../api-auth'
import { getLockoutReason } from '../billing-access'
import type { Organization } from '@/types'

describe('needsBillingCheck', () => {
  test('writes to data routes are checked', () => {
    expect(needsBillingCheck('POST', '/api/welds', 'qc_inspector')).toBe(true)
    expect(needsBillingCheck('patch', '/api/projects/123', 'organization_owner')).toBe(true)
    expect(needsBillingCheck('DELETE', '/api/spools/9', 'administrator')).toBe(true)
  })
  test('reads are never checked', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(needsBillingCheck(m, '/api/welds', 'welder')).toBe(false)
  })
  test('billing, auth, me, support and notification routes stay open', () => {
    for (const p of ['/api/billing/checkout', '/api/billing', '/api/auth/callback', '/api/me',
                     '/api/me/digest-preference', '/api/contact', '/api/feedback', '/api/notifications/read'])
      expect(needsBillingCheck('POST', p, 'organization_owner')).toBe(false)
  })
  test('prefix match is on whole segments', () => {
    expect(needsBillingCheck('POST', '/api/meetings', 'welder')).toBe(true)
    expect(needsBillingCheck('POST', '/api/billingx', 'welder')).toBe(true)
  })
  test('platform admins are never locked out', () => {
    expect(needsBillingCheck('POST', '/api/welds', 'platform_admin')).toBe(false)
  })
})

describe('getLockoutReason (current rules)', () => {
  const past = new Date(Date.now() - 86_400_000).toISOString()
  const future = new Date(Date.now() + 86_400_000).toISOString()
  const org = (o: Partial<Organization>) => ({ subscription_status: 'active', subscription_tier: 'starter', trial_ends_at: null, grace_period_ends_at: null, ...o }) as Organization
  test('active and trialing orgs are not locked', () => {
    expect(getLockoutReason(org({}))).toBeNull()
    expect(getLockoutReason(org({ subscription_status: 'trialing', subscription_tier: 'free_trial' }))).toBeNull()
  })
  test('past_due is locked only after grace ends', () => {
    expect(getLockoutReason(org({ subscription_status: 'past_due', grace_period_ends_at: future }))).toBeNull()
    expect(getLockoutReason(org({ subscription_status: 'past_due', grace_period_ends_at: past }))).toBe('payment_failed')
  })
  test('cancelled trial past its end date is locked', () => {
    expect(getLockoutReason(org({ subscription_status: 'canceled', subscription_tier: 'free_trial', trial_ends_at: past }))).toBe('trial_expired')
  })
})
