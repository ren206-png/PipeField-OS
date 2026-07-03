'use client'
// ============================================================
// QRCodeModal — shows a QR code image fetched from /api/qr,
// with Download and Print actions.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { X, Download, Printer } from 'lucide-react'

interface QRCodeModalProps {
  open:       boolean
  onClose:    () => void
  url:        string
  label:      string
  subtitle?:  string
}

export function QRCodeModal({ open, onClose, url, label, subtitle }: QRCodeModalProps) {
  const [imgSrc, setImgSrc]     = useState<string>('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)
  const printFrameRef           = useRef<HTMLIFrameElement | null>(null)

  // Build the API URL
  const apiUrl = `/api/qr?url=${encodeURIComponent(url)}&label=${encodeURIComponent(label)}`

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(false)
    setImgSrc('')

    // Fetch as blob so we can also use it for download
    fetch(apiUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.blob()
      })
      .then(blob => {
        setImgSrc(URL.createObjectURL(blob))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url, label])

  // Clean up object URL on unmount / close
  useEffect(() => {
    return () => {
      if (imgSrc.startsWith('blob:')) URL.revokeObjectURL(imgSrc)
    }
  }, [imgSrc])

  function handleDownload() {
    if (!imgSrc) return
    const a = document.createElement('a')
    a.href  = imgSrc
    a.download = `${label.replace(/\s+/g, '-')}-qr.png`
    a.click()
  }

  function handlePrint() {
    if (!imgSrc) return

    const win = window.open('', '_blank', 'width=500,height=500')
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code – ${label}</title>
          <style>
            body {
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: system-ui, sans-serif;
              background: #fff;
              color: #000;
            }
            img  { width: 260px; height: 260px; display: block; }
            h1   { margin: 16px 0 4px; font-size: 22px; font-weight: 700; letter-spacing: 0.05em; }
            p    { margin: 0; font-size: 14px; color: #555; }
            @media print {
              @page { margin: 0; }
              body  { padding: 24px; }
            }
          </style>
        </head>
        <body>
          <img src="${imgSrc}" alt="QR Code" />
          <h1>${label}</h1>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <div>
            <h2 className="text-base font-bold text-surface-50">{label}</h2>
            {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR image */}
        <div className="flex flex-col items-center justify-center px-5 py-8 gap-4">
          {loading && (
            <div className="w-48 h-48 bg-surface-700 animate-pulse rounded-xl" />
          )}
          {error && !loading && (
            <div className="w-48 h-48 bg-surface-700 rounded-xl flex items-center justify-center">
              <p className="text-xs text-surface-400">Failed to generate QR</p>
            </div>
          )}
          {imgSrc && !loading && (
            <div className="bg-white p-3 rounded-xl shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={`QR code for ${label}`}
                width={192}
                height={192}
                className="block"
              />
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-semibold text-surface-100">{label}</p>
            {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleDownload}
            disabled={!imgSrc || loading}
            className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-sm disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            onClick={handlePrint}
            disabled={!imgSrc || loading}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Hidden iframe kept for reference (unused — using window.open instead) */}
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-frame" />
    </div>
  )
}
