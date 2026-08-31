'use client'
// Branch Layout diagram — header + branch pipe with ordinate marks
export function BranchDiagram() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 300 180" fill="none" aria-label="Branch layout diagram">
      {/* Header pipe */}
      <line x1="20" y1="90" x2="280" y2="90" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
      {/* Branch pipe */}
      <line x1="150" y1="90" x2="150" y2="20" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      {/* Ordinate marks on header */}
      <line x1="90"  y1="80" x2="90"  y2="100" stroke="#fbbf24" strokeWidth="1.5"/>
      <line x1="150" y1="80" x2="150" y2="100" stroke="#60a5fa" strokeWidth="2"/>
      <line x1="210" y1="80" x2="210" y2="100" stroke="#fbbf24" strokeWidth="1.5"/>
      {/* Dimension lines */}
      <line x1="90"  y1="145" x2="150" y2="145" stroke="#fbbf24" strokeWidth="1.5"/>
      <line x1="150" y1="145" x2="210" y2="145" stroke="#fbbf24" strokeWidth="1.5"/>
      <text x="120" y="160" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#fbbf24">ORDINATE</text>
      <text x="180" y="160" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#fbbf24">ORDINATE</text>
      {/* Branch CL */}
      <text x="155" y="55" fontFamily="monospace" fontSize="11" fill="#60a5fa">BRANCH ℄</text>
      {/* Header label */}
      <text x="25" y="82" fontFamily="monospace" fontSize="11" fill="currentColor">HEADER</text>
    </svg>
  )
}
