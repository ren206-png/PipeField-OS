'use client'
// ============================================================
// /intelligence/ask — AI-powered Q&A over company knowledge base
// ============================================================
import { useState, useRef, useEffect, FormEvent } from 'react'
import { Brain, FileText, Send, Shield, Loader2, MessageCircle } from 'lucide-react'
import { useAskKnowledge, type KnowledgeAnswer } from '@/hooks/useKnowledge'

// ── Types ─────────────────────────────────────────────────────

interface Message {
  id:         string
  role:       'user' | 'assistant'
  content:    string
  sources?:   KnowledgeAnswer['sources']
  isLoading?: boolean
}

// ── Source card ───────────────────────────────────────────────

function SourcePill({ source }: { source: KnowledgeAnswer['sources'][number] }) {
  const content = (
    <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 flex items-center gap-1.5 transition-colors">
      <FileText className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[180px]">{source.title}</span>
      <span className="text-surface-500 shrink-0">{Math.round(source.similarity * 100)}%</span>
    </span>
  )

  if (source.public_url) {
    return (
      <a href={source.public_url} target="_blank" rel="noopener noreferrer" key={source.chunk_id}>
        {content}
      </a>
    )
  }
  return <span key={source.chunk_id}>{content}</span>
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

  // Assistant
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <Brain className="w-4 h-4 text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-surface-800 border border-surface-700 rounded-2xl rounded-tl-sm px-4 py-3">
          {msg.isLoading ? (
            <div className="flex items-center gap-2 text-surface-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking…</span>
            </div>
          ) : (
            <p className="text-sm text-surface-100 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.sources.map(s => <SourcePill key={s.chunk_id} source={s} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput   ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { mutateAsync: askAI, isPending } = useAskKnowledge()

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    const query = input.trim()
    if (!query || isPending) return

    setInput('')

    // Add user message + placeholder assistant message
    const assistantId = crypto.randomUUID()
    const userMsg:    Message = { id: crypto.randomUUID(), role: 'user',      content: query }
    const loadingMsg: Message = { id: assistantId,         role: 'assistant', content: '', isLoading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])

    try {
      const result = await askAI({ query })
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: result.answer, sources: result.sources, isLoading: false }
          : m
        )
      )
    } catch (err) {
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: err instanceof Error ? err.message : 'Something went wrong. Please try again.', isLoading: false }
          : m
        )
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk(e as unknown as FormEvent)
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-surface-800">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
          <Brain className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-50">Ask AI</h1>
          <p className="text-xs text-surface-500">Powered by your company knowledge base</p>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto py-6 space-y-5">

        {/* Welcome + safety notice (shown when no messages) */}
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 flex items-start gap-3">
              <MessageCircle className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-brand-300">Ask anything about your documents</p>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Ask questions about procedures, specifications, lessons learned, safety documents, and more.
                  The AI will answer based only on documents your organization has uploaded.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-surface-300 leading-relaxed">
                <span className="font-semibold text-warning">Safety reminder:</span>{' '}
                AI responses are based on uploaded documents and may not be complete.
                For safety-critical work — pressure testing, lifting, confined space, energized systems —
                always verify with a qualified engineer or supervisor before proceeding.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
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
            placeholder="Ask a question about your knowledge base… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isPending}
            className="flex-1 resize-none rounded-xl border border-surface-700 bg-surface-800 px-4 py-3 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="btn-primary px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-xs text-surface-600 mt-2">
          AI answers are derived from your uploaded documents. Verify critical information with qualified personnel.
        </p>
      </form>
    </div>
  )
}
