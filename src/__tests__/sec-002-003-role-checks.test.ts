/** SEC-002 / SEC-003: server-side role checks and offline weld sync allowlist. */
let caller: Record<string, unknown> | null = null

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      q.select = () => q; q.eq = () => q
      q.maybeSingle = async () => ({
        data: table === 'user_profiles' ? caller : table === 'projects' ? { id: 'proj-1' } : null,
        error: null,
      })
      return q
    },
  }),
}))
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: caller ? { id: 'u1' } : null } }) } }),
}))
jest.mock('@/lib/api-billing-guard', () => ({ requireActiveBilling: async () => null }))
jest.mock('@/intelligence/flags', () => ({ OFFLINE_FIELD_ENABLED: true, isFlagEnabled: () => false }))

const createWeld = jest.fn(async () => ({ ok: true, weld: { id: 'w-new' } }))
jest.mock('@/lib/welds/create-weld', () => {
  const actual = jest.requireActual('@/lib/welds/create-weld')
  return { ...actual, createWeld: (...a: unknown[]) => (createWeld as jest.Mock)(...a) }
})

import { NextRequest } from 'next/server'
import * as apiAuth from '@/lib/api-auth'
import { hasPermission, isWeldApprovalStatus } from '@/lib/auth/permissions'

const ME = { id: 'p1', auth_user_id: 'u1', organization_id: 'o1', full_name: 'Sam', status: 'active' }

beforeEach(() => {
  createWeld.mockClear()
})

describe('permission matrix', () => {
  it('client_viewer cannot write, pipefitter cannot approve', () => {
    expect(hasPermission('client_viewer', 'welds:update')).toBe(false)
    expect(hasPermission('pipefitter', 'welds:approve')).toBe(false)
    expect(hasPermission('qa_inspector', 'welds:approve')).toBe(true)
  })
  it('flags inspection verdicts as approval statuses', () => {
    expect(isWeldApprovalStatus('accepted')).toBe(true)
    expect(isWeldApprovalStatus('failed')).toBe(true)
    expect(isWeldApprovalStatus('welded')).toBe(false)
    expect(isWeldApprovalStatus(undefined)).toBe(false)
  })
})

describe('requirePermission', () => {
  const req = new NextRequest('https://x.test/api/welds', { method: 'POST' })
  it('403s a role without the permission', async () => {
    caller = { ...ME, role: 'client_viewer' }
    const r = await apiAuth.requirePermission(req, 'welds:create')
    expect(r.error?.status).toBe(403)
  })
  it('passes when the role has any of the listed permissions', async () => {
    caller = { ...ME, role: 'qa_inspector' }
    const r = await apiAuth.requirePermission(req, ['projects:update', 'welds:approve'])
    expect(r.caller?.role).toBe('qa_inspector')
  })
  it('401s when signed out', async () => {
    caller = null
    expect((await apiAuth.requirePermission(req, 'welds:read')).error?.status).toBe(401)
  })
})

describe('createWeld approval gate', () => {
  it('refuses an approval status for a pipefitter before touching the DB', async () => {
    const { createWeld: real } = jest.requireActual('@/lib/welds/create-weld')
    const res = await real({ ...ME, role: 'pipefitter' }, { project_id: '00000000-0000-0000-0000-000000000001', weld_id_number: 'W1', status: 'accepted' })
    expect(res).toMatchObject({ ok: false, status: 403 })
  })
})

describe('POST /api/welds/sync-queue', () => {
  const post = async (payload: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/welds/sync-queue/route')
    return POST(new NextRequest('https://x.test/api/welds/sync-queue', {
      method: 'POST',
      body: JSON.stringify({ items: [{ local_id: 'l1', project_id: '00000000-0000-0000-0000-000000000001', payload }] }),
    }))
  }

  it('drops server-owned fields instead of spreading the payload', async () => {
    caller = { ...ME, role: 'pipefitter' }
    const res = await post({
      weld_id_number: 'W-9', created_by: 'someone-else', spool_id: 'foreign-spool',
      qualification_flag: null, organization_id: 'other-org',
    })
    expect(res.status).toBe(200)
    expect(createWeld).toHaveBeenCalledTimes(1)
    {
      const input = (createWeld.mock.calls[0] as unknown[])[1] as Record<string, unknown>
      expect(input).not.toHaveProperty('created_by')
      expect(input).not.toHaveProperty('spool_id')
      expect(input).not.toHaveProperty('qualification_flag')
      expect(input).not.toHaveProperty('organization_id')
      expect(input.weld_id_number).toBe('W-9')
    }
  })

  it('403s a client_viewer', async () => {
    caller = { ...ME, role: 'client_viewer' }
    expect((await post({ weld_id_number: 'W-1' })).status).toBe(403)
  })
})
