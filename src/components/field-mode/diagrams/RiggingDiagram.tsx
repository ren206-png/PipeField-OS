'use client'
// Rigging diagram — load + sling legs with angle marked
export function RiggingDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 260 200" fill="none" aria-label="Rigging sling angle diagram">
      {/* Load block */}
      <rect x="80" y="150" width="100" height="30" stroke="currentColor" strokeWidth="2.5" rx="2" fill="none"/>
      <text x="130" y="170" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="currentColor">LOAD</text>
      {/* Left sling leg */}
      <line x1="130" y1="30" x2="90"  y2="150" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Right sling leg */}
      <line x1="130" y1="30" x2="170" y2="150" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Hook */}
      <circle cx="130" cy="25" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
      {/* Vertical centreline */}
      <line x1="130" y1="35" x2="130" y2="155" stroke="#6b7280" strokeWidth="1" strokeDasharray="5 4"/>
      {/* Left angle arc */}
      <path d="M 130 70 A 25 25 0 0 0 114 60" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
      <text x="108" y="80" fontFamily="monospace" fontSize="11" fill="#fbbf24">θ</text>
      {/* Right angle arc */}
      <path d="M 130 70 A 25 25 0 0 1 146 60" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
      {/* Labels */}
      <text x="65"  y="105" fontFamily="monospace" fontSize="11" fill="#60a5fa" textAnchor="middle">LEG</text>
      <text x="195" y="105" fontFamily="monospace" fontSize="11" fill="#60a5fa" textAnchor="middle">LEG</text>
    </svg>
  )
}
