'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  steps: {
    createProject:    boolean
    addWelder:        boolean
    logFirstWeld:     boolean
    inviteTeamMember: boolean
  }
}

const STEPS = [
  { key: 'createProject',    label: 'Create your first project',  href: '/projects/new'  },
  { key: 'addWelder',        label: 'Add a welder',               href: '/welders'        },
  { key: 'logFirstWeld',     label: 'Log your first weld',        href: '/welds/new'      },
  { key: 'inviteTeamMember', label: 'Invite a team member',       href: '/organization'   },
] as const

export function OnboardingBanner({ steps }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    if (localStorage.getItem('onboarding_dismissed') === '1') setDismissed(true)
  }, [])

  if (!mounted || dismissed) return null

  const completedCount = STEPS.filter(s => steps[s.key]).length
  const pct = Math.round((completedCount / STEPS.length) * 100)

  function dismiss() {
    localStorage.setItem('onboarding_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className={cn('card border-l-4 border-brand-500 p-5 mb-2')}>
      {/* header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-brand-400" />
          <span className="font-semibold text-surface-100 text-sm">Getting Started with PipeField OS</span>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-surface-500 hover:text-surface-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-surface-400 mb-4">Complete these steps to get your team up and running</p>
      {/* steps */}
      <div className="space-y-2 mb-4">
        {STEPS.map(step => {
          const done = steps[step.key]
          return (
            <div key={step.key} className="flex items-center gap-3">
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-surface-600 flex-shrink-0" />
              }
              {done
                ? <span className="text-sm text-surface-500 line-through">{step.label}</span>
                : <Link href={step.href} className="text-sm text-surface-200 hover:text-brand-400 transition-colors">{step.label} →</Link>
              }
            </div>
          )
        })}
      </div>
      {/* progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-surface-500">
          <span>{completedCount} of {STEPS.length} complete</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
