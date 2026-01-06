import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: 'dot',
  expect: { timeout: 4000 },
  timeout: 8000,
  globalTimeout: 300000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:8000',
    screenshot: 'off',
    trace: 'retain-on-failure',
    video: 'off',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
});
