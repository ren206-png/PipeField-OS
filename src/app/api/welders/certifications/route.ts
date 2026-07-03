import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id').eq('auth_user_id', user.id).maybeSingle()

  const { searchParams } = new URL(request.url)
  const welderId = searchParams.get('welderId')

  let query = supabase
    .from('welder_certifications')
    .select('*, welders(full_name, stamp)')
    .eq('organization_id', profile?.organization_id)
    .order('expiry_date', { ascending: true })

  if (welderId) query = query.eq('welder_id', welderId)

  const { data, error } = await query
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id').eq('auth_user_id', user.id).maybeSingle()

  const body = await request.json() as {
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

  const { data, error } = await supabase
    .from('welder_certifications')
    .insert({ ...body, organization_id: profile?.organization_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
