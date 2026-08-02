import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles').select('organization_id').eq('auth_user_id', user.id).maybeSingle()
  if (profileError) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30')

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  const { data, error } = await supabase
    .from('welder_certifications')
    .select('*, welders(full_name, stamp)')
    .eq('organization_id', profile?.organization_id)
    .eq('is_active', true)
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })

  // Return empty array if table doesn't exist yet (migration pending)
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}
