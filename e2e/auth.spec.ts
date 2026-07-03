import { test, expect } from '@playwright/test'

test('landing page loads with dual audience content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/pipefitter/i).first()).toBeVisible({ timeout: 5000 })
})

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('form').or(page.getByRole('main'))).toBeVisible({ timeout: 5000 })
})

test('unauthenticated redirect to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/, { timeout: 5000 })
})
