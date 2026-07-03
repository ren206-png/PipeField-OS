import { Page } from '@playwright/test'

export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL ?? '')
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD ?? '')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 10000 })
}
