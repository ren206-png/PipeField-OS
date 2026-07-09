// ============================================================
// Intelligence Engine — Document Embedding Adapter
//
// Wraps the existing /api/knowledge/process/[id] logic.
// In Phase 1 the existing route is UNCHANGED — this adapter
// is the canonical reference implementation for future phases.
//
// Legacy code path: /api/knowledge/process/[id]/route.ts (unchanged)
// Engine code path: registry.invoke('document-embedding', ctx, input)
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface DocumentEmbeddingInput {
  sourceId: string   // knowledge_sources.id
}

export interface DocumentEmbeddingOutput {
  sourceId:    string
  chunkCount:  number
  tokensUsed:  number
}

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'document-embedding',
  status:        'ACTIVE',
  requiredTiers: [],   // available to all plans
  dailyTokenBudget: {
    free_trial:   20_000,
    field_pro:    50_000,
    starter:      100_000,
    professional: 500_000,
    enterprise:   null,
  },
}

// ── Chunking helpers ─────────────────────────────────────────
// Identical constants to process/[id]/route.ts:55–68
const CHUNK_SIZE    = 2000
const CHUNK_OVERLAP = 200

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

// ── Adapter implementation ────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: DocumentEmbeddingInput,
): Promise<AdapterResult<DocumentEmbeddingOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // 1. Fetch source — verify it belongs to the caller's org (canonical pattern)
  const { data: source, error: srcError } = await admin
    .from('knowledge_sources')
    .select('id, organization_id, extracted_text, processing_status')
    .eq('id', input.sourceId)
    .eq('organization_id', ctx.organizationId)   // tenant isolation
    .maybeSingle()

  if (srcError || !source) {
    throw new Error(`Source ${input.sourceId} not found in org ${ctx.organizationId}`)
  }

  if (!source.extracted_text) {
    throw new Error(`Source ${input.sourceId} has no extracted text to embed`)
  }

  // 2. Mark as processing
  await admin
    .from('knowledge_sources')
    .update({ processing_status: 'processing' })
    .eq('id', input.sourceId)

  // 3. Chunk text — identical to route.ts:55–68
  const rawChunks  = chunkText(source.extracted_text as string)
  const BATCH_SIZE = 100
  let totalTokens  = 0
  let chunkIndex   = 0

  // Delete any existing chunks for this source before re-embedding
  await admin.from('knowledge_chunks').delete().eq('source_id', input.sourceId)

  // 4. Batch embed — identical to route.ts:150–157
  for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
    const batch = rawChunks.slice(i, i + BATCH_SIZE)
    const embResp = await openai.embeddings.create({
      model: MODELS.EMBEDDING,
      input: batch,
    })

    totalTokens += embResp.usage?.total_tokens ?? 0

    const rows = batch.map((content, j) => ({
      source_id:       input.sourceId,
      organization_id: ctx.organizationId,  // tenant isolation
      chunk_index:     chunkIndex + j,
      content,
      embedding:       JSON.stringify(embResp.data[j].embedding),
    }))

    await admin.from('knowledge_chunks').insert(rows)
    chunkIndex += batch.length
  }

  // 5. Mark as ready
  await admin
    .from('knowledge_sources')
    .update({ processing_status: 'ready', chunk_count: chunkIndex })
    .eq('id', input.sourceId)

  const latencyMs = Date.now() - startTime

  return {
    data:      { sourceId: input.sourceId, chunkCount: chunkIndex, tokensUsed: totalTokens },
    tokensUsed: totalTokens,
    latencyMs,
    model:      MODELS.EMBEDDING,
  }
}

export const documentEmbeddingAdapter: CapabilityAdapter<DocumentEmbeddingInput, DocumentEmbeddingOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
