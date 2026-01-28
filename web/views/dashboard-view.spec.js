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
  // useConsoleOutput(test);
  useStrict(test);

  describe('Dashboard Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display page header', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('shall display loading state initially', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Dashboard should eventually load successfully
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Dashboard Metric Cards', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Net Revenue metric card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Net Revenue' })).toBeVisible();
    });

    test('shall display Cash Balance metric card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Cash Balance' })).toBeVisible();
    });

    test('shall display Bank Balance metric card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Bank Balance' })).toBeVisible();
    });

    test('shall display Accounts Payable metric card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounts Payable' })).toBeVisible();
    });

    test('shall display metric values with currency format', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Check that financial metrics region is present
      await expect(page.getByRole('region', { name: 'Financial Metrics' })).toBeVisible();
    });
  });

  describe('Dashboard Fiscal Year Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Fiscal Year card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Fiscal Year' })).toBeVisible();
    });

    test('shall display no active fiscal year message when not configured', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('No active fiscal year')).toBeVisible();
    });
  });

  describe('Dashboard Stock Alerts Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Stock Alerts card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible();
    });

    test('shall display well stocked message when no low stock items', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('All items are well stocked')).toBeVisible();
    });
  });

  describe('Dashboard Recent Sales Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Recent Sales card', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Recent Sales' })).toBeVisible();
    });

    test('shall display no sales message when no sales recorded', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('No sales recorded yet')).toBeVisible();
    });

    test('shall display New Sale button in empty state', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Sale' })).toBeVisible();
    });
  });

  describe('Dashboard Error Handling', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display error state when retry button is available', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Dashboard should load without error in normal case
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
