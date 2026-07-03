'use client'
// ============================================================
// Intelligence Center — Source Detail Page
// ============================================================
import { use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, FileText, ExternalLink, Archive, Tag,
  Calendar, User, Layers, Shield, AlertTriangle, Brain,
} from 'lucide-react'
import { toast } from 'sonner'
import { useKnowledgeSource, useUpdateKnowledgeSource } from '@/hooks/useKnowledge'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

const DOC_TYPE_LABELS: Record<string, string> = {
  procedure:        'Procedure / Work Instruction',
  report:           'Report',
  specification:    'Specification',
  drawing:          'Drawing / Isometric / P&ID',
  lessons_learned:  'Lessons Learned',
  method_statement: 'Method Statement',
  safety:           'Safety / JSA / Risk Assessment',
  training:         'Training Material',
  client_spec:      'Client Specification / Standard',
  other:            'Document',
}

const MODULE_LABELS: Record<string, string> = {
  weld_tracking:      'Weld Tracking',
  qa_qc:             'QA/QC',
  spool_tracking:    'Spool Tracking',
  safety:            'Safety & Compliance',
  commissioning:     'Commissioning',
  project_management:'Project Management',
  training:          'Training',
  general:           'General / Company-Wide',
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: source, isLoading, error } = useKnowledgeSource(id)
  const { mutateAsync: update } = useUpdateKnowledgeSource()
  const { profile } = useAuth()

  const isAdmin = profile?.role && [
    'platform_admin', 'organization_owner', 'administrator',
  ].includes(profile.role)

  async function handleArchive() {
    if (!source) return
    try {
      await update({ id: source.id, status: 'archived' })
      toast.success('Document archived')
    } catch {
      toast.error('Failed to archive')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-surface-700 rounded w-1/3" />
        <div className="card p-6 space-y-3">
          <div className="h-6 bg-surface-700 rounded w-2/3" />
          <div className="h-4 bg-surface-700 rounded w-1/2" />
          <div className="h-4 bg-surface-700 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (error || !source) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-surface-400">Document not found.</p>
        <Link href="/intelligence/sources" className="text-brand-400 text-sm mt-3 inline-block">
          ← Back to library
        </Link>
      </div>
    )
  }

  const isSuperseded = source.status === 'superseded'
  const isArchived   = source.status === 'archived'

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/intelligence/sources" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-surface-50 truncate">{source.title}</h1>
          <p className="text-xs text-surface-500 mt-0.5">
            {source.knowledge_categories?.name ?? 'Uncategorised'} ·{' '}
            {DOC_TYPE_LABELS[source.document_type] ?? 'Document'}
          </p>
        </div>
        {source.public_url && (
          <a
            href={source.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2 shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            Open File
          </a>
        )}
      </div>

      {/* Superseded / Archived warnings */}
      {isSuperseded && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-300">This document has been superseded</p>
            <p className="text-surface-400 text-xs mt-0.5">
              A newer version exists. Verify you are using the current document before acting on this content.
            </p>
          </div>
        </div>
      )}
      {isArchived && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-surface-600 bg-surface-800/50">
          <Archive className="w-5 h-5 text-surface-400 shrink-0 mt-0.5" />
          <p className="text-sm text-surface-400">This document has been archived and is no longer active.</p>
        </div>
      )}

      {/* Main card */}
      <div className="card p-6 space-y-6">

        {/* Description */}
        {source.description && (
          <div>
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Description</h2>
            <p className="text-sm text-surface-200 leading-relaxed whitespace-pre-wrap">{source.description}</p>
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetaField icon={FileText}  label="File"      value={`${source.file_name} (${formatFileSize(source.file_size)})`} />
          <MetaField icon={Layers}    label="Version"   value={`v${source.version}`} />
          <MetaField icon={Calendar}  label="Uploaded"  value={formatDate(source.created_at)} />
          {source.related_module && (
            <MetaField icon={Brain}   label="Module"    value={MODULE_LABELS[source.related_module] ?? source.related_module} />
          )}
          {source.projects && (
            <MetaField icon={Layers}  label="Project"   value={source.projects.name} />
          )}
          <MetaField icon={Shield}    label="Visibility" value={
            source.visibility === 'org'        ? 'All org members' :
            source.visibility === 'project'    ? 'Project members' :
            'Restricted'
          } />
        </div>

        {/* Tags */}
        {source.tags.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {source.tags.map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-surface-700 text-surface-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI processing status */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-800">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-surface-500" />
            <span className="text-xs text-surface-500">AI Processing</span>
          </div>
          <AIStatusBadge status={source.processing_status} chunkCount={source.chunk_count} />
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && source.status === 'active' && (
        <div className="flex gap-3">
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-surface-700 text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
          >
            <Archive className="w-4 h-4" />
            Archive Document
          </button>
        </div>
      )}

      {/* Safety disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
        <Shield className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-surface-400 leading-relaxed">
          <span className="font-semibold text-warning">Reference only.</span>{' '}
          Always verify with a qualified engineer or supervisor before performing any safety-critical work
          including pressure testing, lifting, confined space entry, or energized systems — regardless of
          what this document states.
        </p>
      </div>
    </div>
  )
}

function MetaField({
  icon: Icon, label, value,
}: {
  icon: React.ElementType; label: string; value: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-surface-500 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm text-surface-200 truncate">{value}</p>
    </div>
  )
}

function AIStatusBadge({ status, chunkCount }: { status: string; chunkCount: number }) {
  if (status === 'ready') {
    return (
      <span className="text-xs text-green-400 font-medium">
        ✓ Ready · {chunkCount} chunk{chunkCount !== 1 ? 's' : ''} indexed
      </span>
    )
  }
  if (status === 'processing') {
    return <span className="text-xs text-yellow-400 font-medium">⏳ Processing…</span>
  }
  if (status === 'failed') {
    return <span className="text-xs text-red-400 font-medium">✗ Processing failed</span>
  }
  return <span className="text-xs text-surface-500">Pending (activates in Phase 2)</span>
}
