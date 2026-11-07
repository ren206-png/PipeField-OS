/** SEC-004: signature creation checks record ownership, slot, image and duplicates. */
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}

function table(name: string) {
  db[name] ??= []
  const filters: Array<(r: Row) => boolean> = []
  let insertRow: Row | null = null
  const api: Record<string, unknown> = {
    select() { return api },
    eq(k: string, v: unknown) { filters.push(r => r[k] === v); return api },
    insert(r: Row) { insertRow = { id: 'sig-new', ...r }; db[name].push(insertRow); return api },
    maybeSingle: async () => ({ data: db[name].find(r => filters.every(f => f(r))) ?? null, error: null }),
    single: async () => ({ data: insertRow, error: null }),
  }
  return api
}

let caller: Row | null = null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: table }) }))
jest.mock('@/lib/api-auth', () => ({
  requirePermission: async () => (caller ? { caller } : { error: new Response(null, { status: 401 }) }),
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'

const REC = '00000000-0000-0000-0000-0000000000a1'
const IMG = 'data:image/png;base64,AAAA'
const post = (body: Row) =>
  POST(new NextRequest('https://x.test/api/signatures', { method: 'POST', body: JSON.stringify(body) }))
const base = { recordType: 'itp', recordId: REC, role: 'QC Manager', signerName: 'Pat', signatureData: IMG }

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  caller = { id: 'p1', auth_user_id: 'u1', organization_id: 'o1', role: 'qa_inspector' }
  db.itps = [{ id: REC, organization_id: 'o1' }]
})

it('signs a slot on an own-org record and records the submitter', async () => {
  const res = await post(base)
  expect(res.status).toBe(201)
  expect(db.signatures[0]).toMatchObject({ signed_by: 'u1', organization_id: 'o1', role: 'QC Manager' })
})

it('404s a record from another org', async () => {
  db.itps = [{ id: REC, organization_id: 'other' }]
  expect((await post(base)).status).toBe(404)
})

it('rejects unknown record types and slots', async () => {
  expect((await post({ ...base, recordType: 'weld' })).status).toBe(400)
  expect((await post({ ...base, role: 'Owner Rep' })).status).toBe(400)
})

it('rejects a non-image signature payload', async () => {
  expect((await post({ ...base, signatureData: 'hello' })).status).toBe(400)
})

it('refuses to sign a slot twice', async () => {
  expect((await post(base)).status).toBe(201)
  expect((await post({ ...base, signerName: 'Someone Else' })).status).toBe(409)
})
