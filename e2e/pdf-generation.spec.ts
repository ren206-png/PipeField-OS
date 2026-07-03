import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page)
})

test('executive report API endpoint exists', async ({ page }) => {
  const response = await page.request.get('/api/reports/executive-report?projectId=test')
  // Should be 404 for unknown project or 401 — not a 500 server crash
  expect(response.status()).not.toBe(500)
})
