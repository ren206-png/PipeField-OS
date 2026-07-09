// ============================================================
// Intelligence Engine — Digital Twin Adapter
//
// Operational status twin: aggregates project data across
// welds, spools, NDE, pressure tests, and commissioning to
// answer natural language questions about system readiness.
//
// This is a data-driven status twin (not a geometry twin).
// Enterprise only.
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'
import { getOpenAIClient, MODELS } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export interface TwinLineSnapshot {
  line_number?:  string
  service?:      string
  fluid_code?:   string
  pipe_class?:   string
  status?:       string
  total_spools?: number
  design_pressure?: number
  design_temp?:  number
}

export interface TwinSpoolSnapshot {
  spool_number?:  string
  status?:        string
  line_number?:   string
  area?:          string
}

export interface TwinWeldSummary {
  total:     number
  by_status: Record<string, number>
}

export interface TwinNdeSummary {
  total:  number
  pass:   number
  fail:   number
  pending?: number
}

export interface TwinPressureTestSummary {
  total:    number
  pass:     number
  fail:     number
  pending?: number
}

export interface TwinCommCertSummary {
  total:        number
  mc_complete?: number
  pending?:     number
}

export interface DigitalTwinInput {
  project_id:     string
  project_name?:  string
  twin_query:     string    // "Which lines are ready for commissioning?"
  snapshot: {
    lines?:               TwinLineSnapshot[]
    spools?:              TwinSpoolSnapshot[]
    weld_summary?:        TwinWeldSummary
    nde_summary?:         TwinNdeSummary
    pressure_test_summary?: TwinPressureTestSummary
    comm_cert_summary?:   TwinCommCertSummary
  }
}

export interface DigitalTwinOutput {
  answer:           string
  system_status:    SystemStatusItem[]
  readiness_flags:  ReadinessFlag[]
  open_items:       string[]
  knowledge_refs:   TwinKnowledgeRef[]
}

export interface SystemStatusItem {
  system:    string
  status:    'complete' | 'in_progress' | 'not_started' | 'blocked'
  detail:    string
}

export interface ReadinessFlag {
  area:     string
  ready:    boolean
  blocker?: string
}

export interface TwinKnowledgeRef {
  title:      string
  similarity: number
}

interface MatchedChunk {
  chunk_id:   string
  source_id:  string
  content:    string
  title:      string
  document_type: string
  similarity: number
}

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are PipeField Digital Twin Intelligence, an operational status analyst for pipeline construction projects.

You have access to a real-time snapshot of project data. Answer natural language questions about:
- System/line readiness for commissioning or handover
- Weld completion status by area, line, or system
- NDE and pressure test completion
- Mechanical completion certificate status
- Open items and blockers

Rules:
- Only report what the data shows — never invent status
- Use the exact status values from the data (not_started, in_progress, etc.)
- When calculating percentages, show the formula
- For "ready for commissioning" questions: all welds complete + NDE pass + pressure test pass + MC cert issued
- Note any systems with failed NDE or pressure tests as BLOCKED

Return JSON:
{
  answer: string,
  system_status: [{system, status, detail}],
  readiness_flags: [{area, ready, blocker?}],
  open_items: [string]
}

Respond ONLY with valid JSON.`

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'digital-twin',
  status:        'ACTIVE',
  requiredTiers: ['enterprise'],
  dailyTokenBudget: {
    free_trial:   0,
    field_pro:    0,
    starter:      0,
    professional: 0,
    enterprise:   null,
  },
}

// ── Adapter ───────────────────────────────────────────────────
async function invoke(
  ctx:   InvocationContext,
  input: DigitalTwinInput,
): Promise<AdapterResult<DigitalTwinOutput>> {
  const startTime = Date.now()
  const openai    = getOpenAIClient()
  const admin     = createAdminClient()

  // Search knowledge base for commissioning/handover procedures
  const embResp = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: input.twin_query,
  })

  const { data: chunks } = await admin.rpc('match_knowledge_chunks', {
    query_embedding:   embResp.data[0].embedding,
    org_id:            ctx.organizationId,
    match_count:       4,
    filter_project_id: input.project_id,
  })

  const matchedChunks = (chunks ?? []) as MatchedChunk[]
  const contextBlock  = matchedChunks.length > 0
    ? `Project Procedures/Standards:\n${matchedChunks.map((c, i) => `[Doc ${i + 1}: "${c.title}"]\n${c.content}`).join('\n---\n')}\n\n`
    : ''

  // Truncate lines/spools for token management
  const snapshot = {
    ...input.snapshot,
    lines:  (input.snapshot.lines  ?? []).slice(0, 20),
    spools: (input.snapshot.spools ?? []).slice(0, 30),
  }

  const userMessage = `
Project: ${input.project_name ?? input.project_id}
Query: ${input.twin_query}

Project Status Snapshot:
${JSON.stringify(snapshot, null, 2)}
${input.snapshot.lines && input.snapshot.lines.length > 20 ? `\n[Note: ${input.snapshot.lines.length - 20} additional lines not shown]` : ''}
${input.snapshot.spools && input.snapshot.spools.length > 30 ? `[Note: ${input.snapshot.spools.length - 30} additional spools not shown]` : ''}

${contextBlock}Answer the query based on this data. Return valid JSON only.`.trim()

  const completion = await openai.chat.completions.create({
    model:       MODELS.COMPLETION,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature:     0.1,
    max_tokens:      1200,
    response_format: { type: 'json_object' },
  })

  const raw        = completion.choices[0]?.message?.content ?? '{}'
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs  = Date.now() - startTime

  let parsed: Partial<DigitalTwinOutput> = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { answer: raw } }

  return {
    data: {
      answer:          parsed.answer          ?? 'Unable to query digital twin.',
      system_status:   parsed.system_status   ?? [],
      readiness_flags: parsed.readiness_flags ?? [],
      open_items:      parsed.open_items      ?? [],
      knowledge_refs:  matchedChunks.map(c => ({
        title:      c.title,
        similarity: c.similarity,
      })),
    },
    tokensUsed,
    latencyMs,
    model: MODELS.COMPLETION,
  }
}

export const digitalTwinAdapter: CapabilityAdapter<DigitalTwinInput, DigitalTwinOutput> = {
  descriptor: DESCRIPTOR,
  invoke,
}
