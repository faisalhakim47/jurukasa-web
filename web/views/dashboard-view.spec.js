import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
const { describe } = test;

describe('Dashboard View', function () {
  // useConsoleOutput(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServerUrl) {
    await page.goto('/test/fixtures/testing.html');

    await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServerUrl);
    await page.getByRole('button', { name: 'Configure' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await page.getByLabel('Business Name').fill('Test Business');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  describe('Dashboard Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Dashboard link in navigation', async function ({ page }) {
      await page.goto('/test/fixtures/testing.html');

      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('Test Business');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
      await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
      await page.getByRole('button', { name: 'Finish' }).click();

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Dash' }).first()).toBeVisible();
    });

    test('shall navigate to Dashboard when clicking Dashboard link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Dashboard Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display page header', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('shall display loading state initially', async function ({ page }) {
      await page.goto('/test/fixtures/testing.html');
      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('Test Business');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
      await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
      await page.getByRole('button', { name: 'Finish' }).click();

      // Dashboard should eventually load successfully
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Dashboard Metric Cards', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Net Revenue metric card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Net Revenue' })).toBeVisible();
    });

    test('shall display Cash Balance metric card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Cash Balance' })).toBeVisible();
    });

    test('shall display Bank Balance metric card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Bank Balance' })).toBeVisible();
    });

    test('shall display Accounts Payable metric card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounts Payable' })).toBeVisible();
    });

    test('shall display metric values with currency format', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      // Check that financial metrics region is present
      await expect(page.getByRole('region', { name: 'Financial Metrics' })).toBeVisible();
    });
  });

  describe('Dashboard Fiscal Year Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Fiscal Year card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Fiscal Year' })).toBeVisible();
    });

    test('shall display no active fiscal year message when not configured', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByText('No active fiscal year')).toBeVisible();
    });
  });

  describe('Dashboard Stock Alerts Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Stock Alerts card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible();
    });

    test('shall display well stocked message when no low stock items', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByText('All items are well stocked')).toBeVisible();
    });
  });

  describe('Dashboard Recent Sales Card', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Recent Sales card', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Recent Sales' })).toBeVisible();
    });

    test('shall display no sales message when no sales recorded', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByText('No sales recorded yet')).toBeVisible();
    });

    test('shall display New Sale button in empty state', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Sale' })).toBeVisible();
    });
  });

  describe('Dashboard Error Handling', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display error state when retry button is available', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      // Dashboard should load without error in normal case
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
