import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Only encode https URLs pointing at this app's own domain.
// This prevents the endpoint being used to generate phishing
// QR codes served under the pipefield-os.com origin.
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? ''

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    // Must be https
    if (parsed.protocol !== 'https:') return false
    // Must be same origin as the app (e.g. pipefield-os.com or Vercel preview URL)
    if (APP_ORIGIN) {
      const appHost = new URL(APP_ORIGIN).hostname
      if (parsed.hostname !== appHost && !parsed.hostname.endsWith(`.${appHost}`)) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  // Require authentication — unauthenticated QR generation was an open redirect vector
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const url   = searchParams.get('url')
  const label = searchParams.get('label') ?? ''

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Validate the URL is safe to encode
  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: 'URL must be an https URL on the PipeField OS domain' },
      { status: 400 }
    )
  }

  try {
    const buffer = await QRCode.toBuffer(url, {
      type:                 'png',
      width:                400,
      margin:               2,
      errorCorrectionLevel: 'H',
      color: {
        dark:  '#000000',
        light: '#ffffff',
      },
    })

    return new NextResponse(buffer as unknown as BodyInit, {
      status:  200,
      headers: {
        'Content-Type':        'image/png',
        'Content-Disposition': `inline; filename="${label || 'qr'}.png"`,
        // Private — QR codes are user-session specific, don't cache publicly
        'Cache-Control':       'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('[/api/qr]', err)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
