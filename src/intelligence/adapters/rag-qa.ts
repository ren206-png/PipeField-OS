// ============================================================
// Intelligence Engine — RAG Q&A Adapter
//
// Wraps the existing /api/knowledge/ask logic.
// In Phase 1 the existing route is UNCHANGED — this adapter
// exists for future phases where the route will delegate here.
//
// Legacy code path: /api/knowledge/ask/route.ts (unchanged)
// Engine code path: registry.invoke('rag-qa', ctx, input)
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface RagQaInput {
  query:       string
  project_id?: string
}

export interface RagQaOutput {
  answer:   string
  sources:  RagQaSource[]
  query_id: string | null
}

export interface RagQaSource {
  chunk_id:      string
  source_id:     string
  title:         string
  document_type: string
  file_name:     string
  public_url:    string | null
  similarity:    number
}

interface MatchedChunk {
  chunk_id:      string
  source_id:     string
  content:       string
  chunk_index:   number
  title:         string
  document_type: string
  file_name:     string
  public_url:    string | null
  source_status: string
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
// Kept identical to ask/route.ts:19–23 to guarantee equivalence.
const SYSTEM_PROMPT = `You are PipeField Intelligence, an AI assistant for pipeline construction professionals.
Answer ONLY from the provided context documents. If the answer is not clearly stated in the context, say "I don't have sufficient information in the knowledge base to answer this confidently."
Always cite which document(s) your answer is based on by mentioning the document title.
For safety-critical work (pressure testing, lifting, confined space, energized systems), always remind the user to verify with a qualified engineer or supervisor regardless of what you state.
Never fabricate standards, specifications, or procedures. If you're uncertain, say so.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:             'rag-qa',
  status:           'ACTIVE',
  requiredTiers:    [],   // available to all plans
  dailyTokenBudget: {
    free_trial:   5_000,
    field_pro:    10_000,
    starter:      25_000,
    professional: 100_000,
    enterprise:   null,
  },
}

// ── Adapter implementation ────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: RagQaInput,
): Promise<AdapterResult<RagQaOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // 1. Embed the query — identical to route.ts:74–78
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: input.query.trim(),
  })
  const queryEmbedding = embResp.data[0].embedding

  // 2. pgvector similarity search — org-scoped (canonical pattern)
  const { data: chunks, error: rpcError } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   queryEmbedding,
    org_id:            ctx.organizationId,   // tenant isolation: always present
    match_count:       8,
    filter_project_id: input.project_id ?? null,
  })

  if (rpcError) throw new Error(`RPC error: ${rpcError.message}`)

  const matchedChunks = (chunks ?? []) as MatchedChunk[]

  // 3. Build context string — identical to route.ts:93–100
  const contextBlock = matchedChunks
    .map((c, i) =>
      `[Document ${i + 1}: "${c.title}" (${c.document_type})]\n${c.content}`
    )
    .join('\n\n---\n\n')

  const userMessage = contextBlock
    ? `Context documents:\n\n${contextBlock}\n\n---\n\nQuestion: ${input.query}`
    : `No relevant documents were found in the knowledge base for this question.\n\nQuestion: ${input.query}\n\nBecause there are no matching documents, respond only with: "I don't have specific information about that in the knowledge base. Please upload relevant documents or rephrase your question."`

  // 4. GPT-4o-mini completion — identical settings to route.ts:110–117
  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages:    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature: 0.2,
    max_tokens:  1500,
  })

  const answerText = completion.choices[0]?.message?.content ?? ''
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  // 5. Deduplicate sources — identical to route.ts:124–131
  const seenSourceIds = new Set<string>()
  const uniqueSources = matchedChunks.filter(c => {
    if (seenSourceIds.has(c.source_id)) return false
    seenSourceIds.add(c.source_id)
    return true
  })

  // 6. Log to knowledge_queries — identical to route.ts:133–143
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
      source_count:    uniqueSources.length,
    })
    .select('id')
    .maybeSingle()

  if (queryLog && matchedChunks.length > 0) {
    await admin.from('knowledge_query_sources').insert(
      matchedChunks.map(c => ({
        query_id:         queryLog.id,
        chunk_id:         c.chunk_id,
        source_id:        c.source_id,
        similarity_score: c.similarity,
      }))
    )
  }

  return {
    data: {
      answer:   answerText,
      sources:  matchedChunks.map(c => ({
        chunk_id:      c.chunk_id,
        source_id:     c.source_id,
        title:         c.title,
        document_type: c.document_type,
        file_name:     c.file_name,
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

export const ragQaAdapter: CapabilityAdapter<RagQaInput, RagQaOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
