'use client'
// ============================================================
// Digital Weld Map — SVG-based pipeline schematic
// Shows spools as pipe segments with colored weld joints
// ============================================================
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/hooks/useOrganization'
import { useProjectsList } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import { Map, Loader2, ZoomIn, ZoomOut, RotateCcw, X, CheckCircle2, AlertCircle, Clock, Activity, Printer } from 'lucide-react'

// ── Weld status colors ────────────────────────────────────────
const WELD_STATUS = {
  not_welded:  { color: '#4b5563', label: 'Not Welded',  ring: '#6b7280' },
  in_progress: { color: '#d97706', label: 'In Progress', ring: '#f59e0b' },
  welded:      { color: '#2563eb', label: 'Welded',      ring: '#3b82f6' },
  nde_pending: { color: '#7c3aed', label: 'NDE Pending', ring: '#8b5cf6' },
  nde_pass:    { color: '#059669', label: 'NDE Pass',    ring: '#10b981' },
  nde_fail:    { color: '#dc2626', label: 'NDE Fail',    ring: '#ef4444' },
  rejected:    { color: '#991b1b', label: 'Rejected',    ring: '#b91c1c' },
} as const

type WeldStatus = keyof typeof WELD_STATUS

interface WeldData {
  id: string
  weld_id_number: string
  status: WeldStatus
  spool_id: string | null
  welder_name: string | null
  weld_date: string | null
  notes: string | null
}

interface SpoolData {
  id: string
  spool_number: string
  line_number: string | null
  status: string
  welds: WeldData[]
}

// ── Weld Node (SVG circle on pipe) ───────────────────────────
function WeldNode({
  x, y, weld, selected, onClick,
}: {
  x: number; y: number; weld: WeldData; selected: boolean; onClick: () => void
}) {
  const cfg = WELD_STATUS[weld.status] ?? WELD_STATUS.not_welded
  const R = 8
  return (
    <g onClick={onClick} className="cursor-pointer" style={{ userSelect: 'none' }}>
      {selected && (
        <circle cx={x} cy={y} r={R + 5} fill="none" stroke={cfg.ring} strokeWidth="2" opacity="0.5" />
      )}
      <circle
        cx={x} cy={y} r={R}
        fill={cfg.color}
        stroke={selected ? cfg.ring : '#1f2937'}
        strokeWidth={selected ? 2.5 : 1.5}
        style={{ transition: 'all 0.15s ease' }}
      />
      {/* Small check/x icon for pass/fail */}
      {weld.status === 'nde_pass' && (
        <path d={`M${x-3},${y} l2,2.5 l4,-4`} stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {(weld.status === 'nde_fail' || weld.status === 'rejected') && (
        <>
          <line x1={x-3} y1={y-3} x2={x+3} y2={y+3} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={x+3} y1={y-3} x2={x-3} y2={y+3} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

// ── Spool Row (SVG horizontal pipe) ──────────────────────────
function SpoolRow({
  spool, y, selectedWeldId, onSelectWeld, lineColor,
}: {
  spool: SpoolData
  y: number
  selectedWeldId: string | null
  onSelectWeld: (w: WeldData) => void
  lineColor: string
}) {
  const PIPE_START_X = 220
  const PIPE_END_X   = 900
  const PIPE_W       = PIPE_END_X - PIPE_START_X
  const PIPE_Y       = y + 18

  // Distribute welds evenly along the pipe
  const welds = spool.welds
  const spacing = welds.length > 1 ? PIPE_W / (welds.length + 1) : PIPE_W / 2

  return (
    <g>
      {/* Spool label */}
      <text x={10} y={PIPE_Y + 5} fontSize="11" fill="#9ca3af" fontFamily="monospace">
        {spool.spool_number}
      </text>
      {spool.line_number && (
        <text x={10} y={PIPE_Y + 18} fontSize="9" fill="#6b7280" fontFamily="monospace">
          {spool.line_number}
        </text>
      )}

      {/* Pipe body */}
      <rect
        x={PIPE_START_X} y={PIPE_Y - 6}
        width={PIPE_W} height={12}
        rx="6" fill="#1f2937" stroke="#374151" strokeWidth="1"
      />
      {/* Pipe highlight */}
      <rect
        x={PIPE_START_X + 4} y={PIPE_Y - 4}
        width={PIPE_W - 8} height={3}
        rx="1.5" fill="#374151" opacity="0.6"
      />

      {/* Weld nodes */}
      {welds.map((w, i) => {
        const wx = PIPE_START_X + spacing * (i + 1)
        return (
          <WeldNode
            key={w.id}
            x={wx} y={PIPE_Y}
            weld={w}
            selected={selectedWeldId === w.id}
            onClick={() => onSelectWeld(w)}
          />
        )
      })}

      {/* Empty state */}
      {welds.length === 0 && (
        <text x={PIPE_START_X + PIPE_W / 2} y={PIPE_Y + 5} fontSize="10" fill="#4b5563" textAnchor="middle">
          No welds
        </text>
      )}
    </g>
  )
}

// ── Detail Panel ──────────────────────────────────────────────
function WeldDetailPanel({ weld, spool, onClose }: { weld: WeldData; spool: SpoolData; onClose: () => void }) {
  const cfg = WELD_STATUS[weld.status] ?? WELD_STATUS.not_welded

  return (
    <div className="w-72 flex-shrink-0 card p-5 space-y-4 h-fit">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-surface-500 font-mono">{spool.spool_number}</p>
          <h3 className="text-base font-bold text-surface-100 mt-0.5">{weld.weld_id_number}</h3>
        </div>
        <button onClick={onClose} className="text-surface-600 hover:text-surface-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
        <span className="text-sm font-medium text-surface-200">{cfg.label}</span>
      </div>

      <div className="space-y-3 border-t border-surface-800 pt-3">
        {[
          { label: 'Line Number', value: spool.line_number ?? '—' },
          { label: 'Welder',      value: weld.welder_name ?? '—'  },
          { label: 'Weld Date',   value: weld.weld_date ? new Date(weld.weld_date).toLocaleDateString() : '—' },
          { label: 'Spool Status',value: spool.status    },
        ].map(f => (
          <div key={f.label} className="flex justify-between items-start">
            <span className="text-xs text-surface-500">{f.label}</span>
            <span className="text-xs text-surface-300 font-medium text-right max-w-[140px]">{f.value}</span>
          </div>
        ))}
      </div>

      {weld.notes && (
        <div className="border-t border-surface-800 pt-3">
          <p className="text-xs text-surface-500 mb-1">Notes</p>
          <p className="text-xs text-surface-400">{weld.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function WeldMapPage() {
  const { organizationId } = useOrganization()

  const [selectedProject, setSelectedProject] = useState<string>('')
  const [filterLine, setFilterLine] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedWeld, setSelectedWeld] = useState<WeldData | null>(null)
  const [selectedSpool, setSelectedSpool] = useState<SpoolData | null>(null)
  const [zoom, setZoom] = useState(1)

  // Load projects for selector
  const { data: projects = [] } = useProjectsList()

  // Load spools + welds for selected project
  const { data: rawSpools = [], isLoading } = useQuery({
    queryKey: ['weld-map', organizationId, selectedProject],
    enabled: !!organizationId && !!selectedProject,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('spools')
        .select(`
          id, spool_number, line_number, status,
          welds:welds(id, weld_id_number, status, welder_name, weld_date, notes, spool_id)
        `)
        .eq('organization_id', organizationId!)
        .eq('project_id', selectedProject)
        .order('spool_number')
      if (error) throw error
      return (data ?? []) as SpoolData[]
    },
  })

  // Unique line numbers for filter
  const lineNumbers = useMemo(() => {
    const set = new Set<string>()
    rawSpools.forEach(s => { if (s.line_number) set.add(s.line_number) })
    return Array.from(set).sort()
  }, [rawSpools])

  // Apply filters
  const spools = useMemo(() => {
    return rawSpools
      .filter(s => filterLine === 'all' || s.line_number === filterLine)
      .map(s => ({
        ...s,
        welds: (s.welds ?? []).filter((w: WeldData) =>
          filterStatus === 'all' || w.status === filterStatus
        ),
      }))
      .filter(s => filterLine === 'all' || s.welds.length > 0 || filterStatus === 'all')
  }, [rawSpools, filterLine, filterStatus])

  // Weld stats
  const stats = useMemo(() => {
    const all = rawSpools.flatMap(s => s.welds ?? [])
    return {
      total:    all.length,
      pass:     all.filter(w => w.status === 'nde_pass').length,
      fail:     all.filter(w => w.status === 'nde_fail').length,
      pending:  all.filter(w => ['not_welded','in_progress','welded','nde_pending'].includes(w.status)).length,
    }
  }, [rawSpools])

  // Line colors for visual grouping
  const lineColorMap = useMemo(() => {
    const COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6']
    const map: Record<string, string> = {}
    lineNumbers.forEach((ln, i) => { map[ln] = COLORS[i % COLORS.length] })
    return map
  }, [lineNumbers])

  const SVG_W  = 950
  const ROW_H  = 50
  const HEADER = 20
  const svgH   = Math.max(200, spools.length * ROW_H + HEADER + 20)

  function handleSelectWeld(w: WeldData, s: SpoolData) {
    if (selectedWeld?.id === w.id) {
      setSelectedWeld(null)
      setSelectedSpool(null)
    } else {
      setSelectedWeld(w)
      setSelectedSpool(s)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Digital Weld Map</h1>
        <p className="text-sm text-surface-500 mt-0.5">Visual pipeline schematic — click a weld joint to see details</p>
      </div>

      {/* Project selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label mb-1.5">Project</label>
            <select className="input w-64" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedWeld(null) }}>
              <option value="">Choose a project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_number ? `${p.project_number} — ` : ''}{p.name}</option>
              ))}
            </select>
          </div>
          {selectedProject && lineNumbers.length > 0 && (
            <div>
              <label className="label mb-1.5">Line</label>
              <select className="input w-44" value={filterLine} onChange={e => setFilterLine(e.target.value)}>
                <option value="all">All Lines</option>
                {lineNumbers.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          {selectedProject && (
            <div>
              <label className="label mb-1.5">Weld Status</label>
              <select className="input w-44" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                {Object.entries(WELD_STATUS).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {selectedProject && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Welds', value: stats.total,   icon: Activity,     color: 'text-brand-400'   },
              { label: 'NDE Pass',    value: stats.pass,    icon: CheckCircle2, color: 'text-green-400'   },
              { label: 'NDE Fail',    value: stats.fail,    icon: AlertCircle,  color: 'text-red-400'     },
              { label: 'Pending',     value: stats.pending, icon: Clock,        color: 'text-yellow-400'  },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={cn('w-4 h-4', s.color)} />
                  <span className="text-xs text-surface-500">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-surface-50">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="card px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs text-surface-500 font-medium">Legend:</span>
              {Object.entries(WELD_STATUS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setFilterStatus(filterStatus === k ? 'all' : k)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-opacity',
                    filterStatus !== 'all' && filterStatus !== k ? 'opacity-30' : 'opacity-100'
                  )}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                  <span className="text-surface-400">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Map + Detail panel */}
          <div className="flex gap-4 items-start">
            {/* SVG canvas */}
            <div className="card flex-1 overflow-hidden">
              {/* Zoom controls */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800 flex-wrap">
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
                  className="btn-ghost p-1.5"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
                  className="btn-ghost p-1.5"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="btn-ghost p-1.5"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <span className="text-xs text-surface-600">{Math.round(zoom * 100)}%</span>
                <div className="ml-auto">
                  <button
                    onClick={() => window.print()}
                    className="btn-ghost p-1.5 flex items-center gap-1.5 text-xs"
                    title="Export / Print weld map"
                  >
                    <Printer className="w-4 h-4" /> Export PNG
                  </button>
                </div>
              </div>

              <div className="overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                  </div>
                ) : spools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Map className="w-12 h-12 text-surface-600 mb-3" />
                    <p className="text-surface-400 font-medium">No spools found</p>
                    <p className="text-surface-600 text-sm mt-1">Add spools and welds to see the pipeline map</p>
                  </div>
                ) : (
                  <svg
                    width={SVG_W * zoom}
                    height={svgH * zoom}
                    viewBox={`0 0 ${SVG_W} ${svgH}`}
                    style={{ display: 'block' }}
                  >
                    {/* Column headers */}
                    <text x={10}  y={15} fontSize="10" fill="#6b7280" fontWeight="600">SPOOL / LINE</text>
                    <text x={220} y={15} fontSize="10" fill="#6b7280" fontWeight="600">WELD JOINTS</text>

                    {/* Grid lines */}
                    {spools.map((_, i) => (
                      <line
                        key={i}
                        x1={0} y1={HEADER + i * ROW_H}
                        x2={SVG_W} y2={HEADER + i * ROW_H}
                        stroke="#1f2937" strokeWidth="1"
                      />
                    ))}

                    {/* Spool rows */}
                    {spools.map((spool, i) => (
                      <SpoolRow
                        key={spool.id}
                        spool={spool}
                        y={HEADER + i * ROW_H}
                        selectedWeldId={selectedWeld?.id ?? null}
                        onSelectWeld={w => handleSelectWeld(w, spool)}
                        lineColor={lineColorMap[spool.line_number ?? ''] ?? '#4b5563'}
                      />
                    ))}
                  </svg>
                )}
              </div>
            </div>

            {/* Detail panel */}
            {selectedWeld && selectedSpool && (
              <WeldDetailPanel
                weld={selectedWeld}
                spool={selectedSpool}
                onClose={() => { setSelectedWeld(null); setSelectedSpool(null) }}
              />
            )}
          </div>
        </>
      )}

      {!selectedProject && (
        <div className="card p-12 text-center">
          <Map className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">Select a project to view the weld map</p>
          <p className="text-surface-600 text-sm mt-1">Weld joints are displayed along their spool segments</p>
        </div>
      )}
    </div>
  )
}
