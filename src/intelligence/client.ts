// ============================================================
// Intelligence Engine — Shared OpenAI Client
//
// Single factory used by all adapters. Never create OpenAI
// instances outside this module. This ensures one place to
// change provider, model versions, or timeout defaults.
// ============================================================
import OpenAI from 'openai'

// Lazy singleton — created on first use, reused across requests
// within the same serverless function instance.
let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[Intelligence Engine] OPENAI_API_KEY is not set. ' +
      'Add it to .env.local — see .env.local.example.'
    )
  }
  _client = new OpenAI({ apiKey })
  return _client
}

// ── Model constants ──────────────────────────────────────────
// Change model versions in ONE place when upgrading.
export const MODELS = {
  EMBEDDING:   'text-embedding-3-small',
  COMPLETION:  'gpt-4o-mini',
  VISION:      'gpt-4o',           // Full GPT-4o required for image/drawing analysis
} as const

export type ModelName = typeof MODELS[keyof typeof MODELS]
