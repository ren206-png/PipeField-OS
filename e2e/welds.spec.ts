import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page)
})

test('welds page loads', async ({ page }) => {
  await page.goto('/dashboard/welds')
  await expect(page.getByText(/weld/i).first()).toBeVisible({ timeout: 5000 })
})
