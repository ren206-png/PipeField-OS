'use client'
// Simple Offset diagram — offset (vertical), run (horizontal), travel (hypotenuse)
export function SimpleOffsetDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 280 180" fill="none" aria-label="Simple offset diagram">
      {/* Run (horizontal pipe) */}
      <line x1="30" y1="150" x2="180" y2="150" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Offset (vertical rise) */}
      <line x1="180" y1="150" x2="180" y2="40" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Travel (hypotenuse) */}
      <line x1="30" y1="150" x2="180" y2="40" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 4" strokeLinecap="round"/>
      {/* Angle arc */}
      <path d="M 60 150 A 30 30 0 0 1 47 128" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      {/* Labels */}
      <text x="105" y="170" textAnchor="middle" fontFamily="monospace" fontSize="13" fill="currentColor">RUN</text>
      <text x="205" y="100" textAnchor="start" fontFamily="monospace" fontSize="13" fill="currentColor">OFFSET</text>
      <text x="85" y="83" textAnchor="middle" fontFamily="monospace" fontSize="13" fill="#60a5fa">TRAVEL</text>
      <text x="72" y="140" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#fbbf24">θ</text>
      {/* Right angle box */}
      <polyline points="170,150 170,140 180,140" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}
