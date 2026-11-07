/** SEC-005 share links, SEC-006 invites, SEC-009 ownership changes. */
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}

function table(name: string) {
  db[name] ??= []
  const filters: Array<(r: Row) => boolean> = []
  let pending: { op: 'insert' | 'update'; row: Row } | null = null
  const rows = () => db[name].filter(r => filters.every(f => f(r)))
  const api: Record<string, unknown> = {
    select() { return api },
    order() { return api },
    eq(k: string, v: unknown) { filters.push(r => r[k] === v); return api },
    insert(r: Row) { pending = { op: 'insert', row: { id: `${name}-new`, ...r } }; db[name].push(pending.row); return api },
    update(r: Row) { pending = { op: 'update', row: r }; return api },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    single: async () => ({ data: pending?.row ?? rows()[0] ?? null, error: null }),
    then(resolve: (v: unknown) => void) {
      if (pending?.op === 'update') rows().forEach(r => Object.assign(r, pending!.row))
      resolve({ data: rows(), error: null })
    },
  }
  return api
}

const updateUserById = jest.fn(async () => ({}))
let caller: Row | null = null
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: table,
    auth: { admin: {
      updateUserById,
      getUserById: async () => ({ data: { user: { email: 'invited@x.com', created_at: new Date().toISOString() } } }),
    } },
  }),
}))
jest.mock('@/lib/api-auth', () => {
  const ORG_ADMIN_ROLES = ['platform_admin', 'organization_owner', 'administrator']
  const ok = () => (caller ? { caller } : { error: new Response(null, { status: 401 }) })
  return {
    ORG_ADMIN_ROLES,
    requireAuth: async () => ok(),
    requirePermission: async () => ok(),
    requireOrgAdmin: async () =>
      caller && ORG_ADMIN_ROLES.includes(caller.role as string) ? { caller } : { error: new Response(null, { status: 403 }) },
  }
})
jest.mock('@/lib/rate-limit', () => ({ rateLimit: () => true, getClientIp: () => '1.1.1.1' }))
jest.mock('@/lib/email', () => ({ sendWelcomeEmail: async () => {} }))

import { NextRequest } from 'next/server'

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`https://x.test${url}`, { method, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  updateUserById.mockClear()
})

describe('SEC-005 share links', () => {
  const P = '00000000-0000-0000-0000-0000000000b1'
  beforeEach(() => { db.projects = [{ id: P, organization_id: 'o1' }] })
  const create = async (body: Row) => (await import('@/app/api/share-links/route')).POST(req('/api/share-links', 'POST', body))

  it('defaults to a 90-day expiry', async () => {
    caller = { auth_user_id: 'u1', organization_id: 'o1', role: 'project_manager' }
    expect((await create({ label: 'Owner', projectId: P })).status).toBe(201)
    const exp = new Date(db.client_share_links[0].expires_at as string).getTime()
    expect(Math.round((exp - Date.now()) / 86_400_000)).toBe(90)
  })
  it('rejects expiry over a year and in the past', async () => {
    caller = { auth_user_id: 'u1', organization_id: 'o1', role: 'project_manager' }
    const far = new Date(Date.now() + 400 * 86_400_000).toISOString()
    expect((await create({ label: 'x', projectId: P, expiresAt: far })).status).toBe(400)
    expect((await create({ label: 'x', projectId: P, expiresAt: '2020-01-01T00:00:00.000Z' })).status).toBe(400)
  })
  it('only admins may share all projects', async () => {
    caller = { auth_user_id: 'u1', organization_id: 'o1', role: 'project_manager' }
    expect((await create({ label: 'all' })).status).toBe(403)
    caller = { auth_user_id: 'u1', organization_id: 'o1', role: 'administrator' }
    expect((await create({ label: 'all' })).status).toBe(201)
  })
})

describe('SEC-009 ownership', () => {
  const W = '00000000-0000-0000-0000-0000000000c1'
  const patch = async (body: Row) =>
    (await import('@/app/api/organization/workers/route')).PATCH(req('/api/organization/workers', 'PATCH', body))

  it('an administrator cannot grant ownership or change the owner', async () => {
    caller = { auth_user_id: 'admin', organization_id: 'o1', role: 'administrator' }
    db.user_profiles = [{ id: W, organization_id: 'o1', role: 'foreman', auth_user_id: 'w' }]
    expect((await patch({ worker_profile_id: W, role: 'organization_owner' })).status).toBe(403)
    db.user_profiles = [{ id: W, organization_id: 'o1', role: 'organization_owner', auth_user_id: 'w' }]
    expect((await patch({ worker_profile_id: W, role: 'pipefitter' })).status).toBe(403)
  })
  it('nobody changes their own role', async () => {
    caller = { auth_user_id: 'admin', organization_id: 'o1', role: 'administrator' }
    db.user_profiles = [{ id: W, organization_id: 'o1', role: 'administrator', auth_user_id: 'admin' }]
    expect((await patch({ worker_profile_id: W, role: 'organization_owner' })).status).toBe(403)
  })
  it('an administrator can still change a normal member', async () => {
    caller = { auth_user_id: 'admin', organization_id: 'o1', role: 'administrator' }
    db.user_profiles = [{ id: W, organization_id: 'o1', role: 'foreman', auth_user_id: 'w' }]
    expect((await patch({ worker_profile_id: W, role: 'qa_inspector' })).status).toBe(200)
    expect(db.user_profiles[0].role).toBe('qa_inspector')
  })
  it('the owner can hand over ownership', async () => {
    caller = { auth_user_id: 'own', organization_id: 'o1', role: 'organization_owner' }
    db.user_profiles = [{ id: W, organization_id: 'o1', role: 'administrator', auth_user_id: 'w' }]
    expect((await patch({ worker_profile_id: W, role: 'organization_owner' })).status).toBe(200)
  })
})

describe('SEC-006 invites', () => {
  const U = '00000000-0000-0000-0000-0000000000d1'
  const register = async (email: string) =>
    (await import('@/app/api/register/route')).POST(req('/api/register', 'POST', {
      authUserId: U, email, fullName: 'New Person', inviteToken: 'tok',
    }))
  beforeEach(() => {
    db.pending_invites = [{ id: 'i1', token: 'tok', email: 'invited@x.com', role: 'administrator',
      organization_id: 'o1', status: 'pending', expires_at: new Date(Date.now() + 86_400_000).toISOString() }]
    db.organizations = [{ id: 'o1', name: 'Acme' }]
  })

  it('refuses an invite token used with a different email, without confirming it', async () => {
    // getUserById fake returns invited@x.com; registering as someone else fails the ownership check first,
    // so simulate a stolen token: the auth user's own email differs from the invite's.
    db.pending_invites[0].email = 'boss@x.com'
    const res = await register('invited@x.com')
    expect(res.status).toBe(403)
    expect(db.user_profiles ?? []).toHaveLength(0)
    expect(updateUserById).not.toHaveBeenCalled()
    expect(db.pending_invites[0].status).toBe('pending')
  })

  it('accepts the invite for the invited email', async () => {
    const res = await register('invited@x.com')
    expect(res.status).toBe(201)
    expect(db.user_profiles[0]).toMatchObject({ organization_id: 'o1', role: 'administrator' })
    expect(updateUserById).toHaveBeenCalledWith(U, { email_confirm: true })
  })
})
