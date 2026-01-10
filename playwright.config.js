import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __pathname = fileURLToPath(import.meta.url);
const __dirname = dirname(__pathname);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: 'dot',
  expect: { timeout: 4000 },
  timeout: 8000,
  globalTimeout: 300000,
  globalSetup: join(__dirname, './test/global-setup.js'),
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
  ],
  use: {
    baseURL: 'http://localhost:8000',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
});
