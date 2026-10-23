'use client'
// ============================================================
// ISO Tap-to-Calculate — Bounding Box Overlay Canvas
// Renders OCR bounding boxes over the image preview.
//
// Coordinate system:
//   Canonical = pre-rotation, pre-crop image pixels (stored in BoundingBox).
//   Rotated   = after applying `rotation` degrees CW.
//   Viewport  = scaled to fit `viewportWidth` × `viewportHeight`.
//
// The transform: canonical → rotate → scale to viewport.
// Uses ResizeObserver to stay aligned after resize.
// ============================================================
import React, { useRef, useEffect, useCallback } from 'react'
import type { BoundingBox } from '../ocr/types'

interface OverlayCanvasProps {
  imageNaturalWidth: number
  imageNaturalHeight: number
  rotation: 0 | 90 | 180 | 270
  boxes: BoundingBox[]
  onBoxTap?: (box: BoundingBox) => void
  className?: string
}

/** Rotate a point (px,py) in an image of (iw × ih) by `deg` degrees CW. */
function rotatePoint(
  px: number, py: number,
  iw: number, ih: number,
  deg: 0 | 90 | 180 | 270,
): [number, number] {
  switch (deg) {
    case 0:   return [px, py]
    case 90:  return [ih - py, px]
    case 180: return [iw - px, ih - py]
    case 270: return [py, iw - px]
  }
}

/** After rotation, what are the image dimensions? */
function rotatedSize(iw: number, ih: number, deg: 0 | 90 | 180 | 270): [number, number] {
  return (deg === 90 || deg === 270) ? [ih, iw] : [iw, ih]
}

export function OverlayCanvas({
  imageNaturalWidth,
  imageNaturalHeight,
  rotation,
  boxes,
  onBoxTap,
  className,
}: OverlayCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Store current viewport size for hit-testing
  const vpRef = useRef({ width: 0, height: 0 })

  const draw = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const vw = svg.clientWidth
    const vh = svg.clientHeight
    if (!vw || !vh) return

    vpRef.current = { width: vw, height: vh }

    const [rw, rh] = rotatedSize(imageNaturalWidth, imageNaturalHeight, rotation)
    const scale = Math.min(vw / rw, vh / rh)
    // Centred offset within the SVG
    const ox = (vw - rw * scale) / 2
    const oy = (vh - rh * scale) / 2

    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)

    // Clear old rects
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    for (const box of boxes) {
      // Rotate all four corners
      const corners: Array<[number, number]> = [
        [box.x0, box.y0],
        [box.x1, box.y0],
        [box.x1, box.y1],
        [box.x0, box.y1],
      ].map(([x, y]) => rotatePoint(x, y, imageNaturalWidth, imageNaturalHeight, rotation))

      const xs = corners.map(c => c[0] * scale + ox)
      const ys = corners.map(c => c[1] * scale + oy)

      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const w = Math.max(...xs) - x
      const h = Math.max(...ys) - y

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(x))
      rect.setAttribute('y', String(y))
      rect.setAttribute('width', String(w))
      rect.setAttribute('height', String(h))
      rect.setAttribute('fill', 'rgba(250,204,21,0.12)')
      rect.setAttribute('stroke', '#facc15')
      rect.setAttribute('stroke-width', '1.5')
      rect.setAttribute('rx', '2')

      if (onBoxTap) {
        rect.style.cursor = 'pointer'
        rect.addEventListener('click', () => onBoxTap(box))
      }
      svg.appendChild(rect)
    }
  }, [boxes, imageNaturalWidth, imageNaturalHeight, rotation, onBoxTap])

  // Redraw on boxes/rotation/size change
  useEffect(() => { draw() }, [draw])

  // ResizeObserver to stay aligned after container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(container)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className ?? ''}`}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ pointerEvents: onBoxTap ? 'auto' : 'none' }}
        aria-hidden="true"
      />
    </div>
  )
}
