'use client'
import Link from 'next/link'
import {
  FileText, Users, Package, ChevronRight,
  Download, Printer, BarChart2, FileDown, ClipboardList, TrendingUp,
} from 'lucide-react'

const REPORTS = [
  {
    href:        '/reports/weld-log',
    icon:        FileText,
    iconBg:      'bg-brand-500/10',
    iconColor:   'text-brand-400',
    title:       'Weld Log',
    description: 'Full list of welds with status, welder stamp, dates, and inspection results. Filter by project, status, welder, or date range.',
    tags:        ['CSV Export', 'Print to PDF', 'QC Package'],
  },
  {
    href:        '/reports/welder-performance',
    icon:        Users,
    iconBg:      'bg-purple-500/10',
    iconColor:   'text-purple-400',
    title:       'Welder Performance',
    description: 'Pass rates, weld counts, and failure analysis per welder stamp. Essential for certification tracking and QA review.',
    tags:        ['CSV Export', 'Pass Rate', 'By Stamp'],
  },
  {
    href:        '/reports/spool-status',
    icon:        Package,
    iconBg:      'bg-orange-500/10',
    iconColor:   'text-orange-400',
    title:       'Spool Status',
    description: 'Fabrication pipeline snapshot — where every spool is, what\'s released, and what\'s overdue by priority.',
    tags:        ['CSV Export', 'Priority View', 'Release Status'],
  },
  {
    href:        '/daily-reports',
    icon:        ClipboardList,
    iconBg:      'bg-blue-500/10',
    iconColor:   'text-blue-400',
    title:       'Daily Field Reports',
    description: 'Log daily site conditions, crew counts, work completed, and issues. Tracks field progress day-by-day with PDF export.',
    tags:        ['Daily Log', 'Crew Tracking', 'Site Conditions'],
  },
  {
    href:        '/reports/weld-log',
    icon:        FileDown,
    iconBg:      'bg-green-500/10',
    iconColor:   'text-green-400',
    title:       'QA Package (PDF)',
    description: 'Download a complete weld log + NDE inspection package for client submission. Select a project on the Weld Log report to generate.',
    tags:        ['PDF Export', 'NDE Results', 'Client Ready'],
  },
  {
    href:        '/reports/progress',
    icon:        TrendingUp,
    iconBg:      'bg-green-500/10',
    iconColor:   'text-green-400',
    title:       'Progress S-Curve',
    description: 'Cumulative weld and spool completion over time. Compare actual progress against planned targets by project.',
    tags:        ['Trend Chart', 'Weekly Progress', 'Client Reports'],
  },
]

export default function ReportsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Reports</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Generate, filter, and export project data
        </p>
      </div>

      {/* ── How to get PDF ── */}
      <div className="card p-4 flex items-start gap-3 border-brand-500/20 bg-brand-500/5">
        <Printer className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-surface-400">
          <span className="text-brand-300 font-semibold">To export as PDF:</span> open any report,
          press <kbd className="px-1.5 py-0.5 rounded bg-surface-700 text-surface-300 text-xs font-mono">Ctrl+P</kbd> (or <kbd className="px-1.5 py-0.5 rounded bg-surface-700 text-surface-300 text-xs font-mono">⌘+P</kbd> on Mac),
          then choose <strong className="text-surface-300">"Save as PDF"</strong>.
          All reports are print-optimised with clean layouts.
        </p>
      </div>

      {/* ── Report cards ── */}
      <div className="space-y-4">
        {REPORTS.map(report => {
          const Icon = report.icon
          return (
            <Link
              key={report.href}
              href={report.href}
              className="card p-5 flex items-start gap-4 hover:border-surface-600 hover:shadow-card-lg transition-all duration-150 group block"
            >
              <div className={`w-12 h-12 rounded-xl ${report.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-6 h-6 ${report.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-surface-100">{report.title}</h2>
                  <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
                </div>
                <p className="text-sm text-surface-500 mt-1 leading-relaxed">
                  {report.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {report.tags.map(tag => (
                    <span key={tag} className="text-xs bg-surface-700 text-surface-400 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Coming soon ── */}
      <div className="card p-5 opacity-50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-6 h-6 text-surface-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-surface-400">Daily Progress Report</h2>
            <p className="text-sm text-surface-600 mt-1">
              Welds completed per day, by crew and project. Coming in Phase 7.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
