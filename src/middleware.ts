// ============================================================
// Next.js Middleware — Session refresh + Route Protection
//
// CRITICAL: The session refresh (supabase.auth.getUser()) MUST
// run on EVERY request — including API routes. Skipping API
// routes was the root cause of persistent 401s: the access token
// expires after 1 hour, and without middleware refreshing it and
// writing the new token back to the response cookies, every API
// call fails permanently until the user manually signs out/in.
//
// API routes are NOT redirected to /login — they get a pass-through
// after the refresh so they receive a valid session cookie.
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that skip redirect-to-login (but still get session refresh)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/invite',
  '/share/',
  '/billing',
  '/api/',             // API routes: refresh session but never redirect to /login
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Static assets — skip entirely ─────────────────────────
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // ── Session refresh — runs on EVERY non-static request ────
  // This is the Supabase SSR recommended pattern. The setAll
  // callback writes refreshed tokens back to both the request
  // and response so all downstream code sees a valid session.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Write refreshed tokens to the request (so route handlers see them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild response with updated cookies so the browser gets them
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  // getUser() validates + refreshes the session. Must not be removed.
  const { data: { user } } = await supabase.auth.getUser()

  // ── API routes: never redirect, always pass through ────────
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in + protected page → redirect to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in + auth pages → redirect to dashboard
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // /admin/* — middleware ensures user is authenticated
  // (role check happens in the layout)
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
