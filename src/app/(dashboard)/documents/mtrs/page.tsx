'use client'
// ============================================================
// MTR Register — Material Traceability Records
// ============================================================
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileSearch } from 'lucide-react'
import { useMtrs } from '@/hooks/useMtr'
import { useProjects } from '@/hooks/useProjects'
import {
  MTR_STATUS_LABELS,
  MTR_STATUS_COLORS,
  MTR_TYPE_LABELS,
  type MtrStatus,
  type MtrMaterialType,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

export default function MtrsPage() {
  const router = useRouter()
  const { data: mtrs = [], isLoading } = useMtrs()
  const { data: projects = [] } = useProjects()

  const [filterProject,  setFilterProject]  = useState('')
  const [filterType,     setFilterType]     = useState<MtrMaterialType | ''>('')
  const [filterStatus,   setFilterStatus]   = useState<MtrStatus | ''>('')
  const [search,         setSearch]         = useState('')

  const total      = mtrs.length
  const accepted   = mtrs.filter(m => m.status === 'accepted').length
  const quarantine = mtrs.filter(m => m.status === 'quarantine').length
  const rejected   = mtrs.filter(m => m.status === 'rejected').length

  const filtered = useMemo(() => {
    return mtrs.filter(m => {
      if (filterProject && m.project_id !== filterProject) return false
      if (filterType    && m.material_type !== filterType) return false
      if (filterStatus  && m.status !== filterStatus)      return false
      if (search) {
        const q = search.toLowerCase()
        return (
          m.heat_number.toLowerCase().includes(q) ||
          (m.mtr_number ?? '').toLowerCase().includes(q) ||
          m.material_spec.toLowerCase().includes(q) ||
          (m.supplier ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [mtrs, filterProject, filterType, filterStatus, search])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Material Traceability</h1>
          <p className="text-sm text-surface-500 mt-0.5">MTR register — ASME B31.3 compliance</p>
        </div>
        <Link href="/documents/mtrs/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> Add MTR
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-surface-200 mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Accepted</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{accepted}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Quarantine</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">{quarantine}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Rejected</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-[200px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterType} onChange={e => setFilterType(e.target.value as MtrMaterialType | '')}>
          <option value="">All Types</option>
          {(Object.keys(MTR_TYPE_LABELS) as MtrMaterialType[]).map(t => (
            <option key={t} value={t}>{MTR_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as MtrStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(MTR_STATUS_LABELS) as MtrStatus[]).map(s => (
            <option key={s} value={s}>{MTR_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Search heat #, MTR #, spec, supplier…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileSearch className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">
            No MTRs found. Add your first material traceability record.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Heat #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Material Spec</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Received</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filtered.map(mtr => (
                  <tr
                    key={mtr.id}
                    className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                    onClick={() => router.push(`/documents/mtrs/${mtr.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-surface-100">{mtr.heat_number}</span>
                      {mtr.mtr_number && (
                        <p className="text-xs text-surface-500 mt-0.5">{mtr.mtr_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-300">{mtr.material_spec}</td>
                    <td className="px-4 py-3 text-surface-400">{MTR_TYPE_LABELS[mtr.material_type]}</td>
                    <td className="px-4 py-3 text-surface-400">{mtr.nominal_size ?? '—'}</td>
                    <td className="px-4 py-3 text-surface-400">{mtr.supplier ?? '—'}</td>
                    <td className="px-4 py-3 text-surface-500 text-xs">
                      {mtr.received_date ? formatDate(mtr.received_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', MTR_STATUS_COLORS[mtr.status])}>
                        {MTR_STATUS_LABELS[mtr.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/mtrs/${mtr.id}`}
                        className="text-xs text-brand-400 hover:text-brand-300"
                        onClick={e => e.stopPropagation()}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
