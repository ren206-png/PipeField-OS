// ============================================================
// GET /api/health/deep
// Deep health check: DB, OpenAI, slow queries, env vars,
// circuit breaker states. Requires CRON_SECRET Bearer auth.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllBreakerStates } from '@/lib/circuit-breaker'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean
  latencyMs: number
  detail?: unknown
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    const [orgsRes, usersRes] = await Promise.all([
      admin.from('organizations').select('id', { count: 'exact', head: true }),
      admin.from('user_profiles').select('id', { count: 'exact', head: true }),
    ])
    if (orgsRes.error) throw new Error(orgsRes.error.message)
    if (usersRes.error) throw new Error(usersRes.error.message)
    return {
      ok: true,
      latencyMs: Date.now() - start,
      detail: { organizations: orgsRes.count ?? 0, users: usersRes.count ?? 0 },
    }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

async function checkOpenAI(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(2000),
    })
    // 200 = reachable + valid key; 401 = reachable but bad key — both mean OpenAI is up
    const reachable = res.ok || res.status === 401
    return {
      ok: reachable,
      latencyMs: Date.now() - start,
      detail: { status: res.status },
      error: reachable ? undefined : `Unexpected status ${res.status}`,
    }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

async function checkSlowQueries(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count, error } = await admin
      .from('ai_invocations')
      .select('id', { count: 'exact', head: true })
      .gte('invoked_at', windowStart)
      .gt('latency_ms', 10000)
    if (error) throw new Error(error.message)
    const slowCount = count ?? 0
    return {
      ok: slowCount < 10,
      latencyMs: Date.now() - start,
      detail: { slowQueriesLast15m: slowCount },
      error: slowCount >= 10 ? `${slowCount} slow queries (>10s) in last 15 min` : undefined,
    }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

function checkEnvVars(): CheckResult {
  const required = ['OPENAI_API_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(k => !process.env[k])
  return {
    ok: missing.length === 0,
    latencyMs: 0,
    detail: { missing, present: required.filter(k => !!process.env[k]) },
    error: missing.length > 0 ? `Missing env vars: ${missing.join(', ')}` : undefined,
  }
}

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overall = await Promise.race([
    Promise.allSettled([
      checkDatabase(),
      checkOpenAI(),
      checkSlowQueries(),
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Deep health check timed out after 5000ms')), 5000)
    ),
  ]).catch((err: Error) => ({ timedOut: true, message: err.message }))

  if ('timedOut' in overall) {
    return NextResponse.json({ status: 'unhealthy', error: overall.message }, { status: 503 })
  }

  const results = overall as PromiseSettledResult<CheckResult>[]
  const [dbResult, openaiResult, slowResult] = results

  const db     = dbResult.status     === 'fulfilled' ? dbResult.value     : { ok: false, latencyMs: 0, error: String(dbResult.reason) }
  const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : { ok: false, latencyMs: 0, error: String(openaiResult.reason) }
  const slow   = slowResult.status   === 'fulfilled' ? slowResult.value   : { ok: false, latencyMs: 0, error: String(slowResult.reason) }
  const env    = checkEnvVars()

  const breakerStates = getAllBreakerStates()

  const dbOk    = db.ok
  const allOk   = dbOk && openai.ok && slow.ok && env.ok
  const status  = allOk ? 'healthy' : !dbOk ? 'unhealthy' : 'degraded'
  const httpStatus = allOk ? 200 : !dbOk ? 503 : 207

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database:    db,
        openai,
        slowQueries: slow,
        envVars:     env,
      },
      circuitBreakers: breakerStates,
    },
    { status: httpStatus }
  )
}
