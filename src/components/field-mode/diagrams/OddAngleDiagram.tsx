'use client'
// Odd-Angle Cut from 90 — 90° elbow with cut-back marked
export function OddAngleDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 220 200" fill="none" aria-label="Odd-angle cut diagram">
      {/* 90 elbow body */}
      <path d="M 40 160 L 40 80 A 60 60 0 0 1 120 20 L 180 20" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
      {/* Cut line */}
      <line x1="40" y1="130" x2="90" y2="80" stroke="#f87171" strokeWidth="2" strokeDasharray="6 4"/>
      {/* Cut angle arc */}
      <path d="M 40 150 A 20 20 0 0 1 54 135" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
      {/* Labels */}
      <text x="50" y="145" fontFamily="monospace" fontSize="11" fill="#fbbf24">θ</text>
      <text x="60" y="112" fontFamily="monospace" fontSize="11" fill="#f87171">CUT</text>
      <text x="95" y="55" fontFamily="monospace" fontSize="12" fill="currentColor">90° ELL</text>
      {/* Cut-back dimension */}
      <line x1="12" y1="130" x2="12" y2="160" stroke="#60a5fa" strokeWidth="1.5"/>
      <text x="8" y="148" fontFamily="monospace" fontSize="10" fill="#60a5fa" textAnchor="middle" transform="rotate(-90 8 148)">CB</text>
    </svg>
  )
}
