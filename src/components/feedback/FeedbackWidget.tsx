'use client'
// ============================================================
// FeedbackWidget — Floating feedback button + modal
// Renders in the bottom-right corner of every dashboard page.
// ============================================================
import { useState } from 'react'
import { MessageSquarePlus, X, Star, Loader2, CheckCircle2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'general',     label: 'General' },
  { value: 'bug',         label: 'Bug Report' },
  { value: 'feature',     label: 'Feature Request' },
  { value: 'ux',          label: 'UX / Design' },
  { value: 'performance', label: 'Performance' },
  { value: 'other',       label: 'Other' },
]

export function FeedbackWidget() {
  const [open,     setOpen]     = useState(false)
  const [rating,   setRating]   = useState(0)
  const [hover,    setHover]    = useState(0)
  const [category, setCategory] = useState('general')
  const [comment,  setComment]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  function reset() {
    setRating(0)
    setHover(0)
    setCategory('general')
    setComment('')
    setLoading(false)
    setDone(false)
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    setTimeout(reset, 300) // reset after close animation
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a star rating.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rating,
          category,
          comment:  comment.trim() || null,
          page_url: window.location.pathname,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Submission failed')
      setDone(true)
      setTimeout(handleClose, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40
                   flex items-center gap-2 px-3 py-2.5 rounded-full
                   bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold
                   shadow-lg shadow-brand-500/30 transition-all hover:scale-105 active:scale-95"
        aria-label="Give feedback"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}

      {/* Modal */}
      {open && (
        <div className="fixed bottom-32 right-4 lg:bottom-20 lg:right-6 z-50
                        w-[calc(100vw-2rem)] max-w-sm
                        bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl
                        animate-in slide-in-from-bottom-4 fade-in duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="font-bold text-surface-50 text-base">Share Your Feedback</h3>
              <p className="text-xs text-surface-500 mt-0.5">Help us improve PipeField OS</p>
            </div>
            <button
              onClick={handleClose}
              className="text-surface-500 hover:text-surface-200 transition-colors p-1 rounded-lg hover:bg-surface-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4">

            {done ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-surface-100">Thanks for the feedback!</p>
                  <p className="text-xs text-surface-500 mt-0.5">We read every submission.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Star rating */}
                <div>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                    How would you rate your experience?
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="transition-transform hover:scale-110 active:scale-95 p-0.5"
                        aria-label={`${star} star`}
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= (hover || rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-surface-600'
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 text-sm text-surface-400">
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                    Category
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          category === cat.value
                            ? 'bg-brand-500 text-white'
                            : 'bg-surface-700 text-surface-400 hover:bg-surface-600 hover:text-surface-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                    Comments <span className="font-normal normal-case">(optional)</span>
                  </p>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Tell us what you think…"
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-xl bg-surface-700 border border-surface-600
                               text-surface-100 placeholder-surface-500 text-sm
                               px-3 py-2.5 resize-none focus:outline-none
                               focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition"
                  />
                  <p className="text-right text-xs text-surface-600 mt-1">{comment.length}/1000</p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 bg-danger/10 px-3 py-2 rounded-lg">{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || rating === 0}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white
                             text-sm font-semibold transition-all flex items-center justify-center gap-2
                             disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    'Send Feedback'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
