'use client'
import Link from 'next/link'
import { Plus, FolderKanban, Calendar, Pencil } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  planning:    'bg-surface-700 text-surface-400',
  active:      'bg-green-500/15 text-green-400',
  on_hold:     'bg-yellow-500/15 text-yellow-400',
  completed:   'bg-blue-500/15 text-blue-400',
  cancelled:   'bg-red-500/15 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function ProjectsPage() {
  const { data: projects, isLoading, isError } = useProjects()

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Projects</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Manage your active construction projects
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* ── Content ── */}
      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="card p-6 text-center text-red-400">
          Failed to load projects. Please refresh.
        </div>
      )}

      {!isLoading && !isError && projects?.length === 0 && (
        <EmptyState
          icon="📁"
          title="No projects yet"
          description="Create your first project to start tracking welds and spools."
          action={{ label: 'Create First Project', href: '/projects/new' }}
        />
      )}

      {!isLoading && projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map(project => (
            <div
              key={project.id}
              className="card p-5 hover:border-brand-500/30 hover:shadow-card-lg transition-all duration-150 group"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <Link href={`/projects/${project.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/20 transition-colors">
                    <FolderKanban className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-surface-100 truncate group-hover:text-brand-300 transition-colors">{project.name}</h2>
                    {project.project_number && (
                      <p className="text-xs text-surface-500 font-mono">{project.project_number}</p>
                    )}
                  </div>
                </Link>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[project.status] ?? STATUS_STYLES.planning}`}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </span>
              </div>

              {project.description && (
                <p className="text-sm text-surface-500 line-clamp-2 mb-3">{project.description}</p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-4 text-xs text-surface-600 pt-3 border-t border-surface-700/60">
                {project.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(project.start_date)}
                  </span>
                )}
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-1 hover:text-brand-400 transition-colors font-medium"
                >
                  View Details
                </Link>
                <Link
                  href={`/projects/${project.id}/edit`}
                  className="flex items-center gap-1 hover:text-brand-400 transition-colors ml-auto"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
