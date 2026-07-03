'use client'
// ============================================================
// Punch List — Track and close outstanding site deficiencies
// ============================================================
import { useState, useMemo } from 'react'
import { format, isAfter, startOfDay } from 'date-fns'
import {
  Plus,
  Check,
  Pencil,
  ListChecks,
  X,
} from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import {
  usePunchItems,
  useCreatePunchItem,
  useUpdatePunchItem,
  useClosePunchItem,
} from '@/hooks/usePunchList'
import {
  PUNCH_STATUS_LABELS,
  PUNCH_STATUS_COLORS,
  PUNCH_CATEGORY_COLORS,
  PUNCH_CATEGORY_LABELS,
  PUNCH_DISCIPLINE_LABELS,
  type PunchItem,
  type PunchStatus,
  type PunchCategory,
  type PunchDiscipline,
} from '@/types'
import { cn } from '@/lib/utils'

// ── helpers ──────────────────────────────────────────────────
const TODAY = startOfDay(new Date())

function isOverdue(due: string | null): boolean {
  if (!due) return false
  return isAfter(TODAY, startOfDay(new Date(due)))
}

// ── Add Item Modal ────────────────────────────────────────────
interface AddModalProps {
  projects: { id: string; name: string; project_number: string }[]
  onClose: () => void
  onSave: (v: Omit<PunchItem, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'closed_by'|'closed_at'>) => void
  isSaving: boolean
  initial?: PunchItem | null
}

function PunchModal({ projects, onClose, onSave, isSaving, initial }: AddModalProps) {
  const [projectId, setProjectId]     = useState(initial?.project_id ?? '')
  const [itemNumber, setItemNumber]   = useState(initial?.item_number ?? `PL-${String(Date.now()).slice(-4)}`)
  const [category, setCategory]       = useState<PunchCategory>(initial?.category ?? 'A')
  const [discipline, setDiscipline]   = useState<PunchDiscipline>(initial?.discipline ?? 'piping')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [location, setLocation]       = useState(initial?.location ?? '')
  const [drawingRef, setDrawingRef]   = useState(initial?.drawing_ref ?? '')
  const [raisedBy, setRaisedBy]       = useState(initial?.raised_by ?? '')
  const [dueDate, setDueDate]         = useState(initial?.due_date ?? '')
  const [status, setStatus]           = useState<PunchStatus>(initial?.status ?? 'open')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !description) return
    onSave({
      project_id:      projectId,
      item_number:     itemNumber,
      category,
      discipline,
      description,
      location:        location || null,
      drawing_ref:     drawingRef || null,
      raised_by:       raisedBy || null,
      assigned_to:     initial?.assigned_to ?? null,
      due_date:        dueDate || null,
      status,
      resolution_notes: initial?.resolution_notes ?? null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <h2 className="font-semibold text-surface-100">{initial ? 'Edit Punch Item' : 'Add Punch Item'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project */}
          <div>
            <label className="label">Project <span className="text-red-400">*</span></label>
            <select className="input mt-1" value={projectId} onChange={e => setProjectId(e.target.value)} required>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
            </select>
          </div>

          {/* Item Number + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Item Number</label>
              <input className="input mt-1" value={itemNumber} onChange={e => setItemNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Category <span className="text-red-400">*</span></label>
              <select className="input mt-1" value={category} onChange={e => setCategory(e.target.value as PunchCategory)}>
                {(['A','B','C'] as PunchCategory[]).map(c => (
                  <option key={c} value={c}>{PUNCH_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Discipline */}
          <div>
            <label className="label">Discipline</label>
            <select className="input mt-1" value={discipline} onChange={e => setDiscipline(e.target.value as PunchDiscipline)}>
              {(Object.keys(PUNCH_DISCIPLINE_LABELS) as PunchDiscipline[]).map(d => (
                <option key={d} value={d}>{PUNCH_DISCIPLINE_LABELS[d]}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-red-400">*</span></label>
            <textarea
              className="input mt-1"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              placeholder="Describe the deficiency…"
            />
          </div>

          {/* Location + Drawing Ref */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Location</label>
              <input className="input mt-1" value={location} onChange={e => setLocation(e.target.value)} placeholder="Area / coordinate" />
            </div>
            <div>
              <label className="label">Drawing Reference</label>
              <input className="input mt-1" value={drawingRef} onChange={e => setDrawingRef(e.target.value)} placeholder="DWG-001" />
            </div>
          </div>

          {/* Raised By + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Raised By</label>
              <input className="input mt-1" value={raisedBy} onChange={e => setRaisedBy(e.target.value)} placeholder="Inspector / client name" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input mt-1" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Status (edit only) */}
          {initial && (
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={status} onChange={e => setStatus(e.target.value as PunchStatus)}>
                {(Object.keys(PUNCH_STATUS_LABELS) as PunchStatus[]).map(s => (
                  <option key={s} value={s}>{PUNCH_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={isSaving} className="btn-primary flex-1">
              {isSaving ? 'Saving…' : initial ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Close Modal ───────────────────────────────────────────────
function CloseModal({ item, onClose, onConfirm, isSaving }: {
  item: PunchItem
  onClose: () => void
  onConfirm: (notes: string) => void
  isSaving: boolean
}) {
  const [notes, setNotes] = useState(item.resolution_notes ?? '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <h2 className="font-semibold text-surface-100">Close Punch Item</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-surface-400">
            Close <span className="font-mono font-bold text-surface-200">{item.item_number}</span>: {item.description.slice(0, 80)}
          </p>
          <div>
            <label className="label">Resolution Notes</label>
            <textarea
              className="input mt-1"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe how the deficiency was resolved…"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button
              onClick={() => onConfirm(notes)}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Closing…' : 'Confirm Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function PunchListPage() {
  const { data: projects = [] } = useProjects()
  const { data: allItems = [], isLoading } = usePunchItems()
  const createPunch  = useCreatePunchItem()
  const updatePunch  = useUpdatePunchItem()
  const closePunch   = useClosePunchItem()

  const [showAddModal, setShowAddModal]   = useState(false)
  const [editItem, setEditItem]           = useState<PunchItem | null>(null)
  const [closeItem, setCloseItem]         = useState<PunchItem | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterCategory, setFilterCategory] = useState<PunchCategory | ''>('')
  const [filterStatus, setFilterStatus]   = useState<PunchStatus | ''>('')
  const [search, setSearch]               = useState('')

  // Stats
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const totalOpen    = allItems.filter(i => i.status === 'open').length
  const catAOpen     = allItems.filter(i => i.status === 'open' && i.category === 'A').length
  const inProgress   = allItems.filter(i => i.status === 'in_progress').length
  const closedToday  = allItems.filter(i => i.status === 'closed' && i.closed_at?.startsWith(todayStr)).length

  // Filtered
  const items = useMemo(() => {
    return allItems.filter(item => {
      if (filterProject  && item.project_id !== filterProject) return false
      if (filterCategory && item.category   !== filterCategory) return false
      if (filterStatus   && item.status     !== filterStatus)   return false
      if (search) {
        const q = search.toLowerCase()
        return (
          item.item_number.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.location ?? '').toLowerCase().includes(q) ||
          (item.raised_by ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allItems, filterProject, filterCategory, filterStatus, search])

  async function handleCreate(values: Parameters<typeof createPunch.mutateAsync>[0]) {
    await createPunch.mutateAsync(values)
    setShowAddModal(false)
  }

  async function handleEdit(values: Parameters<typeof createPunch.mutateAsync>[0]) {
    if (!editItem) return
    await updatePunch.mutateAsync({ id: editItem.id, ...values })
    setEditItem(null)
  }

  async function handleClose(notes: string) {
    if (!closeItem) return
    await closePunch.mutateAsync({ id: closeItem.id, resolution_notes: notes })
    setCloseItem(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Punch List</h1>
          <p className="text-sm text-surface-500 mt-0.5">Track and close outstanding site deficiencies</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Total Open</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{totalOpen}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Cat A Open</p>
          <p className="text-3xl font-bold text-red-300 mt-1">{catAOpen}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">In Progress</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{inProgress}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase tracking-wide">Closed Today</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{closedToday}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input max-w-[180px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterCategory} onChange={e => setFilterCategory(e.target.value as PunchCategory | '')}>
          <option value="">All Categories</option>
          <option value="A">Cat A</option>
          <option value="B">Cat B</option>
          <option value="C">Cat C</option>
        </select>
        <select className="input max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value as PunchStatus | '')}>
          <option value="">All Statuses</option>
          {(Object.keys(PUNCH_STATUS_LABELS) as PunchStatus[]).map(s => (
            <option key={s} value={s}>{PUNCH_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <ListChecks className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">No punch items found.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Item #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Cat</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Discipline</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Location</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Due</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-surface-200">{item.item_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', PUNCH_CATEGORY_COLORS[item.category])}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded">
                        {PUNCH_DISCIPLINE_LABELS[item.discipline]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-surface-200 truncate" title={item.description}>
                        {item.description.length > 60 ? item.description.slice(0, 60) + '…' : item.description}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-surface-400">{item.location ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {item.due_date ? (
                        <span className={cn('text-xs font-medium', isOverdue(item.due_date) && item.status !== 'closed' && item.status !== 'voided' ? 'text-red-400' : 'text-surface-400')}>
                          {format(new Date(item.due_date), 'MMM d')}
                        </span>
                      ) : <span className="text-surface-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs px-2 py-0.5 rounded', PUNCH_STATUS_COLORS[item.status])}>
                        {PUNCH_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {item.status !== 'closed' && item.status !== 'voided' && (
                          <button
                            onClick={() => setCloseItem(item)}
                            className="p-1.5 rounded hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-colors"
                            title="Close item"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                          title="Edit item"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <PunchModal
          projects={projects}
          onClose={() => setShowAddModal(false)}
          onSave={handleCreate}
          isSaving={createPunch.isPending}
        />
      )}
      {editItem && (
        <PunchModal
          projects={projects}
          onClose={() => setEditItem(null)}
          onSave={handleEdit}
          isSaving={updatePunch.isPending}
          initial={editItem}
        />
      )}
      {closeItem && (
        <CloseModal
          item={closeItem}
          onClose={() => setCloseItem(null)}
          onConfirm={handleClose}
          isSaving={closePunch.isPending}
        />
      )}
    </div>
  )
}
