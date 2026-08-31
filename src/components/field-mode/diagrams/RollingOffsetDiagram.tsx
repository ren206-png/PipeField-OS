'use client'
// Rolling Offset diagram — 3D box showing rise, roll, travel
export function RollingOffsetDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 280 200" fill="none" aria-label="Rolling offset diagram">
      {/* Box face (front) */}
      <rect x="30" y="60" width="120" height="80" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
      {/* Box depth lines */}
      <line x1="150" y1="60"  x2="210" y2="30"  stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <line x1="150" y1="140" x2="210" y2="110" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <line x1="30"  y1="60"  x2="90"  y2="30"  stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      {/* Box top */}
      <polyline points="90,30 210,30 210,110 150,140" stroke="currentColor" strokeWidth="1.5" opacity="0.4" fill="none"/>
      {/* Diagonal travel */}
      <line x1="30" y1="140" x2="210" y2="30" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 4"/>
      {/* Labels */}
      <text x="85"  y="175" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="currentColor">ROLL</text>
      <text x="18"  y="100" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="currentColor" transform="rotate(-90 18 100)">RISE</text>
      <text x="130" y="72"  textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#60a5fa">TRAVEL</text>
      {/* Arrows */}
      <line x1="30" y1="155" x2="150" y2="155" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arr)"/>
      <line x1="30" y1="60"  x2="30"  y2="140" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arr)"/>
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0 0L6 3L0 6Z" fill="currentColor"/>
        </marker>
      </defs>
    </svg>
  )
}
