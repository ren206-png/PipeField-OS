'use client'
// ============================================================
// Intelligence Center — Knowledge Library (Sources List)
// ============================================================
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, Filter, Upload, FileText, Download,
  Archive, Trash2, MoreVertical, Brain, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useKnowledgeSources, useKnowledgeCategories, useUpdateKnowledgeSource, useDeleteKnowledgeSource } from '@/hooks/useKnowledge'
import type { KnowledgeSource } from '@/hooks/useKnowledge'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

const DOC_TYPE_LABELS: Record<string, string> = {
  procedure:        'Procedure',
  report:           'Report',
  specification:    'Specification',
  drawing:          'Drawing',
  lessons_learned:  'Lessons Learned',
  method_statement: 'Method Statement',
  safety:           'Safety',
  training:         'Training',
  client_spec:      'Client Spec',
  other:            'Document',
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgeSourcesPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { profile }  = useAuth()

  const [q,            setQ]            = useState(searchParams.get('q') ?? '')
  const [categoryId,   setCategoryId]   = useState(searchParams.get('category_id') ?? '')
  const [docType,      setDocType]      = useState(searchParams.get('document_type') ?? '')
  const [status,       setStatus]       = useState(searchParams.get('status') ?? '')
  const [openMenu,     setOpenMenu]     = useState<string | null>(null)

  const { data, isLoading, isError } = useKnowledgeSources({
    q:             q     || undefined,
    category_id:   categoryId || undefined,
    document_type: docType    || undefined,
    status:        status     || undefined,
    limit:         100,
  })

  const { data: categories = [] } = useKnowledgeCategories()
  const { mutateAsync: update }   = useUpdateKnowledgeSource()
  const { mutateAsync: remove }   = useDeleteKnowledgeSource()

  const sources = data?.sources ?? []
  const total   = data?.total   ?? 0

  const isAdmin = profile?.role && [
    'platform_admin', 'organization_owner', 'administrator',
  ].includes(profile.role)

  const canUpload = profile?.role && [
    'platform_admin', 'organization_owner', 'administrator',
    'project_manager', 'foreman', 'qa_inspector', 'shop_fabricator',
  ].includes(profile.role)

  async function handleArchive(source: KnowledgeSource) {
    try {
      await update({ id: source.id, status: 'archived' })
      toast.success('Document archived')
    } catch {
      toast.error('Failed to archive')
    }
    setOpenMenu(null)
  }

  async function handleDelete(source: KnowledgeSource) {
    if (!confirm(`Permanently delete "${source.title}"? This cannot be undone.`)) return
    try {
      await remove(source.id)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setOpenMenu(null)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/intelligence" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Knowledge Library</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              {total} document{total !== 1 ? 's' : ''} in your company knowledge base
            </p>
          </div>
        </div>
        {canUpload && (
          <Link href="/intelligence/upload" className="btn-primary text-sm px-4 py-2 self-start sm:self-auto">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input pl-9"
            placeholder="Search documents…"
          />
        </div>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="input sm:w-52"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="input sm:w-48"
        >
          <option value="">All types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="input sm:w-40"
        >
          <option value="">Active</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      {/* Source list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-surface-700 rounded w-1/3 mb-2" />
              <div className="h-3 bg-surface-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <Brain className="w-10 h-10 text-surface-700 mx-auto mb-3" />
          <p className="text-sm text-surface-500 font-medium">Could not load documents</p>
          <p className="text-xs text-surface-600 mt-1">Check your connection and try refreshing the page.</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-10 h-10 text-surface-700 mx-auto mb-3" />
          <p className="text-sm text-surface-500 font-medium">No documents found</p>
          <p className="text-xs text-surface-600 mt-1">
            {q || categoryId || docType ? 'Try adjusting your filters.' : 'Upload your first knowledge document to get started.'}
          </p>
          {canUpload && !q && !categoryId && !docType && (
            <Link href="/intelligence/upload" className="btn-primary text-sm px-4 py-2 mt-4 inline-flex">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-surface-800">
            {sources.map(source => (
              <div key={source.id} className="flex items-start gap-4 p-4 hover:bg-surface-800/40 transition-colors group relative">

                {/* Category colour */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: source.knowledge_categories?.color ?? '#64748b' }}
                />

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-surface-400" />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Link
                      href={`/intelligence/sources/${source.id}`}
                      className="text-sm font-semibold text-surface-100 hover:text-white truncate"
                    >
                      {source.title}
                    </Link>
                    {source.status === 'archived' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">Archived</span>
                    )}
                    {source.status === 'superseded' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">Superseded</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-surface-500">
                    {source.knowledge_categories && (
                      <span style={{ color: source.knowledge_categories.color }}>
                        {source.knowledge_categories.name}
                      </span>
                    )}
                    <span>{DOC_TYPE_LABELS[source.document_type] ?? 'Document'}</span>
                    <span>{formatFileSize(source.file_size)}</span>
                    <span>v{source.version}</span>
                    <span>Uploaded {formatDate(source.created_at)}</span>
                  </div>
                  {source.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {source.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-surface-400">
                          {tag}
                        </span>
                      ))}
                      {source.tags.length > 5 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-surface-500">
                          +{source.tags.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Processing status */}
                  <ProcessingBadge status={source.processing_status} />

                  {/* Download */}
                  {source.public_url && (
                    <a
                      href={source.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors"
                      title="Open / Download"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Kebab menu */}
                  {(isAdmin || canUpload) && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === source.id ? null : source.id)}
                        className="p-1.5 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenu === source.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-surface-700 bg-surface-800 shadow-xl overflow-hidden">
                          <button
                            onClick={() => handleArchive(source)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-surface-300 hover:bg-surface-700 hover:text-surface-100"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(source)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProcessingBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'Pending',    cls: 'bg-surface-700 text-surface-400' },
    processing: { label: 'Processing', cls: 'bg-yellow-500/10 text-yellow-400' },
    ready:      { label: 'AI Ready',   cls: 'bg-green-500/10 text-green-400' },
    failed:     { label: 'Error',      cls: 'bg-red-500/10 text-red-400' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}
