// ============================================================
// Security Headers + Threat Detection
// Applied by middleware on every response.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

// ── HTTP Security Headers ─────────────────────────────────────
// Applied to every response to prevent XSS, clickjacking,
// MIME sniffing, and information leakage.

export function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers

  // Prevent clickjacking
  h.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  h.set('X-Content-Type-Options', 'nosniff')

  // Block XSS in older browsers
  h.set('X-XSS-Protection', '1; mode=block')

  // Control referrer info sent to external sites
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser features
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')

  // Force HTTPS for 1 year, include subdomains
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // Content Security Policy — tight for a Next.js app
  // 'unsafe-inline' required by Next.js inline scripts; nonce-based CSP
  // is a future improvement once Next.js supports it fully.
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.stripe.com https://api.resend.com",
      "frame-src https://challenges.cloudflare.com https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  )

  // Remove server fingerprint
  h.delete('X-Powered-By')
  h.delete('Server')

  return response
}

// ── Threat Detection ──────────────────────────────────────────
// Patterns used by scanners, exploit kits, and malware probes.
// Block at the edge before any app code runs.

// Known bad path prefixes — scanner / exploit kit signatures
const BLOCKED_PATH_PREFIXES = [
  '/.env',
  '/.git',
  '/wp-',          // WordPress scanner
  '/wp-admin',
  '/wp-login',
  '/phpMyAdmin',
  '/phpmyadmin',
  '/admin.php',
  '/xmlrpc.php',
  '/shell',
  '/cgi-bin',
  '/vendor/phpunit',
  '/telescope',    // Laravel debug endpoint
  '/solr',
  '/actuator',     // Spring Boot actuator leak
  '/.well-known/acme-challenge/../',
  '/owa/',         // Outlook Web Access scanner
  '/ecp/',         // Exchange scanner
]

// Regex patterns that indicate injection attempts or path traversal
const BLOCKED_PATH_PATTERNS = [
  /\.\.\//,                        // Path traversal
  /%2e%2e/i,                       // URL-encoded path traversal
  /etc\/passwd/i,                  // LFI attempt
  /proc\/self/i,                   // Linux process info leak
  /<script/i,                      // XSS probe in URL
  /union.{0,10}select/i,           // SQL injection probe
  /exec\s*\(/i,                    // Code execution probe
  /base64_decode/i,                // PHP webshell signature
  /eval\s*\(/i,                    // Code execution probe
  /\x00/,                          // Null byte injection
]

// User-agents used by vulnerability scanners and exploit kits
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /havij/i,
  /acunetix/i,
  /nessus/i,
  /openvas/i,
  /python-requests\/[01]\./i,      // Old Python scanners (not modern SDK)
  /go-http-client\/1\.0/i,         // Common scanner runtime
  /curl\/[67]\.[0-4]/i,            // Older curl often used by bots
]

export type ThreatResult = { blocked: true; reason: string } | { blocked: false }

export function detectThreat(req: NextRequest): ThreatResult {
  const pathname = req.nextUrl.pathname
  const ua = req.headers.get('user-agent') ?? ''

  // Block known bad paths
  for (const prefix of BLOCKED_PATH_PREFIXES) {
    if (pathname.toLowerCase().startsWith(prefix.toLowerCase())) {
      return { blocked: true, reason: `blocked-path:${prefix}` }
    }
  }

  // Block injection/traversal patterns in path
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return { blocked: true, reason: `blocked-pattern:${pattern.source}` }
    }
  }

  // Block known scanner user-agents
  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { blocked: true, reason: `blocked-ua:${pattern.source}` }
    }
  }

  return { blocked: false }
}
