'use client'
// ============================================================
// /intelligence/field-assistant — Pipefitter AI Assistant
//
// Field-worker optimised AI chat powered by the pipefitter-
// assistant adapter. Plain language, practical answers from
// the org knowledge base.
// ============================================================
import { useState, useRef, useEffect, FormEvent } from 'react'
import { HardHat, FileText, Send, Shield, Loader2, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ── Types ─────────────────────────────────────────────────────
interface Source {
  title:         string
  document_type: string
  public_url:    string | null
  similarity:    number
}

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  Source[]
  isLoading?: boolean
}

// ── Source pill ───────────────────────────────────────────────
function SourcePill({ source }: { source: Source }) {
  const inner = (
    <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 flex items-center gap-1.5 transition-colors">
      <FileText className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[180px]">{source.title}</span>
      <span className="text-surface-500 shrink-0">{Math.round(source.similarity * 100)}%</span>
    </span>
  )
  if (source.public_url) {
    return <a href={source.public_url} target="_blank" rel="noopener noreferrer">{inner}</a>
  }
  return <span>{inner}</span>
}

// ── Message bubble ────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-xl bg-brand-500/20 border border-brand-500/30 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-surface-100 whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <HardHat className="w-4 h-4 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-surface-800 border border-surface-700 rounded-2xl rounded-tl-sm px-4 py-3">
          {msg.isLoading ? (
            <div className="flex items-center gap-2 text-surface-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Looking it up…</span>
            </div>
          ) : (
            <p className="text-sm text-surface-100 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.sources.map((s, i) => <SourcePill key={i} source={s} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function FieldAssistantPage() {
  const [messages,   setMessages  ] = useState<Message[]>([])
  const [input,      setInput     ] = useState('')
  const [isPending,  setIsPending ] = useState(false)
  const [engineOff,  setEngineOff ] = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    const query = input.trim()
    if (!query || isPending) return
    setInput('')
    setIsPending(true)

    const assistantId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user',      content: query },
      { id: assistantId,         role: 'assistant', content: '', isLoading: true },
    ])

    try {
      const res = await apiFetch('/api/ai/pipefitter-assistant', {
        method: 'POST',
        body: JSON.stringify({ query }),
      })

      if (res.status === 503) {
        setEngineOff(true)
        setMessages(prev => prev.filter(m => m.id !== assistantId))
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        const errMsg = json.error ?? 'Something went wrong. Please try again.'
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: errMsg, isLoading: false } : m
        ))
        return
      }

      const json = await res.json() as { data: { answer: string; sources: Source[] } }
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: json.data.answer, sources: json.data.sources, isLoading: false }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Could not reach AI service. Check your connection.', isLoading: false }
          : m
      ))
    } finally {
      setIsPending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk(e as unknown as FormEvent)
    }
  }

  if (engineOff) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-warning mx-auto" />
        <p className="text-surface-300 font-medium">Field Assistant is not enabled on this environment.</p>
        <p className="text-surface-500 text-sm">Contact your administrator to enable the Pipefitter Assistant feature.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-surface-800">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-50">Field Assistant</h1>
          <p className="text-xs text-surface-500">Plain-language answers from your project documents</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-5">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex items-start gap-3">
              <HardHat className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Ask anything about the job</p>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Get practical answers about procedures, materials, tolerances, and requirements —
                  in plain language, straight from your company documents.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-surface-300 leading-relaxed">
                <span className="font-semibold text-warning">Safety first:</span>{' '}
                Always verify safety-critical tasks with your supervisor or QC inspector before proceeding.
                AI answers are based on uploaded documents and may not cover every situation.
              </p>
            </div>

            {/* Quick-start prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'What is the preheat requirement for P11 chrome-moly pipe?',
                'What PPE is required for grinding operations?',
                'What is the hydrostatic test pressure for 600 class flanges?',
                'What are the fit-up tolerances for butt welds?',
              ].map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => { setInput(prompt); textareaRef.current?.focus() }}
                  className="text-left text-xs text-surface-400 hover:text-surface-200 border border-surface-700 hover:border-surface-600 rounded-lg px-3 py-2.5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleAsk} className="border-t border-surface-800 pt-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the job… (Enter to send)"
            rows={2}
            disabled={isPending}
            className="flex-1 resize-none rounded-xl border border-surface-700 bg-surface-800 px-4 py-3 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="bg-orange-500 hover:bg-orange-400 text-white px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-surface-600 mt-2">
          Answers come from your uploaded documents. Verify critical information with your supervisor.
        </p>
      </form>
    </div>
  )
}
