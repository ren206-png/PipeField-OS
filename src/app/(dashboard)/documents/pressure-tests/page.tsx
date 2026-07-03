'use client'
// ============================================================
// Pressure Tests — List Page
// ============================================================
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Gauge } from 'lucide-react'
import { usePressureTests } from '@/hooks/usePressureTests'
import { useProjects } from '@/hooks/useProjects'
import {
  PT_RESULT_LABELS,
  PT_RESULT_COLORS,
  PT_STATUS_LABELS,
  PT_STATUS_COLORS,
  PT_TYPE_LABELS,
  type PressureTestResult,
  type PressureTestType,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

export default function PressureTestsPage() {
  const { data: tests = [], isLoading } = usePressureTests()
  const { data: projects = [] } = useProjects()

  const [filterProject, setFilterProject] = useState('')
  const [filterType,    setFilterType]    = useState<PressureTestType | ''>('')
  const [filterResult,  setFilterResult]  = useState<PressureTestResult | ''>('')
  const [search,        setSearch]        = useState('')

  const total   = tests.length
  const passed  = tests.filter(t => t.result === 'pass').length
  const failed  = tests.filter(t => t.result === 'fail').length
  const pending = tests.filter(t => t.result === 'pending').length

  const filtered = useMemo(() => {
    return tests.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterType    && t.test_type  !== filterType)    return false
      if (filterResult  && t.result     !== filterResult)  return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.test_number.toLowerCase().includes(q) ||
          t.system_name.toLowerCase().includes(q) ||
          t.inspector_name.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tests, filterProject, filterType, filterResult, search])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-bold text-surface-50">Pressure Tests</h1>
          </div>
          <p className="text-surface-400 text-sm">Hydrostatic &amp; pneumatic test records</p>
        </div>
        <Link href="/documents/pressure-tests/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Test Record
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-surface-50">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Passed</p>
          <p className="text-2xl font-bold text-green-400">{passed}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-400">{failed}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-surface-400">{pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="input text-sm py-1.5 px-3"
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          className="input text-sm py-1.5 px-3"
          value={filterType}
          onChange={e => setFilterType(e.target.value as PressureTestType | '')}
        >
          <option value="">All Types</option>
          {(Object.keys(PT_TYPE_LABELS) as PressureTestType[]).map(k => (
            <option key={k} value={k}>{PT_TYPE_LABELS[k]}</option>
          ))}
        </select>
        <select
          className="input text-sm py-1.5 px-3"
          value={filterResult}
          onChange={e => setFilterResult(e.target.value as PressureTestResult | '')}
        >
          <option value="">All Results</option>
          {(Object.keys(PT_RESULT_LABELS) as PressureTestResult[]).map(k => (
            <option key={k} value={k}>{PT_RESULT_LABELS[k]}</option>
          ))}
        </select>
        <input
          type="text"
          className="input text-sm py-1.5 px-3 flex-1 min-w-[200px]"
          placeholder="Search test number, system, inspector…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-surface-500 text-sm py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Gauge className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400">No pressure test records yet.</p>
          <Link href="/documents/pressure-tests/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Test Record
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(test => (
            <Link
              key={test.id}
              href={`/documents/pressure-tests/${test.id}`}
              className="card p-4 block hover:border-surface-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-bold text-surface-50">{test.test_number}</span>
                    <span className="badge bg-surface-700 text-surface-300 text-xs">{PT_TYPE_LABELS[test.test_type]}</span>
                    <span className={cn('badge text-xs', PT_RESULT_COLORS[test.result])}>{PT_RESULT_LABELS[test.result]}</span>
                  </div>
                  <p className="font-semibold text-surface-100">{test.system_name}</p>
                  {test.project && (
                    <p className="text-sm text-surface-400 mt-0.5">{test.project.name}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
                    <span>{test.test_pressure} {test.pressure_unit} · {test.hold_duration_min} min hold</span>
                    <span>{formatDate(test.test_date)}</span>
                    <span>Inspector: {test.inspector_name}</span>
                    {test.witness_name && <span>Witnessed by: {test.witness_name}</span>}
                  </div>
                </div>
                <span className={cn('badge text-xs flex-shrink-0', PT_STATUS_COLORS[test.status])}>
                  {PT_STATUS_LABELS[test.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
