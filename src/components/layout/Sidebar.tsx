// ============================================================
// Sidebar — Desktop Navigation
// Fixed left panel with full navigation, logo, and user info.
// Only visible on screens wider than 1024px (lg breakpoint).
// ============================================================
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Flame,
  Package,
  FileBarChart,
  Calculator,
  Wrench,
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
  Building2,
  Users,
  ShieldAlert,
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
} from 'lucide-react'
import { cn, getInitials, truncate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { USER_ROLE_LABELS, type UserRole } from '@/types'
import { hasPermission } from '@/lib/auth/permissions'
import { NotificationBell } from './NotificationBell'
import { WidgetErrorBoundary } from '@/components/shared/ErrorBoundary'
import { PlanBadge } from '@/components/billing/PlanBadge'
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
      { label: 'Projects',  href: '/projects',  icon: FolderKanban },
      { label: 'Welds',     href: '/welds',     icon: Flame },
      { label: 'Spools',    href: '/spools',    icon: Package },
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
      { label: 'Punch List',        href: '/punch-list',               icon: ListChecks },
      { label: 'Checklists',        href: '/checklists',               icon: ClipboardList },
      { label: 'Daily Reports',    href: '/daily-reports',            icon: ClipboardList },
    ],
  },
  {
    title: 'Field Tracking',
    items: [
      { label: 'Line List',    href: '/documents/line-list', icon: List },
      { label: 'MTR Register', href: '/documents/mtrs',      icon: FileSearch },
      { label: 'Flanges',        href: '/documents/flanges',   icon: CircleDot },
      { label: 'Flange Manager', href: '/flanges',             icon: Disc      },
      { label: 'WPS',          href: '/documents/wps',       icon: FileCheck2 },
      { label: 'NDE Tracker',    href: '/nde-tracker',      icon: FlaskConical },
      { label: 'NDE Engine',     href: '/nde',              icon: FlaskConical },
      { label: 'Material Trace',     href: '/material-trace',  icon: Fingerprint      },
      { label: 'Excel I/O',          href: '/excel-io',         icon: FileSpreadsheet  },
      { label: 'Turnover Packages',  href: '/turnover',         icon: Package          },
      { label: 'Offline Queue',       href: '/offline-queue',    icon: WifiOff          },
      { label: 'ISO Viewer',          href: '/iso-viewer',       icon: Map              },
    ],
  },
  {
    title: 'Commissioning',
    items: [
      { label: 'System Packages', href: '/commissioning', icon: Zap },
      { label: 'Weld Map',        href: '/weld-map',      icon: Map },
    ],
  },
  // ── Engineering Tools ──────────────────────────────────────
  // Visible only to roles with calculator:use permission.
  // client_viewer and qa_inspector are excluded (no calculator:use).
  {
    title: 'Engineering Tools',
    requirePermission: 'calculator:use',
    items: [
      { label: 'Take-Off Calculator',    href: '/calculator',      icon: Calculator },
      { label: 'Rolling Offset Calc',    href: '/calculator?tab=offset', icon: ArrowLeftRight },
      { label: 'Pipe Support Calc',      href: '/pipe-support',    icon: HardHat },
      { label: 'Pipe Support Log',       href: '/pipe-reference',  icon: BookOpen },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Intelligence Center', href: '/intelligence',                        icon: Brain         },
      { label: 'Ask AI',             href: '/intelligence/ask',                  icon: MessageCircle },
      { label: 'Field Assistant',    href: '/intelligence/field-assistant',      icon: HardHat       },
      { label: 'Welding Guidance',   href: '/intelligence/welding-guidance',     icon: Flame         },
      { label: 'Drawing Analysis',   href: '/intelligence/drawing-analysis',     icon: Layers        },
      { label: 'Upload Knowledge',   href: '/intelligence/upload',               icon: Upload        },
      { label: 'Knowledge Library',  href: '/intelligence/sources',              icon: BookOpen      },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Client Portal', href: '/client-portal', icon: Eye },
      { label: 'Reports',       href: '/reports',       icon: FileBarChart },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Welders',      href: '/welders',              icon: Users },
      { label: 'Team Members', href: '/organization/workers', icon: Users },
      { label: 'Billing',      href: '/billing',              icon: CreditCard },
      { label: 'Settings',     href: '/settings',             icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut, isPlatformAdmin, isLoading } = useAuth()
  const { organization } = useOrganization()
  const { plan } = usePlanLimits()

  // Strip query string before comparing — active state is path-only.
  // Exception: /calculator?tab=offset should be active only when the offset
  // tab is open; for the base /calculator link we match any /calculator visit.
  function isActive(href: string): boolean {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    if (path === '/documents') return pathname === '/documents'
    // Rolling offset item (/calculator?tab=offset) is never individually
    // highlighted — the take-off item covers the whole /calculator path.
    if (href.includes('?')) return false
    return pathname.startsWith(path)
  }

  // Section-level permission check.
  // While loading, hide gated sections (they'll appear once profile arrives).
  // Once loaded, check the role permission.
  function sectionVisible(section: NavSection): boolean {
    if (!section.requirePermission) return true
    if (isLoading) return false          // still fetching — hide until ready
    if (!profile?.role) return false     // not authenticated
    return hasPermission(profile.role as UserRole, section.requirePermission as Parameters<typeof hasPermission>[1])
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-surface-950 border-r border-surface-800 h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-surface-800">
        <img src="/logo.png" alt="PipeField OS" className="w-full max-w-[210px] h-auto" />
      </div>

      {/* Organization Switcher (future feature placeholder) */}
      <div className="px-3 py-3 border-b border-surface-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors group">
          <div className="w-7 h-7 bg-brand-500/20 rounded-md flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-brand-400" />
          </div>
          {isLoading ? (
            <div className="h-3 w-32 bg-surface-700 rounded animate-pulse flex-1" />
          ) : (
            <span className="flex-1 min-w-0">
              <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors truncate text-left">
                {(organization?.name ?? 'Organization').replace(/ - /g, ' ')}
              </span>
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-surface-600 flex-shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">

        <WidgetErrorBoundary label="Navigation">
        {NAV_SECTIONS.filter(sectionVisible).map(section => (
          <div key={section.title}>
            <p className={cn(
              'px-3 mb-2 text-xs font-semibold uppercase tracking-wider',
              section.title === 'Engineering Tools'
                ? 'text-brand-600'   // subtle teal accent to visually separate the group
                : 'text-surface-600'
            )}>
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        active ? 'nav-item-active' : 'nav-item',
                        'w-full'
                      )}
                    >
                      <Icon className={cn(
                        'w-4 h-4 flex-shrink-0',
                        active ? 'text-brand-400' : 'text-surface-500'
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-bold bg-brand-500 text-white rounded-full leading-none">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        </WidgetErrorBoundary>
      </nav>

      {/* Usage meter */}
      <div className="px-3 pb-3">
        <WidgetErrorBoundary label="Usage">
          <UsageBar />
        </WidgetErrorBoundary>
      </div>

      {/* Bottom: Notifications + User */}
      <div className="border-t border-surface-800 p-3 space-y-1">
        {/* Platform Admin link — only visible to platform_admin */}
        {isPlatformAdmin && (
          <Link
            href="/admin/overview"
            className={cn(
              isActive('/admin') ? 'nav-item-active' : 'nav-item',
              'w-full border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 group'
            )}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span className="flex-1 text-red-300 text-sm font-medium">Admin Dashboard</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wide">You</span>
          </Link>
        )}

        {/* Notifications */}
        <WidgetErrorBoundary label="Notifications">
          <NotificationBell />
        </WidgetErrorBoundary>

        {/* User profile */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            {isLoading ? (
              <div className="w-4 h-4 rounded-full bg-surface-600 animate-pulse" />
            ) : (
              <span className="text-xs font-bold text-brand-400">
                {profile ? getInitials(profile.full_name) : '?'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-surface-700 rounded animate-pulse" />
                <div className="h-2.5 w-16 bg-surface-800 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-surface-200 truncate">
                  {profile?.full_name ?? 'User'}
                </p>
                <p className="text-xs text-surface-500 truncate">
                  {profile ? USER_ROLE_LABELS[profile.role] : ''}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Sign Out — server-side route clears cookies reliably */}
        <a
          href="/api/auth/signout"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/20 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </a>
      </div>
    </aside>
  )
}
