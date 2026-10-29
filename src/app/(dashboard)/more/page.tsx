// ============================================================
// More page — mobile full-menu page (replaces overlay drawer)
// Reached from the bottom nav "More" button on mobile.
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
  Settings,
  LogOut,
  Users,
  FlaskConical,
  ListChecks,
  ClipboardList,
  MessageSquareMore,
  AlertOctagon,
  Gauge,
  FolderOpen,
  ClipboardCheck,
  List,
  FileSearch,
  CircleDot,
  Disc,
  Zap,
  Map,
  Eye,
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
  ShieldCheck,
  Link2,
  CreditCard,
  Tag,
  Smartphone,
  BookMarked,
} from 'lucide-react'
import { cn, getInitials, truncate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { USER_ROLE_LABELS, type UserRole } from '@/types'
import { hasPermission } from '@/lib/auth/permissions'
import { NotificationBell } from '@/components/layout/NotificationBell'

interface NavGroup {
  title: string
  requirePermission?: string
  items: { label: string; href: string; icon: React.ElementType }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard',      href: '/dashboard',   icon: LayoutDashboard },
      { label: 'QC Analytics',   href: '/analytics',   icon: BarChart3 },
      { label: 'Projects',       href: '/projects',    icon: FolderKanban },
      { label: 'Welds',          href: '/welds',       icon: Flame },
      { label: 'Spools',         href: '/spools',      icon: Package },
    ],
  },
  {
    title: 'QA / QC',
    items: [
      { label: 'Documents',      href: '/documents',                  icon: FolderOpen },
      { label: 'ITPs',           href: '/documents/itps',             icon: ClipboardCheck },
      { label: 'RFIs',           href: '/documents/rfis',             icon: MessageSquareMore },
      { label: 'NCRs',           href: '/documents/ncrs',             icon: AlertOctagon },
      { label: 'Pressure Tests', href: '/documents/pressure-tests',   icon: Gauge },
      { label: 'Punch List',     href: '/punch-list',                 icon: ListChecks },
      { label: 'Checklists',     href: '/checklists',                 icon: ClipboardList },
      { label: 'Daily Reports',  href: '/daily-reports',              icon: ClipboardList },
    ],
  },
  {
    title: 'Materials',
    items: [
      { label: 'Line List',      href: '/documents/line-list',  icon: List },
      { label: 'MTR Register',   href: '/documents/mtrs',       icon: FileSearch },
      { label: 'Flanges',        href: '/documents/flanges',    icon: CircleDot },
      { label: 'Flange Manager', href: '/flanges',              icon: Disc },
      { label: 'WPS',            href: '/documents/wps',        icon: FileCheck2 },
      { label: 'NDE Tracker',    href: '/nde-tracker',          icon: FlaskConical },
      { label: 'NDE Engine',     href: '/nde',                  icon: FlaskConical },
      { label: 'Material Trace',    href: '/material-trace',   icon: Fingerprint },
      { label: 'Excel I/O',         href: '/excel-io',          icon: FileSpreadsheet },
      { label: 'Turnover Packages', href: '/turnover',          icon: Package },
      { label: 'Offline Queue',     href: '/offline-queue',     icon: WifiOff },
      { label: 'ISO Viewer',        href: '/iso-viewer',        icon: Map },
    ],
  },
  {
    title: 'Field Tools',
    items: [
      { label: 'Field Home',     href: '/home',              icon: Smartphone },
      { label: 'Reference Book', href: '/book',              icon: BookMarked },
      { label: 'Flanges',        href: '/book/ref_flanges',  icon: CircleDot },
      { label: 'Stud Bolts',     href: '/book/ref_stud_bolts', icon: Disc },
      { label: 'Calculators',    href: '/calc',              icon: Calculator },
    ],
  },
  {
    title: 'Engineering Tools',
    requirePermission: 'calculator:use',
    items: [
      { label: 'Take-Off Calculator',  href: '/calculator',            icon: Calculator },
      { label: 'Rolling Offset Calc',  href: '/calculator?tab=offset', icon: ArrowLeftRight },
      { label: 'Pipe Support Calc',    href: '/pipe-support',          icon: HardHat },
      { label: 'Pipe Support Log',     href: '/pipe-reference',        icon: BookOpen },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Client Portal',  href: '/client-portal', icon: Eye },
      { label: 'Commissioning',  href: '/commissioning', icon: Zap },
      { label: 'Weld Map',       href: '/weld-map',      icon: Map },
      { label: 'Compliance',     href: '/compliance',    icon: ShieldCheck },
      { label: 'Reports',        href: '/reports',       icon: FileBarChart },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Intelligence Center', href: '/intelligence',                   icon: Brain },
      { label: 'Ask AI',              href: '/intelligence/ask',               icon: MessageCircle },
      { label: 'Field Assistant',     href: '/intelligence/field-assistant',   icon: HardHat },
      { label: 'Welding Guidance',    href: '/intelligence/welding-guidance',  icon: Flame },
      { label: 'Drawing Analysis',    href: '/intelligence/drawing-analysis',  icon: Layers },
      { label: 'Upload Knowledge',    href: '/intelligence/upload',            icon: Upload },
      { label: 'Knowledge Library',   href: '/intelligence/sources',           icon: BookOpen },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Welders',          href: '/welders',              icon: Users },
      { label: 'Team Members',     href: '/organization/workers', icon: Users },
      { label: 'Billing',          href: '/billing',              icon: CreditCard },
      { label: 'Settings',         href: '/settings',             icon: Settings },
      { label: 'ERP Integration',  href: '/settings/erp',         icon: Link2 },
      { label: 'Pricing',          href: '/settings/pricing',     icon: Tag },
    ],
  },
]

export default function MorePage() {
  const pathname = usePathname()
  const { profile, isPlatformAdmin } = useAuth()
  const { organization } = useOrganization()

  function isActive(href: string): boolean {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    if (href.includes('?')) return false
    return pathname.startsWith(path)
  }

  function groupVisible(group: NavGroup): boolean {
    if (!group.requirePermission) return true
    if (!profile?.role) return false
    return hasPermission(
      profile.role as UserRole,
      group.requirePermission as Parameters<typeof hasPermission>[1],
    )
  }

  return (
    <div className="pb-24">
      {/* Org header */}
      {organization && (
        <div className="px-4 py-3 border-b border-surface-800">
          <p className="text-xs text-surface-500">{truncate(organization.name, 40)}</p>
        </div>
      )}

      {/* Nav groups */}
      <nav className="p-4 space-y-5">
        {NAV_GROUPS.filter(groupVisible).map(group => (
          <div key={group.title}>
            <p className={cn(
              'text-[10px] font-semibold uppercase tracking-widest mb-2 px-1',
              group.title === 'Engineering Tools'
                ? 'text-brand-600'
                : 'text-surface-600'
            )}>
              {group.title}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map(item => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all',
                      active
                        ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-surface-100 border border-transparent'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-brand-400' : 'text-surface-500')} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-surface-800 p-4 space-y-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-brand-400">
              {profile ? getInitials(profile.full_name) : '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-100 truncate">
              {profile?.full_name ?? 'User'}
            </p>
            <p className="text-xs text-surface-500">
              {profile ? USER_ROLE_LABELS[profile.role] : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-800 border border-surface-700 overflow-hidden">
            <NotificationBell />
          </div>
          <a
            href="/api/auth/signout"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-danger/10 text-red-400 text-sm font-medium hover:bg-danger/20 transition-colors border border-danger/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </a>
        </div>

        {isPlatformAdmin && (
          <Link
            href="/admin/overview"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
          >
            Platform Admin
          </Link>
        )}
      </div>
    </div>
  )
}
