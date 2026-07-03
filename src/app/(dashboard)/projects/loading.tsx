import { SkeletonProjectCard } from '@/components/shared/Skeleton'
export default function ProjectsLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-700/50" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-surface-700/50" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonProjectCard key={i} />)}
      </div>
    </div>
  )
}
