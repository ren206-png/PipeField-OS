// Dynamic OG image — /og?title=...&subtitle=...
// Used for social share previews. Returns 1200×630 PNG.
import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title    = searchParams.get('title')    ?? 'PipeField OS'
  const subtitle = searchParams.get('subtitle') ?? 'Pipeline QC & Pipefitter Field Tools'

  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          background:      'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily:      'system-ui, sans-serif',
          padding:         80,
        }}
      >
        {/* Orange glow */}
        <div
          style={{
            position:    'absolute',
            top:         0,
            left:        0,
            right:       0,
            bottom:      0,
            background:  'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(249,115,22,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width:           52,
              height:          52,
              borderRadius:    12,
              background:      'rgba(249,115,22,0.15)',
              border:          '1px solid rgba(249,115,22,0.4)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        28,
            }}
          >
            🔥
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            PipeField OS
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize:    60,
            fontWeight:  800,
            color:       '#f1f5f9',
            textAlign:   'center',
            lineHeight:  1.15,
            marginBottom: 20,
            maxWidth:    900,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize:   26,
            color:      '#94a3b8',
            textAlign:  'center',
            maxWidth:   700,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>

        {/* Bottom pills */}
        <div style={{ display: 'flex', gap: 12, marginTop: 48 }}>
          {['Weld Tracking', 'Field Calculators', 'QA Packages', 'B31.3 Compliant'].map(tag => (
            <div
              key={tag}
              style={{
                borderRadius: 999,
                border:       '1px solid rgba(249,115,22,0.3)',
                background:   'rgba(249,115,22,0.1)',
                color:        '#fb923c',
                fontSize:     16,
                fontWeight:   600,
                padding:      '8px 18px',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
