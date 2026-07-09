// ============================================================
// POST /api/errors
// No auth required — client errors must be loggable even when
// auth is broken. Auth is attempted opportunistically.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCallerProfile } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

interface ErrorPayload {
  message: string
  stack?: string
  url?: string
  component?: string
  severity?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ErrorPayload = await request.json()

    if (!body.message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

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
      user_id: userId,
      message: body.message,
      stack: body.stack ?? null,
      url: body.url ?? null,
      component: body.component ?? null,
      severity: body.severity ?? 'error',
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
