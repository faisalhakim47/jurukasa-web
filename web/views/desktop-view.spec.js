import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/hooks/use-strict.js';
const { describe } = test;

describe('Desktop View', function () {
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

  describe('Navigation Rail', function () {
    useStrict(test);
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display main navigation', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('navigation', { name: 'Main Navigation' })).toBeVisible();
    });

    test('shall display Dashboard navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Dash' }).first()).toBeVisible();
    });

    test('shall display Books navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Books' }).first()).toBeVisible();
    });

    test('shall display Stock navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Stock' }).first()).toBeVisible();
    });

    test('shall display Procure navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Procure' }).first()).toBeVisible();
    });

    test('shall display Sale navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Sale' }).first()).toBeVisible();
    });

    test('shall display Settings navigation link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav.getByRole('link', { name: 'Settings' }).first()).toBeVisible();
    });
  });

  describe('Navigation Behavior', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall navigate to Books when clicking Books link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Books' }).first().click();

      await expect(page.getByRole('heading', { name: 'Accounting' })).toBeVisible();
    });

    test('shall navigate to Stock when clicking Stock link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Stock' }).first().click();

      await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    });

    test('shall navigate to Procure when clicking Procure link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Procure' }).first().click();

      await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible();
    });

    test('shall navigate to Sale when clicking Sale link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Sale' }).first().click();

      await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();
    });

    test('shall navigate to Settings when clicking Settings link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first().click();

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });

    test('shall navigate back to Dashboard when clicking Dashboard link', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      // Navigate away from dashboard first
      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first().click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      // Navigate back to dashboard
      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Dash' }).first().click();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Active Navigation Indicator', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall mark Dashboard link as active when on dashboard', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const dashboardLink = page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Dash' }).first();
      await expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });

    test('shall mark Books link as active when on books page', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Books' }).first().click();
      await expect(page.getByRole('heading', { name: 'Accounting' })).toBeVisible();

      const booksLink = page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Books' }).first();
      await expect(booksLink).toHaveClass(/active/);
    });

    test('shall mark Settings link as active when on settings page', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first().click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      const settingsLink = page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first();
      await expect(settingsLink).toHaveClass(/active/);
    });
  });

  describe('Layout Structure', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display navigation rail on the side', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      const nav = page.getByRole('navigation', { name: 'Main Navigation' });
      await expect(nav).toBeVisible();
    });

    test('shall display main content area', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      // Dashboard should be visible in main content
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Initial Route Handling', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall redirect from root to dashboard', async function ({ page }) {
      await setupDatabaseAndNavigateToDashboard(page, tursoLibSQLiteServer().url);

      // Should land on dashboard
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
