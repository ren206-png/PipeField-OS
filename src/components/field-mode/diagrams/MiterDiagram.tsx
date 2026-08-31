'use client'
// Miter diagram — pipe with miter cut angle marked
export function MiterDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 280 160" fill="none" aria-label="Miter cut diagram">
      {/* Pipe body */}
      <rect x="40" y="60" width="200" height="40" stroke="currentColor" strokeWidth="2.5" fill="none" rx="2"/>
      {/* Miter cut line */}
      <line x1="160" y1="60" x2="200" y2="100" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Miter angle arc */}
      <path d="M 160 75 A 15 15 0 0 1 147 60" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
      {/* Labels */}
      <text x="142" y="95" fontFamily="monospace" fontSize="11" fill="#fbbf24">θ/2</text>
      <text x="175" y="55" fontFamily="monospace" fontSize="12" fill="#f87171">CUT</text>
      {/* Long/short side labels */}
      <line x1="40"  y1="130" x2="200" y2="130" stroke="#60a5fa" strokeWidth="1.5"/>
      <text x="120" y="148" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#60a5fa">LONG SIDE</text>
      <line x1="40"  y1="45" x2="160" y2="45" stroke="currentColor" strokeWidth="1"/>
      <text x="100" y="40" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="currentColor">SHORT SIDE</text>
    </svg>
  )
}
