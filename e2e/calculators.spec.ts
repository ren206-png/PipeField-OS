import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page)
})

test('calculators page loads', async ({ page }) => {
  await page.goto('/dashboard/calculators')
  await expect(page.getByText(/calculator/i).first()).toBeVisible({ timeout: 5000 })
})
