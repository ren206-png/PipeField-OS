import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page)
})

test('projects page loads', async ({ page }) => {
  await page.goto('/dashboard/projects')
  await expect(page.getByText(/project/i).first()).toBeVisible({ timeout: 5000 })
})

test('can open a project if one exists', async ({ page }) => {
  await page.goto('/dashboard/projects')
  const projectLink = page.locator('a[href*="/projects/"]').first()
  if (await projectLink.count() > 0) {
    await projectLink.click()
    await expect(page).toHaveURL(/\/projects\//, { timeout: 5000 })
  }
})
