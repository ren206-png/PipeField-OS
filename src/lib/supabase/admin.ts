// ============================================================
// Supabase Admin Client
// Uses the service role key — bypasses ALL Row Level Security.
// ONLY use this in server-side API routes, never in the browser.
// The service role key must stay server-side only.
//
// Singleton pattern: one client instance per Node.js process so
// we don't exhaust the DB connection pool on high-traffic routes.
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. ' +
      'Add it to .env.local — found in Supabase Dashboard → Settings → API.'
    )
  }

  _adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
    },
  })

  return _adminClient
}
