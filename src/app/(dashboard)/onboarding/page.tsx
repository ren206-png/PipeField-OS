'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiFetch'
import {
  Flame,
  ArrowRight,
  CheckCircle2,
  Users,
  Zap,
  FileSearch,
  BarChart3,
  Wrench,
  ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
type Step = 0 | 1 | 2 | 3

// ── Step indicators ───────────────────────────────────────────
const STEP_LABELS = ['Welcome', 'First Project', 'Invite Team', "You're Ready"]

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i === step ? '' : ''}`}>
            <div
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i < step
                  ? 'bg-brand-500'
                  : i === step
                  ? 'bg-brand-500 w-4'
                  : 'bg-surface-700'
              }`}
            />
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className="h-px w-8 bg-surface-700" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 0: Welcome ───────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
          <Flame className="h-8 w-8 text-brand-500" />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-surface-50 mb-3">
        Welcome to PipeField OS
      </h1>
      <p className="text-surface-400 text-base mb-2">
        The field intelligence platform for piping contractors
      </p>
      <p className="text-surface-500 text-sm mb-10">
        Let&apos;s get you set up in 2 minutes
      </p>

      <div className="grid grid-cols-1 gap-3 mb-10 text-left">
        {[
          { icon: Wrench,      label: 'Weld tracking & QC management' },
          { icon: FileSearch,  label: 'AI-powered drawing analysis' },
          { icon: BarChart3,   label: 'Field intelligence & reporting' },
          { icon: Users,       label: 'Team collaboration & invites' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-surface-700 bg-surface-800/40 px-4 py-3">
            <Icon className="h-4 w-4 text-brand-400 shrink-0" />
            <span className="text-sm text-surface-300">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-base font-semibold text-white hover:bg-brand-600 transition-colors"
      >
        Get started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Step 1: Create first project ──────────────────────────────
function StepProject({ onNext }: { onNext: () => void }) {
  const [name, setName]         = useState('')
  const [client, setClient]     = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        name.trim(),
          client_name: client.trim() || undefined,
          location:    location.trim() || undefined,
          start_date:  startDate || undefined,
          status:      'active',
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? 'Failed to create project. Please try again.')
        setLoading(false)
        return
      }
      onNext()
    } catch {
      setError('Could not connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-surface-50 mb-1">Create your first project</h2>
      <p className="text-surface-400 text-sm mb-8">Projects are the foundation of PipeField OS — welds, reports, and drawings all live inside a project.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Project name <span className="text-brand-400">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Line 12A Compressor Station"
            required
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Client name <span className="text-surface-600">(optional)</span></label>
          <input
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="e.g. Acme Petrochemical"
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Location <span className="text-surface-600">(optional)</span></label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Baytown, TX"
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Start date <span className="text-surface-600">(optional)</span></label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors mt-2"
        >
          {loading ? 'Creating…' : 'Create project & continue'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </div>
  )
}

// ── Step 2: Invite team ───────────────────────────────────────
function StepInvite({ onNext }: { onNext: () => void }) {
  const [email, setEmail]       = useState('')
  const [role, setRole]         = useState('pipefitter')
  const [loading, setLoading]   = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/organization/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), role }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? 'Failed to send invite.')
        setLoading(false)
        return
      }
      setInviteSent(true)
      setEmail('')
    } catch {
      setError('Could not connect. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-surface-50 mb-1">Invite your team</h2>
      <p className="text-surface-400 text-sm mb-8">Add your QC inspectors, foremen, and project managers. They&apos;ll get an email invite to join your organization.</p>

      <form onSubmit={handleInvite} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 focus:outline-none focus:border-brand-500 transition-colors"
          >
            <option value="project_manager">Project Manager</option>
            <option value="foreman">Foreman</option>
            <option value="qa_inspector">QA Inspector</option>
            <option value="pipefitter">Pipefitter</option>
            <option value="shop_fabricator">Shop Fabricator</option>
            <option value="client_viewer">Client Viewer</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
            {error}
          </p>
        )}

        {inviteSent && (
          <div className="flex items-center gap-2 text-sm text-green-400 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Invite sent! Add another or continue.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-surface-700 py-3 text-sm font-medium text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
      >
        Skip for now
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Step 3: You're ready ──────────────────────────────────────
function StepReady() {
  const router  = useRouter()
  const [going, setGoing] = useState(false)

  async function handleDone() {
    setGoing(true)
    try {
      await apiFetch('/api/onboarding/complete', { method: 'POST' })
    } catch { /* non-fatal */ }
    router.push('/dashboard')
  }

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-surface-50 mb-2">You&apos;re all set!</h2>
      <p className="text-surface-400 text-sm mb-8">Here&apos;s what&apos;s available in PipeField OS:</p>

      <div className="grid grid-cols-1 gap-3 mb-10 text-left">
        {[
          { icon: Zap,        label: 'Intelligence Center', desc: 'AI-powered field analytics' },
          { icon: FileSearch, label: 'Drawing Analysis',    desc: 'Upload ISO & P&ID drawings for AI review' },
          { icon: Wrench,     label: 'Weld Tracking',       desc: 'Log, inspect, and track every weld' },
          { icon: BarChart3,  label: 'Daily Reports',       desc: 'Field reports and progress tracking' },
          { icon: Users,      label: 'Team Management',     desc: 'Roles, permissions, and invites' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-surface-700 bg-surface-800/40 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-200">{label}</p>
              <p className="text-xs text-surface-500">{desc}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto shrink-0" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={() => void handleDone()}
          disabled={going}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-base font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-70"
        >
          {going ? 'Loading…' : 'Go to Dashboard'}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push('/intelligence')}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-surface-700 py-3 text-sm font-medium text-surface-300 hover:bg-surface-800 transition-colors"
        >
          Explore Intelligence Center
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>(0)
  const [checking, setChecking]   = useState(true)

  // Redirect to dashboard if user already has projects
  useEffect(() => {
    async function checkProjects() {
      try {
        const res = await apiFetch('/api/projects')
        if (res.ok) {
          const json = await res.json() as { projects?: unknown[] }
          if (Array.isArray(json.projects) && json.projects.length > 0) {
            router.replace('/dashboard')
            return
          }
        }
      } catch { /* non-fatal — just show onboarding */ }
      setChecking(false)
    }
    checkProjects()
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const next = () => setStep(s => (s < 3 ? (s + 1) as Step : s))

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <Flame className="h-7 w-7 text-brand-500" />
        <span className="text-lg font-bold text-surface-50">PipeField OS</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-surface-700 bg-surface-800 p-8">
        <StepDots step={step} />

        {step === 0 && <StepWelcome  onNext={next} />}
        {step === 1 && <StepProject  onNext={next} />}
        {step === 2 && <StepInvite   onNext={next} />}
        {step === 3 && <StepReady />}
      </div>

      <p className="mt-6 text-xs text-surface-600">Step {step + 1} of 4</p>
    </div>
  )
}
