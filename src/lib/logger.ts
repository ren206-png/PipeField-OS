// ============================================================
// logger.ts — Structured JSON logger for PipeField OS
//
// Emits newline-delimited JSON to stdout so Vercel Log Drains,
// Datadog, Axiom, Logtail, etc. can ingest and index fields.
//
// In development it pretty-prints so the terminal stays readable.
//
// Usage:
//   import { logger } from '@/lib/logger'
//
//   logger.info('weld.created', { weld_id, org_id })
//   logger.warn('rate_limit.exceeded', { key, limit })
//   logger.error('upload.failed', err, { org_id, file_name })
// ============================================================

type Level = 'debug' | 'info' | 'warn' | 'error'

const IS_DEV = process.env.NODE_ENV !== 'production'

// Map level → numeric priority for filtering
const LEVEL_NUM: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN_LEVEL: number = IS_DEV ? LEVEL_NUM.debug : LEVEL_NUM.info

function emit(level: Level, event: string, context?: Record<string, unknown>, err?: unknown) {
  if (LEVEL_NUM[level] < MIN_LEVEL) return

  const entry: Record<string, unknown> = {
    level,
    event,
    timestamp: new Date().toISOString(),
    service:   'pipefield-os',
    env:       process.env.NODE_ENV ?? 'unknown',
    ...context,
  }

  if (err instanceof Error) {
    entry.error   = err.message
    entry.stack   = IS_DEV ? err.stack : undefined
    entry.errName = err.name
  } else if (err !== undefined) {
    entry.error = String(err)
  }

  if (IS_DEV) {
    // Pretty-print for local dev
    const color: Record<Level, string> = {
      debug: '\x1b[90m',   // grey
      info:  '\x1b[36m',   // cyan
      warn:  '\x1b[33m',   // yellow
      error: '\x1b[31m',   // red
    }
    const reset = '\x1b[0m'
    const { timestamp, ...rest } = entry
    const meta = Object.entries(rest)
      .filter(([k]) => k !== 'level' && k !== 'event' && k !== 'service' && k !== 'env')
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ')
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    method(`${color[level]}[${level.toUpperCase()}]${reset} ${timestamp} ${event}${meta ? ' ' + meta : ''}`)
  } else {
    // Structured JSON — one line per log entry
    process.stdout.write(JSON.stringify(entry) + '\n')
  }
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) =>
    emit('debug', event, context),

  info: (event: string, context?: Record<string, unknown>) =>
    emit('info', event, context),

  warn: (event: string, context?: Record<string, unknown>) =>
    emit('warn', event, context),

  /** Pass the caught error as the second argument for automatic stack capture */
  error: (event: string, err?: unknown, context?: Record<string, unknown>) =>
    emit('error', event, context, err),
}
