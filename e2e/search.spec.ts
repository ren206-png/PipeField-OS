import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => { await loginAsTestUser(page) })

test('global search opens with keyboard shortcut', async ({ page }) => {
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog').or(page.getByRole('searchbox'))).toBeVisible({ timeout: 3000 })
})

test('escape closes search', async ({ page }) => {
  await page.keyboard.press('Meta+k')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 })
})
