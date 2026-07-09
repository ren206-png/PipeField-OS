// ============================================================
// Intelligence Engine — QA/QC Assistance Adapter
//
// Assists QC engineers with NCR drafting, disposition
// recommendations, and ITP checklist interpretation.
// Cross-references org knowledge base for spec references.
//
// Tiers: starter, professional, enterprise
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type QaQcMode =
  | 'ncr_draft_assist'       // Help draft NCR description, root cause, corrective action
  | 'disposition_suggest'    // Suggest NCR disposition (use-as-is, repair, reject, concession)
  | 'itp_guidance'           // Explain ITP activity / acceptance criteria
  | 'general_qa'             // General QA/QC question

export interface NcrContext {
  title?:             string
  description?:       string
  discipline?:        string
  severity?:          string
  ncr_type?:          string
  location?:          string
  drawing_ref?:       string
  spec_ref?:          string
  root_cause?:        string
  weld_info?:         Record<string, unknown>
}

export interface ItpContext {
  activity?:            string
  acceptance_criteria?: string
  reference_doc?:       string
  discipline?:          string
  remarks?:             string
}

export interface QaQcAssistanceInput {
  mode:        QaQcMode
  query:       string
  ncr?:        NcrContext
  itp_item?:   ItpContext
  project_id?: string
}

export interface QaQcAssistanceOutput {
  response:          string
  suggestions:       QaQcSuggestion[]
  spec_references:   string[]
  knowledge_sources: QaQcSource[]
  disclaimer:        string
}

export interface QaQcSuggestion {
  field:   string
  value:   string
  reason:  string
}

export interface QaQcSource {
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
  file_name:     string
  public_url:    string | null
  similarity:    number
}

// ── System prompts ────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<QaQcMode, string> = {
  ncr_draft_assist: `You are a QA/QC assistant helping draft Non-Conformance Reports for pipeline construction.
Given the NCR context, suggest:
1. A clear, factual description of the non-conformance
2. The likely root cause category (workmanship/material/procedure/design/inspection)
3. An initial corrective action recommendation
4. Relevant specification/code references from the provided documents

Return JSON: { response: string, suggestions: [{field, value, reason}], spec_references: [string] }`,

  disposition_suggest: `You are a QA/QC specialist advising on NCR dispositions for pipeline construction.
Based on the NCR details and applicable codes/specs from documents, recommend:
1. The most appropriate disposition: use-as-is / repair / reject / concession / rework
2. The technical justification based on specification requirements
3. Any conditions or follow-up inspections required

Be conservative — when in doubt, recommend repair or rejection. State assumptions explicitly.
Return JSON: { response: string, suggestions: [{field, value, reason}], spec_references: [string] }`,

  itp_guidance: `You are a QA/QC specialist helping interpret Inspection and Test Plan requirements.
Explain the ITP activity in plain language, clarify the acceptance criteria, and identify the applicable code/spec.
Note any hold points or witness points that typically apply to this type of inspection.
Return JSON: { response: string, suggestions: [], spec_references: [string] }`,

  general_qa: `You are a QA/QC assistant for pipeline and industrial construction.
Answer the question using only information from the provided knowledge base documents.
If the information is not in the documents, state this clearly.
Return JSON: { response: string, suggestions: [], spec_references: [string] }`,
}

const BASE_DISCLAIMER = 'AI-generated QA/QC guidance must be reviewed and approved by a qualified QC Engineer or Inspector before being recorded in official project documentation.'

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'qa-qc-assistance',
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
  input: QaQcAssistanceInput,
): Promise<AdapterResult<QaQcAssistanceOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Build search query from all available context
  const searchTerms = [
    input.query,
    input.ncr?.spec_ref,
    input.ncr?.description,
    input.ncr?.discipline,
    input.itp_item?.activity,
    input.itp_item?.reference_doc,
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

  const systemPrompt = SYSTEM_PROMPTS[input.mode]

  const contextLines: string[] = [`Mode: ${input.mode}`, `Query: ${input.query}`]
  if (input.ncr)      contextLines.push(`NCR Context:\n${JSON.stringify(input.ncr, null, 2)}`)
  if (input.itp_item) contextLines.push(`ITP Item:\n${JSON.stringify(input.itp_item, null, 2)}`)
  if (contextBlock)   contextLines.push(`Knowledge Base Documents:\n${contextBlock}`)

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: contextLines.join('\n\n') },
    ],
    temperature:     0.15,
    max_tokens:      900,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<QaQcAssistanceOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { response: raw } }

  return {
    data: {
      response:          parsed.response        ?? 'Unable to generate QA/QC guidance.',
      suggestions:       parsed.suggestions      ?? [],
      spec_references:   parsed.spec_references  ?? [],
      knowledge_sources: matchedChunks.map(c => ({
        title:         c.title,
        document_type: c.document_type,
        similarity:    c.similarity,
      })),
      disclaimer: BASE_DISCLAIMER,
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const qaQcAssistanceAdapter: CapabilityAdapter<QaQcAssistanceInput, QaQcAssistanceOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
