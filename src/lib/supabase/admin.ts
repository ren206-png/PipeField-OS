// ============================================================
// Supabase Admin Client
// Uses the service role key — bypasses ALL Row Level Security.
// ONLY use this in server-side API routes, never in the browser.
// The service role key must stay server-side only.
// ============================================================
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. ' +
      'Add it to .env.local — found in Supabase Dashboard → Settings → API.'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
    },
  })
}
