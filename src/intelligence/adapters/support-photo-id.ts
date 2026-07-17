// Support Photo-ID adapter — routes through the Intelligence Engine.
// Input: base64 image + catalog subset (id, name, visual_description only)
// Output: strict schema — component_type_id, confidence, visual_indicators, status
// ADVISORY ONLY — never an engineering determination.

import OpenAI from 'openai'
import { z } from 'zod'
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '@/intelligence/types'

// Strict response schema — unknown fields REJECTED (strict mode)
export const SupportPhotoResponseSchema = z.object({
  component_type_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  visual_indicators: z.array(z.string()).max(10),
  status: z.enum(['MATCH', 'UNIDENTIFIED']),
}).strict()  // .strict() rejects unknown fields

export type SupportPhotoResponse = z.infer<typeof SupportPhotoResponseSchema>

export interface SupportPhotoInput {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  catalog: { id: string; name: string; visual_description: string | null }[]
}

// ── Descriptor ────────────────────────────────────────────────
const DESCRIPTOR: CapabilityDescriptor = {
  name:          'support-photo-id',
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
  _ctx: InvocationContext,
  input: SupportPhotoInput,
): Promise<AdapterResult<SupportPhotoResponse>> {
  const startTime = Date.now()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const catalogText = input.catalog
    .map(c => `- ID: ${c.id} | Name: ${c.name}${c.visual_description ? ` | Visual: ${c.visual_description}` : ''}`)
    .join('\n')

  const systemPrompt = `You are a pipe support component identification assistant.
You must identify which pipe support component type is shown in the photo.
You may ONLY choose from the provided catalog. If uncertain or the component is not in the catalog, return UNIDENTIFIED.

CATALOG:
${catalogText}

RULES:
- Respond with ONLY valid JSON. No markdown, no explanation, no extra fields.
- Schema: { "component_type_id": string|null, "confidence": number, "visual_indicators": string[], "status": "MATCH"|"UNIDENTIFIED" }
- component_type_id must be one of the catalog IDs above, or null for UNIDENTIFIED
- confidence: 0.0 to 1.0
- visual_indicators: up to 5 brief strings describing what you visually observed
- status: "MATCH" only if confidence >= 0.6, otherwise "UNIDENTIFIED"
- Do NOT include load ratings, material specs, compliance codes, or any engineering values
- This is advisory pre-identification only — never an engineering determination`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 256,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
              detail: 'high',
            },
          },
          { type: 'text', text: 'Identify the pipe support component shown. Respond with JSON only.' },
        ],
      },
    ],
  })

  const tokensUsed = response.usage?.total_tokens ?? 0
  const raw = response.choices[0]?.message?.content?.trim() ?? ''

  // Parse JSON — reject on any parse failure
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`VALIDATION_FAILURE: model returned non-JSON: ${raw.slice(0, 100)}`)
  }

  // Strict schema validation — unknown fields rejected
  const validated = SupportPhotoResponseSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`VALIDATION_FAILURE: ${validated.error.message}`)
  }

  let result = validated.data

  // Confidence gate: < 0.6 always coerces to UNIDENTIFIED
  if (result.confidence < 0.6) {
    result = { ...result, status: 'UNIDENTIFIED', component_type_id: null }
  }

  // CATALOG_ESCAPE guard: component_type_id must be in the provided catalog
  if (result.status === 'MATCH' && result.component_type_id !== null) {
    const validIds = new Set(input.catalog.map(c => c.id))
    if (!validIds.has(result.component_type_id)) {
      throw new Error(`CATALOG_ESCAPE: model returned id not in catalog: ${result.component_type_id}`)
    }
  }

  return {
    data: result,
    tokensUsed,
    latencyMs: Date.now() - startTime,
    model: 'gpt-4o',
  }
}

export const supportPhotoIdAdapter: CapabilityAdapter<SupportPhotoInput, SupportPhotoResponse> = {
  descriptor: DESCRIPTOR,
  invoke,
}
