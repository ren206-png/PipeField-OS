// ============================================================
// POST /api/errors
// No auth required — client errors must be loggable even when
// auth is broken. Auth is attempted opportunistically.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCallerProfile } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Zod schema with strict length limits to prevent log injection and DB bloat.
// The endpoint is unauthenticated so these limits are the only abuse mitigation.
const ErrorPayloadSchema = z.object({
  message:   z.string().min(1).max(2000),
  stack:     z.string().max(10000).optional(),
  url:       z.string().max(500).optional(),
  component: z.string().max(200).optional(),
  severity:  z.enum(['error', 'warning', 'info']).default('error'),
})

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const parsed = ErrorPayloadSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const body = parsed.data

    // Attempt auth — never throw if it fails
    let organizationId: string | null = null
    let userId: string | null = null

    try {
      const caller = await getCallerProfile()
      if (caller) {
        organizationId = caller.organization_id
        userId = caller.auth_user_id
      }
    } catch {
      // Auth failed — proceed anonymously
    }

    const supabase = await createClient()

    const { error: insertError } = await supabase.from('error_logs').insert({
      organization_id: organizationId,
      user_id:         userId,
      message:         body.message,
      stack:           body.stack    ?? null,
      url:             body.url      ?? null,
      component:       body.component ?? null,
      severity:        body.severity,
    })

    if (insertError) {
      console.error('[/api/errors] insert failed:', insertError.message)
      return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[/api/errors]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
