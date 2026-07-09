// ============================================================
// POST /api/knowledge/ask
// Embed user query → pgvector similarity search → GPT-4o-mini RAG
// Body: { query: string; project_id?: string }
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are PipeField Intelligence, an AI assistant for pipeline construction professionals.
Answer ONLY from the provided context documents. If the answer is not clearly stated in the context, say "I don't have sufficient information in the knowledge base to answer this confidently."
Always cite which document(s) your answer is based on by mentioning the document title.
For safety-critical work (pressure testing, lifting, confined space, energized systems), always remind the user to verify with a qualified engineer or supervisor regardless of what you state.
Never fabricate standards, specifications, or procedures. If you're uncertain, say so.`

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

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Rate limit: 30 AI queries per user per hour
    if (!rateLimit({ key: `knowledge-ask:${caller.auth_user_id}`, limit: 30, windowMs: 60 * 60_000 })) {
      return NextResponse.json({ error: 'Too many queries. Please wait before asking again.' }, { status: 429 })
    }

    // Permission check — all roles with knowledge:query can ask
    const queryRoles = [
      'platform_admin', 'organization_owner', 'administrator',
      'project_manager', 'foreman', 'qa_inspector', 'shop_fabricator',
      'field_technician', 'client_viewer',
    ]
    if (!queryRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json() as { query?: string; project_id?: string }
    const query = body.query?.trim()
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const openai = getOpenAI()

    // 1. Embed the query
    const embResp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embResp.data[0].embedding

    // 2. pgvector similarity search via RPC
    const { data: chunks, error: rpcError } = await admin.rpc('match_knowledge_chunks', {
      query_embedding:   queryEmbedding,
      org_id:            caller.organization_id,
      match_count:       8,
      filter_project_id: body.project_id ?? null,
    })

    if (rpcError) {
      logger.error('knowledge.ask.rpc_error', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const matchedChunks = (chunks ?? []) as MatchedChunk[]

    // 3. Build context string
    const contextBlock = matchedChunks
      .map((c, i) =>
        `[Document ${i + 1}: "${c.title}" (${c.document_type})]\n${c.content}`
      )
      .join('\n\n---\n\n')

    // If no chunks matched, use a no-context prompt so GPT explicitly signals
    // it has no knowledge-base information rather than hallucinating an answer.
    const userMessage = contextBlock
      ? `Context documents:\n\n${contextBlock}\n\n---\n\nQuestion: ${query}`
      : `No relevant documents were found in the knowledge base for this question.\n\nQuestion: ${query}\n\nBecause there are no matching documents, respond only with: "I don't have specific information about that in the knowledge base. Please upload relevant documents or rephrase your question."`

    // 4. Call GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system',  content: SYSTEM_PROMPT },
        { role: 'user',    content: userMessage   },
      ],
      temperature: 0.2,
      max_tokens:  1500,
    })

    const answerText  = completion.choices[0]?.message?.content ?? ''
    const tokensUsed  = completion.usage?.total_tokens ?? 0
    const latencyMs   = Date.now() - startTime

    // 5. Deduplicate sources by source_id
    const seenSourceIds = new Set<string>()
    const uniqueSources = matchedChunks.filter(c => {
      if (seenSourceIds.has(c.source_id)) return false
      seenSourceIds.add(c.source_id)
      return true
    })

    // 6. Log query to knowledge_queries
    const { data: queryLog } = await admin
      .from('knowledge_queries')
      .insert({
        organization_id: caller.organization_id,
        asked_by:        caller.id,
        query_text:      query,
        answer_text:     answerText,
        model_used:      'gpt-4o-mini',
        tokens_used:     tokensUsed,
        latency_ms:      latencyMs,
        source_count:    uniqueSources.length,
      })
      .select('id')
      .maybeSingle()

    // 7. Log query sources
    if (queryLog && matchedChunks.length > 0) {
      await admin.from('knowledge_query_sources').insert(
        matchedChunks.map(c => ({
          query_id:        queryLog.id,
          chunk_id:        c.chunk_id,
          source_id:       c.source_id,
          similarity_score: c.similarity,
        }))
      )
    }

    // 8. Return answer + sources
    return NextResponse.json({
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
    })

  } catch (err) {
    logger.error('knowledge.ask.failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ask failed' },
      { status: 500 },
    )
  }
}
