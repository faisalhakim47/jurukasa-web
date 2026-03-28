import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupDashboardView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/dashboard');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <dashboard-view></dashboard-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Dashboard View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view dashboard page with header and loading state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Dashboard' }), 'it shall display Dashboard page heading').toBeVisible();
  });

  test('view financial metric cards', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Net Revenue' }), 'it shall display Net Revenue metric card').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cash Balance' }), 'it shall display Cash Balance metric card').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bank Balance' }), 'it shall display Bank Balance metric card').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accounts Payable' }), 'it shall display Accounts Payable metric card').toBeVisible();
    await expect(page.getByRole('region', { name: 'Financial Metrics' }), 'it shall display Financial Metrics region').toBeVisible();
  });

  test('view fiscal year card with empty state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Fiscal Year' }), 'it shall display Fiscal Year card heading').toBeVisible();
    await expect(page.getByText('No active fiscal year'), 'it shall display no active fiscal year message').toBeVisible();
  });

  test('view stock alerts card with well stocked state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Stock Alerts' }), 'it shall display Stock Alerts card heading').toBeVisible();
    await expect(page.getByText('All items are well stocked'), 'it shall display well stocked message').toBeVisible();
  });

  test('view recent sales card with empty state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Recent Sales' }), 'it shall display Recent Sales card heading').toBeVisible();
    await expect(page.getByText('No sales recorded yet'), 'it shall display no sales recorded message').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Sale' }), 'it shall display New Sale button in empty state').toBeVisible();
  });
});
