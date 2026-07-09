'use client'
// ============================================================
// PipeField Intelligence Center — Hub Page (Phase 2)
// Showcases all AI capabilities + knowledge base management
// ============================================================
import Link from 'next/link'
import {
  Brain, Upload, BookOpen, Search, TrendingUp, FileText, Shield,
  ChevronRight, MessageCircle, HardHat, Flame, Layers, Wrench,
  ClipboardCheck, HardDrive, Calculator, Calendar, PackageSearch, Activity,
} from 'lucide-react'
import { useKnowledgeSources, useKnowledgeCategories } from '@/hooks/useKnowledge'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { AiUsageWidget } from '@/components/ai/AiUsageWidget'

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

  const sources   = sourcesData?.sources ?? []
  const total     = sourcesData?.total ?? 0
  const aiReady   = sources.filter(s => s.processing_status === 'ready').length
  const hasDocuments = total > 0

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
              AI-powered tools trained on your company's procedures, specs, and field expertise
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

      {/* ── Onboarding banner — shown only when no docs uploaded ── */}
      {!hasDocuments && canUpload && (
        <div className="rounded-xl border-2 border-dashed border-brand-500/30 bg-brand-500/5 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-brand-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-200">
                Upload your first document to activate AI features
              </p>
              <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                The AI capabilities below draw answers from your company's uploaded procedures, WPS, safety plans, and specifications.
                Without documents, the AI has no project-specific knowledge to work from.
                Start with a WPS or safety plan to see Welding Guidance and Safety Analysis in action.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['WPS / PQR', 'Safety Plan / JSA', 'ITP', 'Method Statement', 'Lessons Learned'].map(t => (
                  <span key={t} className="text-xs bg-brand-500/10 border border-brand-500/20 text-brand-300 px-2 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
            <Link href="/intelligence/upload" className="btn-primary text-sm px-5 py-2.5 shrink-0">
              <Upload className="w-4 h-4 mr-2" />
              Upload First Document
            </Link>
          </div>
        </div>
      )}

      {/* ── Stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}   label="Total Documents" value={total}              color="text-brand-400"  />
        <StatCard icon={BookOpen}   label="Categories"      value={categories.length}  color="text-blue-400"  />
        <StatCard icon={TrendingUp} label="Active Sources"  value={sources.filter(s => s.status === 'active').length} color="text-green-400" />
        <StatCard icon={Search}     label="AI Ready"        value={aiReady}            color="text-purple-400"/>
      </div>

      {/* ── AI Capabilities grid ────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-surface-100 mb-1">AI Capabilities</h2>
        <p className="text-xs text-surface-500 mb-4">
          All capabilities draw from your uploaded knowledge base. Upload documents to improve accuracy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CapabilityCard
            href="/intelligence/ask"
            icon={MessageCircle}
            title="Ask AI"
            desc="Chat with your knowledge base — procedures, specs, and lessons learned"
            color="purple"
            badge="All plans"
          />
          <CapabilityCard
            href="/intelligence/field-assistant"
            icon={HardHat}
            title="Field Assistant"
            desc="Plain-language answers for pipefitters and field workers"
            color="orange"
            badge="All plans"
          />
          <CapabilityCard
            href="/intelligence/welding-guidance"
            icon={Flame}
            title="Welding Guidance"
            desc="WPS recommendations and certification checks for your weld parameters"
            color="red"
            badge="Starter+"
          />
          <CapabilityCard
            href="/intelligence/drawing-analysis"
            icon={Layers}
            title="Drawing Analysis"
            desc="AI vision analysis of isometrics, P&IDs, and GA drawings"
            color="teal"
            badge="Professional+"
          />
          <CapabilityCard
            href="/welds/new"
            icon={Wrench}
            title="QA/QC Assistance"
            desc="NCR drafting, ITP guidance, and disposition recommendations"
            color="blue"
            badge="Starter+"
          />
          <CapabilityCard
            href="/welds/new"
            icon={Shield}
            title="Safety Analysis"
            desc="Hazard identification and safety controls from your safety documents"
            color="yellow"
            badge="All plans"
          />
          <CapabilityCard
            href="/spools"
            icon={PackageSearch}
            title="Material Takeoff"
            desc="AI-generated BOM from spool data, aggregated by size and material"
            color="green"
            badge="Starter+"
          />
          <CapabilityCard
            href="/projects"
            icon={ClipboardCheck}
            title="Inspection Guidance"
            desc="Hold/witness points and acceptance criteria for ITP activities"
            color="indigo"
            badge="Starter+"
          />
          <CapabilityCard
            href="/projects"
            icon={HardDrive}
            title="Fabrication Planning"
            desc="Optimal spool sequence recommendations based on priority and dates"
            color="pink"
            badge="Professional+"
          />
          <CapabilityCard
            href="/projects"
            icon={Calculator}
            title="Estimating"
            desc="Effort estimates from scope data and your productivity rates"
            color="amber"
            badge="Professional+"
          />
          <CapabilityCard
            href="/projects"
            icon={Calendar}
            title="Scheduling"
            desc="Schedule health analysis and recovery action recommendations"
            color="cyan"
            badge="Professional+"
          />
          <CapabilityCard
            href="/projects"
            icon={Activity}
            title="Digital Twin"
            desc="Live project status twin — system readiness and commissioning queries"
            color="violet"
            badge="Enterprise"
          />
        </div>
      </div>

      {/* ── AI Usage ────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-surface-100 mb-4">AI Usage — Last 30 Days</h2>
        <AiUsageWidget />
      </div>

      {/* ── Knowledge base section ──────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-surface-100 mb-4">Knowledge Base</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <QuickAction
            href="/intelligence/upload"
            icon={Upload}
            title="Upload Knowledge"
            desc="Add procedures, WPS, safety plans, drawings"
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

        {/* Recent documents */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-surface-100">Recent Documents</h3>
            <Link href="/intelligence/sources" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {sources.length === 0 ? (
            <div className="text-center py-10">
              <Brain className="w-10 h-10 text-surface-700 mx-auto mb-3" />
              <p className="text-sm text-surface-500 font-medium">No documents yet</p>
              <p className="text-xs text-surface-600 mt-1 max-w-xs mx-auto">
                Upload your first document to give the AI something to work from.
              </p>
              {canUpload && (
                <Link href="/intelligence/upload" className="btn-primary text-sm px-4 py-2 mt-4 inline-flex items-center">
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

function StatCard({ icon: Icon, label, value, color }: {
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

type CapColor = 'purple'|'orange'|'red'|'teal'|'blue'|'yellow'|'green'|'indigo'|'pink'|'amber'|'cyan'|'violet'

const CAP_COLOR_MAP: Record<CapColor, string> = {
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  red:    'bg-red-500/10    border-red-500/20    text-red-400',
  teal:   'bg-teal-500/10   border-teal-500/20   text-teal-400',
  blue:   'bg-blue-500/10   border-blue-500/20   text-blue-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  green:  'bg-green-500/10  border-green-500/20  text-green-400',
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  pink:   'bg-pink-500/10   border-pink-500/20   text-pink-400',
  amber:  'bg-amber-500/10  border-amber-500/20  text-amber-400',
  cyan:   'bg-cyan-500/10   border-cyan-500/20   text-cyan-400',
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

function CapabilityCard({ href, icon: Icon, title, desc, color, badge }: {
  href: string; icon: React.ElementType; title: string; desc: string; color: CapColor; badge: string
}) {
  return (
    <Link href={href} className="card p-4 hover:bg-surface-700/50 transition-colors group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${CAP_COLOR_MAP[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs bg-surface-700 text-surface-400 px-2 py-0.5 rounded-full shrink-0">{badge}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-surface-100 group-hover:text-white">{title}</p>
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon: Icon, title, desc, color, disabled }: {
  href: string; icon: React.ElementType; title: string; desc: string;
  color: 'brand' | 'blue' | 'green'; disabled?: boolean
}) {
  const colorMap = {
    brand: 'bg-brand-500/10 border-brand-500/20 text-brand-400',
    blue:  'bg-blue-500/10  border-blue-500/20  text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
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
