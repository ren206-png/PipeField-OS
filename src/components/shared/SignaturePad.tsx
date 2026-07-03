'use client'
// ============================================================
// SignaturePad — canvas-based signature capture
// Dynamically imports signature_pad to avoid SSR issues.
// ============================================================
import { useRef, useEffect, useState } from 'react'
import type SignaturePadType from 'signature_pad'
import { Trash2, Check } from 'lucide-react'

interface Props {
  onSave: (dataUrl: string) => void
}

export default function SignaturePad({ onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef    = useRef<SignaturePadType | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    let pad: SignaturePadType | null = null

    import('signature_pad').then(({ default: SignaturePadClass }) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Size canvas to its CSS display size
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1)
      canvas.width  = canvas.offsetWidth  * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)

      pad = new SignaturePadClass(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      })

      pad.addEventListener('beginStroke', () => setIsEmpty(false))
      padRef.current = pad
    })

    return () => {
      pad?.off()
    }
  }, [])

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  function handleSave() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    const dataUrl = pad.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-surface-600 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: 160, display: 'block' }}
        />
      </div>
      <p className="text-xs text-surface-500 text-center">Sign in the box above</p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleClear}
          className="btn-ghost flex items-center gap-1.5 text-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Save Signature
        </button>
      </div>
    </div>
  )
}
