// ============================================================
// Intelligence Engine — Inspection Adapter
//
// Helps inspectors understand ITP requirements, interpret
// acceptance criteria, and identify applicable hold points.
// Cross-references org knowledge base for relevant codes/specs.
//
// Tiers: starter, professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface ItpItemInput {
  id?:                  string
  activity?:            string
  acceptance_criteria?: string
  reference_doc?:       string
  contractor_level?:    string   // H=hold, W=witness, R=review, I=inspect
  inspector_level?:     string
  client_level?:        string
  frequency?:           string
  status?:              string
  remarks?:             string
}

export interface InspectionInput {
  query:         string
  itp_items?:    ItpItemInput[]
  discipline?:   string         // piping, mechanical, civil, electrical
  project_id?:   string
  inspection_type?: string      // RT, UT, PT, MT, VT, PMI, pressure test, etc.
}

export interface InspectionOutput {
  guidance:          string
  hold_points:       string[]
  witness_points:    string[]
  acceptance_notes:  string[]
  code_references:   string[]
  knowledge_sources: InspectionSource[]
  disclaimer:        string
}

export interface InspectionSource {
  title:         string
  document_type: string
  similarity:    number
}

interface MatchedChunk {
  chunk_id:      string
  source_id:     string
  content:       string
  title:         string
  document_type: string
  similarity:    number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Inspection Intelligence, an assistant for QC inspectors on pipeline and industrial projects.

You help inspectors:
1. Understand ITP activities and what they require
2. Identify hold points (H) — work CANNOT proceed without sign-off
3. Identify witness points (W) — inspector notified, work CAN proceed if no response within agreed time
4. Interpret acceptance criteria based on the applicable code/specification
5. Note inspection frequency, documentation requirements, and test reports needed

Rules:
- Never approve non-conforming work — always recommend raising an NCR if acceptance criteria are not met
- For pressure testing and NDE, emphasise permit requirements and competency of personnel
- Only reference information found in the provided documents
- State clearly when something is a hold point vs witness point vs review

Return JSON:
{
  guidance: string,
  hold_points: [string],
  witness_points: [string],
  acceptance_notes: [string],
  code_references: [string]
}

Respond ONLY with valid JSON — no markdown fences.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'inspection',
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
  input: InspectionInput,
): Promise<AdapterResult<InspectionOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Build search query from inspection context
  const searchTerms = [
    input.query,
    input.discipline && `${input.discipline} inspection`,
    input.inspection_type,
    ...(input.itp_items ?? []).map(i => i.reference_doc).filter(Boolean),
  ].filter(Boolean).join(' ')

  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: searchTerms,
  })

  const { data: chunks, error: rpcError } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       6,
    filter_project_id: input.project_id ?? null,
  })

  if (rpcError) throw new Error(`RPC error: ${rpcError.message}`)

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks
    .map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`)
    .join('\n\n---\n\n')

  const itpJson = input.itp_items && input.itp_items.length > 0
    ? `ITP Items:\n${JSON.stringify(input.itp_items, null, 2)}\n\n`
    : ''

  const userMessage = `
Inspection Query: ${input.query}
Discipline: ${input.discipline ?? 'Not specified'}
Inspection Type: ${input.inspection_type ?? 'Not specified'}

${itpJson}${contextBlock ? `Relevant Documents:\n${contextBlock}` : 'No relevant documents found in knowledge base.'}

Provide inspection guidance. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      900,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<InspectionOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { guidance: raw } }

  return {
    data: {
      guidance:          parsed.guidance          ?? 'Unable to generate inspection guidance.',
      hold_points:       parsed.hold_points        ?? [],
      witness_points:    parsed.witness_points     ?? [],
      acceptance_notes:  parsed.acceptance_notes   ?? [],
      code_references:   parsed.code_references    ?? [],
      knowledge_sources: matchedChunks.map(c => ({
        title:         c.title,
        document_type: c.document_type,
        similarity:    c.similarity,
      })),
      disclaimer: 'AI inspection guidance must be reviewed by a qualified QC Inspector or Third Party Inspector. Do not use as a substitute for official inspection records or sign-offs.',
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const inspectionAdapter: CapabilityAdapter<InspectionInput, InspectionOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
