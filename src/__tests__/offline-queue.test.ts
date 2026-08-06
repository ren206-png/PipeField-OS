// ============================================================
// Phase 4 — Offline Queue: Adversarial & Edge Case Tests
//
// Covers:
//   - TTL purge (expired vs fresh items)
//   - markSynced / markFailed / markPending routing by entity type
//   - attempt_count increments on markFailed
//   - clearSynced removes only synced items across all stores
//   - getAllQueueItems returns all stores sorted by created_at desc
//   - getPendingCount returns accurate per-entity breakdown
//   - QUEUE_TTL_MS constant is 30 days
// ============================================================

// ── Mock `idb` before any imports ────────────────────────────
// We build an in-memory store that mirrors the IndexedDB API
// surface used by offline-queue.ts.

type StoreName = 'weld_queue' | 'daily_report_queue' | 'spool_queue'
type IndexName = 'by-sync-status' | 'by-project'

interface MockStore {
  [key: string]: Record<string, unknown>
}

// Module-level in-memory DB shared across calls
const _stores: Record<StoreName, MockStore> = {
  weld_queue:          {},
  daily_report_queue:  {},
  spool_queue:         {},
}

function resetStores() {
  for (const k of Object.keys(_stores) as StoreName[]) {
    _stores[k] = {}
  }
}

function getIndex(store: StoreName, index: IndexName, value: string): Record<string, unknown>[] {
  const field = index === 'by-sync-status' ? 'sync_status' : 'project_id'
  return Object.values(_stores[store]).filter(i => i[field] === value)
}

// Build a mock transaction
function makeTx(storeName: StoreName) {
  let _resolve: () => void
  const done = new Promise<void>(r => { _resolve = r })
  const store = {
    get: jest.fn(async (key: string) => _stores[storeName][key] ?? undefined),
    put: jest.fn(async (item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    }),
    delete: jest.fn(async (key: string) => { delete _stores[storeName][key] }),
  }
  // Resolve done synchronously after each operation
  store.put.mockImplementation(async (item: Record<string, unknown>) => {
    _stores[storeName][item['local_id'] as string] = item
    _resolve()
  })
  store.get.mockImplementation(async (key: string) => {
    const v = _stores[storeName][key]
    _resolve()
    return v ?? undefined
  })
  return { store, done }
}

// Build the mock DB object returned by openDB
function buildMockDB() {
  return {
    put: jest.fn(async (storeName: StoreName, item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    }),
    get: jest.fn(async (storeName: StoreName, key: string) => {
      return _stores[storeName][key] ?? undefined
    }),
    getAll: jest.fn(async (storeName: StoreName) => {
      return Object.values(_stores[storeName])
    }),
    getAllFromIndex: jest.fn(async (storeName: StoreName, indexName: IndexName, value: string) => {
      return getIndex(storeName, indexName, value)
    }),
    delete: jest.fn(async (storeName: StoreName, key: string) => {
      delete _stores[storeName][key]
    }),
    transaction: jest.fn((storeName: StoreName) => {
      const tx = makeTx(storeName)
      return tx
    }),
  }
}

let _mockDB: ReturnType<typeof buildMockDB>

jest.mock('idb', () => ({
  openDB: jest.fn(async () => _mockDB),
}))

// Helper: set transaction mock without TS complaining about Mock vs plain fn
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setTxMock(impl: (storeName: StoreName) => { store: { get: any; put: any; delete: any }; done: Promise<void> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(_mockDB.transaction as any).mockImplementation(impl)
}

// ── Reset DB state and module cache between tests ─────────────
beforeEach(() => {
  resetStores()
  _mockDB = buildMockDB()
  // Clear the module-level dbPromise so each test gets a fresh db
  jest.resetModules()
})

// ── Helpers ───────────────────────────────────────────────────
function makeItem(
  overrides: Partial<{
    local_id: string
    project_id: string
    sync_status: string
    attempt_count: number
    created_at: string
    entity_type: string
    payload: Record<string, unknown>
  }> = {}
): Record<string, unknown> {
  return {
    local_id:      overrides.local_id      ?? 'test-id-' + Math.random(),
    project_id:    overrides.project_id    ?? 'proj-001',
    sync_status:   overrides.sync_status   ?? 'pending',
    attempt_count: overrides.attempt_count ?? 0,
    created_at:    overrides.created_at    ?? new Date().toISOString(),
    entity_type:   overrides.entity_type   ?? 'weld',
    payload:       overrides.payload       ?? {},
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe('QUEUE_TTL_MS', () => {
  test('is exactly 30 days in milliseconds', async () => {
    const { QUEUE_TTL_MS } = await import('@/lib/offline-queue')
    expect(QUEUE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

describe('purgeExpired()', () => {
  test('removes items older than 30 days from all stores', async () => {
    const { purgeExpired } = await import('@/lib/offline-queue')

    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const fresh            = new Date().toISOString()

    _stores.weld_queue['expired-weld']          = makeItem({ local_id: 'expired-weld',   created_at: thirtyOneDaysAgo })
    _stores.daily_report_queue['expired-dr']    = makeItem({ local_id: 'expired-dr',     created_at: thirtyOneDaysAgo })
    _stores.spool_queue['expired-spool']        = makeItem({ local_id: 'expired-spool',  created_at: thirtyOneDaysAgo })
    _stores.weld_queue['fresh-weld']            = makeItem({ local_id: 'fresh-weld',     created_at: fresh })

    const purged = await purgeExpired()

    expect(purged).toBe(3)
    expect(_stores.weld_queue['expired-weld']).toBeUndefined()
    expect(_stores.daily_report_queue['expired-dr']).toBeUndefined()
    expect(_stores.spool_queue['expired-spool']).toBeUndefined()
    // Fresh item untouched
    expect(_stores.weld_queue['fresh-weld']).toBeDefined()
  })

  test('returns 0 when no expired items exist', async () => {
    const { purgeExpired } = await import('@/lib/offline-queue')
    _stores.weld_queue['w1'] = makeItem({ local_id: 'w1', created_at: new Date().toISOString() })
    const purged = await purgeExpired()
    expect(purged).toBe(0)
    expect(_stores.weld_queue['w1']).toBeDefined()
  })

  test('does not purge items exactly at TTL boundary (must be strictly older)', async () => {
    const { purgeExpired, QUEUE_TTL_MS } = await import('@/lib/offline-queue')
    // 1 ms inside TTL — should NOT be purged
    const justFresh = new Date(Date.now() - QUEUE_TTL_MS + 1).toISOString()
    _stores.weld_queue['boundary'] = makeItem({ local_id: 'boundary', created_at: justFresh })
    const purged = await purgeExpired()
    expect(purged).toBe(0)
  })
})

describe('markSynced()', () => {
  test('updates status to synced in the correct store', async () => {
    const { markSynced } = await import('@/lib/offline-queue')
    const item = makeItem({ local_id: 'dr-001', entity_type: 'daily_report', sync_status: 'pending' })
    _stores.daily_report_queue['dr-001'] = item

    // makeTx mock: need to inject proper transaction behavior
    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => { const v = inner[key]; return v },
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markSynced('dr-001', 'daily_report')
    const updated = _stores.daily_report_queue['dr-001']
    expect(updated?.sync_status).toBe('synced')
    expect(updated?.synced_at).toBeDefined()
  })

  test('does not touch weld_queue when entityType is spool', async () => {
    const { markSynced } = await import('@/lib/offline-queue')
    const spool = makeItem({ local_id: 'spool-001', entity_type: 'spool', sync_status: 'pending' })
    _stores.spool_queue['spool-001'] = spool

    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => inner[key],
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markSynced('spool-001', 'spool')
    expect(_stores.spool_queue['spool-001']?.sync_status).toBe('synced')
    expect(Object.values(_stores.weld_queue)).toHaveLength(0)
  })
})

describe('markFailed()', () => {
  test('increments attempt_count and sets sync_error', async () => {
    const { markFailed } = await import('@/lib/offline-queue')
    const item = makeItem({ local_id: 'w-fail', entity_type: 'weld', sync_status: 'pending', attempt_count: 1 })
    _stores.weld_queue['w-fail'] = item

    _mockDB.get.mockImplementation(async (_store: StoreName, key: string) => _stores.weld_queue[key])
    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => inner[key],
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markFailed('w-fail', 'HTTP 500', 'weld')
    const updated = _stores.weld_queue['w-fail']
    expect(updated?.sync_status).toBe('failed')
    expect(updated?.sync_error).toBe('HTTP 500')
    expect(updated?.attempt_count).toBe(2)
  })

  test('routes to daily_report_queue not weld_queue', async () => {
    const { markFailed } = await import('@/lib/offline-queue')
    const item = makeItem({ local_id: 'dr-fail', entity_type: 'daily_report', sync_status: 'pending', attempt_count: 0 })
    _stores.daily_report_queue['dr-fail'] = item

    _mockDB.get.mockImplementation(async (storeName: StoreName, key: string) => _stores[storeName]?.[key])
    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => inner[key],
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markFailed('dr-fail', 'Validation error', 'daily_report')
    expect(_stores.daily_report_queue['dr-fail']?.sync_status).toBe('failed')
    expect(_stores.weld_queue['dr-fail']).toBeUndefined()
  })
})

describe('markPending()', () => {
  test('resets status to pending and clears sync_error', async () => {
    const { markPending } = await import('@/lib/offline-queue')
    const item = makeItem({ local_id: 'spool-retry', entity_type: 'spool', sync_status: 'failed', attempt_count: 1 })
    ;(item as Record<string, unknown>)['sync_error'] = 'Network error'
    _stores.spool_queue['spool-retry'] = item

    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => inner[key],
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markPending('spool-retry', 'spool')
    const updated = _stores.spool_queue['spool-retry']
    expect(updated?.sync_status).toBe('pending')
    expect(updated?.sync_error).toBeUndefined()
  })
})

describe('clearSynced()', () => {
  test('removes synced items from all three stores', async () => {
    const { clearSynced } = await import('@/lib/offline-queue')

    _stores.weld_queue['w-synced']           = makeItem({ local_id: 'w-synced',  sync_status: 'synced' })
    _stores.weld_queue['w-pending']          = makeItem({ local_id: 'w-pending', sync_status: 'pending' })
    _stores.daily_report_queue['dr-synced']  = makeItem({ local_id: 'dr-synced', sync_status: 'synced' })
    _stores.spool_queue['sp-synced']         = makeItem({ local_id: 'sp-synced', sync_status: 'synced' })
    _stores.spool_queue['sp-failed']         = makeItem({ local_id: 'sp-failed', sync_status: 'failed' })

    _mockDB.getAllFromIndex.mockImplementation(async (storeName: StoreName, _idx: IndexName, value: string) => {
      return getIndex(storeName, 'by-sync-status', value)
    })
    _mockDB.delete.mockImplementation(async (storeName: StoreName, key: string) => {
      delete _stores[storeName][key]
    })

    const count = await clearSynced()

    expect(count).toBe(3)
    expect(_stores.weld_queue['w-synced']).toBeUndefined()
    expect(_stores.daily_report_queue['dr-synced']).toBeUndefined()
    expect(_stores.spool_queue['sp-synced']).toBeUndefined()
    // Non-synced items untouched
    expect(_stores.weld_queue['w-pending']).toBeDefined()
    expect(_stores.spool_queue['sp-failed']).toBeDefined()
  })

  test('returns 0 when no synced items exist', async () => {
    const { clearSynced } = await import('@/lib/offline-queue')
    _stores.weld_queue['w1'] = makeItem({ local_id: 'w1', sync_status: 'pending' })

    _mockDB.getAllFromIndex.mockImplementation(async (storeName: StoreName, _idx: IndexName, value: string) => {
      return getIndex(storeName, 'by-sync-status', value)
    })
    _mockDB.delete.mockImplementation(async (storeName: StoreName, key: string) => {
      delete _stores[storeName][key]
    })

    const count = await clearSynced()
    expect(count).toBe(0)
  })
})

describe('getAllQueueItems()', () => {
  test('returns items from all three stores sorted by created_at descending', async () => {
    const { getAllQueueItems } = await import('@/lib/offline-queue')

    const t1 = new Date(1000).toISOString()
    const t2 = new Date(2000).toISOString()
    const t3 = new Date(3000).toISOString()

    _stores.weld_queue['w1']          = makeItem({ local_id: 'w1', created_at: t1 })
    _stores.daily_report_queue['dr1'] = makeItem({ local_id: 'dr1', created_at: t3 })
    _stores.spool_queue['sp1']        = makeItem({ local_id: 'sp1', created_at: t2 })

    _mockDB.getAll.mockImplementation(async (storeName: StoreName) => Object.values(_stores[storeName]))

    const items = await getAllQueueItems()
    expect(items).toHaveLength(3)
    expect(items[0].local_id).toBe('dr1')  // newest first
    expect(items[1].local_id).toBe('sp1')
    expect(items[2].local_id).toBe('w1')   // oldest last
  })

  test('returns empty array when all stores are empty', async () => {
    const { getAllQueueItems } = await import('@/lib/offline-queue')
    _mockDB.getAll.mockResolvedValue([])
    const items = await getAllQueueItems()
    expect(items).toHaveLength(0)
  })
})

describe('getPendingCount()', () => {
  test('returns accurate per-entity pending counts', async () => {
    const { getPendingCount } = await import('@/lib/offline-queue')

    _stores.weld_queue['w1']          = makeItem({ local_id: 'w1',  sync_status: 'pending' })
    _stores.weld_queue['w2']          = makeItem({ local_id: 'w2',  sync_status: 'synced' })
    _stores.daily_report_queue['dr1'] = makeItem({ local_id: 'dr1', sync_status: 'pending' })
    _stores.daily_report_queue['dr2'] = makeItem({ local_id: 'dr2', sync_status: 'pending' })
    _stores.spool_queue['sp1']        = makeItem({ local_id: 'sp1', sync_status: 'failed' })

    _mockDB.getAllFromIndex.mockImplementation(async (storeName: StoreName, _idx: IndexName, value: string) => {
      return getIndex(storeName, 'by-sync-status', value)
    })

    const counts = await getPendingCount()
    expect(counts.welds).toBe(1)
    expect(counts.daily_reports).toBe(2)
    expect(counts.spools).toBe(0)
    expect(counts.total).toBe(3)
  })
})

describe('enqueueWeld / enqueueDailyReport / enqueueSpool', () => {
  test('enqueueWeld writes to weld_queue with pending status and attempt_count 0', async () => {
    const { enqueueWeld } = await import('@/lib/offline-queue')
    _mockDB.put.mockImplementation(async (storeName: StoreName, item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    })

    const id = await enqueueWeld('proj-xyz', { weld_id_number: 'W-001' })
    expect(id).toBeDefined()
    const stored = _stores.weld_queue[id]
    expect(stored?.sync_status).toBe('pending')
    expect(stored?.attempt_count).toBe(0)
    expect(stored?.entity_type).toBe('weld')
    expect(stored?.project_id).toBe('proj-xyz')
  })

  test('enqueueDailyReport writes to daily_report_queue', async () => {
    const { enqueueDailyReport } = await import('@/lib/offline-queue')
    _mockDB.put.mockImplementation(async (storeName: StoreName, item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    })

    const id = await enqueueDailyReport('proj-abc', { report_date: '2026-07-14' })
    const stored = _stores.daily_report_queue[id]
    expect(stored?.entity_type).toBe('daily_report')
    expect(stored?.sync_status).toBe('pending')
  })

  test('enqueueSpool writes to spool_queue', async () => {
    const { enqueueSpool } = await import('@/lib/offline-queue')
    _mockDB.put.mockImplementation(async (storeName: StoreName, item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    })

    const id = await enqueueSpool('proj-abc', { spool_number: 'SP-007' })
    const stored = _stores.spool_queue[id]
    expect(stored?.entity_type).toBe('spool')
    expect(stored?.sync_status).toBe('pending')
  })

  test('each enqueue call produces a unique local_id', async () => {
    const { enqueueWeld } = await import('@/lib/offline-queue')
    _mockDB.put.mockImplementation(async (storeName: StoreName, item: Record<string, unknown>) => {
      _stores[storeName][item['local_id'] as string] = item
    })

    const id1 = await enqueueWeld('proj-1', {})
    const id2 = await enqueueWeld('proj-1', {})
    expect(id1).not.toBe(id2)
  })
})

describe('attempt_count exhaustion boundary', () => {
  test('attempt_count starts at 0 and increments on each markFailed', async () => {
    const { markFailed } = await import('@/lib/offline-queue')
    const item = makeItem({ local_id: 'retry-me', entity_type: 'weld', attempt_count: 0 })
    _stores.weld_queue['retry-me'] = item

    const patchedGet = jest.fn(async (storeName: StoreName, key: string) => _stores[storeName]?.[key])
    _mockDB.get = patchedGet
    setTxMock((storeName: StoreName) => {
      const inner = _stores[storeName]
      let _res: () => void
      const done = new Promise<void>(r => { _res = r })
      const store = {
        get:    async (key: string) => inner[key],
        put:    async (val: Record<string, unknown>) => { inner[val['local_id'] as string] = val; _res() },
        delete: async (key: string) => { delete inner[key] },
      }
      return { store, done }
    })

    await markFailed('retry-me', 'err1', 'weld')
    expect(_stores.weld_queue['retry-me']?.attempt_count).toBe(1)

    await markFailed('retry-me', 'err2', 'weld')
    expect(_stores.weld_queue['retry-me']?.attempt_count).toBe(2)

    await markFailed('retry-me', 'err3', 'weld')
    expect(_stores.weld_queue['retry-me']?.attempt_count).toBe(3)
  })
})
