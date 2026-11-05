import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'html',
  // Run against the user's installed Google Chrome instead of Playwright's bundled Chromium.
  // Playwright still creates an isolated temporary profile for each test run.
  use: { browserName: 'chromium', channel: 'chrome' },
})
