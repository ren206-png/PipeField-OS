/**
 * Stripe webhook: idempotency and out-of-order safety.
 * Stripe and Supabase are faked in memory.
 */

// ── In-memory Supabase fake ────────────────────────────────────
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
let failNextInsertOn: string | null = null

function table(name: string) {
  db[name] ??= []
  const filters: Array<[string, unknown]> = []
  let op: 'select' | 'update' | 'delete' | null = null
  let patch: Row = {}
  const rows = () => db[name].filter(r => filters.every(([k, v]) => r[k] === v))
  const api = {
    insert(row: Row) {
      if (failNextInsertOn === name) { failNextInsertOn = null; return Promise.resolve({ error: { code: '42P01', message: 'boom' } }) }
      if (name === 'stripe_webhook_events' && db[name].some(r => r.id === row.id)) {
        return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } })
      }
      db[name].push({ ...row })
      return Promise.resolve({ error: null })
    },
    select() { op = 'select'; return api },
    update(p: Row) { op = 'update'; patch = p; return api },
    delete() { op = 'delete'; return api },
    eq(k: string, v: unknown) { filters.push([k, v]); return api },
    maybeSingle() { return Promise.resolve({ data: rows()[0] ?? null, error: null }) },
    then(resolve: (v: { error: null }) => void) {
      if (op === 'update') rows().forEach(r => Object.assign(r, patch))
      if (op === 'delete') db[name] = db[name].filter(r => !rows().includes(r))
      resolve({ error: null })
    },
  }
  return api
}
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: table }) }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }))

// ── Stripe fake ─────────────────────────────────────────────────
const liveSubs: Record<string, unknown> = {}
const liveInvoices: Record<string, { status: string }> = {}
let nextEvent: unknown = null
jest.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: () => nextEvent },
    subscriptions: { retrieve: async (id: string) => liveSubs[id] },
    invoices: { retrieve: async (id: string) => liveInvoices[id] },
  }),
}))

import { NextRequest } from 'next/server'

// Env must be set before the route (and its price→tier map) is loaded.
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
process.env.STRIPE_PRICE_STARTER = 'price_starter_test'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { STRIPE_STATUS_MAP } = require('@/lib/stripe-webhook-schemas') as typeof import('@/lib/stripe-webhook-schemas')

const CUSTOMER = 'cus_1'
const PRICE = 'price_starter_test'

function send(event: unknown) {
  nextEvent = event
  return POST(new NextRequest('https://x.test/api/billing/webhook', {
    method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=x' },
  }))
}
const evt = (id: string, type: string, object: unknown) =>
  ({ id, type, object: 'event', created: 1, livemode: false, data: { object } })
const invoice = (id: string) =>
  ({ id, object: 'invoice', customer: CUSTOMER, subscription: 'sub_1', status: 'open', amount_due: 599, amount_paid: 0, currency: 'cad' })
const sub = (status: string) => ({
  id: 'sub_1', object: 'subscription', customer: CUSTOMER, status, trial_end: null,
  current_period_end: 2_000_000_000, items: { data: [{ price: { id: PRICE }, current_period_end: 2_000_000_000 }] },
})
const org = () => db.organizations[0]
const notifications = () => db.notifications ?? []

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  db.organizations = [{ id: 'org_1', stripe_customer_id: CUSTOMER, subscription_status: 'active', subscription_tier: 'starter', grace_period_ends_at: null }]
  for (const k of Object.keys(liveSubs)) delete liveSubs[k]
  for (const k of Object.keys(liveInvoices)) delete liveInvoices[k]
  liveSubs.sub_1 = sub('active')
})

describe('idempotency', () => {
  it('processes an event once and acknowledges the duplicate', async () => {
    liveInvoices.in_1 = { status: 'open' }
    const e = evt('evt_fail_1', 'invoice.payment_failed', invoice('in_1'))
    const r1 = await send(e)
    const r2 = await send(e)
    expect(r1.status).toBe(200)
    expect(await r2.json()).toMatchObject({ received: true, duplicate: true })
    expect(notifications().filter(n => n.type === 'payment_failed')).toHaveLength(1)
    expect(db.stripe_webhook_events.map(r => r.id)).toEqual(['evt_fail_1'])
  })

  it('still processes when the events table is unavailable', async () => {
    liveInvoices.in_1 = { status: 'open' }
    failNextInsertOn = 'stripe_webhook_events'
    const r = await send(evt('evt_x', 'invoice.payment_failed', invoice('in_1')))
    expect(r.status).toBe(200)
    expect(org().subscription_status).toBe('past_due')
  })

  it('releases the claim when handling fails, so Stripe can retry', async () => {
    liveInvoices.in_1 = undefined as unknown as { status: string } // retrieve → undefined → throws
    const r = await send(evt('evt_boom', 'invoice.payment_failed', invoice('in_1')))
    expect(r.status).toBe(500)
    expect((db.stripe_webhook_events ?? []).some(x => x.id === 'evt_boom')).toBe(false)
  })
})

describe('out-of-order safety', () => {
  it('ignores a payment_failed event for an invoice that has since been paid', async () => {
    liveInvoices.in_1 = { status: 'paid' }
    await send(evt('evt_late_fail', 'invoice.payment_failed', invoice('in_1')))
    expect(org().subscription_status).toBe('active')
    expect(org().grace_period_ends_at).toBeNull()
    expect(notifications()).toHaveLength(0)
  })

  it('keeps the original grace period on repeated failures', async () => {
    liveInvoices.in_1 = { status: 'open' }
    await send(evt('evt_f1', 'invoice.payment_failed', invoice('in_1')))
    const first = org().grace_period_ends_at
    await send(evt('evt_f2', 'invoice.payment_failed', invoice('in_1')))
    expect(org().grace_period_ends_at).toBe(first)
  })

  it('subscription.updated uses the live subscription, not the stale event payload', async () => {
    liveSubs.sub_1 = sub('active')
    db.organizations[0].subscription_status = 'trialing'
    await send(evt('evt_stale', 'customer.subscription.updated', sub('past_due')))
    expect(org().subscription_status).toBe(STRIPE_STATUS_MAP.active)
    expect(org().subscription_tier).toBe('starter') // proves the price→tier map matched
  })

  it('a stale subscription.updated after cancellation does not re-activate', async () => {
    liveSubs.sub_1 = sub('canceled')
    db.organizations[0].subscription_status = 'canceled'
    await send(evt('evt_stale2', 'customer.subscription.updated', sub('active')))
    expect(org().subscription_status).toBe('canceled')
  })
})

describe('reactivation notice', () => {
  it('is not sent on a normal renewal', async () => {
    await send(evt('evt_renew', 'invoice.payment_succeeded', { ...invoice('in_2'), status: 'paid', amount_paid: 599 }))
    expect(notifications().filter(n => n.type === 'billing_reactivated')).toHaveLength(0)
  })
  it('is sent when a past-due account recovers', async () => {
    db.organizations[0].subscription_status = 'past_due'
    await send(evt('evt_recover', 'invoice.payment_succeeded', { ...invoice('in_3'), status: 'paid', amount_paid: 599 }))
    expect(org().subscription_status).toBe('active')
    expect(notifications().filter(n => n.type === 'billing_reactivated')).toHaveLength(1)
  })
})
