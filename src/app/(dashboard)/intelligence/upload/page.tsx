'use client'
// ============================================================
// Intelligence Center — Upload Knowledge Document
// ============================================================
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useKnowledgeCategories, useUploadKnowledge } from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.svg',
]

const DOCUMENT_TYPES = [
  { value: 'procedure',        label: 'Procedure / Work Instruction' },
  { value: 'report',           label: 'Report' },
  { value: 'specification',    label: 'Specification' },
  { value: 'drawing',          label: 'Drawing / Isometric / P&ID' },
  { value: 'lessons_learned',  label: 'Lessons Learned' },
  { value: 'method_statement', label: 'Method Statement' },
  { value: 'safety',           label: 'Safety / JSA / Risk Assessment' },
  { value: 'training',         label: 'Training Material' },
  { value: 'client_spec',      label: 'Client Specification / Standard' },
  { value: 'other',            label: 'Other' },
]

const RELATED_MODULES = [
  { value: 'weld_tracking',      label: 'Weld Tracking' },
  { value: 'qa_qc',             label: 'QA/QC' },
  { value: 'spool_tracking',    label: 'Spool Tracking' },
  { value: 'safety',            label: 'Safety & Compliance' },
  { value: 'commissioning',     label: 'Commissioning' },
  { value: 'project_management',label: 'Project Management' },
  { value: 'training',          label: 'Training' },
  { value: 'general',           label: 'General / Company-Wide' },
]

const schema = z.object({
  title:           z.string().min(1, 'Title is required').max(300),
  description:     z.string().max(2000).optional(),
  document_type:   z.string().min(1, 'Document type is required'),
  related_module:  z.string().optional(),
  category_id:     z.string().optional(),
  project_id:      z.string().optional(),
  visibility:      z.enum(['org', 'project', 'restricted']),
  version:         z.string().max(20).optional(),
  tags:            z.string().optional(), // comma-separated
})

type FormValues = z.infer<typeof schema>

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadKnowledgePage() {
  const router = useRouter()
  const { data: categories = [] } = useKnowledgeCategories()
  const { data: projects = [] }   = useProjects()
  const { mutateAsync: upload, isPending } = useUploadKnowledge()

  const [file,       setFile]       = useState<File | null>(null)
  const [dragOver,   setDragOver]   = useState(false)
  const [uploaded,   setUploaded]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    defaultValues: { visibility: 'org', document_type: '' },
  })

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  async function onSubmit(values: FormValues) {
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    const tags = values.tags
      ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    try {
      await upload({
        file,
        title:           values.title,
        description:     values.description || undefined,
        document_type:   values.document_type,
        related_module:  values.related_module || undefined,
        category_id:     values.category_id   || undefined,
        project_id:      values.project_id    || undefined,
        visibility:      values.visibility,
        version:         values.version       || '1.0',
        tags,
      })
      setUploaded(true)
      toast.success('Document uploaded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  if (uploaded) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-surface-50">Document Uploaded</h2>
        <p className="text-sm text-surface-400">
          Your document has been added to the Intelligence Center and is queued for AI processing.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/intelligence/upload" onClick={() => setUploaded(false)} className="btn-secondary text-sm px-4 py-2">
            Upload Another
          </Link>
          <Link href="/intelligence/sources" className="btn-primary text-sm px-4 py-2">
            View Library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Upload Knowledge Document</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Add procedures, reports, field lessons, or any company knowledge
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── File Drop Zone ───────────────────────────────── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${dragOver
              ? 'border-brand-500 bg-brand-500/10'
              : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-surface-700 hover:border-surface-600 bg-surface-800/30'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-green-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-surface-100">{file.name}</p>
                <p className="text-xs text-surface-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null) }}
                className="ml-2 p-1 rounded hover:bg-surface-700"
              >
                <X className="w-4 h-4 text-surface-400" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-surface-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-surface-300">
                Drop a file here or <span className="text-brand-400">browse</span>
              </p>
              <p className="text-xs text-surface-600 mt-1">
                PDF, Word, Excel, PowerPoint, images · Max 50 MB
              </p>
            </>
          )}
        </div>

        {/* ── Document metadata ────────────────────────────── */}
        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-surface-200">Document Details</h2>

          {/* Title */}
          <div>
            <label className="label">Title <span className="text-red-400">*</span></label>
            <input
              {...register('title')}
              className="input"
              placeholder="e.g. B31.3 Hydrotest Procedure — Train 2"
            />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>

          {/* Document type + Related module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Document Type <span className="text-red-400">*</span></label>
              <select {...register('document_type')} className="input">
                <option value="">Select type…</option>
                {DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors.document_type && <p className="field-error">{errors.document_type.message}</p>}
            </div>
            <div>
              <label className="label">Related Module</label>
              <select {...register('related_module')} className="input">
                <option value="">None / General</option>
                {RELATED_MODULES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category + Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select {...register('category_id')} className="input">
                <option value="">Uncategorised</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Project (optional)</label>
              <select {...register('project_id')} className="input">
                <option value="">All projects / Org-wide</option>
                {(projects as Array<{ id: string; name: string; project_number?: string | null }>).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_number ? `${p.project_number} — ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input min-h-[80px] resize-y"
              placeholder="What does this document cover? When was it last used? Any key context…"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags <span className="text-surface-600 font-normal">(comma-separated)</span></label>
            <input
              {...register('tags')}
              className="input"
              placeholder="e.g. hydrotest, ASME, train-2, turnaround-2026"
            />
          </div>

          {/* Visibility + Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Visibility</label>
              <select {...register('visibility')} className="input">
                <option value="org">All organisation members</option>
                <option value="project">Project members only</option>
                <option value="restricted">Restricted (admins only)</option>
              </select>
            </div>
            <div>
              <label className="label">Version</label>
              <input
                {...register('version')}
                className="input"
                placeholder="1.0"
              />
            </div>
          </div>
        </div>

        {/* Safety notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-surface-400 leading-relaxed">
            Uploaded documents are reference material only. Ensure they are accurate and current before uploading.
            Superseded or outdated documents should be marked accordingly to prevent field teams acting on stale information.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !file}
          className="btn-primary w-full py-3 text-base"
        >
          {isPending
            ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Uploading…</>
            : <><Upload className="w-4 h-4 inline mr-2" />Upload Document</>
          }
        </button>
      </form>
    </div>
  )
}
