// ============================================================
// GET /api/health
// System health check: DB, auth, storage, and env-var inventory.
// Returns 200 if all critical systems are healthy, 503 otherwise.
// Safe to hit unauthenticated — no user data is exposed.
// Suitable for uptime monitors (UptimeRobot, Checkly, etc.).
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean
  latencyMs: number
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('organizations').select('id', { count: 'exact', head: true })
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

async function checkAuth(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    // Listing 1 user verifies the service-role key is valid
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    // Listing buckets verifies storage connectivity with service-role key
    const { error } = await admin.storage.listBuckets()
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

/** Returns a map of required env vars → whether they are present (never their values). */
function checkEnvVars(): { ok: boolean; missing: string[]; present: string[] } {
  const REQUIRED = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  const OPTIONAL = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
    'INTERNAL_API_SECRET',
    'SENTRY_DSN',
  ]

  const missing = REQUIRED.filter(k => !process.env[k])
  const present = [...REQUIRED, ...OPTIONAL].filter(k => !!process.env[k])

  return { ok: missing.length === 0, missing, present }
}

export async function GET() {
  const [db, auth, storage] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkStorage(),
  ])

  const env = checkEnvVars()

  // Storage failure is degraded (non-critical to auth flow) — but DB/auth failure is critical.
  const critical = db.ok && auth.ok && env.ok
  const allOk    = critical && storage.ok
  const httpStatus = allOk ? 200 : critical ? 207 : 503

  return NextResponse.json(
    {
      status:    allOk ? 'healthy' : critical ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version:   process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
      checks: {
        database: db,
        auth,
        storage,
        env: {
          ok:      env.ok,
          // Never expose secret variable names — return counts only.
          // An attacker learning which secrets are absent makes targeted
          // attacks easier on misconfigured deployments.
          missing: env.missing.length,   // count only
          present: env.present.length,   // count only
        },
      },
    },
    { status: httpStatus }
  )
}
