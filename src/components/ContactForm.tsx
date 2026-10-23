'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    const form = e.currentTarget
    const data = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Something went wrong')
      }
      setStatus('success')
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-surface-300 mb-1.5">
          Full Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="John Smith"
          className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 text-surface-50 placeholder-surface-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-surface-300 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="john@company.com"
          className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 text-surface-50 placeholder-surface-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-surface-300 mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Tell us what you need..."
          className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 text-surface-50 placeholder-surface-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors resize-none"
        />
      </div>

      {status === 'success' && (
        <p className="text-sm text-success font-medium">
          Message sent! We&apos;ll get back to you shortly.
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-400 font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-brand-500 px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" />
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
