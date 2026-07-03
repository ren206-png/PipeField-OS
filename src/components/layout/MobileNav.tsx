// ============================================================
// MobileNav — Bottom Navigation Bar (phones & tablets)
// Fixed at the bottom of the screen on small devices.
// Shows the 5 most important sections as icon buttons.
// Only visible on screens smaller than 1024px (lg breakpoint).
// ============================================================
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Flame,
  Package,
  Menu,
  LogOut,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { MobileDrawer } from './MobileDrawer'
import { useAuth } from '@/hooks/useAuth'

interface MobileNavItem {
  label: string
  href: string
  icon: React.ElementType
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: 'Dashboard', href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Welds',     href: '/welds',       icon: Flame },
  { label: 'Spools',    href: '/spools',      icon: Package },
  { label: 'Punch',     href: '/punch-list',  icon: ListChecks },
]

export function MobileNav() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Bottom navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-950 border-t border-surface-800 safe-area-inset-bottom">
        <div className="flex items-stretch">
          {MOBILE_NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1',
                  'min-h-[56px] transition-colors duration-150',
                  active
                    ? 'text-brand-400'
                    : 'text-surface-500 hover:text-surface-300 active:text-surface-200'
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]')} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-500 rounded-full" />
                )}
              </Link>
            )
          })}

          {/* More menu button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1',
              'min-h-[56px] transition-colors duration-150',
              'text-surface-500 hover:text-surface-300 active:text-surface-200'
            )}
            aria-label="Open full menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>

          {/* Sign Out — always visible in bottom bar */}
          <button
            onClick={signOut}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1',
              'min-h-[56px] transition-colors duration-150',
              'text-red-500 hover:text-red-400 active:text-red-300'
            )}
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Full-screen drawer for "More" */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
