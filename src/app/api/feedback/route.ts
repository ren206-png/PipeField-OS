// ============================================================
// POST /api/feedback
// Accepts star rating + comment from any authenticated user.
// Anonymous submissions are also accepted (no auth required).
//
// GET /api/feedback
// Returns feedback for the caller's org. Org admins only.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAdmin } from '@/lib/api-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const postSchema = z.object({
  rating:    z.number().int().min(1).max(5),
  category:  z.string().optional().default('general'),
  comment:   z.string().max(2000).nullable().optional(),
  page_url:  z.string().url().nullable().optional(),
})

export async function POST(req: NextRequest) {
  // 10 feedback submissions per IP per 10 minutes
  const ip = getClientIp(req.headers)
  if (!rateLimit({ key: `feedback:${ip}`, limit: 10, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    // ── Validate body ──────────────────────────────────────────
    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { rating, category, comment, page_url } = parsed.data

    // ── Optional auth — anonymous feedback is fine ─────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let userId: string | null = null
    let orgId:  string | null = null

    if (user) {
      const admin = createAdminClient()
      const { data: profile } = await admin
        .from('user_profiles')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      userId = profile?.id              ?? null
      orgId  = profile?.organization_id ?? null
    }

    const admin = createAdminClient()
    const { error } = await admin.from('feedback').insert({
      organization_id: orgId,
      user_id:         userId,
      rating,
      category,
      comment:    comment  ?? null,
      page_url:   page_url ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    })

    if (error) {
      console.error('[/api/feedback]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })

  } catch (err) {
    console.error('[/api/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — returns feedback list for the caller's org (org admins only)
export async function GET() {
  try {
    const { caller, error: authError } = await requireOrgAdmin()
    if (authError) return authError

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('feedback')
      .select('*, user_profiles(full_name, email)')
      .eq('organization_id', caller.organization_id!)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ feedback: data })

  } catch (err) {
    console.error('[GET /api/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
