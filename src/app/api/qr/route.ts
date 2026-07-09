import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const url   = searchParams.get('url')
  const label = searchParams.get('label') ?? ''

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
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
        'Cache-Control':       'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[/api/qr]', err)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
