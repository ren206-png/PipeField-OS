// ============================================================
// Sprint 7 — ERP Connector Schema & Compliance Status: Unit Tests
//
// Covers:
//   - ERP connector Zod schema validation (valid/invalid inputs)
//   - ERP type enum enforcement
//   - inspection_completion_pct calculation logic
//   - Continuity alert filtering logic
// ============================================================

import { z } from 'zod'

// ── Inline the ERP connector schema (mirrors route) ──

const erpConnectorSchema = z.object({
  erp_type:        z.enum(['MIE_TRAK', 'SYSPRO', 'DIGIT', 'JOBBOSS', 'GENERIC']),
  display_name:    z.string().min(1).optional(),
  erp_host:        z.string().min(1),
  erp_api_url:     z.string().url(),
  erp_api_key:     z.string().min(1),
  auth_method:     z.enum(['API_KEY', 'OAUTH2', 'BASIC']).default('API_KEY'),
  sync_frequency:  z.enum(['HOURLY', 'ON_DEMAND']).default('ON_DEMAND'),
  auto_post_welds: z.boolean().default(false),
})

type ERPConnectorInput = z.infer<typeof erpConnectorSchema>

const validConnector: ERPConnectorInput = {
  erp_type:        'MIE_TRAK',
  display_name:    'MIE Trak Production',
  erp_host:        'mie.example.com',
  erp_api_url:     'https://mie.example.com/api/v2',
  erp_api_key:     'secret-key-abc123',
  auth_method:     'API_KEY',
  sync_frequency:  'ON_DEMAND',
  auto_post_welds: false,
}

describe('ERP connector schema — valid inputs', () => {
  test('accepts a complete valid connector', () => {
    const result = erpConnectorSchema.safeParse(validConnector)
    expect(result.success).toBe(true)
  })

  test('accepts all valid erp_type values', () => {
    const types = ['MIE_TRAK', 'SYSPRO', 'DIGIT', 'JOBBOSS', 'GENERIC'] as const
    for (const erp_type of types) {
      const result = erpConnectorSchema.safeParse({ ...validConnector, erp_type })
      expect(result.success).toBe(true)
    }
  })

  test('defaults auth_method to API_KEY when omitted', () => {
    const { auth_method: _, ...without } = validConnector
    const result = erpConnectorSchema.safeParse(without)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.auth_method).toBe('API_KEY')
    }
  })

  test('defaults sync_frequency to ON_DEMAND when omitted', () => {
    const { sync_frequency: _, ...without } = validConnector
    const result = erpConnectorSchema.safeParse(without)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sync_frequency).toBe('ON_DEMAND')
    }
  })

  test('defaults auto_post_welds to false when omitted', () => {
    const { auto_post_welds: _, ...without } = validConnector
    const result = erpConnectorSchema.safeParse(without)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.auto_post_welds).toBe(false)
    }
  })

  test('display_name is optional', () => {
    const { display_name: _, ...without } = validConnector
    const result = erpConnectorSchema.safeParse(without)
    expect(result.success).toBe(true)
  })
})

describe('ERP connector schema — invalid inputs', () => {
  test('rejects unknown erp_type', () => {
    const result = erpConnectorSchema.safeParse({ ...validConnector, erp_type: 'SAP' })
    expect(result.success).toBe(false)
  })

  test('rejects invalid erp_api_url (not a URL)', () => {
    const result = erpConnectorSchema.safeParse({ ...validConnector, erp_api_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  test('rejects empty erp_host', () => {
    const result = erpConnectorSchema.safeParse({ ...validConnector, erp_host: '' })
    expect(result.success).toBe(false)
  })

  test('rejects empty erp_api_key', () => {
    const result = erpConnectorSchema.safeParse({ ...validConnector, erp_api_key: '' })
    expect(result.success).toBe(false)
  })

  test('rejects invalid auth_method', () => {
    const result = erpConnectorSchema.safeParse({ ...validConnector, auth_method: 'TOKEN' as never })
    expect(result.success).toBe(false)
  })

  test('rejects missing required fields', () => {
    const result = erpConnectorSchema.safeParse({ erp_type: 'GENERIC' })
    expect(result.success).toBe(false)
  })
})

// ── Inspection completion % logic (mirrors compliance-status route) ──

function calcInspectionCompletionPct(visualInspectedCount: number, totalWelds: number): number {
  if (totalWelds === 0) return 0
  return Math.round((visualInspectedCount / totalWelds) * 100)
}

describe('inspection_completion_pct calculation', () => {
  test('0 welds → 0%', () => {
    expect(calcInspectionCompletionPct(0, 0)).toBe(0)
  })

  test('all welds inspected → 100%', () => {
    expect(calcInspectionCompletionPct(10, 10)).toBe(100)
  })

  test('half inspected → 50%', () => {
    expect(calcInspectionCompletionPct(5, 10)).toBe(50)
  })

  test('rounds correctly (1/3 → 33%)', () => {
    expect(calcInspectionCompletionPct(1, 3)).toBe(33)
  })

  test('rounds correctly (2/3 → 67%)', () => {
    expect(calcInspectionCompletionPct(2, 3)).toBe(67)
  })
})

// ── Continuity alert filtering (mirrors compliance-status route) ──

type ContinuityRow = {
  welder_id: string
  process: string
  position: string
  expires_date: string
  continuity_status: string
}

function filterContinuityAlerts(rows: ContinuityRow[]): ContinuityRow[] {
  return rows.filter((r) =>
    ['CLOSE_TO_EXPIRY', 'EXPIRED'].includes(r.continuity_status)
  )
}

const mockRows: ContinuityRow[] = [
  { welder_id: 'w1', process: 'GMAW', position: '3G', expires_date: '2027-01-01', continuity_status: 'ACTIVE' },
  { welder_id: 'w2', process: 'SMAW', position: '1G', expires_date: '2026-08-30', continuity_status: 'CLOSE_TO_EXPIRY' },
  { welder_id: 'w3', process: 'FCAW', position: '2G', expires_date: '2025-01-01', continuity_status: 'EXPIRED' },
]

describe('continuity alert filtering', () => {
  test('returns only CLOSE_TO_EXPIRY and EXPIRED rows', () => {
    const alerts = filterContinuityAlerts(mockRows)
    expect(alerts).toHaveLength(2)
    expect(alerts.map((a) => a.continuity_status)).not.toContain('ACTIVE')
  })

  test('returns empty array when all ACTIVE', () => {
    const activeOnly = mockRows.filter((r) => r.continuity_status === 'ACTIVE')
    expect(filterContinuityAlerts(activeOnly)).toHaveLength(0)
  })

  test('returns all rows when all are alerts', () => {
    const alertOnly = mockRows.filter((r) => r.continuity_status !== 'ACTIVE')
    expect(filterContinuityAlerts(alertOnly)).toHaveLength(2)
  })

  test('handles empty input', () => {
    expect(filterContinuityAlerts([])).toHaveLength(0)
  })
})
