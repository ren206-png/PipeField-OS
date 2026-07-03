'use client'
// ============================================================
// useQRScanner — Capacitor MLKit barcode / QR scanner hook
// Works on iOS and Android native; gracefully degrades on web.
//
// QR tag format expected by PipeField OS:
//   WELD:<project_id>:<weld_number>
//   SPOOL:<project_id>:<spool_number>
//   CALC:<nps>:<schedule>:<fluid>    (pipe support quick-start)
// ============================================================

import { useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

export type QRScanResult =
  | { type: 'weld';   projectId: string; weldNumber: string;  raw: string }
  | { type: 'spool';  projectId: string; spoolNumber: string; raw: string }
  | { type: 'calc';   nps: string; schedule: string; fluid: string; raw: string }
  | { type: 'unknown'; raw: string }

function parseQRPayload(raw: string): QRScanResult {
  const parts = raw.trim().split(':')
  switch (parts[0]?.toUpperCase()) {
    case 'WELD':
      return { type: 'weld', projectId: parts[1] ?? '', weldNumber: parts[2] ?? '', raw }
    case 'SPOOL':
      return { type: 'spool', projectId: parts[1] ?? '', spoolNumber: parts[2] ?? '', raw }
    case 'CALC':
      return { type: 'calc', nps: parts[1] ?? '', schedule: parts[2] ?? '', fluid: parts[3] ?? '', raw }
    default:
      return { type: 'unknown', raw }
  }
}

interface UseQRScannerReturn {
  scanning: boolean
  lastResult: QRScanResult | null
  error: string | null
  isSupported: boolean
  startScan: () => Promise<QRScanResult | null>
  stopScan: () => Promise<void>
}

export function useQRScanner(): UseQRScannerReturn {
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<QRScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const listenerRef = useRef<{ remove: () => void } | null>(null)

  const isSupported = Capacitor.isNativePlatform()

  const stopScan = useCallback(async () => {
    if (!isSupported) return
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      listenerRef.current?.remove()
      listenerRef.current = null
      await BarcodeScanner.stopScan()
    } catch {
      // ignore
    } finally {
      setScanning(false)
    }
  }, [isSupported])

  const startScan = useCallback(async (): Promise<QRScanResult | null> => {
    if (!isSupported) {
      setError('QR scanning requires the native iOS or Android app.')
      return null
    }

    setError(null)
    setScanning(true)

    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')

      // Request camera permission
      const { camera } = await BarcodeScanner.requestPermissions()
      if (camera !== 'granted' && camera !== 'limited') {
        throw new Error('Camera permission denied. Please allow camera access in Settings.')
      }

      // One-shot scan — returns when a barcode is found
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39],
      })

      const raw = barcodes[0]?.rawValue ?? ''
      if (!raw) {
        setScanning(false)
        return null
      }

      const result = parseQRPayload(raw)
      setLastResult(result)
      setScanning(false)
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Scan failed'
      setError(msg)
      setScanning(false)
      return null
    }
  }, [isSupported])

  return { scanning, lastResult, error, isSupported, startScan, stopScan }
}
