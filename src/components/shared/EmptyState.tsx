'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ActionObj {
  label:   string
  href?:   string
  onClick?: () => void
}

interface EmptyStateProps {
  /** Pass a LucideIcon component OR an emoji string */
  icon:        LucideIcon | string
  title:       string
  description: string
  /** Pass a ReactNode, or a simple {label, href?, onClick?} object */
  action?:     React.ReactNode | ActionObj
  className?:  string
}

function isActionObj(a: unknown): a is ActionObj {
  return typeof a === 'object' && a !== null && 'label' in a
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const renderIcon = () => {
    if (typeof icon === 'string') {
      return <span className="text-3xl">{icon}</span>
    }
    const Icon = icon
    return <Icon className="w-8 h-8 text-surface-500" />
  }

  const renderAction = () => {
    if (!action) return null
    if (isActionObj(action)) {
      if (action.href) {
        return (
          <Link href={action.href} className="btn-primary">
            {action.label}
          </Link>
        )
      }
      return (
        <button onClick={action.onClick} className="btn-ghost">
          {action.label}
        </button>
      )
    }
    return <>{action}</>
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-20 text-center', className)}>
      <div className="w-16 h-16 bg-surface-700/60 rounded-2xl flex items-center justify-center mb-4">
        {renderIcon()}
      </div>
      <h3 className="text-base font-semibold text-surface-200 mb-1">{title}</h3>
      <p className="text-sm text-surface-500 max-w-xs leading-relaxed mb-6">{description}</p>
      {renderAction()}
    </div>
  )
}
