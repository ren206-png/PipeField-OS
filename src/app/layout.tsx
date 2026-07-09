import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { NativeAppProvider } from '@/components/NativeAppProvider'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { PWAInstallBanner } from '@/components/shared/PWAInstallBanner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

// ── Site URL ─────────────────────────────────────────────────
// NEXT_PUBLIC_APP_URL must be set in the Vercel (or CI) environment
// for og:url, canonical, sitemap, and robots to emit correct production
// URLs. The fallback ensures the build never hard-crashes, but a warning
// is emitted so the missing var surfaces in build logs.
if (!process.env.NEXT_PUBLIC_APP_URL && process.env.NODE_ENV === 'production') {
  console.warn(
    '[layout] NEXT_PUBLIC_APP_URL is not set. ' +
    'og:url, canonical, and sitemap URLs will fall back to https://pipefield-os.com. ' +
    'Set this variable in your Vercel environment to suppress this warning.'
  )
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

export const metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'PipeField OS — Pipeline QC & Pipefitter Field Tools',
    template: '%s | PipeField OS',
  },
  description:
    'The all-in-one platform for pipeline construction teams and pipefitters. Weld tracking, NDE management, QA packages, and 6 built-in field calculators.',
  keywords: [
    'pipeline QC software',
    'weld tracking',
    'pipefitter calculator',
    'pipe offset calculator',
    'NDE management',
    'QA package generator',
    'pipeline construction',
    'B31.3 compliance',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PipeField OS',
  },
  // Canonical URL for the root — child pages override this via their own metadata.
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'PipeField OS',
    title: 'PipeField OS — Pipeline QC & Pipefitter Field Tools',
    description:
      'Weld tracking, NDE management, QA packages, and 6 built-in pipefitter field calculators. Built for the field and the office.',
    images: [
      {
        // Absolute URL — metadataBase resolves relative paths, but being
        // explicit prevents issues when the page is shared without context.
        url: `${APP_URL}/og?title=PipeField+OS&subtitle=Pipeline+QC+%26+Pipefitter+Field+Tools`,
        width: 1200,
        height: 630,
        alt: 'PipeField OS — Pipeline QC Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PipeField OS — Pipeline QC & Pipefitter Field Tools',
    description:
      'Weld tracking, NDE management, QA packages, and 6 built-in pipefitter field calculators.',
    images: [`${APP_URL}/og?title=PipeField+OS&subtitle=Pipeline+QC+%26+Pipefitter+Field+Tools`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
}

export const viewport = {
  themeColor: '#0f172a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-surface-900 text-surface-100">
        <ErrorBoundary label="RootLayout">
          <QueryProvider>
            <AuthProvider>
              <NativeAppProvider>
                {children}
                <PWAInstallBanner />
              </NativeAppProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--color-surface-800, #1e293b)',
              border:     '1px solid var(--color-surface-700, #334155)',
              color:      'var(--color-surface-100, #f1f5f9)',
            },
          }}
        />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
