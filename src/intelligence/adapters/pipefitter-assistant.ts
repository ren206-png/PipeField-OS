// ============================================================
// Intelligence Engine — Pipefitter Assistant Adapter
//
// A field-worker-optimised RAG assistant. Same RAG pipeline as
// rag-qa but with a system prompt tuned for pipefitters:
// plain language, unit conversions, practical context.
//
// Tiers: starter, professional, enterprise (field_pro: 5k/day)
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface PipefitterAssistantInput {
  query:            string
  project_id?:      string
  active_spool?:    string    // spool number currently being worked
  line_number?:     string    // current line
  current_task?:    string    // description of task in progress
}

export interface PipefitterAssistantOutput {
  answer:      string
  sources:     PipefitterSource[]
  query_id:    string | null
}

export interface PipefitterSource {
  title:         string
  document_type: string
  public_url:    string | null
  similarity:    number
}

interface MatchedChunk {
  chunk_id:      string
  source_id:     string
  content:       string
  title:         string
  document_type: string
  file_name:     string
  public_url:    string | null
  source_status: string
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
// Tuned for tradespeople — practical, plain English, metric+imperial
const SYSTEM_PROMPT = `You are PipeField Assistant, an AI helper designed specifically for pipefitters and pipe welders on construction sites.

Your job is to give practical, clear answers that a tradesperson can act on immediately.

How to respond:
- Use plain, everyday language — avoid engineering jargon unless the user uses it first
- Give measurements in both metric and imperial when relevant
- Keep answers concise — field workers are busy
- Always answer from the provided documents first
- If a task is safety-critical, remind the user to check with their supervisor or QC inspector
- Never make up procedures, torque values, weld settings, or specifications

If the knowledge base doesn't have the answer, say: "I don't have that information in the documents. Check with your supervisor or the project QC team."

Always cite which document your answer came from.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'pipefitter-assistant',
  status:        'ACTIVE',
  requiredTiers: ['starter', 'professional', 'enterprise'],
  dailyTokenBudget: {
    free_trial:   0,
    field_pro:    5_000,
    starter:      25_000,
    professional: 100_000,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: PipefitterAssistantInput,
): Promise<AdapterResult<PipefitterAssistantOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Enrich query with field context
  const enrichedQuery = [
    input.query,
    input.active_spool  && `(Spool: ${input.active_spool})`,
    input.line_number   && `(Line: ${input.line_number})`,
    input.current_task  && `(Task: ${input.current_task})`,
  ].filter(Boolean).join(' ')

  // Embed
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: enrichedQuery.trim(),
  })
  const queryEmbedding = embResp.data[0].embedding

  // pgvector search — org-scoped
  const { data: chunks, error: rpcError } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   queryEmbedding,
    org_id:            ctx.organizationId,
    match_count:       6,
    filter_project_id: input.project_id ?? null,
  })

  if (rpcError) throw new Error(`RPC error: ${rpcError.message}`)

  const matchedChunks = (chunks ?? []) as MatchedChunk[]

  // Build context
  const contextBlock = matchedChunks
    .map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`)
    .join('\n\n---\n\n')

  const userMessage = contextBlock
    ? `Context from project documents:\n\n${contextBlock}\n\n---\n\nQuestion: ${input.query}`
    : `No matching documents found in the knowledge base.\n\nQuestion: ${input.query}\n\nRespond: "I don't have that information in the documents. Check with your supervisor or the project QC team."`

  // Completion
  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature: 0.2,
    max_tokens:  800,
  })

  const answerText = completion.choices[0]?.message?.content ?? ''
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  // Log to knowledge_queries (same as rag-qa for analytics consistency)
  const { data: queryLog } = await admin
    .from('knowledge_queries')
    .insert({
      organization_id: ctx.organizationId,
      asked_by:        ctx.userId,
      query_text:      input.query,
      answer_text:     answerText,
      model_used:      MODELS.COMPLETION,
      tokens_used:     tokensUsed,
      latency_ms:      latencyMs,
      source_count:    matchedChunks.length,
    })
    .select('id')
    .maybeSingle()

  return {
    data: {
      answer:   answerText,
      sources:  matchedChunks.map(c => ({
        title:         c.title,
        document_type: c.document_type,
        public_url:    c.public_url,
        similarity:    c.similarity,
      })),
      query_id: queryLog?.id ?? null,
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const pipefitterAssistantAdapter: CapabilityAdapter<PipefitterAssistantInput, PipefitterAssistantOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
