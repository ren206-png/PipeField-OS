/** SEC-010: weekly digest cron must fail closed when CRON_SECRET is unset. */
const from = jest.fn(() => { throw new Error('should not reach the database') })
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { NextRequest } from 'next/server'
import { GET } from '../route'

const call = (auth?: string) =>
  GET(new NextRequest('https://x.test/api/cron/weekly-digest', auth ? { headers: { authorization: auth } } : undefined))

const ORIGINAL = process.env.CRON_SECRET
afterAll(() => { process.env.CRON_SECRET = ORIGINAL })

it('rejects every request when CRON_SECRET is unset', async () => {
  delete process.env.CRON_SECRET
  expect((await call()).status).toBe(401)
  expect((await call('Bearer undefined')).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
})

it('rejects a wrong secret', async () => {
  process.env.CRON_SECRET = 's3cret'
  expect((await call('Bearer nope')).status).toBe(401)
})
