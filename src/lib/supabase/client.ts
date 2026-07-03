// ============================================================
// Supabase Browser Client
// Used in React components (client-side code).
//
// Note: The <Database> generic type parameter is omitted here
// because Supabase's internal conditional types require exactly
// the format produced by `npx supabase gen types typescript`.
// Hand-written Database types can cause query types to resolve
// to `never`. We use the default untyped client and rely on
// our domain types (src/types/index.ts) for type safety instead.
// Run `npx supabase gen types typescript` in Phase 8 to add
// full type safety here.
// ============================================================
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
