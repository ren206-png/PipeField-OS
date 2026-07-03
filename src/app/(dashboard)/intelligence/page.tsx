'use client'
// ============================================================
// PipeField Intelligence Center — Hub Page
// Company-trained industrial knowledge layer
// ============================================================
import Link from 'next/link'
import { Brain, Upload, BookOpen, Search, TrendingUp, FileText, Shield, ChevronRight, MessageCircle } from 'lucide-react'
import { useKnowledgeSources, useKnowledgeCategories } from '@/hooks/useKnowledge'
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

export default function IntelligencePage() {
  const { profile } = useAuth()
  const { data: sourcesData } = useKnowledgeSources({ limit: 6 })
  const { data: categories = [] } = useKnowledgeCategories()

  const sources = sourcesData?.sources ?? []
  const total   = sourcesData?.total ?? 0

  const canUpload = profile?.role && [
    'platform_admin','organization_owner','administrator',
    'project_manager','foreman','qa_inspector','shop_fabricator',
  ].includes(profile.role)

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
            <Brain className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-50">Intelligence Center</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Your company's trained knowledge — procedures, lessons learned, field expertise
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/intelligence/sources" className="btn-secondary text-sm px-4 py-2">
            <BookOpen className="w-4 h-4 mr-2" />
            Browse Library
          </Link>
          {canUpload && (
            <Link href="/intelligence/upload" className="btn-primary text-sm px-4 py-2">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Link>
          )}
        </div>
      </div>

      {/* ── Ask AI call-to-action ───────────────────────────── */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-200">AI-powered Q&amp;A is live</p>
          <p className="text-xs text-surface-400 mt-0.5">
            Ask questions about procedures, specs, lessons learned, and field documents — get answers with source citations.
          </p>
        </div>
        <Link href="/intelligence/ask" className="btn-primary text-sm px-4 py-2 shrink-0">
          <MessageCircle className="w-4 h-4 mr-2" />
          Ask AI
        </Link>
      </div>

      {/* ── Stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}  label="Total Documents" value={total}              color="text-brand-400"   />
        <StatCard icon={BookOpen}  label="Categories"      value={categories.length}  color="text-blue-400"   />
        <StatCard icon={TrendingUp} label="Active Sources" value={sources.filter(s => s.status === 'active').length} color="text-green-400" />
        <StatCard icon={Search}    label="AI Ready"        value={sources.filter(s => s.processing_status === 'ready').length} color="text-purple-400" />
      </div>

      {/* ── Quick actions ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction
          href="/intelligence/ask"
          icon={MessageCircle}
          title="Ask AI"
          desc="Chat with your knowledge base — get answers with source citations"
          color="purple"
        />
        <QuickAction
          href="/intelligence/upload"
          icon={Upload}
          title="Upload Knowledge"
          desc="Add procedures, reports, lessons learned, drawings"
          color="brand"
          disabled={!canUpload}
        />
        <QuickAction
          href="/intelligence/sources"
          icon={BookOpen}
          title="Browse Library"
          desc="Search and filter all company knowledge documents"
          color="blue"
        />
        <QuickAction
          href="/intelligence/sources?document_type=lessons_learned"
          icon={TrendingUp}
          title="Lessons Learned"
          desc="Past mistakes, root causes, and field improvements"
          color="green"
        />
      </div>

      {/* ── Recent uploads ──────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-surface-100">Recent Documents</h2>
          <Link href="/intelligence/sources" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {sources.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 text-surface-700 mx-auto mb-3" />
            <p className="text-sm text-surface-500 font-medium">No documents yet</p>
            <p className="text-xs text-surface-600 mt-1">
              Start building your company's knowledge base by uploading procedures, reports, and field documents.
            </p>
            {canUpload && (
              <Link href="/intelligence/upload" className="btn-primary text-sm px-4 py-2 mt-4 inline-flex">
                <Upload className="w-4 h-4 mr-2" />
                Upload First Document
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {sources.map(source => (
              <Link
                key={source.id}
                href={`/intelligence/sources/${source.id}`}
                className="flex items-center gap-4 py-3 hover:bg-surface-800/40 -mx-2 px-2 rounded-lg transition-colors group"
              >
                {/* Category colour dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: source.knowledge_categories?.color ?? '#64748b' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100 truncate group-hover:text-white">
                    {source.title}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {source.knowledge_categories?.name ?? 'Uncategorised'} ·{' '}
                    {DOC_TYPE_LABELS[source.document_type] ?? 'Document'} ·{' '}
                    {formatDate(source.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-surface-600">{formatFileSize(source.file_size)}</span>
                  <StatusPill status={source.processing_status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Categories grid ─────────────────────────────────── */}
      {categories.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-100 mb-4">Knowledge Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(cat => (
              <Link
                key={cat.id}
                href={`/intelligence/sources?category_id=${cat.id}`}
                className="card p-4 hover:bg-surface-700/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-surface-100 truncate group-hover:text-white">
                    {cat.name}
                  </span>
                </div>
                {cat.description && (
                  <p className="text-xs text-surface-500 line-clamp-2 mt-1">{cat.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Safety reminder ─────────────────────────────────── */}
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="text-xs text-surface-300 leading-relaxed">
          <span className="font-semibold text-warning">Always verify with a qualified person.</span>{' '}
          Documents in this library are reference materials only. For safety-critical work — pressure testing,
          energized systems, lifting, confined space entry — always obtain sign-off from a qualified engineer
          or supervisor before proceeding, regardless of what any document states.
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="card p-4">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <div className="text-2xl font-bold text-surface-50">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
    </div>
  )
}

function QuickAction({
  href, icon: Icon, title, desc, color, disabled,
}: {
  href: string; icon: React.ElementType; title: string; desc: string;
  color: 'brand' | 'blue' | 'green' | 'purple'; disabled?: boolean
}) {
  const colorMap = {
    brand:  'bg-brand-500/10  border-brand-500/20  text-brand-400',
    blue:   'bg-blue-500/10   border-blue-500/20   text-blue-400',
    green:  'bg-green-500/10  border-green-500/20  text-green-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  }
  const base = `card p-5 flex flex-col gap-3 transition-colors ${disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-surface-700/50 cursor-pointer'}`
  return (
    <Link href={disabled ? '#' : href} className={base}>
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-surface-100">{title}</p>
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </Link>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'Pending',    cls: 'bg-surface-700 text-surface-400' },
    processing: { label: 'Processing', cls: 'bg-yellow-500/10 text-yellow-400' },
    ready:      { label: 'AI Ready',   cls: 'bg-green-500/10 text-green-400' },
    failed:     { label: 'Error',      cls: 'bg-red-500/10 text-red-400' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
