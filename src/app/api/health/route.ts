// ============================================================
// GET /api/health
// No auth required. Returns DB connectivity status.
// 200 = healthy, 503 = degraded.
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })

    const latency = Date.now() - start

    if (error) {
      return NextResponse.json(
        { status: 'degraded', error: error.message, latency, timestamp: new Date().toISOString() },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { status: 'healthy', latency, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (err) {
    const latency = Date.now() - start
    return NextResponse.json(
      {
        status: 'degraded',
        error: err instanceof Error ? err.message : 'Unknown error',
        latency,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
