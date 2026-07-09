// ============================================================
// MobileDrawer — Full-screen slide-up drawer for mobile "More"
// Contains the complete navigation for small screens.
// ============================================================
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  X,
  LayoutDashboard,
  FolderKanban,
  Flame,
  Package,
  FileBarChart,
  Calculator,
  Wrench,
  Settings,
  LogOut,
  Users,
  ShieldAlert,
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
} from 'lucide-react'
import { cn, getInitials, truncate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { USER_ROLE_LABELS, type UserRole } from '@/types'
import { hasPermission } from '@/lib/auth/permissions'
import { NotificationBell } from './NotificationBell'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

interface DrawerNavGroup {
  title: string
  requirePermission?: string
  items: { label: string; href: string; icon: React.ElementType }[]
}

const NAV_GROUPS: DrawerNavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard',      href: '/dashboard',   icon: LayoutDashboard },
      { label: 'Projects',       href: '/projects',    icon: FolderKanban },
      { label: 'Welds',          href: '/welds',       icon: Flame },
      { label: 'Spools',         href: '/spools',      icon: Package },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Documents',      href: '/documents',                  icon: FolderOpen },
      { label: 'ITPs',           href: '/documents/itps',             icon: ClipboardCheck },
      { label: 'RFIs',           href: '/documents/rfis',             icon: MessageSquareMore },
      { label: 'NCRs',           href: '/documents/ncrs',             icon: AlertOctagon },
      { label: 'Pressure Tests', href: '/documents/pressure-tests',   icon: Gauge },
      { label: 'Punch List',     href: '/punch-list',                 icon: ListChecks },
      { label: 'Daily Reports',  href: '/daily-reports',              icon: ClipboardList },
    ],
  },
  {
    title: 'Field Tracking',
    items: [
      { label: 'Line List',      href: '/documents/line-list',  icon: List },
      { label: 'MTR Register',   href: '/documents/mtrs',       icon: FileSearch },
      { label: 'Flanges',        href: '/documents/flanges',    icon: CircleDot },
      { label: 'WPS',            href: '/documents/wps',        icon: FileCheck2 },
      { label: 'NDE Tracker',    href: '/nde-tracker',          icon: FlaskConical },
    ],
  },
  {
    title: 'Commissioning',
    items: [
      { label: 'Commissioning',  href: '/commissioning', icon: Zap },
      { label: 'Weld Map',       href: '/weld-map',      icon: Map },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Intelligence Center', href: '/intelligence',                 icon: Brain         },
      { label: 'Ask AI',             href: '/intelligence/ask',             icon: MessageCircle },
      { label: 'Field Assistant',    href: '/intelligence/field-assistant', icon: HardHat       },
      { label: 'Upload Knowledge',   href: '/intelligence/upload',          icon: Upload        },
      { label: 'Knowledge Library',  href: '/intelligence/sources',         icon: BookOpen      },
    ],
  },
  {
    title: 'Engineering Tools',
    requirePermission: 'calculator:use',
    items: [
      { label: 'Take-Off Calculator',  href: '/calculator',              icon: Calculator },
      { label: 'Rolling Offset Calc',  href: '/calculator?tab=offset',   icon: ArrowLeftRight },
      { label: 'Pipe Support Calc',    href: '/pipe-support',            icon: HardHat },
      { label: 'Piping Reference DB',  href: '/pipe-reference',          icon: BookOpen },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Client Portal',  href: '/client-portal', icon: Eye },
      { label: 'Reports',        href: '/reports',       icon: FileBarChart },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Welders',        href: '/welders',              icon: Users },
      { label: 'Team Members',   href: '/organization/workers', icon: Users },
      { label: 'Settings',       href: '/settings',             icon: Settings },
    ],
  },
]

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname()
  const { profile, signOut, isPlatformAdmin } = useAuth()
  const { organization } = useOrganization()

  // Close drawer on route change
  useEffect(() => {
    onClose()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function isActive(href: string): boolean {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    if (href.includes('?')) return false   // query-string items never individually active
    return pathname.startsWith(path)
  }

  function groupVisible(group: DrawerNavGroup): boolean {
    if (!group.requirePermission) return true
    if (!profile?.role) return false
    return hasPermission(
      profile.role as UserRole,
      group.requirePermission as Parameters<typeof hasPermission>[1],
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-surface-900 border-t border-surface-700 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-in pb-safe">
        {/* Handle */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-glow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-surface-50">PipeField OS</p>
              {organization && (
                <p className="text-xs text-surface-500">{truncate(organization.name, 28)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-100 rounded-lg hover:bg-surface-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items — grouped to mirror the desktop sidebar */}
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

          {/* Platform Admin — only visible to platform_admin role */}
          {isPlatformAdmin && (
            <Link
              href="/admin/overview"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
            >
              <ShieldAlert className="w-4 h-4" />
              Admin Dashboard
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wide">You</span>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
