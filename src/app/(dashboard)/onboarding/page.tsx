'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiFetch'
import { Flame, Building2, Users, FolderOpen, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'

const STEPS = [
  { id: 'company', title: 'Company Setup', icon: Building2, description: 'Tell us about your organization' },
  { id: 'project', title: 'First Project', icon: FolderOpen, description: 'Create your first project' },
  { id: 'team', title: 'Invite Team', icon: Users, description: 'Add your QC team members' },
  { id: 'done', title: 'All Set!', icon: CheckCircle2, description: "You're ready to go" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [companyForm, setCompanyForm] = useState({ industry: 'oil_gas', size: '1-10' })
  const [projectName, setProjectName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  const currentStep = STEPS[step]
  const progress = (step / (STEPS.length - 1)) * 100

  const handleNext = async () => {
    if (step === STEPS.length - 1) {
      router.push('/dashboard')
      return
    }

    if (step === 1 && projectName.trim()) {
      setLoading(true)
      try {
        await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName.trim(), status: 'active' }),
        })
      } catch { /* non-fatal */ }
      setLoading(false)
    }

    setStep(s => s + 1)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setLoading(true)
    try {
      await apiFetch('/api/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'member' }),
      })
      setInviteSent(true)
      setInviteEmail('')
    } catch { /* non-fatal */ }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-12">
        <Flame className="h-8 w-8 text-brand-500" />
        <span className="text-xl font-bold text-surface-50">PipeField OS</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                i < step ? 'bg-brand-500 border-brand-500' :
                i === step ? 'border-brand-500 bg-brand-500/20' :
                'border-surface-700 bg-surface-800'
              }`}>
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                ) : (
                  <s.icon className={`h-4 w-4 ${i === step ? 'text-brand-400' : 'text-surface-600'}`} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-surface-800 rounded-full">
          <div className="h-1.5 bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-surface-700 bg-surface-800 p-8">
        <h2 className="text-2xl font-bold text-surface-50 mb-1">{currentStep.title}</h2>
        <p className="text-surface-400 mb-8">{currentStep.description}</p>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Industry</label>
              <select
                value={companyForm.industry}
                onChange={e => setCompanyForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 focus:outline-none focus:border-brand-500"
              >
                <option value="oil_gas">Oil &amp; Gas</option>
                <option value="petrochemical">Petrochemical</option>
                <option value="power">Power Generation</option>
                <option value="industrial">Industrial / Manufacturing</option>
                <option value="water">Water &amp; Wastewater</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Team Size</label>
              <select
                value={companyForm.size}
                onChange={e => setCompanyForm(f => ({ ...f, size: e.target.value }))}
                className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 focus:outline-none focus:border-brand-500"
              >
                <option value="1-10">1–10 people</option>
                <option value="11-50">11–50 people</option>
                <option value="51-200">51–200 people</option>
                <option value="200+">200+ people</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Project Name</label>
            <input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Line 12A Compressor Station"
              className="w-full rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
            />
            <p className="mt-2 text-xs text-surface-500">You can add more projects anytime from your dashboard.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                type="email"
                className="flex-1 rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-surface-50 placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleInvite}
                disabled={loading || !inviteEmail}
                className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Invite
              </button>
            </div>
            {inviteSent && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Invite sent!
              </div>
            )}
            <button
              onClick={() => setStep(s => s + 1)}
              className="text-sm text-surface-500 hover:text-surface-300 transition-colors"
            >
              Skip for now →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {[
              '✅ Your organization is set up',
              '✅ Your first project is ready',
              '✅ Field calculators available immediately',
              '✅ Start logging welds right away',
            ].map(item => (
              <div key={item} className="text-sm text-surface-300">{item}</div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 rounded-xl border border-surface-700 px-4 py-3 text-sm font-medium text-surface-300 hover:bg-surface-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {step === STEPS.length - 1 ? 'Go to Dashboard' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-surface-600">Step {step + 1} of {STEPS.length}</p>
    </div>
  )
}
