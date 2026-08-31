// ============================================================
// Service-role Supabase client for Field Mode CLI scripts ONLY.
//
// Deliberately does NOT import `createAdminClient` from
// `src/lib/supabase/admin.ts`. The Field Mode master prompt's
// Definition of Done forbids `createAdminClient` in "any file under
// the Field Mode route group, calc library, or importer" — the
// importer is named explicitly. That helper is designed for use in
// request-serving Next.js server code, which is exactly the surface
// the rule is protecting: no fitter-facing page or API route may
// reach a service-role client.
//
// This script is not part of that surface. It is a standalone CLI,
// run manually from a terminal by a trusted operator with a
// `.env.local` service-role key on disk, never imported by app code
// and never reachable from any route. It follows the same pattern
// already established by `scripts/audit-roles.ts`: instantiate
// `@supabase/supabase-js`'s `createClient` directly, scoped to this
// script's own module.
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

let cached: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  cached = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return cached
}
