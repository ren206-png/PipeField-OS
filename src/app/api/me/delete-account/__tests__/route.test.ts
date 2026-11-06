/** Self-service account deletion: Supabase, Stripe and auth are faked. */
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}

function table(name: string) {
  db[name] ??= []
  const filters: Array<(r: Row) => boolean> = []
  let op: 'select' | 'update' | 'delete' = 'select'
  let patch: Row = {}
  let head = false
  const rows = () => db[name].filter(r => filters.every(f => f(r)))
  const api: Record<string, unknown> = {
    select(_c?: string, o?: { count?: string; head?: boolean }) { op = 'select'; head = !!o?.head; return api },
    update(p: Row) { op = 'update'; patch = p; return api },
    delete() { op = 'delete'; return api },
    eq(k: string, v: unknown) { filters.push(r => r[k] === v); return api },
    neq(k: string, v: unknown) { filters.push(r => r[k] !== v); return api },
    maybeSingle() { return Promise.resolve({ data: rows()[0] ?? null, error: null }) },
    then(resolve: (v: unknown) => void) {
      if (op === 'update') rows().forEach(r => Object.assign(r, patch))
      if (op === 'delete') { const del = rows(); db[name] = db[name].filter(r => !del.includes(r)) }
      resolve(head ? { count: rows().length, error: null } : { data: rows(), error: null })
    },
  }
  return api
}

const deleteUser = jest.fn(async () => ({ error: null }))
const cancelSub = jest.fn(async () => ({}))
let caller: Record<string, unknown> | null = null

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: table, auth: { admin: { deleteUser } } }),
}))
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ subscriptions: { cancel: cancelSub } }) }))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/api-auth', () => ({
  requireAuth: async () => (caller ? { caller } : { error: new Response(null, { status: 401 }) }),
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'

const post = (body: unknown) =>
  POST(new NextRequest('https://x.test/api/me/delete-account', { method: 'POST', body: JSON.stringify(body) }))

const ME = { id: 'p1', auth_user_id: 'u1', organization_id: 'o1', role: 'pipefitter', full_name: 'Sam', status: 'active' }

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  deleteUser.mockClear(); cancelSub.mockClear()
  caller = { ...ME }
  db.user_profiles = [{ id: 'p1', organization_id: 'o1', is_active: true, full_name: 'Sam', email: 'sam@x.com', phone: '555', welder_stamp: 'S-12', avatar_url: 'a.png', status: 'active' }]
  db.organizations = [{ id: 'o1', stripe_subscription_id: 'sub_1', subscription_status: 'active' }]
  db.personal_work_log = [{ user_id: 'u1' }, { user_id: 'u2' }]
  db.push_subscriptions = [{ user_id: 'u1' }]
  db.notifications = [{ user_id: 'p1' }, { user_id: 'p2' }]
  db.knowledge_permissions = [{ granted_to_user: 'u1' }]
  db.welds = [{ id: 'w1', created_by: 'p1' }]
})

it('requires typing DELETE', async () => {
  expect((await post({ confirm: 'delete' })).status).toBe(400)
  expect(deleteUser).not.toHaveBeenCalled()
})

it('refuses platform admins', async () => {
  caller = { ...ME, role: 'platform_admin' }
  expect((await post({ confirm: 'DELETE' })).status).toBe(403)
})

it('requires sign-in', async () => {
  caller = null
  expect((await post({ confirm: 'DELETE' })).status).toBe(401)
})

it('scrubs the profile, deletes personal data, soft-deletes the login, keeps QC records', async () => {
  const res = await post({ confirm: 'DELETE' })
  expect(res.status).toBe(200)
  expect(db.user_profiles[0]).toMatchObject({
    full_name: 'Deleted user', email: 'deleted-p1@deleted.invalid', phone: null,
    welder_stamp: null, avatar_url: null, is_active: false, status: 'deactivated',
  })
  expect(db.personal_work_log).toEqual([{ user_id: 'u2' }])
  expect(db.push_subscriptions).toEqual([])
  expect(db.notifications).toEqual([{ user_id: 'p2' }])
  expect(db.knowledge_permissions).toEqual([])
  expect(deleteUser).toHaveBeenCalledWith('u1', true)
  expect(db.welds).toEqual([{ id: 'w1', created_by: 'p1' }])
})

it('cancels the subscription when the user is the only active member', async () => {
  await post({ confirm: 'DELETE' })
  expect(cancelSub).toHaveBeenCalledWith('sub_1')
})

it('does not touch the subscription when other members remain', async () => {
  db.user_profiles.push({ id: 'p2', organization_id: 'o1', is_active: true })
  await post({ confirm: 'DELETE' })
  expect(cancelSub).not.toHaveBeenCalled()
})

it('does not cancel an already-cancelled subscription', async () => {
  db.organizations[0].subscription_status = 'canceled'
  await post({ confirm: 'DELETE' })
  expect(cancelSub).not.toHaveBeenCalled()
})

it('returns 500 and leaves the login if the auth delete fails', async () => {
  deleteUser.mockResolvedValueOnce({ error: { message: 'nope' } } as never)
  expect((await post({ confirm: 'DELETE' })).status).toBe(500)
})
