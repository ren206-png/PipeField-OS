'use client'

import { useState, useRef } from 'react'
import { useDocuments, useUploadDocument, useDeleteDocument, useDocumentUrl } from '@/hooks/useDocuments'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_ICONS,
  DOC_STATUS_LABELS,
  DOC_STATUS_COLORS,
  type DocType,
  type DocStatus,
  type Document,
} from '@/types'
import { Upload, Download, Trash2, X, FolderOpen, Search } from 'lucide-react'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DOC_TYPES: DocType[] = [
  'drawing','specification','procedure','certificate','report',
  'datasheet','itp','correspondence','submittal','method_statement','risk_assessment','other',
]

const DOC_STATUSES: DocStatus[] = [
  'draft','issued_for_review','issued_for_construction','approved','superseded','void',
]

const DISCIPLINES = ['piping','mechanical','electrical','instrumentation','civil','structural','general']

// Inline component so we can call hooks per document for download URLs
function DocCard({
  doc,
  onDelete,
}: {
  doc: Document
  onDelete: (id: string, path: string) => void
}) {
  const { data: signedUrl, refetch } = useDocumentUrl(doc.storage_path)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    const { data } = await refetch()
    if (data) window.open(data, '_blank')
    setDownloading(false)
  }

  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-surface-600 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{DOC_TYPE_ICONS[doc.document_type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="badge text-xs">{DOC_TYPE_LABELS[doc.document_type]}</span>
            <span className={`badge text-xs ${DOC_STATUS_COLORS[doc.status]}`}>
              {DOC_STATUS_LABELS[doc.status]}
            </span>
          </div>
          <p className="font-semibold text-surface-100 text-sm leading-snug line-clamp-2">
            {doc.title}
          </p>
        </div>
      </div>

      {(doc.document_number || doc.revision) && (
        <p className="font-mono text-xs text-surface-400">
          {doc.document_number && <span>{doc.document_number}</span>}
          {doc.document_number && doc.revision && <span className="mx-1">·</span>}
          {doc.revision && <span>Rev {doc.revision}</span>}
        </p>
      )}

      <div className="flex items-center gap-1 text-xs text-surface-500">
        <span className="truncate max-w-[140px]">{doc.file_name}</span>
        <span>·</span>
        <span className="flex-shrink-0">{formatFileSize(doc.file_size)}</span>
      </div>

      {doc.project && (
        <p className="text-xs text-surface-500 truncate">{doc.project.name}</p>
      )}

      <p className="text-xs text-surface-600">{formatDate(doc.created_at)}</p>

      <div className="flex gap-2 mt-auto pt-2 border-t border-surface-800">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-ghost text-xs flex items-center gap-1.5 flex-1 justify-center"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? 'Loading…' : 'Download'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
              onDelete(doc.id, doc.storage_path)
            }
          }}
          className="btn-ghost text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0 px-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

interface UploadForm {
  title: string
  document_number: string
  document_type: DocType
  revision: string
  status: DocStatus
  project_id: string
  discipline: string
  description: string
  tags: string
}

export default function DocumentsPage() {
  const { data: docs = [], isLoading } = useDocuments()
  const { data: projects = [] } = useProjects()
  const { isOrgAdmin } = useAuth()
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()

  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType] = useState<DocType | ''>('')
  const [filterStatus, setFilterStatus] = useState<DocStatus | ''>('')
  const [showUpload, setShowUpload] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<UploadForm>({
    title: '',
    document_number: '',
    document_type: 'other',
    revision: 'A',
    status: 'issued_for_construction',
    project_id: '',
    discipline: 'piping',
    description: '',
    tags: '',
  })

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    setForm(f => ({ ...f, title: f.title || nameWithoutExt }))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return
    await uploadMutation.mutateAsync({
      file: selectedFile,
      metadata: {
        title:           form.title,
        document_number: form.document_number || null,
        document_type:   form.document_type,
        revision:        form.revision || null,
        status:          form.status,
        project_id:      form.project_id || null,
        discipline:      form.discipline || null,
        description:     form.description || null,
        tags:            form.tags || null,
        linked_weld_id:  null,
        linked_spool_id: null,
        linked_ncr_id:   null,
        linked_rfi_id:   null,
      },
    })
    setShowUpload(false)
    setSelectedFile(null)
    setForm({
      title: '', document_number: '', document_type: 'other',
      revision: 'A', status: 'issued_for_construction',
      project_id: '', discipline: 'piping', description: '', tags: '',
    })
  }

  const filtered = docs.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.title.toLowerCase().includes(q) ||
      (d.document_number?.toLowerCase().includes(q) ?? false) ||
      (d.tags?.toLowerCase().includes(q) ?? false)
    const matchProject = !filterProject || d.project_id === filterProject
    const matchType = !filterType || d.document_type === filterType
    const matchStatus = !filterStatus || d.status === filterStatus
    return matchSearch && matchProject && matchType && matchStatus
  })

  // Stats
  const total = docs.length
  const drawings = docs.filter(d => d.document_type === 'drawing').length
  const specs = docs.filter(d => d.document_type === 'specification').length
  const certs = docs.filter(d => d.document_type === 'certificate').length
  const other = docs.filter(d => !['drawing','specification','certificate'].includes(d.document_type)).length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Document Library</h1>
          <p className="text-surface-400 mt-1">Project documents, drawings, specs and certificates</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Docs', value: total },
          { label: 'Drawings', value: drawings },
          { label: 'Specifications', value: specs },
          { label: 'Certificates', value: certs },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-surface-50">{stat.value}</p>
            <p className="text-xs text-surface-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            className="input pl-9 w-full"
            placeholder="Search title, number, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value as DocType | '')}>
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
        </select>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as DocStatus | '')}>
          <option value="">All Statuses</option>
          {DOC_STATUSES.map(s => <option key={s} value={s}>{DOC_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 h-48 animate-pulse bg-surface-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <p className="text-surface-400 text-lg font-medium">No documents uploaded yet.</p>
          <p className="text-surface-500 text-sm mt-2">
            Upload drawings, specs, and certificates to build your document library.
          </p>
          <button onClick={() => setShowUpload(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              onDelete={(id, path) => deleteMutation.mutate({ id, storage_path: path })}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-surface-800">
              <h2 className="text-lg font-semibold text-surface-50">Upload Document</h2>
              <button onClick={() => { setShowUpload(false); setSelectedFile(null) }} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700 hover:border-surface-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.txt,.csv,.zip"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                />
                {selectedFile ? (
                  <div>
                    <p className="font-medium text-surface-100">{selectedFile.name}</p>
                    <p className="text-sm text-surface-400 mt-1">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-surface-500 mx-auto mb-2" />
                    <p className="text-surface-300 font-medium">Drag & drop or click to select</p>
                    <p className="text-surface-500 text-xs mt-1">Max 50MB · PDF, Excel, Word, Images, ZIP</p>
                  </>
                )}
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Title <span className="text-red-400">*</span></label>
                  <input className="input w-full" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Document Number</label>
                  <input className="input w-full" placeholder="DWG-P-001" value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Document Type <span className="text-red-400">*</span></label>
                  <select className="input w-full" required value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value as DocType }))}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Revision</label>
                  <input className="input w-full" placeholder="A" value={form.revision} onChange={e => setForm(f => ({ ...f, revision: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DocStatus }))}>
                    {DOC_STATUSES.map(s => <option key={s} value={s}>{DOC_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Project (optional)</label>
                  <select className="input w-full" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Org-wide document</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Discipline</label>
                  <select className="input w-full" value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))}>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input w-full" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Tags</label>
                  <input className="input w-full" placeholder="welding, piping, unit-3" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowUpload(false); setSelectedFile(null) }} className="btn-ghost">Cancel</button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
                </button>
              </div>

              {uploadMutation.isError && (
                <p className="field-error">Upload failed: {(uploadMutation.error as Error).message}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
