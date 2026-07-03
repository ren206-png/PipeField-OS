// ============================================================
// Next.js Middleware — Route Protection
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes anyone can visit without being logged in
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/invite',           // invite acceptance page
  '/share/',           // public client share portal — no login required
  '/billing',          // public pricing/billing page
  '/api/organization/invite/', // token validation (public)
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Never touch API routes ─────────────────────────────────
  // API routes handle their own auth. Redirecting them to /login
  // returns HTML instead of JSON and breaks the client.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ── Static assets — skip immediately ──────────────────────
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  // Refresh the session — must happen on every request
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in + protected page → go to login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in + visiting login/register → go to dashboard
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // /admin/* — additional role check
  // The (admin) layout also enforces this server-side, but middleware
  // catches it earlier and avoids rendering the layout at all.
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Role check happens in the layout (service role query) — middleware
    // only ensures the user is authenticated at this point.
    // The layout renders the 403 screen for non-platform-admins.
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
