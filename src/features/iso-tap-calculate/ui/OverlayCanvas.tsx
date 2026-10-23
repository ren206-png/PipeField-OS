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
//
// Selection mode: when `onRegionSelected` is provided and `selectionMode`
// is true, the user can drag to draw a rectangle. The returned region is
// in canonical (pre-rotation) image coordinates.
// ============================================================
import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { BoundingBox } from '../ocr/types'
import type { OcrRegion } from '../ocr/ocr-adapter'

interface OverlayCanvasProps {
  imageNaturalWidth: number
  imageNaturalHeight: number
  rotation: 0 | 90 | 180 | 270
  boxes: BoundingBox[]
  onBoxTap?: (box: BoundingBox) => void
  // Selection mode — user drags a rectangle; result in canonical image coords
  selectionMode?: boolean
  onRegionSelected?: (region: OcrRegion) => void
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

/** Inverse of rotatePoint — viewport canonical coord → pre-rotation canonical. */
function unrotatePoint(
  px: number, py: number,
  iw: number, ih: number,
  deg: 0 | 90 | 180 | 270,
): [number, number] {
  // Inverse rotation: rotate by (360 - deg)
  switch (deg) {
    case 0:   return [px, py]
    case 90:  return [py, ih - px]         // inverse of (ih-py, px)
    case 180: return [iw - px, ih - py]
    case 270: return [iw - py, px]         // inverse of (py, iw-px)
  }
}

/** After rotation, what are the image dimensions? */
function rotatedSize(iw: number, ih: number, deg: 0 | 90 | 180 | 270): [number, number] {
  return (deg === 90 || deg === 270) ? [ih, iw] : [iw, ih]
}

interface DragState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function OverlayCanvas({
  imageNaturalWidth,
  imageNaturalHeight,
  rotation,
  boxes,
  onBoxTap,
  selectionMode = false,
  onRegionSelected,
  className,
}: OverlayCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const vpRef = useRef({ width: 0, height: 0 })
  const scaleRef = useRef({ scale: 1, ox: 0, oy: 0 })

  const [drag, setDrag] = useState<DragState | null>(null)

  const draw = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const vw = svg.clientWidth
    const vh = svg.clientHeight
    if (!vw || !vh) return

    vpRef.current = { width: vw, height: vh }

    const [rw, rh] = rotatedSize(imageNaturalWidth, imageNaturalHeight, rotation)
    const scale = Math.min(vw / rw, vh / rh)
    const ox = (vw - rw * scale) / 2
    const oy = (vh - rh * scale) / 2
    scaleRef.current = { scale, ox, oy }

    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)

    // Remove only box elements (not the selection rect)
    const toRemove = Array.from(svg.querySelectorAll('[data-box]'))
    toRemove.forEach(el => el.remove())

    for (const box of boxes) {
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
      rect.setAttribute('data-box', '1')
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

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(container)
    return () => ro.disconnect()
  }, [draw])

  // Convert a viewport SVG coordinate to canonical (pre-rotation) image coords
  function viewportToCanonical(vx: number, vy: number): [number, number] {
    const { scale, ox, oy } = scaleRef.current
    const [rw, rh] = rotatedSize(imageNaturalWidth, imageNaturalHeight, rotation)
    // Rotated image coords
    const rx = (vx - ox) / scale
    const ry = (vy - oy) / scale
    // Clamp to image bounds
    const cx = Math.max(0, Math.min(rw, rx))
    const cy = Math.max(0, Math.min(rh, ry))
    return unrotatePoint(cx, cy, imageNaturalWidth, imageNaturalHeight, rotation)
  }

  function getSvgPoint(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (!selectionMode || !onRegionSelected) return
    const pt = getSvgPoint(e)
    if (!pt) return
    e.preventDefault()
    setDrag({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y })
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drag) return
    const pt = getSvgPoint(e)
    if (!pt) return
    setDrag(prev => prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null)
  }

  function onPointerUp() {
    if (!drag || !onRegionSelected) return
    const x0 = Math.min(drag.startX, drag.currentX)
    const y0 = Math.min(drag.startY, drag.currentY)
    const x1 = Math.max(drag.startX, drag.currentX)
    const y1 = Math.max(drag.startY, drag.currentY)
    if (x1 - x0 < 5 || y1 - y0 < 5) { setDrag(null); return } // too small

    const [cx0, cy0] = viewportToCanonical(x0, y0)
    const [cx1, cy1] = viewportToCanonical(x1, y1)
    onRegionSelected({
      x: Math.round(Math.min(cx0, cx1)),
      y: Math.round(Math.min(cy0, cy1)),
      width:  Math.round(Math.abs(cx1 - cx0)),
      height: Math.round(Math.abs(cy1 - cy0)),
    })
    setDrag(null)
  }

  // Selection rect in viewport coords
  const selRect = drag ? {
    x: Math.min(drag.startX, drag.currentX),
    y: Math.min(drag.startY, drag.currentY),
    w: Math.abs(drag.currentX - drag.startX),
    h: Math.abs(drag.currentY - drag.startY),
  } : null

  const isInteractive = selectionMode || !!onBoxTap

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className ?? ''}`}
      style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{
          cursor: selectionMode ? 'crosshair' : (onBoxTap ? 'pointer' : 'default'),
          userSelect: 'none',
        }}
        aria-hidden="true"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {/* Selection rectangle drawn during drag */}
        {selRect && (
          <rect
            x={selRect.x} y={selRect.y}
            width={selRect.w} height={selRect.h}
            fill="rgba(59,130,246,0.15)"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            rx="2"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </div>
  )
}
