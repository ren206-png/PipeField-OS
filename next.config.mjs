import withPWA from '@ducanh2912/next-pwa'
import BundleAnalyzer from '@next/bundle-analyzer'
import createMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'

// Run `ANALYZE=true npm run build` to open the bundle report in your browser.
const withBundleAnalyzer = BundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
})

// ── Security headers ──────────────────────────────────────────
// Applied to every page and API response via Next.js headers().
// CSP uses 'unsafe-inline' for scripts because Next.js injects
// inline scripts for hydration — tighten with nonces when ready.
const isDev = process.env.NODE_ENV === 'development'

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydration requires inline scripts; eval is needed for source maps in dev
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  // Images: self + Supabase storage + data URIs (avatars, QR codes) + Google
  "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://www.gstatic.com",
  // API / WebSocket connections
  [
    "connect-src 'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.stripe.com',
    'https://js.stripe.com',
    isDev ? 'ws://localhost:3000' : '',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://www.googletagmanager.com',
  ].filter(Boolean).join(' '),
  "font-src 'self'",
  // Stripe.js renders in an iframe
  "frame-src https://js.stripe.com",
  // Never allow embedding this app in a frame on another origin
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  {
    key:   'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key:   'X-Frame-Options',
    value: 'DENY',
  },
  {
    key:   'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key:   'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key:   'Permissions-Policy',
    // Disable all sensor/device APIs the app never uses.
    // Camera and microphone are allowed for potential future QR / inspection features.
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key:   'Strict-Transport-Security',
    // 1 year HSTS — only set in production (dev uses HTTP)
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key:   'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withMDX(withBundleAnalyzer(withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Supabase API — network first, fall back to cache for 24h
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api-cache',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        // Next.js static chunks — cache first, long TTL
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Next.js image optimisation responses
        urlPattern: /\/_next\/image\?.*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'next-image' },
      },
    ],
  },
})(nextConfig)))
