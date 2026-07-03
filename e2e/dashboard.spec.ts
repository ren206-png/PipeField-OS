import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page)
})

test('dashboard loads', async ({ page }) => {
  await expect(page).toHaveURL(/dashboard/, { timeout: 5000 })
})

test('navigation links are visible', async ({ page }) => {
  await expect(page.getByRole('link', { name: /project/i }).first()).toBeVisible({ timeout: 3000 })
})
