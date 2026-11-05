// Week 10c: open a page, perform actions, then check what the user sees.
import { test, expect } from '@playwright/test'

test('shows an error when the login details are incorrect', async ({ page }) => {
  await page.goto('http://localhost:5173/login')
  await page.getByRole('textbox', { name: 'Email address' }).fill('missing-user@testing.invalid')
  await page.locator('#login-password').fill('IncorrectPassword123')
  await page.locator('button[type="submit"]').click()

  await expect(page.getByText('Email or password is incorrect.')).toBeVisible()
})

test('logs in, searches for a destination and opens the contributor levels', async ({ page }) => {
  // These are demo credentials already defined in backend/scripts/seedCommunity.js.
  await page.goto('http://localhost:5173/login')
  await page.getByRole('textbox', { name: 'Email address' }).fill('aisha@test.com')
  await page.locator('#login-password').fill('qwertyuiop')
  await page.locator('button[type="submit"]').click()

  await expect(page.getByRole('heading', { name: 'Find parking near your destination' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Destination' }).fill('Suntec')
  // A recent-search button can have the same name; choose the OneMap suggestion.
  await page.getByRole('list', { name: 'Destination suggestions' })
    .getByRole('button', { name: 'SUNTEC CITY', exact: true }).click()
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Nearby carparks', exact: true })).toBeVisible()
  await expect(page.getByText('Updated', { exact: false })).toBeVisible()

  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your reviews', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View contributor levels.', exact: false }).click()

  await expect(page.getByRole('heading', { name: 'Contributor levels', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Contributor level requirements' }).getByText('Community Champion', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close contributor levels', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your reviews', exact: true })).toBeVisible()
})

test('shows an error when registration passwords do not match', async ({ page }) => {
  await page.goto('http://localhost:5173/login')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test Driver')
  await page.getByRole('textbox', { name: 'Email address' }).fill('testing@example.com')
  await page.locator('#register-password').fill('ClassTest123')
  await page.locator('#confirm-password').fill('DifferentPassword123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByText('Passwords do not match.')).toBeVisible()
})
