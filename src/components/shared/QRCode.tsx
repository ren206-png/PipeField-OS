'use client'
// ============================================================
// QRCode component
// Generates a QR code as a data URL and renders it as an <img>.
// Uses the 'qrcode' npm package — runs entirely in the browser.
// ============================================================
import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  value:     string   // The URL or text to encode
  size?:     number   // px width/height (default 200)
  className?: string
}

export function QRCode({ value, size = 200, className }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('')
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
    QRCodeLib.toDataURL(value, {
      width:        size,
      margin:       2,
      color: {
        dark:  '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H', // High — survives partial damage on stickers
    })
      .then(url => setDataUrl(url))
      .catch(err => {
        console.error('[QRCode]', err)
        setError(true)
      })
  }, [value, size])

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-surface-700 flex items-center justify-center rounded ${className ?? ''}`}
      >
        <span className="text-xs text-surface-400">QR error</span>
      </div>
    )
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-surface-700 animate-pulse rounded ${className ?? ''}`}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR Code"
      width={size}
      height={size}
      className={`rounded ${className ?? ''}`}
    />
  )
}
