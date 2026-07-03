'use client'
// ============================================================
// QRScanButton — Scan a PipeField OS QR tag from any screen.
//
// Props:
//   onResult(result)   — called with the parsed QR payload
//   label              — button text (default "Scan QR")
//   variant            — 'primary' | 'ghost' (default 'ghost')
//   className          — extra Tailwind classes
//
// The button is hidden on desktop web (non-native); show only
// when Capacitor.isNativePlatform() === true.
// ============================================================

import { Capacitor } from '@capacitor/core'
import { ScanLine, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQRScanner, type QRScanResult } from '@/hooks/useQRScanner'

interface QRScanButtonProps {
  onResult: (result: QRScanResult) => void
  label?: string
  variant?: 'primary' | 'ghost'
  className?: string
}

export function QRScanButton({
  onResult,
  label = 'Scan QR',
  variant = 'ghost',
  className,
}: QRScanButtonProps) {
  const { scanning, error, startScan } = useQRScanner()

  // Hide entirely on non-native (desktop web)
  if (!Capacitor.isNativePlatform()) return null

  const handleClick = async () => {
    const result = await startScan()
    if (result) onResult(result)
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={scanning}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60',
          variant === 'primary'
            ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-glow'
            : 'border border-surface-700 text-surface-300 hover:border-brand-500 hover:text-brand-400 bg-surface-800',
          className
        )}
      >
        {scanning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ScanLine className="w-4 h-4" />
        )}
        {scanning ? 'Scanning…' : label}
      </button>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
