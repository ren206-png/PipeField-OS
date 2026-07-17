import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const admin = createAdminClient()
  const welderId = req.nextUrl.searchParams.get('welderId')

  let query = admin
    .from('welder_certifications')
    .select('*, welders(full_name, stamp)')
    .eq('organization_id', caller.organization_id)
    .order('expiry_date', { ascending: true })

  if (welderId) query = query.eq('welder_id', welderId)

  const { data, error } = await query
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const body = await req.json() as {
    welder_id: string
    cert_type: string
    cert_number?: string
    cert_processes?: string[]
    cert_positions?: string[]
    issued_date?: string
    expiry_date: string
    issued_by?: string
    notes?: string
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('welder_certifications')
    .insert({ ...body, organization_id: caller.organization_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
