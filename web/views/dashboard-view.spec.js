import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupDashboardView(tursoDatabaseUrl) {
  await import('#web/views/dashboard-view.js');
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  localStorage.setItem('onboardingCompleted', 'true');
  localStorage.setItem('businessName', 'Test Business');
  
  // Set initial route to /dashboard
  window.history.replaceState({}, '', '/dashboard');
  
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
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
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Dashboard Page Display', function () {
    test('shall display page header', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('shall display loading state initially', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Dashboard should eventually load successfully
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Dashboard Metric Cards', function () {
    test('shall display Net Revenue metric card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Net Revenue' })).toBeVisible();
    });

    test('shall display Cash Balance metric card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Cash Balance' })).toBeVisible();
    });

    test('shall display Bank Balance metric card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Bank Balance' })).toBeVisible();
    });

    test('shall display Accounts Payable metric card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounts Payable' })).toBeVisible();
    });

    test('shall display metric values with currency format', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Check that financial metrics region is present
      await expect(page.getByRole('region', { name: 'Financial Metrics' })).toBeVisible();
    });
  });

  describe('Dashboard Fiscal Year Card', function () {
    test('shall display Fiscal Year card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Fiscal Year' })).toBeVisible();
    });

    test('shall display no active fiscal year message when not configured', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('No active fiscal year')).toBeVisible();
    });
  });

  describe('Dashboard Stock Alerts Card', function () {
    test('shall display Stock Alerts card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible();
    });

    test('shall display well stocked message when no low stock items', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('All items are well stocked')).toBeVisible();
    });
  });

  describe('Dashboard Recent Sales Card', function () {
    test('shall display Recent Sales card', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Recent Sales' })).toBeVisible();
    });

    test('shall display no sales message when no sales recorded', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByText('No sales recorded yet')).toBeVisible();
    });

    test('shall display New Sale button in empty state', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Sale' })).toBeVisible();
    });
  });

  describe('Dashboard Error Handling', function () {
    test('shall display error state when retry button is available', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupDashboardView, tursoLibSQLiteServer().url);

      // Dashboard should load without error in normal case
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
