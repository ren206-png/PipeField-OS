// ============================================================
// Intelligence Engine — Safety Analysis Adapter
//
// Performs RAG-based safety analysis against the org knowledge
// base (uploaded safety plans, risk assessments, method
// statements). Available to ALL tiers.
//
// Tiers: all (free_trial, field_pro, starter, professional, enterprise)
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface SafetyAnalysisInput {
  query:         string          // "What are the safety requirements for confined space entry?"
  project_id?:   string
  work_scope?:   string          // current work being performed
  work_area?:    string          // location / area description
  recent_incidents?: string      // from DFR.safety_incidents (optional context)
}

export interface SafetyAnalysisOutput {
  analysis:          string
  key_hazards:       string[]
  required_controls: string[]
  references:        SafetyReference[]
  advisory:          string    // always present safety reminder
}

export interface SafetyReference {
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
  title:         string
  document_type: string
  file_name:     string
  public_url:    string | null
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Safety Intelligence, a safety analysis assistant for pipeline and industrial construction.

Your role is to:
1. Identify key hazards relevant to the described work scope and query
2. Summarise the required safety controls, PPE, and procedures from the provided documents
3. Flag any high-severity risks that require immediate attention
4. Always recommend consultation with a safety officer or competent person for high-risk work

Critical rules:
- Only reference information found in the provided context documents
- Never downplay or omit hazards — err on the side of caution
- If documents don't cover the topic, state this clearly
- For confined spaces, lifting, pressure systems, or energized equipment — ALWAYS note these require a permit-to-work and qualified supervision
- Return JSON with keys: analysis (string), key_hazards (string array), required_controls (string array), advisory (string)

Respond ONLY with valid JSON — no markdown fences, no extra text.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'safety-analysis',
  status:        'ACTIVE',
  requiredTiers: [],    // all tiers
  dailyTokenBudget: {
    free_trial:   2_000,
    field_pro:    5_000,
    starter:      25_000,
    professional: 100_000,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: SafetyAnalysisInput,
): Promise<AdapterResult<SafetyAnalysisOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Build enriched search query
  const searchTerms = [input.query, input.work_scope, input.work_area].filter(Boolean).join(' ')

  // Embed and search
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchTerms,
  })
  const queryEmbedding = embResp.data[0].embedding

  const { data: chunks, error: rpcError } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   queryEmbedding,
    org_id:            ctx.organizationId,
    match_count:       8,
    filter_project_id: input.project_id ?? null,
  })

  if (rpcError) throw new Error(`RPC error: ${rpcError.message}`)

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks
    .map((c, i) => `[Doc ${i + 1}: "${c.title}" (${c.document_type})]\n${c.content}`)
    .join('\n\n---\n\n')

  const userMessage = `
Safety Query: ${input.query}

Work Scope: ${input.work_scope ?? 'Not specified'}
Work Area: ${input.work_area ?? 'Not specified'}
Recent Incidents/Issues: ${input.recent_incidents ?? 'None reported'}

${contextBlock ? `Safety Documents from Knowledge Base:\n\n${contextBlock}` : 'No safety documents found in knowledge base for this query.'}

Analyse the safety requirements for this work. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      1000,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<SafetyAnalysisOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { analysis: raw } }

  const ADVISORY = 'This analysis is AI-generated from uploaded documents. Always verify safety requirements with a qualified safety officer or competent person before commencing work. Permit-to-work requirements must be confirmed with site management.'

  return {
    data: {
      analysis:          parsed.analysis          ?? 'Unable to generate safety analysis.',
      key_hazards:       parsed.key_hazards        ?? [],
      required_controls: parsed.required_controls  ?? [],
      references:        matchedChunks.map(c => ({
        title:         c.title,
        document_type: c.document_type,
        file_name:     c.file_name,
        public_url:    c.public_url,
        similarity:    c.similarity,
      })),
      advisory: parsed.advisory ?? ADVISORY,
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const safetyAnalysisAdapter: CapabilityAdapter<SafetyAnalysisInput, SafetyAnalysisOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
