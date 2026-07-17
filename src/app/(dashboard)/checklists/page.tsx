'use client'
// ============================================================
// Inspection Checklist Templates
// Create / edit reusable QA checklists that can be applied
// to any weld record from the weld detail page.
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, Pencil, Trash2, X, Loader2,
  GripVertical, CheckSquare, Square, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/Header'

// ── Types ─────────────────────────────────────────────────────

interface TemplateItem {
  id:       string
  label:    string
  required: boolean
}

interface ChecklistTemplate {
  id:          string
  name:        string
  description: string | null
  weld_type:   string | null
  items:       TemplateItem[]
  created_at:  string
}

// ── Helpers ───────────────────────────────────────────────────

function newItemId() {
  return Math.random().toString(36).slice(2)
}

// ── API calls ────────────────────────────────────────────────

async function fetchTemplates(): Promise<ChecklistTemplate[]> {
  const res = await apiFetch('/api/checklist-templates')
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json() as Promise<ChecklistTemplate[]>
}

// ── Template Form ─────────────────────────────────────────────

interface TemplateFormProps {
  initial?: ChecklistTemplate
  onSave:   () => void
  onCancel: () => void
}

function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const qc = useQueryClient()
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [weldType,    setWeldType]    = useState(initial?.weld_type   ?? '')
  const [items,       setItems]       = useState<TemplateItem[]>(
    initial?.items ?? [{ id: newItemId(), label: '', required: false }]
  )
  const [error, setError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(i => i.label.trim())
      if (!name.trim()) throw new Error('Template name is required')
      if (validItems.length === 0) throw new Error('Add at least one checklist item')

      const payload = {
        name:        name.trim(),
        description: description.trim() || null,
        weld_type:   weldType.trim()    || null,
        items:       validItems.map(i => ({ ...i, label: i.label.trim() })),
      }

      const url    = initial ? `/api/checklist-templates/${initial.id}` : '/api/checklist-templates'
      const method = initial ? 'PUT' : 'POST'
      const res    = await apiFetch(url, { method, body: JSON.stringify(payload) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Save failed')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['checklist-templates'] })
      onSave()
    },
    onError: (err: Error) => setError(err.message),
  })

  function addItem() {
    setItems(prev => [...prev, { id: newItemId(), label: '', required: false }])
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id: string, patch: Partial<TemplateItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  return (
    <div className="card p-6 space-y-5">
      <h2 className="text-base font-semibold text-surface-100">
        {initial ? 'Edit Template' : 'New Template'}
      </h2>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">Template Name *</label>
        <input
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="e.g. Visual Inspection — Carbon Steel"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">Description</label>
        <textarea
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          rows={2}
          placeholder="Optional description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* Weld type filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">Weld Type (optional filter)</label>
        <input
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="e.g. SMAW, GTAW, Butt weld…"
          value={weldType}
          onChange={e => setWeldType(e.target.value)}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wide">Checklist Items *</label>
          <span className="text-xs text-surface-600">{items.filter(i => i.label.trim()).length} items</span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-surface-700 flex-shrink-0" />
              <span className="text-xs text-surface-600 w-5 flex-shrink-0">{idx + 1}.</span>
              <input
                className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Checklist item…"
                value={item.label}
                onChange={e => updateItem(item.id, { label: e.target.value })}
              />
              <button
                type="button"
                onClick={() => updateItem(item.id, { required: !item.required })}
                title={item.required ? 'Required' : 'Optional'}
                className={cn(
                  'text-xs px-2 py-1 rounded border flex-shrink-0 transition-colors',
                  item.required
                    ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                    : 'bg-surface-800 border-surface-700 text-surface-600 hover:text-surface-400'
                )}
              >
                Req
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="p-1 text-surface-600 hover:text-red-400 transition-colors disabled:opacity-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => void saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? 'Save Changes' : 'Create Template'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────

interface TemplateCardProps {
  template: ChecklistTemplate
  onEdit:   (t: ChecklistTemplate) => void
  onDelete: (id: string) => void
  deleting: boolean
}

function TemplateCard({ template, onEdit, onDelete, deleting }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const requiredCount = template.items.filter(i => i.required).length

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-surface-100 text-sm">{template.name}</h3>
            {template.weld_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400">
                {template.weld_type}
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-surface-500 mt-0.5">{template.description}</p>
          )}
          <p className="text-xs text-surface-600 mt-1">
            {template.items.length} items
            {requiredCount > 0 && ` · ${requiredCount} required`}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            disabled={deleting}
            className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expand / collapse items */}
      <button
        onClick={() => setExpanded(s => !s)}
        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Hide items' : 'Show items'}
      </button>

      {expanded && (
        <ul className="space-y-1.5 pl-1">
          {template.items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2 text-xs text-surface-400">
              <Square className="w-3.5 h-3.5 text-surface-700 flex-shrink-0" />
              <span className="flex-1">{i + 1}. {item.label}</span>
              {item.required && (
                <span className="text-brand-500 font-medium">required</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function ChecklistsPage() {
  const qc = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn:  fetchTemplates,
  })

  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<ChecklistTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/checklist-templates/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Delete failed')
    },
    onMutate:  (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  })

  function openEdit(t: ChecklistTemplate) {
    setEditing(t)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  return (
    <>
      <Header title="Inspection Checklists" subtitle="Manage reusable QA checklist templates" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-50">Checklist Templates</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Create reusable inspection checklists and apply them to any weld record.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <TemplateForm
            initial={editing ?? undefined}
            onSave={closeForm}
            onCancel={closeForm}
          />
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 h-24 animate-pulse bg-surface-800" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="w-10 h-10 text-surface-700 mx-auto mb-3" />
            <p className="text-surface-400 font-medium">No templates yet</p>
            <p className="text-surface-600 text-sm mt-1">
              Create your first checklist template to standardise QA inspections.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={openEdit}
                onDelete={(id) => void deleteMutation.mutate(id)}
                deleting={deletingId === t.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
