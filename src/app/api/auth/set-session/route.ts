import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// POST /api/auth/set-session
// Called by the login page after signInWithPassword succeeds.
// Writes auth cookies via HTTP Set-Cookie headers so they are
// immediately available in the next HTTP request — this bypasses
// WKWebView's delayed JS-cookie-to-HTTP-cookie sync, which caused
// "Sign In does not proceed" on iOS.
export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json()

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'Missing tokens' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Record<string, unknown>)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 })
  }

  return response
}
