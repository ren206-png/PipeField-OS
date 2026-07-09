// ============================================================
// apiFetch — authenticated fetch wrapper
// Reads the active Supabase session and injects
// Authorization: Bearer <access_token> on every request.
// This guarantees API routes can validate the caller even when
// the SSR cookie is missing or stale.
// ============================================================
import { createClient } from '@/lib/supabase/client'

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Don't set Content-Type for FormData — browser sets it with boundary automatically
  const isFormData = init.body instanceof FormData
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' }

  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(init.headers as Record<string, string> ?? {}),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}
