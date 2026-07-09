// ============================================================
// AI Rate Limiter — Database-backed, Vercel-safe
//
// Uses the ai_invocations table (already written by the engine)
// to count requests per user per hour. Works correctly across
// all Vercel serverless function instances — no Redis required.
//
// Adds ~1 DB query per AI request (counted against Supabase
// free-tier quota, negligible vs the OpenAI call latency).
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'

export interface AiRateLimitOptions {
  userId:         string
  organizationId: string
  capability:     string
  limitPerHour:   number
}

export interface AiRateLimitResult {
  allowed:    boolean
  count:      number
  limit:      number
  resetAt:    string    // ISO timestamp — start of next hour
}

/**
 * Checks whether the user is within their hourly AI request limit.
 * Counts all ai_invocations for this user in the current UTC hour window.
 * Returns { allowed: false } if the limit is exceeded.
 */
export async function checkAiRateLimit({
  userId,
  organizationId,
  capability,
  limitPerHour,
}: AiRateLimitOptions): Promise<AiRateLimitResult> {
  const admin = createAdminClient()

  // Start of current UTC hour
  const now       = new Date()
  const hourStart = new Date(now)
  hourStart.setUTCMinutes(0, 0, 0)

  // Start of next UTC hour (for reset display)
  const resetAt = new Date(hourStart)
  resetAt.setUTCHours(resetAt.getUTCHours() + 1)

  const { count, error } = await admin
    .from('ai_invocations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .gte('invoked_at', hourStart.toISOString())

  // If the query fails (table missing, etc.) — fail open to avoid blocking users
  if (error) {
    console.warn('[ai-rate-limit] count query failed, failing open:', error.message)
    return { allowed: true, count: 0, limit: limitPerHour, resetAt: resetAt.toISOString() }
  }

  const current = count ?? 0

  return {
    allowed: current < limitPerHour,
    count:   current,
    limit:   limitPerHour,
    resetAt: resetAt.toISOString(),
  }
}

// Per-capability hourly limits by role tier
// These are conservative defaults — adjust as usage data comes in
export const AI_HOURLY_LIMITS: Record<string, number> = {
  'rag-qa':               30,
  'document-embedding':   10,
  'welding-guidance':     20,
  'safety-analysis':      20,
  'qa-qc-assistance':     20,
  'pipefitter-assistant': 30,
  'material-takeoff':     10,
  'inspection':           20,
  'fabrication-planning': 10,
  'estimating':           10,
  'scheduling':           10,
  'drawing-analysis':      5,   // GPT-4o vision — most expensive
  'digital-twin':         10,
}

export const DEFAULT_HOURLY_LIMIT = 20
