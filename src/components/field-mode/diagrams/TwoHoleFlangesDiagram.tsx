'use client'
// Two-Hole Flange diagram — flange face view with bolt circle and offset
export function TwoHoleFlangesDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 220 220" fill="none" aria-label="Two-hole flange diagram">
      {/* Flange OD */}
      <circle cx="110" cy="110" r="90" stroke="currentColor" strokeWidth="2" fill="none"/>
      {/* Bolt circle */}
      <circle cx="110" cy="110" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" fill="none"/>
      {/* Bore */}
      <circle cx="110" cy="110" r="30" stroke="currentColor" strokeWidth="2" fill="none"/>
      {/* Two bolt holes at top and bottom */}
      <circle cx="110" cy="45"  r="8" stroke="#60a5fa" strokeWidth="2" fill="none"/>
      <circle cx="110" cy="175" r="8" stroke="#60a5fa" strokeWidth="2" fill="none"/>
      {/* Bolt circle radius */}
      <line x1="110" y1="110" x2="110" y2="45" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3"/>
      <text x="118" y="82" fontFamily="monospace" fontSize="11" fill="#fbbf24">BC/2</text>
      {/* Centreline */}
      <line x1="110" y1="20" x2="110" y2="200" stroke="#6b7280" strokeWidth="1" strokeDasharray="4 4"/>
      {/* Offset label */}
      <line x1="110" y1="110" x2="190" y2="110" stroke="#f87171" strokeWidth="1.5"/>
      <text x="155" y="105" fontFamily="monospace" fontSize="11" fill="#f87171">OFFSET</text>
    </svg>
  )
}
