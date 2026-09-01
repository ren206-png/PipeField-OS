// ============================================================
// Sidebar — Desktop Navigation (collapsible accordion)
// Each section is a collapsible group. The section containing
// the active route opens automatically; all others start closed.
// Open/closed state persists in localStorage across page loads.
// Only visible on screens wider than 1024px (lg breakpoint).
// ============================================================
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  Flame,
  Package,
  FileBarChart,
  Calculator,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
  MessageSquareMore,
  ListChecks,
  Gauge,
  AlertOctagon,
  List,
  FileSearch,
  CircleDot,
  Disc,
  FolderOpen,
  ClipboardCheck,
  Zap,
  Map,
  Eye,
  FlaskConical,
  ArrowLeftRight,
  BookOpen,
  HardHat,
  FileCheck2,
  Brain,
  Upload,
  MessageCircle,
  Layers,
  Fingerprint,
  FileSpreadsheet,
  WifiOff,
  BarChart3,
  Link2,
  Tag,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { USER_ROLE_LABELS, type UserRole } from '@/types'
import { hasPermission } from '@/lib/auth/permissions'
import { NotificationBell } from './NotificationBell'
import { WidgetErrorBoundary } from '@/components/shared/ErrorBoundary'
import { UsageBar } from '@/components/billing/UsageBar'
import { usePlanLimits } from '@/hooks/usePlanLimits'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

interface NavSection {
  title: string
  items: NavItem[]
  /** If set, section only renders for roles that have this permission. */
  requirePermission?: string
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard',    href: '/dashboard', icon: LayoutDashboard },
      { label: 'QC Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Projects',     href: '/projects',  icon: FolderKanban },
      { label: 'Welds',        href: '/welds',     icon: Flame },
      { label: 'Spools',       href: '/spools',    icon: Package },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Document Library', href: '/documents',                icon: FolderOpen },
      { label: 'ITPs',             href: '/documents/itps',           icon: ClipboardCheck },
      { label: 'RFIs',             href: '/documents/rfis',           icon: MessageSquareMore },
      { label: 'NCRs',             href: '/documents/ncrs',           icon: AlertOctagon },
      { label: 'Pressure Tests',   href: '/documents/pressure-tests', icon: Gauge },
      { label: 'Punch List',       href: '/punch-list',               icon: ListChecks },
      { label: 'Checklists',       href: '/checklists',               icon: ClipboardList },
      { label: 'Daily Reports',    href: '/daily-reports',            icon: ClipboardList },
    ],
  },
  {
    title: 'Field Tracking',
    items: [
      { label: 'Line List',         href: '/documents/line-list', icon: List },
      { label: 'MTR Register',      href: '/documents/mtrs',      icon: FileSearch },
      { label: 'Flanges',           href: '/documents/flanges',   icon: CircleDot },
      { label: 'Flange Manager',    href: '/flanges',             icon: Disc },
      { label: 'WPS',               href: '/documents/wps',       icon: FileCheck2 },
      { label: 'NDE Tracker',       href: '/nde-tracker',         icon: FlaskConical },
      { label: 'NDE Engine',        href: '/nde',                 icon: FlaskConical },
      { label: 'Material Trace',    href: '/material-trace',      icon: Fingerprint },
      { label: 'Excel I/O',         href: '/excel-io',            icon: FileSpreadsheet },
      { label: 'Turnover Packages', href: '/turnover',            icon: Package },
      { label: 'Offline Queue',     href: '/offline-queue',       icon: WifiOff },
      { label: 'ISO Viewer',        href: '/iso-viewer',          icon: Map },
    ],
  },
  {
    title: 'Commissioning',
    items: [
      { label: 'System Packages', href: '/commissioning', icon: Zap },
      { label: 'Weld Map',        href: '/weld-map',      icon: Map },
    ],
  },
  {
    title: 'Engineering Tools',
    requirePermission: 'calculator:use',
    items: [
      { label: 'Take-Off Calc',    href: '/calculator',            icon: Calculator },
      { label: 'Rolling Offset',   href: '/calculator?tab=offset', icon: ArrowLeftRight },
      { label: 'Pipe Support Calc',href: '/pipe-support',          icon: HardHat },
      { label: 'Pipe Support Log', href: '/pipe-reference',        icon: BookOpen },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Intelligence Center', href: '/intelligence',                      icon: Brain },
      { label: 'Ask AI',              href: '/intelligence/ask',                  icon: MessageCircle },
      { label: 'Field Assistant',     href: '/intelligence/field-assistant',      icon: HardHat },
      { label: 'Welding Guidance',    href: '/intelligence/welding-guidance',     icon: Flame },
      { label: 'Drawing Analysis',    href: '/intelligence/drawing-analysis',     icon: Layers },
      { label: 'Upload Knowledge',    href: '/intelligence/upload',               icon: Upload },
      { label: 'Knowledge Library',   href: '/intelligence/sources',              icon: BookOpen },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Client Portal', href: '/client-portal', icon: Eye },
      { label: 'Compliance',    href: '/compliance',    icon: ShieldCheck },
      { label: 'Reports',       href: '/reports',       icon: FileBarChart },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Welders',         href: '/welders',              icon: Users },
      { label: 'Team Members',    href: '/organization/workers', icon: Users },
      { label: 'Billing',         href: '/billing',              icon: CreditCard },
      { label: 'Settings',        href: '/settings',             icon: Settings },
      { label: 'ERP Integration', href: '/settings/erp',         icon: Link2 },
      { label: 'Pricing',         href: '/settings/pricing',     icon: Tag },
    ],
  },
]

const LS_KEY = 'sidebar-open-sections'

export function Sidebar() {
  const pathname = usePathname()
  const { profile, isPlatformAdmin, isLoading } = useAuth()
  const { organization } = useOrganization()
  const { plan } = usePlanLimits()

  function isActive(href: string): boolean {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    if (path === '/documents') return pathname === '/documents'
    if (href.includes('?')) return false
    return pathname.startsWith(path)
  }

  function sectionVisible(section: NavSection): boolean {
    if (!section.requirePermission) return true
    if (isLoading) return false
    if (!profile?.role) return false
    return hasPermission(profile.role as UserRole, section.requirePermission as Parameters<typeof hasPermission>[1])
  }

  /** True if any item in the section matches the current path */
  const sectionIsActive = useCallback((section: NavSection) =>
    section.items.some(item => isActive(item.href)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [pathname])

  // Initialise open state: active section open, rest from localStorage
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const s of NAV_SECTIONS) {
      initial[s.title] = sectionIsActive(s) // active section starts open
    }
    return initial
  })

  // Merge localStorage prefs on mount (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed: Record<string, boolean> = JSON.parse(stored)
        setOpenSections(prev => {
          const merged: Record<string, boolean> = { ...parsed }
          // Always keep the active section open regardless of stored state
          for (const s of NAV_SECTIONS) {
            if (sectionIsActive(s)) merged[s.title] = true
          }
          return merged
        })
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-open the active section whenever the route changes
  useEffect(() => {
    setOpenSections(prev => {
      const next = { ...prev }
      for (const s of NAV_SECTIONS) {
        if (sectionIsActive(s)) next[s.title] = true
      }
      return next
    })
  }, [pathname, sectionIsActive])

  function toggle(title: string) {
    setOpenSections(prev => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const visibleSections = NAV_SECTIONS.filter(sectionVisible)

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-64 bg-surface-950 border-r border-surface-800 h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-4 border-b border-surface-800">
        <img src="/logo.png" alt="PipeField OS" className="w-full max-w-[180px] h-auto" />
      </div>

      {/* Organization switcher */}
      <div className="px-3 py-2 border-b border-surface-800">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-800 transition-colors group">
          <div className="w-6 h-6 bg-brand-500/20 rounded-md flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3 h-3 text-brand-400" />
          </div>
          {isLoading ? (
            <div className="h-3 w-28 bg-surface-700 rounded animate-pulse flex-1" />
          ) : (
            <span className="flex-1 min-w-0 text-xs text-surface-300 group-hover:text-surface-100 truncate text-left">
              {(organization?.name ?? 'Organization').replace(/ - /g, ' ')}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-surface-600 flex-shrink-0" />
        </button>
      </div>

      {/* Collapsible Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <WidgetErrorBoundary label="Navigation">
          <div className="space-y-0.5">
            {visibleSections.map(section => {
              const isOpen = !!openSections[section.title]
              const hasActive = sectionIsActive(section)

              return (
                <div key={section.title}>
                  {/* Section toggle header */}
                  <button
                    onClick={() => toggle(section.title)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors select-none',
                      hasActive
                        ? 'text-brand-400 hover:bg-surface-800/60'
                        : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/40'
                    )}
                  >
                    <span className={cn(
                      'flex-1 text-[11px] font-semibold uppercase tracking-wider',
                      section.title === 'Engineering Tools' && 'text-brand-500'
                    )}>
                      {section.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 flex-shrink-0 transition-transform duration-200',
                        isOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>

                  {/* Section items */}
                  {isOpen && (
                    <ul className="mt-0.5 mb-1 space-y-0.5 pl-1">
                      {section.items.map(item => {
                        const active = isActive(item.href)
                        const Icon = item.icon
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                                active
                                  ? 'bg-brand-500/10 text-brand-300 font-medium'
                                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                              )}
                            >
                              <Icon className={cn(
                                'w-3.5 h-3.5 flex-shrink-0',
                                active ? 'text-brand-400' : 'text-surface-600'
                              )} />
                              <span className="flex-1 truncate text-xs">{item.label}</span>
                              {item.badge != null && item.badge > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-500 text-white rounded-full leading-none">
                                  {item.badge > 99 ? '99+' : item.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </WidgetErrorBoundary>
      </nav>

      {/* Usage meter */}
      <div className="px-2 pb-2">
        <WidgetErrorBoundary label="Usage">
          <UsageBar />
        </WidgetErrorBoundary>
      </div>

      {/* Bottom: Admin + Notifications + User + Sign Out */}
      <div className="border-t border-surface-800 p-2 space-y-1">
        {isPlatformAdmin && (
          <Link
            href="/admin/overview"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors border border-red-500/20 bg-red-500/5 hover:bg-red-500/10',
              isActive('/admin') ? 'text-red-300' : 'text-red-400'
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
            <span className="flex-1">Admin Dashboard</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wide">You</span>
          </Link>
        )}

        <WidgetErrorBoundary label="Notifications">
          <NotificationBell />
        </WidgetErrorBoundary>

        {/* User profile */}
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            {isLoading ? (
              <div className="w-3.5 h-3.5 rounded-full bg-surface-600 animate-pulse" />
            ) : (
              <span className="text-[10px] font-bold text-brand-400">
                {profile ? getInitials(profile.full_name) : '?'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-1">
                <div className="h-2.5 w-20 bg-surface-700 rounded animate-pulse" />
                <div className="h-2 w-14 bg-surface-800 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-surface-200 truncate">
                  {profile?.full_name ?? 'User'}
                </p>
                <p className="text-[10px] text-surface-500 truncate">
                  {profile ? USER_ROLE_LABELS[profile.role] : ''}
                </p>
              </>
            )}
          </div>
        </div>

        <a
          href="/api/auth/signout"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/20 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sign Out
        </a>
      </div>
    </aside>
  )
}
