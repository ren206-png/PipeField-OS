import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Always redirect to login regardless of signOut outcome
  return NextResponse.redirect(new URL('/login', req.url))
}
