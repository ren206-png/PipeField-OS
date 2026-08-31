'use client'
// Cut Length diagram — pipe with two fittings, showing C-to-C and take-outs
export function CutLengthDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 320 160" fill="none" aria-label="Cut length diagram">
      {/* Left elbow (circle) */}
      <circle cx="50" cy="80" r="28" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <text x="50" y="85" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="currentColor">ELL</text>
      {/* Right elbow */}
      <circle cx="270" cy="80" r="28" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <text x="270" y="85" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="currentColor">ELL</text>
      {/* Pipe between */}
      <line x1="78" y1="80" x2="242" y2="80" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      {/* C-to-C dimension line */}
      <line x1="50" y1="30" x2="270" y2="30" stroke="#fbbf24" strokeWidth="1.5" markerStart="url(#dl)" markerEnd="url(#dl)"/>
      <text x="160" y="24" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#fbbf24">C to C</text>
      {/* Take-out left */}
      <line x1="50" y1="108" x2="78" y2="108" stroke="#f87171" strokeWidth="1.5" markerEnd="url(#dl)"/>
      <text x="64" y="125" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#f87171">T/O</text>
      {/* Take-out right */}
      <line x1="242" y1="108" x2="270" y2="108" stroke="#f87171" strokeWidth="1.5" markerEnd="url(#dl)"/>
      <text x="256" y="125" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#f87171">T/O</text>
      {/* Cut length */}
      <line x1="78" y1="140" x2="242" y2="140" stroke="#60a5fa" strokeWidth="1.5" markerStart="url(#dl2)" markerEnd="url(#dl2)"/>
      <text x="160" y="155" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#60a5fa">CUT LENGTH</text>
      <defs>
        <marker id="dl" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <line x1="3" y1="0" x2="3" y2="6" stroke="currentColor" strokeWidth="1.5"/>
        </marker>
        <marker id="dl2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <line x1="3" y1="0" x2="3" y2="6" stroke="#60a5fa" strokeWidth="1.5"/>
        </marker>
      </defs>
    </svg>
  )
}
