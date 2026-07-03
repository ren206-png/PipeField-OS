// ============================================================
// Piping Reference Database — /pipe-reference
// Searchable, filterable library sourced from public ASME/MSS standards.
// Tabs: Pipe Dims | Fittings (B16.9) | Flanges (B16.5) | Valve F-to-F | Support Spans
// ============================================================
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Search, Copy, Calculator, Info,
  ArrowLeftRight, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  NPS_SIZES, PIPE_OD_TABLE, PIPE_WALL_TABLE, PIPE_SCHEDULES,
  CTF_45_ELBOW, CTF_TEE, get90LRElbowCTF, get90SRElbowCTF,
  type NpsSize, type PipeSchedule,
} from '@/config/pipe-data'
import {
  FLANGE_DIMS, FLANGE_CLASSES, FLANGE_PRESSURE_RATING_PSI,
  VALVE_FTF, VALVE_TYPE_LABELS,
  SP69_SPAN_TABLE,
  inToMm, ftToM,
  type FlangeClass, type ValveType,
} from '@/config/reference-data'

// ── Types ─────────────────────────────────────────────────────
type Tab = 'dims' | 'fittings' | 'flanges' | 'valves' | 'spans'
type Unit = 'imperial' | 'metric'

const TABS: { value: Tab; label: string; short: string; source: string }[] = [
  { value: 'dims',     label: 'Pipe Dimensions',    short: 'Pipe Dims',  source: 'ASME B36.10M / B36.19M' },
  { value: 'fittings', label: 'Fitting Take-Outs',  short: 'Take-Outs',  source: 'ASME B16.9' },
  { value: 'flanges',  label: 'Flange Dimensions',  short: 'Flanges',    source: 'ASME B16.5' },
  { value: 'valves',   label: 'Valve Face-to-Face', short: 'Valves',     source: 'ASME B16.10' },
  { value: 'spans',    label: 'Support Spans',      short: 'Spans',      source: 'MSS SP-69' },
]

const VALVE_TYPES: ValveType[] = ['gate', 'globe', 'check_swing', 'ball', 'butterfly']

// ── Helpers ───────────────────────────────────────────────────
function fmtIn(val: number | null | undefined, unit: Unit, decimals = 3): string {
  if (val == null) return '—'
  if (unit === 'metric') return `${inToMm(val).toFixed(1)} mm`
  return `${val.toFixed(decimals)}"`
}

function fmtFt(val: number | null | undefined, unit: Unit): string {
  if (val == null) return '—'
  if (unit === 'metric') return `${ftToM(val).toFixed(2)} m`
  return `${val} ft`
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text)
}

// ── Sub-components ────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn(
      'px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500 border-b border-surface-700 whitespace-nowrap',
      right ? 'text-right' : 'text-left'
    )}>
      {children}
    </th>
  )
}

function Td({ children, mono, right, highlight }: {
  children: React.ReactNode; mono?: boolean; right?: boolean; highlight?: boolean
}) {
  return (
    <td className={cn(
      'px-3 py-2.5 text-sm border-b border-surface-800/50 whitespace-nowrap',
      mono && 'font-mono',
      right ? 'text-right' : 'text-left',
      highlight ? 'text-brand-300 font-semibold' : 'text-surface-200',
    )}>
      {children}
    </td>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { copyText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded text-surface-600 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
      title="Copy value"
    >
      {copied
        ? <span className="text-[10px] text-green-400 font-medium">✓</span>
        : <Copy className="w-3 h-3" />}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function PipeReferencePage() {
  const router = useRouter()
  const [tab, setTab]       = useState<Tab>('dims')
  const [unit, setUnit]     = useState<Unit>('imperial')
  const [search, setSearch] = useState('')
  const [npsFilter, setNpsFilter] = useState<NpsSize | 'all'>('all')
  const [flangeClass, setFlangeClass] = useState<FlangeClass>(150)
  const [valveType, setValveType]     = useState<ValveType>('gate')

  const activeTab = TABS.find(t => t.value === tab)!

  // Filtered NPS list for tables
  const filteredNps: NpsSize[] = useMemo(() => {
    let sizes = NPS_SIZES.map(n => n.value)
    if (npsFilter !== 'all') sizes = sizes.filter(n => n === npsFilter)
    if (search) {
      const q = search.toLowerCase()
      sizes = sizes.filter(n => {
        const label = NPS_SIZES.find(s => s.value === n)?.label ?? ''
        return label.toLowerCase().includes(q) || n.includes(q)
      })
    }
    return sizes
  }, [npsFilter, search])

  function goToCalc(nps: NpsSize) {
    router.push(`/calculator?nps=${nps}`)
  }

  // ── Schedules for dims table (only schedules that exist in data)
  const dimSchedules: PipeSchedule[] = ['sch_5','sch_10','sch_20','sch_40','sch_80','sch_120','sch_160','xxh']

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page header */}
      <div className="page-header hidden lg:block">
        <h1 className="page-title flex items-center gap-3">
          <span className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </span>
          Piping Reference Database
        </h1>
        <p className="page-subtitle">
          {activeTab.source} · Searchable reference library
        </p>
      </div>

      {/* Engineering notice */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-800 border border-surface-700">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-surface-400 leading-relaxed">
          <span className="font-semibold text-surface-300">Sample values only. </span>
          Verify all dimensions against current editions of ASME B36.10M, B36.19M, B16.9, B16.5, B16.10 and MSS SP-69 before use.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search NPS size…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-xl text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>

        {/* NPS filter */}
        <div className="relative">
          <select
            value={npsFilter}
            onChange={e => setNpsFilter(e.target.value as NpsSize | 'all')}
            className="pl-3 pr-8 py-2 text-sm bg-surface-800 border border-surface-700 rounded-xl text-surface-100 focus:border-brand-500 focus:outline-none appearance-none transition-colors"
          >
            <option value="all">All NPS</option>
            {NPS_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
        </div>

        {/* Unit toggle */}
        <button
          onClick={() => setUnit(u => u === 'imperial' ? 'metric' : 'imperial')}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-surface-700 bg-surface-800 text-surface-300 hover:border-brand-500 hover:text-brand-300 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {unit === 'imperial' ? 'Imperial' : 'Metric'}
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-700 pb-0">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.value
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-surface-500 hover:text-surface-200'
            )}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Pipe Dimensions ── */}
      {tab === 'dims' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="text-sm font-semibold text-surface-100">Pipe Dimensions</h2>
              <p className="text-xs text-surface-500 mt-0.5">OD, wall thickness, and ID by NPS and schedule — ASME B36.10M</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-800/50">
                <tr>
                  <Th>NPS</Th>
                  <Th right>OD</Th>
                  {dimSchedules.map(s => (
                    <Th key={s} right>{PIPE_SCHEDULES.find(p => p.value === s)?.label.replace('Sch ', 'S').replace(' (STD)', '').replace(' (XH)', '') ?? s}</Th>
                  ))}
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredNps.map(nps => {
                  const od = PIPE_OD_TABLE[nps]
                  const walls = PIPE_WALL_TABLE[nps]
                  const label = NPS_SIZES.find(s => s.value === nps)?.label ?? nps
                  return (
                    <tr key={nps} className="hover:bg-surface-800/30 transition-colors group">
                      <Td highlight>{label}</Td>
                      <Td mono right>{fmtIn(od, unit)}</Td>
                      {dimSchedules.map(s => {
                        const w = walls?.[s]
                        const id = od && w ? od - 2 * w : null
                        return (
                          <Td key={s} mono right>
                            {w != null ? (
                              <span className="group/cell relative">
                                <span className="block">{fmtIn(w, unit)}</span>
                                {id != null && (
                                  <span className="block text-[10px] text-surface-500">
                                    ID {fmtIn(id, unit, 3)}
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </Td>
                        )
                      })}
                      <Td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyBtn value={`NPS ${label}, OD ${od?.toFixed(3)}"`} />
                          <button
                            onClick={() => goToCalc(nps)}
                            className="p-1 rounded text-surface-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                            title="Open in Calculator"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Fitting Take-Outs ── */}
      {tab === 'fittings' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="text-sm font-semibold text-surface-100">Fitting Take-Out Dimensions</h2>
              <p className="text-xs text-surface-500 mt-0.5">Center-to-face dimensions — ASME B16.9</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-800/50">
                <tr>
                  <Th>NPS</Th>
                  <Th right>OD</Th>
                  <Th right>90° LR Elbow</Th>
                  <Th right>90° SR Elbow</Th>
                  <Th right>45° Elbow</Th>
                  <Th right>Tee (run)</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredNps.map(nps => {
                  const npsNum = parseFloat(nps)
                  const od     = PIPE_OD_TABLE[nps]
                  const lr90   = get90LRElbowCTF(npsNum)
                  const sr90   = get90SRElbowCTF(npsNum)
                  const e45    = CTF_45_ELBOW[nps]
                  const tee    = CTF_TEE[nps]
                  const label  = NPS_SIZES.find(s => s.value === nps)?.label ?? nps
                  return (
                    <tr key={nps} className="hover:bg-surface-800/30 transition-colors group">
                      <Td highlight>{label}</Td>
                      <Td mono right>{fmtIn(od, unit)}</Td>
                      <Td mono right>{fmtIn(lr90, unit)}</Td>
                      <Td mono right>{fmtIn(sr90, unit)}</Td>
                      <Td mono right>{fmtIn(e45, unit)}</Td>
                      <Td mono right>{fmtIn(tee, unit)}</Td>
                      <Td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyBtn value={`NPS ${label}: 90°LR=${lr90.toFixed(3)}" 90°SR=${sr90.toFixed(3)}" 45°=${e45?.toFixed(3) ?? '?'}" Tee=${tee?.toFixed(3) ?? '?'}"`} />
                          <button
                            onClick={() => goToCalc(nps)}
                            className="p-1 rounded text-surface-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                            title="Open in Calculator"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Flanges ── */}
      {tab === 'flanges' && (
        <div className="space-y-4">
          {/* Class selector */}
          <div className="flex flex-wrap gap-2">
            {FLANGE_CLASSES.map(cls => (
              <button
                key={cls}
                onClick={() => setFlangeClass(cls)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  flangeClass === cls
                    ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                    : 'border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200'
                )}
              >
                Class {cls}
                <span className="ml-1.5 text-[10px] text-surface-500">
                  ({FLANGE_PRESSURE_RATING_PSI[cls]} psi)
                </span>
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h2 className="text-sm font-semibold text-surface-100">
                  Class {flangeClass} Flange Dimensions
                  <span className="ml-2 text-xs font-normal text-surface-500">
                    ({FLANGE_PRESSURE_RATING_PSI[flangeClass]} psi @ 100°F — Group 1.1 A105/WCB)
                  </span>
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">ASME B16.5 — Raised Face (RF)</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-800/50">
                  <tr>
                    <Th>NPS</Th>
                    <Th right>Flange OD</Th>
                    <Th right>Bolt Circle</Th>
                    <Th right>No. Bolts</Th>
                    <Th right>Bolt Dia</Th>
                    <Th right>RF Dia</Th>
                    <Th right>Min Thickness</Th>
                    <Th>Copy</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNps.map(nps => {
                    const d = FLANGE_DIMS[nps]?.[flangeClass]
                    const label = NPS_SIZES.find(s => s.value === nps)?.label ?? nps
                    if (!d) return (
                      <tr key={nps} className="hover:bg-surface-800/30 transition-colors">
                        <Td highlight>{label}</Td>
                        <Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>{''}</Td>
                      </tr>
                    )
                    const copyVal = `NPS ${label} Class ${flangeClass}: OD=${d.flange_od_in}" BC=${d.bolt_circle_in}" ${d.num_bolts}×${d.bolt_dia_in}" bolts RF=${d.raised_face_dia_in}" T=${d.min_thickness_in}"`
                    return (
                      <tr key={nps} className="hover:bg-surface-800/30 transition-colors group">
                        <Td highlight>{label}</Td>
                        <Td mono right>{fmtIn(d.flange_od_in, unit)}</Td>
                        <Td mono right>{fmtIn(d.bolt_circle_in, unit)}</Td>
                        <Td mono right>{d.num_bolts}</Td>
                        <Td mono right>{fmtIn(d.bolt_dia_in, unit)}</Td>
                        <Td mono right>{fmtIn(d.raised_face_dia_in, unit)}</Td>
                        <Td mono right>{fmtIn(d.min_thickness_in, unit)}</Td>
                        <Td>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyBtn value={copyVal} />
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Valve Face-to-Face ── */}
      {tab === 'valves' && (
        <div className="space-y-4">
          {/* Valve type selector */}
          <div className="flex flex-wrap gap-2">
            {VALVE_TYPES.map(vt => (
              <button
                key={vt}
                onClick={() => setValveType(vt)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  valveType === vt
                    ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                    : 'border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200'
                )}
              >
                {VALVE_TYPE_LABELS[vt]}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <h2 className="text-sm font-semibold text-surface-100">
                  {VALVE_TYPE_LABELS[valveType]} — Face-to-Face Dimensions
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">ASME B16.10 — Classes 150 / 300 / 600</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-800/50">
                  <tr>
                    <Th>NPS</Th>
                    <Th right>Class 150</Th>
                    <Th right>Class 300</Th>
                    <Th right>Class 600</Th>
                    <Th>Copy</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNps.map(nps => {
                    const v = VALVE_FTF[nps]?.[valveType]
                    const label = NPS_SIZES.find(s => s.value === nps)?.label ?? nps
                    if (!v) return (
                      <tr key={nps} className="hover:bg-surface-800/30 transition-colors">
                        <Td highlight>{label}</Td>
                        <Td>—</Td><Td>—</Td><Td>—</Td><Td>{''}</Td>
                      </tr>
                    )
                    return (
                      <tr key={nps} className="hover:bg-surface-800/30 transition-colors group">
                        <Td highlight>{label}</Td>
                        <Td mono right>{fmtIn(v.class_150, unit)}</Td>
                        <Td mono right>{fmtIn(v.class_300, unit)}</Td>
                        <Td mono right>{fmtIn(v.class_600, unit)}</Td>
                        <Td>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyBtn value={`${VALVE_TYPE_LABELS[valveType]} NPS ${label}: 150#=${v.class_150 ?? '—'}" 300#=${v.class_300 ?? '—'}" 600#=${v.class_600 ?? '—'}"`} />
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Support Spans ── */}
      {tab === 'spans' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <h2 className="text-sm font-semibold text-surface-100">Pipe Support Span Guide</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Maximum recommended span for carbon steel pipe by service fluid — MSS SP-69 Table 3
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-800/50">
                <tr>
                  <Th>NPS</Th>
                  <Th right>OD</Th>
                  <Th right>Water (filled)</Th>
                  <Th right>Steam / Condensate</Th>
                  <Th right>Gas / Air</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredNps.map(nps => {
                  const s = SP69_SPAN_TABLE[nps]
                  const od = PIPE_OD_TABLE[nps]
                  const label = NPS_SIZES.find(n => n.value === nps)?.label ?? nps
                  return (
                    <tr key={nps} className="hover:bg-surface-800/30 transition-colors group">
                      <Td highlight>{label}</Td>
                      <Td mono right>{fmtIn(od, unit)}</Td>
                      <Td mono right>{s ? fmtFt(s.water_ft, unit) : '—'}</Td>
                      <Td mono right>{s ? fmtFt(s.steam_ft, unit) : '—'}</Td>
                      <Td mono right>{s ? fmtFt(s.gas_ft, unit) : '—'}</Td>
                      <Td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {s && <CopyBtn value={`NPS ${label} spans: water=${s.water_ft}ft steam=${s.steam_ft}ft gas=${s.gas_ft}ft`} />}
                          <button
                            onClick={() => router.push('/pipe-support')}
                            className="p-1 rounded text-surface-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                            title="Open Pipe Support Calculator"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Fluid key */}
          <div className="px-5 py-3 border-t border-surface-700 bg-surface-800/30">
            <p className="text-[10px] text-surface-500 leading-relaxed">
              <span className="font-semibold text-surface-400">Note: </span>
              Values assume standard weight carbon steel pipe at ambient temperature.
              Reduce spans for elevated temperature, insulated pipe, or vibration service.
              Always verify against project specifications and ASME B31.3 / B31.1 flexibility analysis requirements.
            </p>
          </div>
        </div>
      )}

      {/* Source citation footer */}
      <p className="text-[10px] text-surface-600 text-center pb-4">
        Reference data sourced from ASME B36.10M, B36.19M, B16.9, B16.5, B16.10 and MSS SP-69 [sample values — verify before use]
      </p>
    </div>
  )
}
